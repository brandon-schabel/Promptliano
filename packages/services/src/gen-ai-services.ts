import { z } from 'zod'
import {
  type AssistantModelMessage,
  type ModelMessage,
  type StepResult,
  streamText,
  generateText,
  generateObject
} from 'ai'
import { formatDataStreamPart } from '@ai-sdk/ui-utils'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'
import type { LanguageModelV2, LanguageModelV2Usage } from '@ai-sdk/provider'
import { createChatService } from './chat-service'
import { createProviderKeyService } from './provider-key-service'
import { createModelConfigService } from './model-config-service'
import { chatRepository } from '@promptliano/database'
import type { APIProviders, ProviderKey, ModelConfig } from '@promptliano/database'
import { getProvidersConfig } from '@promptliano/config'
import { structuredDataSchemas } from '@promptliano/schemas' // AI generation schemas - may remain in schemas package

import { ApiError } from '@promptliano/shared'
import { mapProviderErrorToApiError } from './error-mappers'
import { ErrorFactory, assertExists } from '@promptliano/shared'
import { retryOperation } from './utils/bulk-operations'
import { getProviderUrl } from './provider-settings-service'
import { LMStudioProvider } from './providers/lmstudio-provider'
import { mergeHeaders } from './utils/header-sanitizer'
import { nullToUndefined } from './utils/file-utils'
import {
  buildExampleJsonStructure,
  createJsonOnlyPrompt,
  extractJsonStringFromResponse
} from './utils/structured-output-helpers'
import { logModelUsage, logModelError, logModelCompletion } from './utils/model-usage-logger'

const providersConfig = getProvidersConfig()

type StreamTextResultType = Awaited<ReturnType<typeof streamText>>

type StreamFinishState = {
  finishReason: string
  usage?: NormalizedUsage
  finalText?: string
  lastToolResultText?: string
  stepsUsage?: unknown[]
}

export interface StreamWithState {
  stream: StreamTextResultType
  finishState: StreamFinishState
}

// AI SDK compatible options type for function parameters
export interface AiSdkCompatibleOptions {
  temperature?: number | null
  maxTokens?: number | null
  topP?: number | null
  frequencyPenalty?: number | null
  presencePenalty?: number | null
  topK?: number | null
  responseFormat?: any | null
  provider?: string | APIProviders
  model?: string
  ollamaUrl?: string
  lmstudioUrl?: string
}

function mapConfigToOptions(config: ModelConfig): AiSdkCompatibleOptions {
  return {
    provider: config.provider,
    model: config.model,
    temperature: nullToUndefined(config.temperature),
    maxTokens: nullToUndefined(config.maxTokens),
    topP: nullToUndefined(config.topP),
    frequencyPenalty: nullToUndefined(config.frequencyPenalty),
    presencePenalty: nullToUndefined(config.presencePenalty),
    topK: nullToUndefined(config.topK),
    responseFormat: nullToUndefined(config.responseFormat)
  }
}

export function createAdHocModelConfig(provider: string, model: string): ModelConfig {
  const normalizedProvider = provider.trim()
  const normalizedModel = model.trim()
  const timestamp = Date.now()

  return {
    id: -1,
    name: `${normalizedProvider}/${normalizedModel}`,
    displayName: normalizedModel,
    provider: normalizedProvider,
    model: normalizedModel,
    temperature: null,
    maxTokens: null,
    topP: null,
    topK: null,
    frequencyPenalty: null,
    presencePenalty: null,
    responseFormat: null,
    systemPrompt: null,
    isSystemPreset: false,
    isDefault: false,
    isActive: true,
    description: 'Ad-hoc configuration generated at runtime',
    presetCategory: 'custom',
    uiIcon: null,
    uiColor: null,
    uiOrder: 0,
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

export async function buildModelRequestOptions({
  provider,
  model,
  overrides,
  debug
}: {
  provider: string | APIProviders
  model?: string | null
  overrides?: AiSdkCompatibleOptions
  debug?: boolean
}): Promise<{ config: ModelConfig; options: AiSdkCompatibleOptions }> {
  const modelConfigService = createModelConfigService()
  const resolvedProvider = String(provider)
  const overridesObject = overrides ?? {}
  const { provider: _providerOverride, model: overrideModel, ...restOverrides } = overridesObject
  const requestedModel = model ?? overrideModel ?? undefined

  let config: ModelConfig | null = null
  try {
    config = await modelConfigService.resolveProviderConfig({
      provider: resolvedProvider,
      model: requestedModel
    })
  } catch (error) {
    if (!(error instanceof ApiError) || error.code !== 'NOT_FOUND') {
      throw error
    }
  }

  if (!config) {
    const fallbackModel = requestedModel ?? overrideModel
    if (!fallbackModel) {
      throw ErrorFactory.missingRequired('model', 'buildModelRequestOptions')
    }
    config = createAdHocModelConfig(resolvedProvider, fallbackModel)
    if (debug) {
      console.warn('[ModelOptions] Using ad-hoc configuration for provider/model', {
        provider: resolvedProvider,
        model: fallbackModel
      })
    }
  }

  const baseOptions = mapConfigToOptions(config)
  const finalOptions: AiSdkCompatibleOptions = {
    ...baseOptions,
    ...(restOverrides as AiSdkCompatibleOptions)
  }

  finalOptions.provider = config.provider
  finalOptions.model = config.model

  if (debug) {
    console.debug('[ModelOptions] Resolved configuration', {
      provider: finalOptions.provider,
      model: finalOptions.model,
      overrides: Object.keys(overridesObject)
    })
  }

  return { config, options: finalOptions }
}

// Stream request interface for chat handling
interface AiChatStreamRequest {
  chatId: number
  userMessage: string
  options?: AiSdkCompatibleOptions
  systemMessage?: string
  tempId?: string
  debug?: boolean
  enableChatAutoNaming?: boolean
  toolsEnabled?: boolean
  toolChoice?: 'auto' | 'none'
  maxSteps?: number
  tools?: Record<string, unknown>
  fallbackToolExecutor?: (() => Promise<string | null | undefined>) | null
}

// Extended type for chat streaming requests
type AiChatRequest = AiChatStreamRequest

// Provider capabilities map - which providers support structured output via generateObject
// Note: LM Studio now uses a custom provider that supports native structured outputs
const PROVIDER_CAPABILITIES = {
  openai: { structuredOutput: true, useCustomProvider: false },
  anthropic: { structuredOutput: true, useCustomProvider: false },
  google_gemini: { structuredOutput: true, useCustomProvider: false },
  groq: { structuredOutput: true, useCustomProvider: false },
  openrouter: { structuredOutput: true, useCustomProvider: false },
  copilot: { structuredOutput: true, useCustomProvider: false },
  lmstudio: { structuredOutput: true, useCustomProvider: true }, // Uses custom provider for native json_schema support
  ollama: { structuredOutput: false, useCustomProvider: false }, // Still uses text fallback (TODO: add custom provider)
  xai: { structuredOutput: true, useCustomProvider: false },
  together: { structuredOutput: true, useCustomProvider: false },
  custom: { structuredOutput: true, useCustomProvider: false } // Custom OpenAI-compatible providers
} as const

let providerKeysCache: ProviderKey[] | null = null

// Type guard to check if a value is a valid number
function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value)
}

// Utility function to convert database null values to undefined for AI SDK compatibility
// Handles the type mismatch between Drizzle's `number | null` and AI SDK's `number | undefined`
export function convertDbOptionsToAiSdk(dbOptions: AiSdkCompatibleOptions): {
  temperature?: number
  maxTokens?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  topK?: number
  responseFormat?: any
} {
  // Filter out null values and convert to undefined, with type validation
  const result: ReturnType<typeof convertDbOptionsToAiSdk> = {}

  if (isValidNumber(dbOptions.temperature)) {
    result.temperature = dbOptions.temperature
  }

  if (isValidNumber(dbOptions.maxTokens)) {
    result.maxTokens = dbOptions.maxTokens
  }

  if (isValidNumber(dbOptions.topP)) {
    result.topP = dbOptions.topP
  }

  if (isValidNumber(dbOptions.frequencyPenalty)) {
    result.frequencyPenalty = dbOptions.frequencyPenalty
  }

  if (isValidNumber(dbOptions.presencePenalty)) {
    result.presencePenalty = dbOptions.presencePenalty
  }

  if (isValidNumber(dbOptions.topK)) {
    result.topK = dbOptions.topK
  }

  if (dbOptions.responseFormat !== null && dbOptions.responseFormat !== undefined) {
    result.responseFormat = dbOptions.responseFormat
  }

  return result
}

function createTextModelMessage(
  role: 'system' | 'user' | 'assistant',
  content: string | null | undefined
): ModelMessage {
  let normalizedContent: string
  if (typeof content === 'string') {
    normalizedContent = content
  } else if (content != null) {
    normalizedContent = String(content)
  } else {
    normalizedContent = ''
  }

  switch (role) {
    case 'system':
      return { role, content: normalizedContent }
    case 'user':
      return { role, content: normalizedContent }
    case 'assistant':
      return { role, content: normalizedContent }
    default:
      return { role: 'assistant', content: normalizedContent }
  }
}

export const resolveModelIdentifier = (
  preferredModel: string | undefined,
  modelInstance: LanguageModelV2
): string => {
  if (preferredModel && preferredModel.length > 0) {
    return preferredModel
  }
  return modelInstance.modelId
}

type NormalizedUsage = {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

type LegacyUsageShape = {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

export const normalizeUsage = (
  usage?: LanguageModelV2Usage | LegacyUsageShape | null
): NormalizedUsage | undefined => {
  if (!usage) return undefined
  const usageAny = usage as LanguageModelV2Usage & LegacyUsageShape
  const promptTokens = usageAny.promptTokens ?? usageAny.inputTokens
  const completionTokens = usageAny.completionTokens ?? usageAny.outputTokens
  const totalTokens =
    usageAny.totalTokens ??
    (promptTokens !== undefined && completionTokens !== undefined
      ? promptTokens + completionTokens
      : undefined)

  return {
    promptTokens,
    completionTokens,
    totalTokens
  }
}

async function generateStructuredDataViaTextFallback<T extends z.ZodTypeAny>({
  prompt,
  schema,
  systemMessage,
  finalOptions,
  provider,
  debug
}: {
  prompt: string
  schema: T
  systemMessage?: string
  finalOptions: AiSdkCompatibleOptions
  provider: string
  debug?: boolean
}): Promise<{
  object: z.infer<T>
  usage: { completionTokens: number; promptTokens: number; totalTokens: number }
  finishReason: string
}> {
  const jsonPrompt = createJsonOnlyPrompt(prompt, schema, systemMessage)

  const textResult = await generateSingleText({
    prompt: jsonPrompt,
    options: finalOptions,
    debug
  })

  if (debug) {
    console.log(`[UnifiedProviderService] Raw text response from ${provider}:`, textResult)
  }

  const sanitized = extractJsonStringFromResponse(textResult)

  let parsedObject: any
  try {
    parsedObject = JSON.parse(sanitized)
  } catch (parseError) {
    console.error(`[UnifiedProviderService] Failed to parse JSON from ${provider} response:`, sanitized)

    if (provider === 'lmstudio' || provider === 'ollama') {
      throw ErrorFactory.operationFailed(
        `${provider} JSON generation`,
        'Model did not return valid JSON. This may happen with smaller models (< 7B parameters). Try using a larger model or a different provider.'
      )
    }

    throw ErrorFactory.operationFailed(`${provider} JSON generation`, 'Model did not return valid JSON response.')
  }

  const validatedObject = schema.parse(parsedObject)

  return {
    object: validatedObject,
    usage: {
      completionTokens: 0,
      promptTokens: 0,
      totalTokens: 0
    },
    finishReason: 'stop'
  }
}

// Helper function to get provider key configuration
async function getProviderKeyById(provider: string, debug: boolean = false): Promise<ProviderKey | null> {
  const providerKeyService = createProviderKeyService()
  const keys = await providerKeyService.listKeysUncensored()

  // Find the default key for this provider, or the first one
  const providerKeys = keys.filter((k) => k.provider === provider)
  const defaultKey = providerKeys.find((k) => k.isDefault)
  const key = defaultKey || providerKeys[0]

  if (debug && key) {
    console.log(`[UnifiedProviderService] Found provider key for ${provider}: ${key.name}`)
  }

  return key || null
}

export async function handleChatMessage({
  chatId,
  userMessage,
  options = {},
  systemMessage,
  tempId,
  debug = false,
  enableChatAutoNaming = false,
  toolsEnabled = false,
  toolChoice,
  maxSteps,
  tools,
  fallbackToolExecutor
}: AiChatRequest): Promise<StreamWithState> {
  let finalAssistantMessageId: number | undefined

  // Get dynamic model configuration
  const requestedProvider = (options.provider || 'openai') as APIProviders
  const { options: finalOptions } = await buildModelRequestOptions({
    provider: requestedProvider,
    model: options.model,
    overrides: options,
    debug
  })
  const resolvedProvider = finalOptions.provider as APIProviders
  const chatService = createChatService()
  const modelInstance = await getProviderLanguageModelInterface(resolvedProvider, finalOptions)
  const modelIdentifier = resolveModelIdentifier(finalOptions.model, modelInstance)
  let messagesToProcess: ModelMessage[] = []

  if (systemMessage) {
    messagesToProcess.push(createTextModelMessage('system', systemMessage))
  }

  const dbMessages = (await chatRepository.getMessages(chatId)).map((msg) =>
    createTextModelMessage(msg.role as 'user' | 'assistant' | 'system', msg.content)
  )

  // Check if this is the first user message for auto-naming
  const isFirstUserMessage = dbMessages.filter((msg) => msg.role === 'user').length === 0

  messagesToProcess.push(...dbMessages)

  const savedUserMessage = await chatService.addMessage(chatId, {
    role: 'user',
    content: userMessage,
    metadata: tempId ? { tempId: `${tempId}-user` } : undefined
  })

  messagesToProcess.push(createTextModelMessage('user', userMessage))

  // Update timestamp will be handled by the repository automatically

  const initialAssistantMessage = await chatService.addMessage(chatId, {
    role: 'assistant',
    content: '...',
    metadata: tempId ? { tempId } : undefined
  })
  finalAssistantMessageId = initialAssistantMessage.id

  const aiSdkOptions = convertDbOptionsToAiSdk(finalOptions)
  const hasTools = tools && Object.keys(tools).length > 0
  const resolvedTools = hasTools ? tools : undefined
  const resolvedToolChoice = toolChoice ?? (resolvedTools ? 'auto' : 'none')
  const resolvedMaxSteps = maxSteps ?? (resolvedTools ? 4 : 1)

  const finishState: StreamFinishState = { finishReason: 'unknown' }

  const stream = await streamText({
    model: modelInstance,
    messages: messagesToProcess,
    ...aiSdkOptions,
    // Pass through responseFormat if provided in options
    ...(finalOptions.responseFormat && {
      responseFormat: finalOptions.responseFormat
    }),
    ...(resolvedTools && Object.keys(resolvedTools).length > 0
      ? { tools: resolvedTools, toolChoice: resolvedToolChoice }
      : { toolChoice: resolvedToolChoice }),
    maxSteps: resolvedMaxSteps,

    // Handle completion and errors
    onFinish: async ({ text, usage, finishReason, steps }) => {
      const normalizedUsage = normalizeUsage(usage)
      if (debug) {
        logModelCompletion(
          finalOptions.provider as string,
          modelIdentifier || finalOptions.model || '',
          normalizedUsage
        )
      }

      const finalContent = resolveFinalAssistantContent(text, steps)
      const trimmedFinalContent = finalContent.trim()
      let toolFallback = finishState.lastToolResultText?.trim() ?? ''

      let finalMessageContent = ''
      if (trimmedFinalContent.length > 0) {
        finalMessageContent = finalContent
      } else {
        if (toolFallback.length === 0 && typeof fallbackToolExecutor === 'function') {
          try {
            const fallbackResult = await fallbackToolExecutor()
            if (typeof fallbackResult === 'string' && fallbackResult.trim().length > 0) {
              toolFallback = fallbackResult.trim()
              finishState.lastToolResultText = toolFallback
            }
          } catch (fallbackError) {
            console.error('[UnifiedProviderService] Fallback tool executor failed:', fallbackError)
          }
        }

        if (toolFallback.length > 0) {
          const providerForFollowup = (finalOptions.provider || '').toLowerCase()
          const shouldAttemptFollowup =
            providerForFollowup.length > 0 && !['openrouter', 'lmstudio', 'ollama'].includes(providerForFollowup)

          if (shouldAttemptFollowup) {
            try {
              const summaryPrompt = `The user asked: "${userMessage}"\n\nA tool produced this output:\n${toolFallback}\n\nPlease provide a concise assistant reply that references the tool findings and helps the user.`
              const followupOptions: AiSdkCompatibleOptions = {
                provider: finalOptions.provider,
                model: finalOptions.model,
                temperature: finalOptions.temperature ?? 0.7,
                maxTokens: Math.min(600, finalOptions.maxTokens ?? 600),
                topP: finalOptions.topP,
                frequencyPenalty: finalOptions.frequencyPenalty,
                presencePenalty: finalOptions.presencePenalty,
                responseFormat: null
              }

              const followup = await generateSingleText({
                prompt: summaryPrompt,
                options: followupOptions,
                systemMessage:
                  systemMessage || 'You are a helpful assistant that summarizes tool outputs for the user.',
                debug
              })

              const trimmedFollowup = followup.trim()
              finalMessageContent =
                trimmedFollowup.length > 0 ? trimmedFollowup : formatToolFallback(toolFallback)
            } catch (followupError) {
              console.warn('[UnifiedProviderService] Follow-up generation after tool output failed:', followupError)
              finalMessageContent = formatToolFallback(toolFallback)
            }
          } else {
            finalMessageContent = formatToolFallback(toolFallback)
          }
        } else {
          console.warn(
            `[UnifiedProviderService] Empty assistant response for ${finalOptions.provider}/${modelIdentifier}. Using fallback message.`
          )
          finalMessageContent = 'No response was generated.'
        }
      }

      finishState.finalText = finalMessageContent

      // Update the placeholder Assistant Message with Final Content
      if (finalAssistantMessageId) {
        try {
          // Update message content by deleting and recreating (since messages don't have update)
          await chatRepository.deleteMessage(finalAssistantMessageId)
          const contentToPersist = finalMessageContent
          await chatService.addMessage(chatId, {
            role: 'assistant',
            content: contentToPersist
          })
        } catch (dbError) {
          console.error(
            `[UnifiedProviderService] Failed to update final message content in DB for ID ${finalAssistantMessageId}:`,
            dbError
          )
        }
      }

      // Auto-name the chat if this is the first user message and auto-naming is enabled
      if (isFirstUserMessage && enableChatAutoNaming) {
        try {
          // Get current chat to check if it has a default name
          const currentChat = await chatService.getById(chatId)

          if (currentChat && (currentChat.title.startsWith('New Chat') || currentChat.title.startsWith('Chat '))) {
            // Generate a name based on the user's message
            const generatedName = await generateChatName(userMessage)
            await chatService.update(chatId, { title: generatedName })

            if (debug) {
              console.log(`[UnifiedProviderService] Auto-named chat ${chatId}: "${generatedName}"`)
            }
          }
        } catch (namingError) {
          console.error(`[UnifiedProviderService] Failed to auto-name chat ${chatId}:`, namingError)
          // Don't throw - auto-naming failure shouldn't break the chat
        }
      }

      const reason = finishReason ?? 'stop'
      finishState.finishReason = reason
      if (normalizedUsage) {
        finishState.usage = normalizedUsage
      }
      if (finalMessageContent.trim().length > 0) {
        finishState.finalText = finalMessageContent
      }
    },
    onError: (error) => {
      console.error(
        `[UnifiedProviderService] Error during stream for ${resolvedProvider}/${modelIdentifier}:`,
        error
      )

      // Map the error to get better details
      const mappedError = mapProviderErrorToApiError(error, resolvedProvider, 'streamChat')
      finishState.finishReason = 'error'

      // Update the placeholder message with a user-friendly error message
      if (finalAssistantMessageId) {
        const errorMessage =
          mappedError.code === 'CONTEXT_LENGTH_EXCEEDED'
            ? 'Error: Message too long. Please reduce the length and try again.'
            : mappedError.code === 'RATE_LIMIT_EXCEEDED'
              ? 'Error: Rate limit exceeded. Please wait a moment and try again.'
              : mappedError.code === 'PROVIDER_UNAVAILABLE'
                ? 'Error: Service temporarily unavailable. Please try again.'
                : `Error: ${mappedError.message}`

        // Update error message by deleting and recreating
        chatRepository
          .deleteMessage(finalAssistantMessageId)
          .then(() =>
            chatService.addMessage(chatId, {
              role: 'assistant',
              content: errorMessage
            })
          )
          .catch((dbError: any) => {
            console.error(
              `[UnifiedProviderService] Failed to update message content with stream error in DB for ID ${finalAssistantMessageId}:`,
              dbError
            )
          })
      }

      // Propagate to client so UI can surface a toast
      throw mappedError
    }
  })

  return { stream, finishState }
}

export function extractString(value: unknown): string {
  if (typeof value === 'string') return value
  if (value == null) return ''
  if (Array.isArray(value)) {
    return value.map((entry) => extractString(entry)).join('')
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const preferredKeys = [
      'value',
      'text',
      'delta',
      'delta_text',
      'deltaText',
      'output_text',
      'outputText',
      'content',
      'message',
      'output',
      'response',
      'reasoning'
    ]
    for (const key of preferredKeys) {
      const nested = record[key]
      const extracted = extractString(nested)
      if (extracted.length > 0) return extracted
    }
  }
  return ''
}

export function formatToolFallback(output: string): string {
  const trimmed = (output || '').trim()
  if (!trimmed) {
    return 'The tool did not return any content.'
  }
  return `Here is what I found:\n\n${trimmed}`
}

export function extractTextFromAssistantMessage(message: AssistantModelMessage): string {
  const { content } = message
  if (!content) {
    return ''
  }

  if (typeof content === 'string') {
    return content.trim()
  }

  const pieces: string[] = []
  const collectText = (input: unknown) => {
    const extracted = extractString(input)
    if (extracted.trim().length > 0) {
      pieces.push(extracted.trim())
    }
  }

  for (const part of content) {
    if (!part) continue

    if (typeof part === 'string') {
      collectText(part)
      continue
    }

    if (typeof part === 'object') {
      const partAny = part as unknown as Record<string, unknown>
      const typeValue = typeof partAny.type === 'string' ? partAny.type.toLowerCase() : ''

      if (['text', 'output_text', 'output-text', 'outputtext'].includes(typeValue)) {
        const candidate =
          partAny.text ?? partAny.output_text ?? partAny.outputText ?? partAny.value ?? partAny.content
        collectText(candidate)
        continue
      }

      if (Object.prototype.hasOwnProperty.call(partAny, 'text')) {
        collectText(partAny.text)
        continue
      }

      collectText(partAny)
    }
  }

  return pieces.join('').trim()
}

export function resolveFinalAssistantContent(
  aggregatedText: string | undefined,
  steps: StepResult<any>[] | undefined
): string {
  const text = aggregatedText?.trim() ?? ''
  if (text.length > 0) {
    return text
  }

  if (!Array.isArray(steps) || steps.length === 0) {
    return ''
  }

  const collected: string[] = []

  const pushText = (value: unknown) => {
    const extracted = extractString(value)
    if (extracted && extracted.trim().length > 0) {
      collected.push(extracted.trim())
    }
  }

  for (const step of steps as Array<Record<string, unknown>>) {
    const response = step?.response as Record<string, unknown> | undefined
    if (!response) continue

    const messages = response.messages as unknown
    if (Array.isArray(messages)) {
      for (const message of messages) {
        if (message && typeof message === 'object' && (message as any).role === 'assistant') {
          const extracted = extractTextFromAssistantMessage(message as AssistantModelMessage)
          if (extracted.length > 0) collected.push(extracted)
        } else {
          pushText(message)
        }
      }
    }

    const outputText = response.outputText ?? response.output_text
    if (Array.isArray(outputText)) {
      pushText(outputText.join('\n'))
    } else if (typeof outputText === 'string') {
      pushText(outputText)
    }

    if (typeof response.text === 'string') {
      pushText(response.text)
    }

    if (response.message) {
      pushText(response.message)
    }

    if (Array.isArray(response.content)) {
      pushText(response.content)
    }

    if (response.output) {
      pushText(response.output)
    }

    const delta = (response as any).delta
    if (delta) {
      pushText(delta)
    }
  }

  if (collected.length === 0) {
    const toolOutputs: string[] = []
    for (const step of steps) {
      const results = (step as any).toolResults as Array<{ result?: unknown }> | undefined
      if (!Array.isArray(results)) continue
      for (const result of results) {
        const extracted = extractString(result?.result)
        if (extracted.length > 0) {
          toolOutputs.push(extracted)
        }
      }
    }

    if (toolOutputs.length > 0) {
      return toolOutputs.join('\n').trim()
    }

    return ''
  }

  return collected.join('\n').trim()
}

async function loadUncensoredKeys(): Promise<ProviderKey[]> {
  const providerKeyService = createProviderKeyService()
  // Simple cache invalidation on update/delete could be added if keys change often
  if (providerKeysCache === null) {
    providerKeysCache = await providerKeyService.listKeysUncensored()
  }
  return providerKeysCache
}

async function getKey(provider: APIProviders, debug: boolean): Promise<string | undefined> {
  const keys = await loadUncensoredKeys()
  const keyEntry = keys.find((k) => k.provider === provider)

  // Prefer explicit DB key
  let resolved: string | undefined = nullToUndefined(keyEntry?.key)

  // Fall back to environment using secretRef if present
  if (!resolved && keyEntry && (keyEntry as any).secretRef) {
    const envVar = String((keyEntry as any).secretRef)
    const envVal = (process.env as Record<string, string | undefined>)[envVar]
    if (typeof envVal === 'string' && envVal.length > 0) {
      resolved = envVal
      if (debug) {
        console.log(`[UnifiedProviderService] Resolved ${provider} key from secretRef env var ${envVar}`)
      }
    }
  }

  // Provider-specific env fallback
  if (!resolved) {
    const envFallbackMap: Record<string, string> = {
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      google_gemini: 'GOOGLE_GENERATIVE_AI_API_KEY',
      groq: 'GROQ_API_KEY',
      together: 'TOGETHER_API_KEY',
      xai: 'XAI_API_KEY',
      openrouter: 'OPENROUTER_API_KEY'
    }
    const envName = envFallbackMap[provider]
    if (envName && process.env[envName]) {
      resolved = process.env[envName]
      if (debug) {
        console.log(`[UnifiedProviderService] Resolved ${provider} key from ${envName}`)
      }
    }
  }

  if (!resolved && debug) {
    console.warn(
      `[UnifiedProviderService] API key for provider "${provider}" not found (DB/secretRef/env). Requests will fail.`
    )
  }
  return resolved
}

/**
 * Gets an initialized Vercel AI SDK LanguageModel instance for the given provider and options.
 * Handles API key fetching and local provider configurations.
 */
export async function getProviderLanguageModelInterface(
  provider: APIProviders | string,
  options: AiSdkCompatibleOptions = {},
  debug: boolean = false
): Promise<LanguageModelV2> {
  const providerKey = (options.provider ?? provider) as string
  const modelId = options.model || ''

  if (!modelId) {
    throw ErrorFactory.missingRequired('model', `provider ${providerKey}`)
  }

  if (debug) {
    console.log(`[UnifiedProviderService] Initializing model: Provider=${providerKey}, ModelID=${modelId}`)
  }

  if (providerKey.startsWith('custom_')) {
    const keyId = parseInt(providerKey.replace('custom_', ''), 10)
    if (!Number.isNaN(keyId)) {
      const providerKeyService = createProviderKeyService()
      const customKey = await providerKeyService.getKeyById(keyId)
      if (!customKey || customKey.provider !== 'custom' || !customKey.baseUrl) {
        throw ErrorFactory.notFound('Custom provider configuration', keyId || 'default')
      }

      const baseURL = customKey.baseUrl
      const apiKey = customKey.key

      if (!apiKey) {
        throw ErrorFactory.missingRequired('API key', 'custom provider')
      }

      const customUrl = baseURL.endsWith('/v1') ? baseURL : `${baseURL.replace(/\/$/, '')}/v1`

      if (debug) {
        console.log(`[UnifiedProviderService] Using custom provider at: ${customUrl}`)
      }

      const customHeaders = customKey.customHeaders || {}

      return createOpenAI({
        baseURL: customUrl,
        apiKey,
        headers: customHeaders
      })(modelId)
    }
  }

  switch (providerKey as APIProviders) {
    case 'openai': {
      const apiKey = await getKey('openai', debug)
      return createOpenAI({ apiKey })(modelId)
    }
    case 'anthropic': {
      const apiKey = await getKey('anthropic', debug)
      if (!apiKey && !process.env.ANTHROPIC_API_KEY) {
        throw ErrorFactory.missingRequired('Anthropic API Key', 'database or environment')
      }
      return createAnthropic({ apiKey })(modelId)
    }
    case 'google_gemini': {
      const apiKey = await getKey('google_gemini', debug)
      if (!apiKey && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
        throw ErrorFactory.missingRequired('Google Gemini API Key', 'database or environment')
      }
      return createGoogleGenerativeAI({ apiKey })(modelId)
    }
    case 'groq': {
      const apiKey = await getKey('groq', debug)
      if (!apiKey && !process.env.GROQ_API_KEY) {
        throw ErrorFactory.missingRequired('Groq API Key', 'database or environment')
      }
      return createGroq({ apiKey })(modelId)
    }
    case 'openrouter': {
      const apiKey = (await getKey('openrouter', debug)) || process.env.OPENROUTER_API_KEY
      if (!apiKey) {
        throw ErrorFactory.missingRequired('OpenRouter API Key', 'database or environment')
      }
      const site = process.env.OPENROUTER_SITE_URL?.trim() || 'https://promptliano.dev/local'
      const title = process.env.OPENROUTER_APP_TITLE?.trim() || 'Promptliano Dev'
      const userAgent =
        process.env.OPENROUTER_USER_AGENT?.trim() || 'Promptliano/Dev (https://promptliano.dev/local)'
      const defaultHeaders: Record<string, string> = {
        'HTTP-Referer': site,
        Referer: site,
        'X-Title': title,
        'User-Agent': userAgent,
        Accept: 'application/json'
      }

      return createOpenAI({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        headers: defaultHeaders,
        name: 'openrouter'
      })(modelId)
    }
    case 'copilot': {
      const apiKey = (await getKey('copilot', debug)) || process.env.COPILOT_API_KEY || 'dummy'
      return createOpenAI({ baseURL: providersConfig.copilot.baseURL, apiKey })(modelId)
    }
    case 'lmstudio': {
      let lmStudioUrl = options.lmstudioUrl || getProviderUrl('lmstudio') || providersConfig.lmstudio.baseURL
      if (!lmStudioUrl) {
        throw ErrorFactory.missingRequired('LMStudio Base URL', 'configuration')
      }

      if (options.lmstudioUrl || getProviderUrl('lmstudio')) {
        console.log(`[UnifiedProviderService] Using custom LMStudio URL: ${lmStudioUrl}`)
      }

      const normalizedLmStudioUrl = lmStudioUrl.endsWith('/v1')
        ? lmStudioUrl
        : lmStudioUrl.replace(/\/$/, '') + '/v1'

      let fetchImpl: typeof fetch | undefined
      const shouldLogLmStudio = debug || process.env.PROMPTLIANO_DEBUG_STREAM === 'true'

      if (shouldLogLmStudio) {
        fetchImpl = (async (input, init) => {
          try {
            const request = input instanceof Request ? input : undefined
            const url = request?.url
              ?? (typeof input === 'string'
                ? input
                : input instanceof URL
                  ? input.toString()
                  : 'unknown')
            const method = request?.method ?? init?.method ?? 'GET'
            let bodyPreview: string | undefined

            if (method !== 'GET') {
              if (typeof init?.body === 'string') {
                bodyPreview = init.body
              } else if (request) {
                bodyPreview = await request.clone().text()
              }

              if (bodyPreview && bodyPreview.length > 2000) {
                bodyPreview = `${bodyPreview.slice(0, 2000)}...`
              }
            }

            console.debug('[UnifiedProviderService] LM Studio request', {
              method,
              url,
              hasBody: bodyPreview != null,
              body: bodyPreview
            })
          } catch (logError) {
            console.debug('[UnifiedProviderService] Failed to log LM Studio request', logError)
          }

          return fetch(input as any, init as any)
        }) as typeof fetch
      }

      const providerConfig: Parameters<typeof createOpenAICompatible>[0] = {
        baseURL: normalizedLmStudioUrl,
        name: 'lmstudio',
        apiKey: 'lm-studio',
        supportsStructuredOutputs: true
      }

      if (fetchImpl) {
        providerConfig.fetch = fetchImpl
      }

      return createOpenAICompatible(providerConfig)(modelId)
    }
    case 'xai': {
      const apiKey = await getKey('xai', debug)
      if (!apiKey) {
        throw ErrorFactory.missingRequired('XAI API Key', 'database')
      }
      return createOpenAI({ baseURL: 'https://api.x.ai/v1', apiKey })(modelId)
    }
    case 'together': {
      const apiKey = await getKey('together', debug)
      if (!apiKey) {
        throw ErrorFactory.missingRequired('Together API Key', 'database')
      }
      return createOpenAI({ baseURL: 'https://api.together.xyz/v1', apiKey })(modelId)
    }
    case 'custom': {
      const customKey = await getProviderKeyById(providerKey, debug)
      if (!customKey) {
        throw ErrorFactory.notFound('Custom provider configuration', 'default')
      }

      const baseURL = customKey.baseUrl
      if (!baseURL) {
        throw ErrorFactory.missingRequired('Base URL', 'custom provider')
      }

      const allowKeylessCustom = String(process.env.ALLOW_KEYLESS_CUSTOM || '').toLowerCase() === 'true'
      const apiKey =
        (await getKey('custom', debug)) || process.env.CUSTOM_API_KEY || (allowKeylessCustom ? 'dummy' : undefined)
      if (!apiKey && !allowKeylessCustom) {
        throw ErrorFactory.missingRequired('API key', 'custom provider')
      }

      const customUrl = baseURL.endsWith('/v1') ? baseURL : `${baseURL.replace(/\/$/, '')}/v1`

      if (debug) {
        console.log(`[UnifiedProviderService] Using custom provider at: ${customUrl}`)
      }

      const baseHeaders = {
        Authorization: `Bearer ${apiKey}`
      }

      const sanitizedHeaders = mergeHeaders(baseHeaders, nullToUndefined(customKey.customHeaders))
      const { Authorization, ...customHeaders } = sanitizedHeaders

      return createOpenAI({
        baseURL: customUrl,
        apiKey,
        headers: customHeaders
      })(modelId)
    }
    case 'ollama': {
      const ollamaUrl = options.ollamaUrl || getProviderUrl('ollama') || providersConfig.ollama.baseURL
      if (!ollamaUrl) {
        throw ErrorFactory.missingRequired('Ollama Base URL', 'configuration')
      }

      if (options.ollamaUrl || getProviderUrl('ollama')) {
        console.log(`[UnifiedProviderService] Using custom Ollama URL: ${ollamaUrl}`)
      }

      return createOpenAI({
        baseURL: `${ollamaUrl}/v1`,
        apiKey: 'ollama'
      })(modelId)
    }
    default: {
      console.error(`[UnifiedProviderService] Unsupported provider: ${providerKey}. Attempting fallback to OpenAI.`)
      try {
        const fallbackService = createModelConfigService()
        const fallbackConfig = await fallbackService.resolveProviderConfig({ provider: 'openai' })
        const fallbackApiKey = await getKey('openai', debug)
        if (!fallbackApiKey) {
          throw ErrorFactory.missingRequired('OpenAI API Key', 'database or environment')
        }
        return createOpenAI({ apiKey: fallbackApiKey })(fallbackConfig.model)
      } catch (fallbackError: any) {
        throw ErrorFactory.operationFailed(
          `provider ${providerKey} with OpenAI fallback`,
          `Both provider and fallback failed. Fallback error: ${fallbackError.message}`
        )
      }
    }
  }
}

// Helper function for non-streaming text generation.
export async function generateSingleText({
  prompt,
  messages,
  options = {},
  systemMessage,
  debug = false
}: {
  prompt: string
  messages?: ModelMessage[]
  options?: AiSdkCompatibleOptions
  systemMessage?: string
  debug?: boolean
}): Promise<string> {
  const requestedProvider = (options.provider || 'openai') as APIProviders
  const { options: finalOptions } = await buildModelRequestOptions({
    provider: requestedProvider,
    model: options.model,
    overrides: options,
    debug
  })
  const resolvedProvider = finalOptions.provider as APIProviders

  if (!prompt && (!messages || messages.length === 0)) {
    throw ErrorFactory.missingRequired('prompt or messages', 'generateSingleText')
  }

  let modelIdentifier = finalOptions.model || ''

  try {
    const modelInstance = await getProviderLanguageModelInterface(resolvedProvider, finalOptions)
    modelIdentifier = resolveModelIdentifier(finalOptions.model, modelInstance)

    let messagesToProcess: ModelMessage[] = []
    if (systemMessage) {
      messagesToProcess.push(createTextModelMessage('system', systemMessage))
    }
    if (messages) {
      messagesToProcess.push(...messages)
    }
    if (prompt) {
      messagesToProcess.push(createTextModelMessage('user', prompt))
    }

    // Log model usage
    logModelUsage({
      provider: resolvedProvider,
      model: modelIdentifier,
      temperature: finalOptions.temperature,
      maxTokens: finalOptions.maxTokens,
      topP: finalOptions.topP,
      frequencyPenalty: finalOptions.frequencyPenalty,
      presencePenalty: finalOptions.presencePenalty,
      mode: 'text'
    })

    // Wrap the AI call in retry logic
    const result = await retryOperation(
      async () => {
        const aiSdkOptions = convertDbOptionsToAiSdk(finalOptions)

        const normalizedModelId = (modelIdentifier || finalOptions.model || '').toLowerCase()
        const isOpenRouterGemini =
          resolvedProvider.toLowerCase() === 'openrouter' &&
          (normalizedModelId.includes('gemini') || normalizedModelId.startsWith('google/'))

        if (isOpenRouterGemini && aiSdkOptions && (aiSdkOptions as any).responseFormat !== undefined) {
          delete (aiSdkOptions as any).responseFormat
        }
        const { text, usage } = await generateText({
          model: modelInstance,
          messages: messagesToProcess,
          ...aiSdkOptions
        })

        if (debug) {
          logModelCompletion(resolvedProvider, modelIdentifier, normalizeUsage(usage))
        }

        return text
      },
      {
        maxRetries: 3,
        shouldRetry: (error: any) => {

          console.log('***shouldRetry***', error)
          // Map the error to check if it's retryable
          const mappedError = mapProviderErrorToApiError(error, resolvedProvider, 'generateSingleText')
          return (
            mappedError.code === 'RATE_LIMIT_EXCEEDED' ||
            mappedError.code === 'PROVIDER_UNAVAILABLE' ||
            mappedError.status >= 500
          )
        }
      }
    )

    return result
  } catch (error: any) {
    if (error instanceof ApiError) throw error
    // Log error and re-throw
    logModelError(resolvedProvider, modelIdentifier, error)
    throw mapProviderErrorToApiError(error, resolvedProvider, 'generateSingleText')
  }
}

// Helper function for generating structured JSON objects.
// Zod v4: avoid referencing internal ZodTypeDef; accept any ZodType
export async function generateStructuredData<T extends z.ZodTypeAny>({
  // Accept ZodTypeAny
  prompt,
  schema,
  options = {},
  systemMessage,
  debug = false
}: {
  prompt: string
  schema: T
  systemMessage?: string
  debug?: boolean
  options?: AiSdkCompatibleOptions
}): Promise<{
  object: z.infer<T>
  usage: { completionTokens: number; promptTokens: number; totalTokens: number }
  finishReason: string /* ...other potential fields */
}> {
  const requestedProvider = (options.provider || 'openai') as APIProviders
  const { options: finalOptions } = await buildModelRequestOptions({
    provider: requestedProvider,
    model: options.model,
    overrides: options,
    debug
  })
  const resolvedProvider = finalOptions.provider as APIProviders
  const model = finalOptions.model || 'default'

  if (!prompt) {
    throw ErrorFactory.missingRequired('prompt', 'generateStructuredData')
  }

  // Check if provider supports structured output
  const providerKey = resolvedProvider as keyof typeof PROVIDER_CAPABILITIES
  const supportsStructuredOutput = PROVIDER_CAPABILITIES[providerKey]?.structuredOutput ?? true
  const useCustomProvider = PROVIDER_CAPABILITIES[providerKey]?.useCustomProvider ?? false

  // Log model usage
  logModelUsage({
    provider: resolvedProvider,
    model: model || '',
    temperature: finalOptions.temperature,
    maxTokens: finalOptions.maxTokens,
    topP: finalOptions.topP,
    frequencyPenalty: finalOptions.frequencyPenalty,
    presencePenalty: finalOptions.presencePenalty,
    mode: 'structured'
  })

  if (debug) {
    console.log(
      `[UnifiedProviderService] Schema=${schema.description || 'Unnamed Schema'}, SupportsStructuredOutput=${supportsStructuredOutput}`
    )
  }

  // Use custom LM Studio provider for native structured output support
  if (resolvedProvider === 'lmstudio' && useCustomProvider) {
    if (debug) {
      console.log(`[UnifiedProviderService] Using custom LM Studio provider for native structured output`)
    }

    try {
      // Convert null values to undefined for LMStudio provider
      const convertedOptions = {
        ...finalOptions,
        temperature: nullToUndefined(finalOptions.temperature),
        maxTokens: nullToUndefined(finalOptions.maxTokens),
        topP: nullToUndefined(finalOptions.topP),
        topK: nullToUndefined(finalOptions.topK),
        frequencyPenalty: nullToUndefined(finalOptions.frequencyPenalty),
        presencePenalty: nullToUndefined(finalOptions.presencePenalty),
        debug
      }
      const lmstudioProvider = new LMStudioProvider(convertedOptions)
      const result = await lmstudioProvider.generateObject(schema, prompt, {
        model: model,
        systemMessage,
        temperature: nullToUndefined(finalOptions.temperature),
        maxTokens: nullToUndefined(finalOptions.maxTokens),
        topP: nullToUndefined(finalOptions.topP),
        frequencyPenalty: nullToUndefined(finalOptions.frequencyPenalty),
        presencePenalty: nullToUndefined(finalOptions.presencePenalty),
        debug
      })

      if (debug) {
        console.log(
          `[UnifiedProviderService] LM Studio native structured output finished. Usage: ${JSON.stringify(result.usage)}`
        )
      }

      return result
    } catch (error: any) {
      if (error instanceof ApiError) throw error
      logModelError(resolvedProvider, model || '', error)
      throw mapProviderErrorToApiError(error, resolvedProvider, 'generateStructuredData')
    }
  }

  // If provider doesn't support structured output, use text generation with JSON parsing
  if (!supportsStructuredOutput) {
    if (debug) {
      console.log(
        `[UnifiedProviderService] Provider ${resolvedProvider} doesn't support structured output, using text generation fallback`
      )
    }

    try {
      return await generateStructuredDataViaTextFallback({
        prompt,
        schema,
        systemMessage,
        finalOptions,
        provider: resolvedProvider,
        debug
      })
    } catch (error: any) {
      if (error instanceof ApiError) throw error
      logModelError(resolvedProvider, model || '', error)
      throw mapProviderErrorToApiError(error, resolvedProvider, 'generateStructuredData')
    }
  }

  // Provider supports structured output, use generateObject
  const modelInstance = await getProviderLanguageModelInterface(resolvedProvider, { ...finalOptions, model: model })

  try {
    // Wrap the AI call in retry logic
    const result = await retryOperation(
      async () => {
        const aiSdkOptions = convertDbOptionsToAiSdk(finalOptions)
        const result = await generateObject({
          model: modelInstance,
          schema: schema,
          prompt: prompt,
          system: systemMessage,
          ...aiSdkOptions
        })

        if (debug) {
          logModelCompletion(resolvedProvider, model || '', normalizeUsage(result.usage))
        }

        return result
      },
      {
        maxRetries: 3,
        shouldRetry: (error: any) => {
          // Map the error to check if it's retryable
          const mappedError = mapProviderErrorToApiError(error, resolvedProvider, 'generateStructuredData')
          // Don't retry JSON parsing errors here - let the caller handle fallback
          if (mappedError.code === 'PROVIDER_JSON_PARSE_ERROR') {
            return false
          }
          return (
            mappedError.code === 'RATE_LIMIT_EXCEEDED' ||
            mappedError.code === 'PROVIDER_UNAVAILABLE' ||
            mappedError.status >= 500
          )
        }
      }
    )

    const normalizedUsage = normalizeUsage(result.usage)

    return {
      object: result.object as z.infer<T>,
      usage: {
        completionTokens: normalizedUsage?.completionTokens ?? 0,
        promptTokens: normalizedUsage?.promptTokens ?? 0,
        totalTokens: normalizedUsage?.totalTokens ??
          (normalizedUsage?.promptTokens ?? 0) + (normalizedUsage?.completionTokens ?? 0)
      },
      finishReason: result.finishReason
    }
  } catch (error: any) {
    const mappedError =
      error instanceof ApiError
        ? error
        : mapProviderErrorToApiError(error, resolvedProvider, 'generateStructuredData')

    if (mappedError.code === 'PROVIDER_JSON_PARSE_ERROR') {
      try {
        return await generateStructuredDataViaTextFallback({
          prompt,
          schema,
          systemMessage,
          finalOptions,
          provider: resolvedProvider,
          debug
        })
      } catch (fallbackError: any) {
        const fallbackMapped =
          fallbackError instanceof ApiError
            ? fallbackError
            : mapProviderErrorToApiError(fallbackError, resolvedProvider, 'generateStructuredData')
        logModelError(resolvedProvider, model || '', fallbackError)
        throw fallbackMapped
      }
    }

    if (!(error instanceof ApiError)) {
      logModelError(resolvedProvider, model || '', error)
    }
    throw mappedError
  }
}

export async function genTextStream({
  prompt,
  messages,
  options = {},
  systemMessage,
  debug = false
}: {
  prompt?: string
  messages?: ModelMessage[]
  options?: AiSdkCompatibleOptions
  systemMessage?: string
  debug?: boolean
}): Promise<StreamWithState> {
  const requestedProvider = (options.provider || 'openai') as APIProviders
  const { options: finalOptions } = await buildModelRequestOptions({
    provider: requestedProvider,
    model: options.model,
    overrides: options,
    debug
  })
  const provider = (finalOptions.provider || 'openai') as APIProviders

  if (!prompt && (!messages || messages.length === 0)) {
    throw ErrorFactory.missingRequired('prompt or messages', 'genTextStream')
  }

  let modelIdentifier = finalOptions.model || ''

  const finishState: StreamFinishState = { finishReason: 'unknown' }

  try {
    const modelInstance = await getProviderLanguageModelInterface(provider, finalOptions, debug)
    modelIdentifier = resolveModelIdentifier(finalOptions.model, modelInstance)

    let messagesToProcess: ModelMessage[] = []
    if (systemMessage) {
      messagesToProcess.push(createTextModelMessage('system', systemMessage))
    }
    if (messages) {
      messagesToProcess.push(...messages)
    }
    if (prompt) {
      const lastMessage = messagesToProcess[messagesToProcess.length - 1]
      if (!lastMessage || !(lastMessage.role === 'user' && lastMessage.content === prompt)) {
        messagesToProcess.push(createTextModelMessage('user', prompt))
      }
    }

    if (messagesToProcess.length === 0) {
      throw ErrorFactory.invalidInput('messages', 'at least one valid message', messagesToProcess, {
        context: 'genTextStream',
        provider,
        model: modelIdentifier
      })
    }

    // Log model usage
    logModelUsage({
      provider: provider,
      model: modelIdentifier,
      temperature: finalOptions.temperature,
      maxTokens: finalOptions.maxTokens,
      topP: finalOptions.topP,
      frequencyPenalty: finalOptions.frequencyPenalty,
      presencePenalty: finalOptions.presencePenalty,
      mode: 'stream'
    })

    if (debug) {
      console.log(`[UnifiedProviderService - genTextStream] Messages:`, messagesToProcess.length)
    }

    const aiSdkOptions = convertDbOptionsToAiSdk(finalOptions)
    const stream = await streamText({
      model: modelInstance,
      messages: messagesToProcess,
      ...aiSdkOptions,
      ...(finalOptions.responseFormat && {
        responseFormat: finalOptions.responseFormat
      }),

      onFinish: ({ usage, finishReason }) => {
        const normalized = normalizeUsage(usage)
        if (debug) {
          logModelCompletion(provider, modelIdentifier, normalized)
        }
        finishState.finishReason = finishReason ?? 'stop'
        if (normalized) {
          finishState.usage = normalized
        }
      },
      onError: (error) => {
        console.error(
          `[UnifiedProviderService - genTextStream] Error during stream for ${provider}/${modelIdentifier}:`,
          error
        )
        finishState.finishReason = 'error'
      }
    })

    return { stream, finishState }
  } catch (error: any) {
    if (error instanceof ApiError) throw error
    logModelError(provider, modelIdentifier, error)
    throw mapProviderErrorToApiError(error, provider, 'genTextStream')
  }
}

const buildUsagePayload = (usage?: NormalizedUsage) => {
  if (!usage) return undefined
  const payload: { promptTokens?: number; completionTokens?: number } = {}

  if (typeof usage.promptTokens === 'number' && Number.isFinite(usage.promptTokens)) {
    payload.promptTokens = usage.promptTokens
  }

  if (typeof usage.completionTokens === 'number' && Number.isFinite(usage.completionTokens)) {
    payload.completionTokens = usage.completionTokens
  }

  return Object.keys(payload).length > 0 ? payload : undefined
}

type UiEventType =
  | 'start'
  | 'start-step'
  | 'finish-step'
  | 'finish'
  | 'abort'
  | 'text-start'
  | 'text-delta'
  | 'text-end'
  | 'reasoning'
  | 'reasoning-start'
  | 'reasoning-delta'
  | 'reasoning-end'
  | 'tool-input-delta'
  | 'tool-input-available'
  | 'tool-input-error'
  | 'tool-output-available'
  | 'tool-output-error'
  | 'message-metadata'
  | 'source-url'
  | 'source-document'
  | 'file'
  | 'error'

const ensureId = (prefix: string, id?: unknown): string =>
  typeof id === 'string' && id.length > 0
    ? id
    : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

export function toDataStreamResponse(
  { stream, finishState }: StreamWithState,
  options: { onComplete?: () => void } = {}
): Response {
  const encoder = new TextEncoder()
  const uiStream = stream.toUIMessageStream()
  const headers = {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  }

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      const toolInputs = new Map<string, unknown>()
      let hasTextOutput = false
      let lastTextId: string | undefined
      let lastReasoningId: string | undefined
      let closed = false

      const emit = (type: UiEventType, value: unknown) => {
        if (closed) return
        try {
          const payload = formatDataStreamPart(type as any, value as any)
          controller.enqueue(encoder.encode(payload))
        } catch (err) {
          console.error('[UnifiedProviderService] Failed to format UI stream part', {
            type,
            error: err,
            value
          })
        }
      }

      const emitTextBlock = (text: string) => {
        if (!text) return
        const id = ensureId('txt', lastTextId)
        lastTextId = id
        emit('text-start', { type: 'text-start', id })
        emit('text-delta', { type: 'text-delta', id, delta: text })
        emit('text-end', { type: 'text-end', id })
        hasTextOutput = true
      }

      try {
        for await (const chunk of uiStream) {
          if (!chunk || typeof chunk !== 'object' || !('type' in chunk)) continue
          const c: any = chunk
          const chunkType = String(c.type)

          if (process.env.PROMPTLIANO_DEBUG_STREAM === 'true') {
            try {
              console.debug('[ChatStream][raw]', chunkType.replace(/_/g, '-'), JSON.stringify(c))
            } catch (logError) {
              console.debug('[ChatStream][raw][error]', logError)
            }
          }

          switch (chunkType) {
            case 'start': {
              emit('start', { type: 'start' })
              break
            }
            case 'start-step':
            case 'start_step': {
              emit('start-step', { type: 'start-step' })
              break
            }
            case 'finish-step':
            case 'finish_step': {
              emit('finish-step', { type: 'finish-step' })
              break
            }
            case 'text-start':
            case 'text_start': {
              const id = ensureId('txt', c.id)
              lastTextId = id
              emit('text-start', { type: 'text-start', id })
              break
            }
            case 'text-delta':
            case 'text_delta':
            case 'response_output_text_delta':
            case 'response_text_delta': {
              const id = ensureId('txt', c.id ?? lastTextId)
              lastTextId = id
              const delta =
                typeof c.delta === 'string'
                  ? c.delta
                  : typeof c.text === 'string'
                    ? c.text
                    : extractString(c.delta ?? c.text)
              if (delta && delta.length > 0) {
                emit('text-delta', { type: 'text-delta', id, delta })
                hasTextOutput = true
              }
              break
            }
            case 'text-end':
            case 'text_end': {
              const id = ensureId('txt', c.id ?? lastTextId)
              emit('text-end', { type: 'text-end', id })
              break
            }
            case 'text':
            case 'response_output_text':
            case 'response_text': {
              const text =
                typeof c.text === 'string'
                  ? c.text
                  : extractString(c.text ?? c.value ?? c.message)
              if (text && text.length > 0) emitTextBlock(text)
              break
            }
            case 'assistant_message':
            case 'assistant-message':
            case 'response_message':
            case 'response_message_delta': {
              const message =
                c.message ??
                c.value ??
                (c.delta && typeof c.delta === 'object' ? (c.delta as any).message : undefined)
              if (message && typeof message === 'object') {
                const extracted = extractTextFromAssistantMessage(message as AssistantModelMessage)
                if (extracted && extracted.length > 0) emitTextBlock(extracted)
              }
              break
            }
            case 'reasoning-start':
            case 'reasoning_start': {
              const id = ensureId('reasoning', c.id ?? lastReasoningId)
              lastReasoningId = id
              emit('reasoning-start', { type: 'reasoning-start', id })
              break
            }
            case 'reasoning-delta':
            case 'reasoning_delta': {
              const id = ensureId('reasoning', c.id ?? lastReasoningId)
              lastReasoningId = id
              const delta = typeof c.delta === 'string' ? c.delta : extractString(c.delta)
              if (delta && delta.length > 0) {
                emit('reasoning-delta', { type: 'reasoning-delta', id, delta })
              }
              break
            }
            case 'reasoning-end':
            case 'reasoning_end': {
              const id = ensureId('reasoning', c.id ?? lastReasoningId)
              emit('reasoning-end', { type: 'reasoning-end', id })
              break
            }
            case 'reasoning': {
              const text = typeof c.text === 'string' ? c.text : extractString(c.text)
              if (text && text.length > 0) emit('reasoning', { type: 'reasoning', text })
              break
            }
            case 'tool-input-start':
            case 'tool_input_start': {
              // The UI schema does not define a tool-input-start event; ignore.
              break
            }
            case 'tool-input-delta':
            case 'tool_input_delta': {
              const toolCallId = String(c.toolCallId ?? '')
              const delta =
                typeof c.inputTextDelta === 'string'
                  ? c.inputTextDelta
                  : extractString(c.inputTextDelta)
              if (delta && delta.length > 0) {
                toolInputs.set(toolCallId, (toolInputs.get(toolCallId) ?? '') + delta)
              }
              break
            }
            case 'tool-input-available':
            case 'tool_input_available': {
              const input = c.input ?? {}
              toolInputs.set(c.toolCallId, input)
              const payload: Record<string, unknown> = {
                type: 'tool-input-available',
                toolCallId: c.toolCallId,
                input
              }
              if (c.providerExecuted !== undefined) payload.providerExecuted = !!c.providerExecuted
              if (c.dynamic !== undefined) payload.dynamic = !!c.dynamic
              emit('tool-input-available', payload)
              break
            }
            case 'tool-input-error':
            case 'tool_input_error': {
              const input = c.input ?? {}
              toolInputs.set(c.toolCallId, input)
              emit('tool-input-error', {
                type: 'tool-input-error',
                toolCallId: c.toolCallId,
                input,
                errorText: typeof c.errorText === 'string' ? c.errorText : 'Tool input failed'
              })
              break
            }
            case 'tool-output-available':
            case 'tool_output_available': {
              const payload: Record<string, unknown> = {
                type: 'tool-output-available',
                toolCallId: c.toolCallId,
                output: c.output
              }
              if (c.providerExecuted !== undefined) payload.providerExecuted = !!c.providerExecuted
              if (c.dynamic !== undefined) payload.dynamic = !!c.dynamic
              emit('tool-output-available', payload)
              break
            }
            case 'tool-output-error':
            case 'tool_output_error': {
              emit('tool-output-error', {
                type: 'tool-output-error',
                toolCallId: c.toolCallId,
                errorText: typeof c.errorText === 'string' ? c.errorText : 'Tool execution failed',
                ...(c.providerExecuted !== undefined ? { providerExecuted: !!c.providerExecuted } : {}),
                ...(c.dynamic !== undefined ? { dynamic: !!c.dynamic } : {})
              })
              break
            }
            case 'message-metadata':
            case 'message_metadata': {
              if (Array.isArray(c.messageMetadata)) {
                emit('message-metadata', {
                  type: 'message-metadata',
                  messageMetadata: c.messageMetadata
                })
              }
              break
            }
            case 'error': {
              const errorText = typeof c.errorText === 'string' ? c.errorText : 'Stream error'
              emit('error', { type: 'error', errorText })
              break
            }
            default: {
              const extracted = extractString(c.delta ?? c.text ?? c.value ?? c.message)
              if (extracted && extracted.length > 0) emitTextBlock(extracted)
              break
            }
          }
        }
      } catch (err) {
        emit('error', {
          type: 'error',
          errorText: err instanceof Error ? err.message : String(err)
        })
      } finally {
        if (!hasTextOutput) {
          const placeholder = 'No response was generated.'
          let fallbackText = finishState.finalText
          if (fallbackText) {
            const trimmed = fallbackText.trim()
            if (trimmed.length === 0) {
              fallbackText = undefined
            } else if (trimmed === placeholder && finishState.lastToolResultText) {
              fallbackText = finishState.lastToolResultText
            }
          }

          if (!fallbackText && finishState.lastToolResultText) {
            fallbackText = finishState.lastToolResultText
          }

          if (fallbackText && fallbackText.trim().length > 0) {
            emitTextBlock(fallbackText)
          }
        }

        const finishPayload: Record<string, unknown> = {
          type: 'finish',
          finishReason: finishState.finishReason ?? 'stop'
        }
        const usagePayload = buildUsagePayload(finishState.usage)
        if (usagePayload) finishPayload.usage = usagePayload

        emit('finish', finishPayload)

        try {
          options.onComplete?.()
        } catch (error) {
          console.error('[UnifiedProviderService] Failed to run stream completion callback:', error)
        }

        if (!closed) {
          closed = true
          controller.close()
        }
      }
    }
  })

  return new Response(readable, {
    headers
  })
}

export async function generateChatName(chatContent: string): Promise<string> {
  try {
    const chatNamingConfig = structuredDataSchemas.chatNaming
    const result = await generateStructuredData({
      prompt: chatContent,
      schema: chatNamingConfig.schema,
      systemMessage: chatNamingConfig.systemPrompt,
      options: chatNamingConfig.modelSettings || {}
    })

    return result.object.chatName
  } catch (error) {
    console.error('[generateChatName] Error generating chat name:', error)
    // Return a default name if generation fails
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return `Chat ${timestamp}`
  }
}

export async function generateTabName(
  projectName: string,
  selectedFiles: string[] = [],
  context?: string
): Promise<string> {
  try {
    const tabNamingConfig = structuredDataSchemas.tabNaming

    // Prepare the prompt with the provided information
    const selectedFilesStr =
      selectedFiles.length > 0
        ? selectedFiles.slice(0, 5).join(', ') + (selectedFiles.length > 5 ? '...' : '')
        : 'No specific files selected'

    const promptData = `Project Name: ${projectName}, Selected Files: ${selectedFilesStr}, Context: ${context || 'General project work'}`

    const result = await generateStructuredData({
      prompt: promptData,
      schema: tabNamingConfig.schema,
      systemMessage: tabNamingConfig.systemPrompt,
      options: tabNamingConfig.modelSettings || {}
    })

    return result.object.tabName
  } catch (error) {
    console.error('[generateTabName] Error generating tab name:', error)
    // Return a default name if generation fails
    return `${projectName} Tab`
  }
}
