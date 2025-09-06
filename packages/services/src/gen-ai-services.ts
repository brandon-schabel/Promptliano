import { z } from 'zod'
import { type CoreMessage, type LanguageModel, streamText, generateText, generateObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { createChatService } from './chat-service'
import { createProviderKeyService } from './provider-key-service'
import { createModelConfigService } from './model-config-service'
import { chatRepository } from '@promptliano/database'
import type { APIProviders, ProviderKey } from '@promptliano/database'
import { getProvidersConfig, LOW_MODEL_CONFIG } from '@promptliano/config'
import { structuredDataSchemas } from '@promptliano/schemas' // AI generation schemas - may remain in schemas package

import { ApiError } from '@promptliano/shared'
import { mapProviderErrorToApiError } from './error-mappers'
import { ErrorFactory, assertExists } from '@promptliano/shared'
import { retryOperation } from './utils/bulk-operations'
import { getProviderUrl } from './provider-settings-service'
import { LMStudioProvider } from './providers/lmstudio-provider'
import { mergeHeaders } from './utils/header-sanitizer'
import { nullToUndefined } from './utils/file-utils'
import { logModelUsage, logModelError, logModelCompletion } from './utils/model-usage-logger'

const providersConfig = getProvidersConfig()

// AI SDK compatible options type for function parameters
interface AiSdkCompatibleOptions {
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

// Stream request interface for chat handling
interface AiChatStreamRequest {
  chatId: number
  userMessage: string
  options?: AiSdkCompatibleOptions
  systemMessage?: string
  tempId?: string
  debug?: boolean
  enableChatAutoNaming?: boolean
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
function convertDbOptionsToAiSdk(dbOptions: AiSdkCompatibleOptions): {
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
  enableChatAutoNaming = false
}: AiChatRequest): Promise<ReturnType<typeof streamText>> {
  let finalAssistantMessageId: number | undefined
  
  // Get dynamic model configuration
  const modelConfigService = createModelConfigService()
  const provider = (options.provider || 'openai') as APIProviders
  
  // Try to get default config for provider, or use provided options
  let defaultConfig = await modelConfigService.getDefaultConfig(provider)
  
  // If no default config found, use the provided options as fallback
  const finalOptions = defaultConfig 
    ? { 
        provider: defaultConfig.provider,
        model: defaultConfig.model,
        temperature: defaultConfig.temperature,
        maxTokens: defaultConfig.maxTokens,
        topP: defaultConfig.topP,
        topK: defaultConfig.topK,
        frequencyPenalty: defaultConfig.frequencyPenalty,
        presencePenalty: defaultConfig.presencePenalty,
        ...options // User options override defaults
      }
    : options
  const chatService = createChatService()
  const modelInstance = await getProviderLanguageModelInterface(finalOptions.provider as APIProviders, finalOptions)
  let messagesToProcess: CoreMessage[] = []

  if (systemMessage) {
    messagesToProcess.push({ role: 'system', content: systemMessage })
  }

  const dbMessages = (await chatRepository.getMessages(chatId)).map((msg) => ({
    role: msg.role as 'user' | 'assistant' | 'system',
    content: msg.content
  }))

  // Check if this is the first user message for auto-naming
  const isFirstUserMessage = dbMessages.filter((msg) => msg.role === 'user').length === 0

  messagesToProcess.push(...dbMessages)

  const savedUserMessage = await chatService.addMessage(chatId, {
    role: 'user',
    content: userMessage,
    metadata: tempId ? { tempId: `${tempId}-user` } : undefined
  })

  messagesToProcess.push({ role: 'user', content: userMessage })

  // Update timestamp will be handled by the repository automatically

  const initialAssistantMessage = await chatService.addMessage(chatId, {
    role: 'assistant',
    content: '...',
    metadata: tempId ? { tempId } : undefined
  })
  finalAssistantMessageId = initialAssistantMessage.id

  const aiSdkOptions = convertDbOptionsToAiSdk(finalOptions)

  return streamText({
    model: modelInstance,
    messages: messagesToProcess,
    ...aiSdkOptions,
    // Pass through responseFormat if provided in options
    ...(finalOptions.responseFormat && {
      responseFormat: finalOptions.responseFormat
    }),

    // Handle completion and errors
    onFinish: async ({ text, usage, finishReason }) => {
      if (debug) {
        logModelCompletion(
          finalOptions.provider as string,
          finalOptions.model as string,
          usage
        )
      }

      const finalContent = text || ''

      // Update the placeholder Assistant Message with Final Content
      if (finalAssistantMessageId) {
        try {
          // Update message content by deleting and recreating (since messages don't have update)
          await chatRepository.deleteMessage(finalAssistantMessageId)
          await chatService.addMessage(chatId, {
            role: 'assistant',
            content: finalContent
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
    },
    onError: (error) => {
      console.error(`[UnifiedProviderService] Error during stream for ${provider}/${modelInstance.modelId}:`, error)

      // Map the error to get better details
      const mappedError = mapProviderErrorToApiError(error, provider, 'streamChat')

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
async function getProviderLanguageModelInterface(
  provider: APIProviders | string,
  options: AiSdkCompatibleOptions = {},
  debug: boolean = false
): Promise<LanguageModel> {
  // Use dynamic preset config with fallback to static for compatibility
  const modelConfigService = createModelConfigService()
  const defaultConfig = await modelConfigService.getPresetConfig('low').catch(() => LOW_MODEL_CONFIG)
  const finalOptions = { ...defaultConfig, ...options }
  const modelId = finalOptions.model || defaultConfig.model || ''

  if (!modelId) {
    throw ErrorFactory.missingRequired('Model ID', `provider ${provider}`)
  }

  if (debug) {
    console.log(`[UnifiedProviderService] Initializing model: Provider=${provider}, ModelID=${modelId}`)
  }

  // Check if this is a custom provider with format "custom_<keyId>"
  if (typeof provider === 'string' && provider.startsWith('custom_')) {
    const keyId = parseInt(provider.replace('custom_', ''), 10)
    if (!isNaN(keyId)) {
      // Get the specific custom provider key
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

      // Ensure URL is properly formatted for OpenAI compatibility
      const customUrl = baseURL.endsWith('/v1') ? baseURL : `${baseURL.replace(/\/$/, '')}/v1`

      if (debug) {
        console.log(`[UnifiedProviderService] Using custom provider at: ${customUrl}`)
      }

      // Prepare headers if any custom headers are defined
      const customHeaders = customKey.customHeaders || {}

      // Use OpenAI SDK with custom configuration
      return createOpenAI({
        baseURL: customUrl,
        apiKey,
        headers: customHeaders,
        compatibility: 'compatible' // Use compatible mode for flexibility
      })(modelId)
    }
  }

  switch (provider) {
    case 'openai': {
      const apiKey = await getKey('openai', debug)
      return createOpenAI({ apiKey })(modelId)
    }
    case 'anthropic': {
      const apiKey = await getKey('anthropic', debug)
      if (!apiKey && !process.env.ANTHROPIC_API_KEY)
        throw ErrorFactory.missingRequired('Anthropic API Key', 'database or environment')
      return createAnthropic({ apiKey })(modelId)
    }
    case 'google_gemini': {
      const apiKey = await getKey('google_gemini', debug)
      if (!apiKey && !process.env.GOOGLE_GENERATIVE_AI_API_KEY)
        throw ErrorFactory.missingRequired('Google Gemini API Key', 'database or environment')
      return createGoogleGenerativeAI({ apiKey })(modelId)
    }
    case 'groq': {
      const apiKey = await getKey('groq', debug)
      if (!apiKey && !process.env.GROQ_API_KEY)
        throw ErrorFactory.missingRequired('Groq API Key', 'database or environment')
      return createGroq({ apiKey })(modelId)
    }
    case 'openrouter': {
      const apiKey = (await getKey('openrouter', debug)) || process.env.OPENROUTER_API_KEY
      if (!apiKey) throw ErrorFactory.missingRequired('OpenRouter API Key', 'database or environment')
      const defaultHeaders: Record<string, string> = {
        Referer: process.env.OPENROUTER_SITE_URL || 'http://localhost:1420',
        'X-Title': process.env.OPENROUTER_APP_TITLE || 'Promptliano'
      }
      return createOpenRouter({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        headers: defaultHeaders
      })(modelId)
    }
    // --- OpenAI Compatible Providers ---
    case 'lmstudio': {
      // Priority: options > provider settings > config
      let lmStudioUrl = options.lmstudioUrl || getProviderUrl('lmstudio') || providersConfig.lmstudio.baseURL
      if (!lmStudioUrl) throw ErrorFactory.missingRequired('LMStudio Base URL', 'configuration')

      // Log when custom URL is detected
      if (options.lmstudioUrl || getProviderUrl('lmstudio')) {
        console.log(`[UnifiedProviderService] Using custom LMStudio URL: ${lmStudioUrl}`)
      }

      // Ensure URL ends with /v1 for OpenAI compatibility
      if (!lmStudioUrl.endsWith('/v1')) {
        lmStudioUrl = lmStudioUrl.replace(/\/$/, '') + '/v1'
      }

      // LM Studio supports structured outputs via json_schema format
      // Note: The Vercel AI SDK's generateObject doesn't map correctly to LM Studio's format
      // so we mark it as not supporting structured output and use text fallback
      return createOpenAI({
        baseURL: lmStudioUrl,
        apiKey: 'lm-studio-ignored-key',
        compatibility: 'strict' // Use strict mode for better compatibility
      })(modelId)
    }
    case 'xai': {
      const apiKey = await getKey('xai', debug)
      if (!apiKey) throw ErrorFactory.missingRequired('XAI API Key', 'database')
      return createOpenAI({ baseURL: 'https://api.x.ai/v1', apiKey })(modelId)
    }
    case 'together': {
      const apiKey = await getKey('together', debug)
      if (!apiKey) throw ErrorFactory.missingRequired('Together API Key', 'database')
      return createOpenAI({ baseURL: 'https://api.together.xyz/v1', apiKey })(modelId)
    }
    // --- Custom OpenAI-Compatible Provider ---
    case 'custom': {
      // Get the provider key to access custom configuration
      const customKey = await getProviderKeyById(provider, debug)
      if (!customKey) {
        throw ErrorFactory.notFound('Custom provider configuration', 'default')
      }

      const baseURL = customKey.baseUrl
      if (!baseURL) {
        throw ErrorFactory.missingRequired('Base URL', 'custom provider')
      }

      const apiKey = await getKey('custom', debug)
      if (!apiKey) {
        throw ErrorFactory.missingRequired('API key', 'custom provider')
      }

      // Ensure URL is properly formatted for OpenAI compatibility
      const customUrl = baseURL.endsWith('/v1') ? baseURL : `${baseURL.replace(/\/$/, '')}/v1`

      if (debug) {
        console.log(`[UnifiedProviderService] Using custom provider at: ${customUrl}`)
      }

      // Prepare base headers for API key
      const baseHeaders = {
        Authorization: `Bearer ${apiKey}`
      }

      // Merge with sanitized custom headers
      const sanitizedHeaders = mergeHeaders(baseHeaders, nullToUndefined(customKey.customHeaders))

      // Remove the Authorization header since OpenAI SDK handles it separately
      const { Authorization, ...customHeaders } = sanitizedHeaders

      // Use OpenAI SDK with custom configuration
      return createOpenAI({
        baseURL: customUrl,
        apiKey,
        headers: customHeaders,
        compatibility: 'compatible' // Use compatible mode for flexibility
      })(modelId)
    }
    // --- Local Providers ---
    case 'ollama': {
      // Priority: options > provider settings > config
      const ollamaUrl = options.ollamaUrl || getProviderUrl('ollama') || providersConfig.ollama.baseURL
      if (!ollamaUrl) throw ErrorFactory.missingRequired('Ollama Base URL', 'configuration')

      // Log when custom URL is detected
      if (options.ollamaUrl || getProviderUrl('ollama')) {
        console.log(`[UnifiedProviderService] Using custom Ollama URL: ${ollamaUrl}`)
      }

      // Use OpenAI provider with Ollama's OpenAI-compatible API
      return createOpenAI({
        baseURL: `${ollamaUrl}/v1`,
        apiKey: 'ollama' // Ollama doesn't need a real API key
      })(modelId)
    }
    default:
      console.error(`[UnifiedProviderService] Unsupported provider: ${provider}. Attempting fallback to OpenAI.`)
      // Fallback logic
      try {
        const fallbackApiKey = await getKey('openai', debug)
        const modelConfigService = createModelConfigService()
        const lowConfig = await modelConfigService.getPresetConfig('low').catch(() => LOW_MODEL_CONFIG)
        const fallbackModel = lowConfig.model ?? 'gpt-4o'
        return createOpenAI({ apiKey: fallbackApiKey })(fallbackModel)
      } catch (fallbackError: any) {
        throw ErrorFactory.operationFailed(
          `provider ${provider} with OpenAI fallback`,
          `Both provider and fallback failed. Fallback error: ${fallbackError.message}`
        )
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
  messages?: CoreMessage[]
  options?: AiSdkCompatibleOptions
  systemMessage?: string
  debug?: boolean
}): Promise<string> {
  // Get dynamic model configuration
  const modelConfigService = createModelConfigService()
  const provider = (options.provider || 'openai') as APIProviders
  
  // Try to get default config for provider
  let defaultConfig = await modelConfigService.getDefaultConfig(provider)
  
  // Merge with provided options
  const finalOptions = defaultConfig 
    ? { 
        provider: defaultConfig.provider,
        model: defaultConfig.model,
        temperature: defaultConfig.temperature,
        maxTokens: defaultConfig.maxTokens,
        topP: defaultConfig.topP,
        topK: defaultConfig.topK,
        frequencyPenalty: defaultConfig.frequencyPenalty,
        presencePenalty: defaultConfig.presencePenalty,
        ...options // User options override defaults
      }
    : options
    
  if (!prompt && (!messages || messages.length === 0)) {
    throw ErrorFactory.missingRequired('prompt or messages', 'generateSingleText')
  }

  try {
    const modelInstance = await getProviderLanguageModelInterface(provider, finalOptions)

    let messagesToProcess: CoreMessage[] = []
    if (systemMessage) {
      messagesToProcess.push({ role: 'system', content: systemMessage })
    }
    if (messages) {
      messagesToProcess.push(...messages)
    }
    if (prompt) {
      messagesToProcess.push({ role: 'user', content: prompt })
    }

    // Log model usage
    logModelUsage({
      provider: provider,
      model: finalOptions.model || '',
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
        const { text, usage, finishReason } = await generateText({
          model: modelInstance,
          messages: messagesToProcess,
          ...aiSdkOptions
        })

        if (debug) {
          logModelCompletion(
            provider,
            finalOptions.model || modelInstance.modelId,
            usage
          )
        }

        return text
      },
      {
        maxRetries: 3,
        shouldRetry: (error: any) => {
          // Map the error to check if it's retryable
          const mappedError = mapProviderErrorToApiError(error, provider, 'generateSingleText')
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
    logModelError(provider, finalOptions.model || '', error)
    throw mapProviderErrorToApiError(error, provider, 'generateSingleText')
  }
}

// Helper function for generating structured JSON objects.
export async function generateStructuredData<T extends z.ZodType<any, z.ZodTypeDef, any>>({
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
  // Get dynamic model configuration
  const modelConfigService = createModelConfigService()
  const provider = (options.provider || 'openai') as APIProviders
  
  // Try to get default config for provider
  let defaultConfig = await modelConfigService.getDefaultConfig(provider)
  
  // Merge with provided options
  const finalOptions = defaultConfig 
    ? { 
        provider: defaultConfig.provider,
        model: defaultConfig.model,
        temperature: defaultConfig.temperature,
        maxTokens: defaultConfig.maxTokens,
        topP: defaultConfig.topP,
        topK: defaultConfig.topK,
        frequencyPenalty: defaultConfig.frequencyPenalty,
        presencePenalty: defaultConfig.presencePenalty,
        ...options // User options override defaults
      }
    : options

  const model = finalOptions.model || 'default'

  if (!prompt) {
    throw ErrorFactory.missingRequired('prompt', 'generateStructuredData')
  }

  // Check if provider supports structured output
  const providerKey = provider as keyof typeof PROVIDER_CAPABILITIES
  const supportsStructuredOutput = PROVIDER_CAPABILITIES[providerKey]?.structuredOutput ?? true
  const useCustomProvider = PROVIDER_CAPABILITIES[providerKey]?.useCustomProvider ?? false

  // Log model usage
  logModelUsage({
    provider: provider,
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
  if (provider === 'lmstudio' && useCustomProvider) {
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
      logModelError(provider, model || '', error)
      throw mapProviderErrorToApiError(error, provider, 'generateStructuredData')
    }
  }

  // If provider doesn't support structured output, use text generation with JSON parsing
  if (!supportsStructuredOutput) {
    if (debug) {
      console.log(
        `[UnifiedProviderService] Provider ${provider} doesn't support structured output, using text generation fallback`
      )
    }

    try {
      // Create a prompt that instructs the model to output JSON
      // Get example structure from the schema using a safer approach
      const exampleStructure: any = {}
      try {
        // Try to parse a minimal example to understand the structure
        const testObj = schema.safeParse({})
        if (!testObj.success && testObj.error) {
          // Extract field names from error messages
          for (const issue of testObj.error.issues) {
            if (issue.path.length > 0 && issue.path[0] !== undefined) {
              const fieldName = issue.path[0].toString()
              if (issue.code === 'invalid_type') {
                if (issue.expected === 'string') {
                  exampleStructure[fieldName] = 'string value here'
                } else if (issue.expected === 'number') {
                  exampleStructure[fieldName] = 0
                } else if (issue.expected === 'boolean') {
                  exampleStructure[fieldName] = false
                } else if (issue.expected === 'array') {
                  exampleStructure[fieldName] = []
                } else if (issue.expected === 'object') {
                  exampleStructure[fieldName] = {}
                } else {
                  exampleStructure[fieldName] = null
                }
              }
            }
          }
        }
      } catch (e) {
        // Fallback to empty object if schema introspection fails
        console.warn('Could not introspect schema for example structure')
      }

      const jsonPrompt = `${systemMessage ? systemMessage + '\n\n' : ''}${prompt}

IMPORTANT: Return ONLY valid JSON matching this exact structure, nothing else:
${JSON.stringify(exampleStructure, null, 2)}

Your entire response must be a single JSON object. Do not explain, do not add any text before or after.
Start your response with { and end with }`

      // Use text generation
      const textResult = await generateSingleText({
        prompt: jsonPrompt,
        options: finalOptions,
        debug
      })

      if (debug) {
        console.log(`[UnifiedProviderService] Raw text response from ${provider}:`, textResult)
      }

      // Try to extract JSON from the response
      let jsonStr = textResult.trim()

      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7)
      }
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3)
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3)
      }
      jsonStr = jsonStr.trim()

      // Try to extract JSON from the response - handle various formats
      // Some models include extra text before/after the JSON
      const jsonPatterns = [
        /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/, // Match complete JSON object with nested objects
        /\[[\s\S]*\]/ // Match first complete JSON array
      ]

      let extractedJson: string | null = null
      for (const pattern of jsonPatterns) {
        const matches = jsonStr.match(pattern)
        if (matches) {
          // Try to parse each match to find valid JSON
          for (const match of matches) {
            try {
              JSON.parse(match)
              extractedJson = match
              break
            } catch {
              // Continue to next match
            }
          }
          if (extractedJson) break
        }
      }

      if (extractedJson) {
        jsonStr = extractedJson
      }

      // Parse and validate the JSON
      let parsedObject: any
      try {
        parsedObject = JSON.parse(jsonStr)
      } catch (parseError) {
        console.error(`[UnifiedProviderService] Failed to parse JSON from ${provider} response:`, jsonStr)

        // For local models, provide a more helpful error message
        if (provider === 'lmstudio' || provider === 'ollama') {
          throw ErrorFactory.operationFailed(
            `${provider} JSON generation`,
            'Model did not return valid JSON. This may happen with smaller models (< 7B parameters). Try using a larger model or a different provider.'
          )
        }

        throw ErrorFactory.operationFailed(`${provider} JSON generation`, 'Model did not return valid JSON response.')
      }

      // Validate against schema
      const validatedObject = schema.parse(parsedObject)

      // Return in the same format as generateObject
      return {
        object: validatedObject,
        usage: {
          completionTokens: 0, // We don't have exact token counts from generateSingleText
          promptTokens: 0,
          totalTokens: 0
        },
        finishReason: 'stop'
      }
    } catch (error: any) {
      if (error instanceof ApiError) throw error
      logModelError(provider, model || '', error)
      console.error(
        `[UnifiedProviderService - generateStructuredData] Text generation fallback error for ${provider}:`,
        error
      )
      throw mapProviderErrorToApiError(error, provider, 'generateStructuredData')
    }
  }

  // Provider supports structured output, use generateObject
  const modelInstance = await getProviderLanguageModelInterface(provider, { ...finalOptions, model: model })

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
          logModelCompletion(
            provider,
            model || '',
            result.usage
          )
        }

        return result
      },
      {
        maxRetries: 3,
        shouldRetry: (error: any) => {
          // Map the error to check if it's retryable
          const mappedError = mapProviderErrorToApiError(error, provider, 'generateStructuredData')
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

    return result
  } catch (error: any) {
    if (error instanceof ApiError) throw error
    logModelError(provider, model || '', error)
    throw mapProviderErrorToApiError(error, provider, 'generateStructuredData')
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
  messages?: CoreMessage[]
  options?: AiSdkCompatibleOptions
  systemMessage?: string
  debug?: boolean
}): Promise<ReturnType<typeof streamText>> {
  // Use dynamic preset config with fallback to static for compatibility
  const modelConfigService = createModelConfigService()
  const defaultConfig = await modelConfigService.getPresetConfig('low').catch(() => LOW_MODEL_CONFIG)
  const finalOptions = { ...defaultConfig, ...options }
  const provider = (finalOptions.provider || 'openai') as APIProviders

  if (!prompt && (!messages || messages.length === 0)) {
    throw ErrorFactory.missingRequired('prompt or messages', 'genTextStream')
  }

  try {
    const modelInstance = await getProviderLanguageModelInterface(provider, finalOptions, debug)

    let messagesToProcess: CoreMessage[] = []
    if (systemMessage) {
      messagesToProcess.push({ role: 'system', content: systemMessage })
    }
    if (messages) {
      messagesToProcess.push(...messages)
    }
    if (prompt) {
      const lastMessage = messagesToProcess[messagesToProcess.length - 1]
      if (!lastMessage || !(lastMessage.role === 'user' && lastMessage.content === prompt)) {
        messagesToProcess.push({ role: 'user', content: prompt })
      }
    }

    if (messagesToProcess.length === 0) {
      throw ErrorFactory.invalidInput('messages', 'at least one valid message', messagesToProcess, {
        context: 'genTextStream',
        provider,
        model: modelInstance?.modelId
      })
    }

    // Log model usage
    logModelUsage({
      provider: provider,
      model: finalOptions.model || modelInstance.modelId,
      temperature: finalOptions.temperature,
      maxTokens: finalOptions.maxTokens,
      topP: finalOptions.topP,
      frequencyPenalty: finalOptions.frequencyPenalty,
      presencePenalty: finalOptions.presencePenalty,
      mode: 'stream'
    })

    if (debug) {
      console.log(
        `[UnifiedProviderService - genTextStream] Messages:`,
        messagesToProcess.length
      )
    }

    const aiSdkOptions = convertDbOptionsToAiSdk(options)
    return streamText({
      model: modelInstance,
      messages: messagesToProcess,
      ...aiSdkOptions,
      ...(options.responseFormat && {
        responseFormat: options.responseFormat
      }),

      onFinish: ({ text, usage, finishReason }) => {
        if (debug) {
          logModelCompletion(
            provider,
            finalOptions.model || modelInstance.modelId,
            usage
          )
        }
      },
      onError: (error) => {
        console.error(
          `[UnifiedProviderService - genTextStream] Error during stream for ${provider}/${modelInstance.modelId}:`,
          error
        )
      }
    })
  } catch (error: any) {
    if (error instanceof ApiError) throw error
    logModelError(provider, finalOptions.model || '', error)
    throw mapProviderErrorToApiError(error, provider, 'genTextStream')
  }
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
