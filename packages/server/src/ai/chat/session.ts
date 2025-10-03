import type { APIProviders } from '@promptliano/database'
import type { UIMessage, ModelMessage, ToolSet, SystemModelMessage, Tool } from 'ai'
import { convertToModelMessages, streamText, validateUIMessages, stepCountIs } from 'ai'

import {
  convertDbOptionsToAiSdk,
  resolveModelIdentifier,
  normalizeUsage,
  getProviderLanguageModelInterface,
  extractString,
  resolveFinalAssistantContent,
  formatToolFallback,
  generateChatName,
  generateSingleText,
  buildModelRequestOptions,
  mapProviderErrorToApiError,
  createChatService,
  type StreamWithState,
  type AiSdkCompatibleOptions
} from '@promptliano/services'
import { firstPartyTools } from '../../ai/tools'
import { createMcpToolSuite } from '../mcp/registry'

export type ToolChoice = 'auto' | 'none' | 'required' | { type: 'tool'; toolName: string }

const EMPTY_TOOL_SUITE = {
  tools: {} as ToolSet,
  cleanup: async () => {},
  metadata: [] as Array<{ name: string; description?: string }>
} as const

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null

const getKeyList = (value: unknown): string[] => (isRecord(value) ? Object.keys(value) : [])

type ResponseMessageLike = UIMessage | (UnknownRecord & { role?: string })
type ResponseMessages = Array<ResponseMessageLike | string>

type MessageParts = NonNullable<UIMessage['parts']>
type MessagePart = MessageParts[number]
type MessageWithOptionalParts = UIMessage & { parts?: MessageParts }

const coerceToolSet = (tools: Record<string, unknown>): ToolSet =>
  Object.fromEntries(
    Object.entries(tools).map(([name, tool]) => [name, tool as Tool<any, any>])
  ) as ToolSet

function sanitizeModelOptions<T extends AiSdkCompatibleOptions>(options: T): T {
  return { ...options }
}

export interface StreamChatSessionParams {
  chatId: number
  messages: UIMessage[]
  provider: APIProviders | string
  model?: string
  systemMessage?: string
  options?: AiSdkCompatibleOptions
  toolsEnabled?: boolean
  toolChoice?: ToolChoice
  maxSteps?: number
  enableChatAutoNaming?: boolean
  debug?: boolean
  persistMessages?: boolean
  /** Optional explicit provider key for capability detection. */
  providerKey?: string
  agenticOverrides?: {
    forceFinalText?: boolean
    parallelToolCalls?: boolean
    maxSteps?: number
  }
}

export interface StreamChatSessionResult {
  stream: StreamWithState
  cleanup: () => Promise<void>
  validatedMessages: UIMessage[]
  streamKind?: 'ui' | 'data'
}

type StreamTextParams = Parameters<typeof streamText>[0]
type OnFinishParam = NonNullable<StreamTextParams['onFinish']> extends (arg: infer A) => unknown ? A : never

type StreamFinishExtras = {
  text?: string
  usage?: unknown
  finishReason?: string
  steps?: unknown
  response?: UnknownRecord & { messages?: ResponseMessages; steps?: unknown }
  responseMessages?: ResponseMessages
  messages?: ResponseMessages
}

type FinishResultPayload = OnFinishParam & StreamFinishExtras

type ProviderCaps = {
  supportsParallelToggle: boolean
  parallelToggleStyle?:
    | { kind: 'openai-compatible'; bodyField: 'parallel_tool_calls' }
    | { kind: 'openai'; providerKey: 'openai'; bodyField: 'parallelToolCalls' }
  defaultMaxSteps: number
  defaultForceFinalText: boolean
}

const DEFAULT_PROVIDER_CAPS: ProviderCaps = {
  supportsParallelToggle: false,
  defaultMaxSteps: 4,
  defaultForceFinalText: true
}

const PROVIDER_CAPS: Record<string, ProviderCaps> = {
  lmstudio: {
    supportsParallelToggle: true,
    parallelToggleStyle: { kind: 'openai-compatible', bodyField: 'parallel_tool_calls' },
    defaultMaxSteps: 4,
    defaultForceFinalText: true
  },
  openrouter: {
    supportsParallelToggle: true,
    parallelToggleStyle: { kind: 'openai-compatible', bodyField: 'parallel_tool_calls' },
    defaultMaxSteps: 4,
    defaultForceFinalText: true
  },
  openai: {
    supportsParallelToggle: true,
    parallelToggleStyle: { kind: 'openai', providerKey: 'openai', bodyField: 'parallelToolCalls' },
    defaultMaxSteps: 4,
    defaultForceFinalText: false
  },
  groq: {
    supportsParallelToggle: true,
    parallelToggleStyle: { kind: 'openai-compatible', bodyField: 'parallel_tool_calls' },
    defaultMaxSteps: 4,
    defaultForceFinalText: true
  },
  ollama: {
    supportsParallelToggle: true,
    parallelToggleStyle: { kind: 'openai-compatible', bodyField: 'parallel_tool_calls' },
    defaultMaxSteps: 3,
    defaultForceFinalText: true
  },
  anthropic: {
    supportsParallelToggle: false,
    defaultMaxSteps: 4,
    defaultForceFinalText: true
  }
}

const inferProviderKeyFromModel = (modelInstance: unknown): string | undefined => {
  try {
    const providerAny = (modelInstance as Record<string, unknown>)?.provider
    if (providerAny && typeof providerAny === 'object') {
      const name = (providerAny as Record<string, unknown>).name
      if (typeof name === 'string' && name.length > 0) return name.toLowerCase()
      const id = (providerAny as Record<string, unknown>).id
      if (typeof id === 'string' && id.length > 0) return id.toLowerCase()
    }
    const direct = (modelInstance as Record<string, unknown>)?._providerName
    if (typeof direct === 'string' && direct.length > 0) return direct.toLowerCase()
    const directId = (modelInstance as Record<string, unknown>)?._providerId
    if (typeof directId === 'string' && directId.length > 0) return directId.toLowerCase()
  } catch {}
  return undefined
}

const clamp = (val: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, val))

const toUiMessage = (value: unknown): UIMessage | null => {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.role !== 'string') {
    return null
  }

  if ('parts' in value && value.parts != null && !Array.isArray(value.parts)) {
    return null
  }

  return value as unknown as UIMessage
}

const toStepList = (value: unknown): UnknownRecord[] =>
  Array.isArray(value) ? (value.filter(isRecord) as UnknownRecord[]) : []

const toToolCallRecords = (value: unknown): UnknownRecord[] =>
  Array.isArray(value) ? (value.filter(isRecord) as UnknownRecord[]) : []

const toToolResultRecords = (value: unknown): UnknownRecord[] =>
  Array.isArray(value) ? (value.filter(isRecord) as UnknownRecord[]) : []

const getToolCallDisplayName = (call: UnknownRecord): string | undefined => {
  if (typeof call.toolName === 'string' && call.toolName.length > 0) {
    return call.toolName
  }
  if (typeof call.name === 'string' && call.name.length > 0) {
    return call.name
  }
  return undefined
}

const hasMatchingToolResult = (results: UnknownRecord[], call: UnknownRecord): boolean => {
  if (typeof call.toolCallId !== 'string') return false
  return results.some((result) => typeof result.toolCallId === 'string' && result.toolCallId === call.toolCallId)
}

const getStepResponseRecord = (step: UnknownRecord): UnknownRecord | undefined => {
  const response = step.response
  return isRecord(response) ? (response as UnknownRecord) : undefined
}

const toMessageParts = (message: UIMessage): MessagePart[] => {
  const candidate = message as MessageWithOptionalParts
  return Array.isArray(candidate.parts) ? candidate.parts : []
}

export async function streamChatSession(params: StreamChatSessionParams): Promise<StreamChatSessionResult> {
  const {
    chatId,
    messages,
    provider,
    model,
    systemMessage,
    options,
  toolsEnabled = false,
  toolChoice,
  maxSteps,
  enableChatAutoNaming = false,
  debug = false,
  persistMessages = true,
  providerKey: explicitProviderKey,
  agenticOverrides
} = params

  const chatService = createChatService()
  const initialProviderKey = (provider || 'openai') as APIProviders

  const { options: mergedOptions } = await buildModelRequestOptions({
    provider: initialProviderKey,
    model,
    overrides: options,
    debug
  })

  const resolvedProvider = (mergedOptions.provider || initialProviderKey) as APIProviders
  let effectiveOptions = sanitizeModelOptions(mergedOptions)

  const modelInstance = await getProviderLanguageModelInterface(resolvedProvider, effectiveOptions, debug)

  const modelIdentifier = resolveModelIdentifier(effectiveOptions.model ?? model, modelInstance)
  effectiveOptions = sanitizeModelOptions(effectiveOptions)

  const requestedToolChoice: ToolChoice = toolChoice ?? (toolsEnabled ? 'auto' : 'none')
  const shouldEnableTools = toolsEnabled && requestedToolChoice !== 'none'
  const toolSuite = shouldEnableTools ? await createMcpToolSuite() : EMPTY_TOOL_SUITE
  const rawToolMap = shouldEnableTools ? Object.assign({}, firstPartyTools, toolSuite.tools) : {}
  const combinedToolMap = shouldEnableTools ? coerceToolSet(rawToolMap) : coerceToolSet({})
  const toolNames = Object.keys(rawToolMap)

  const validatedMessages = shouldEnableTools
    ? await validateUIMessages(
        { messages, tools: combinedToolMap } as unknown as Parameters<typeof validateUIMessages>[0]
      )
    : await validateUIMessages({ messages })

  const modelMessages: ModelMessage[] = convertToModelMessages(validatedMessages)

  const resolvedProviderKeyName = (() => {
    const candidates = [
      explicitProviderKey,
      inferProviderKeyFromModel(modelInstance),
      typeof resolvedProvider === 'string' ? resolvedProvider : undefined,
      typeof initialProviderKey === 'string' ? initialProviderKey : undefined
    ]
    const first = candidates.find((entry) => typeof entry === 'string' && entry.length > 0)
    return typeof first === 'string' ? first.toLowerCase() : 'unknown'
  })()

  const providerCaps = PROVIDER_CAPS[resolvedProviderKeyName] ?? DEFAULT_PROVIDER_CAPS

  const resolvedMaxSteps = shouldEnableTools
    ? clamp(agenticOverrides?.maxSteps ?? maxSteps ?? providerCaps.defaultMaxSteps, 1, 20)
    : 1

  const forceFinalText = agenticOverrides?.forceFinalText ?? (shouldEnableTools ? providerCaps.defaultForceFinalText : false)
  const desiredParallelToolCalls = agenticOverrides?.parallelToolCalls

  const policyMessage = shouldEnableTools && toolNames.length > 0
    ? `You may only call these tools: ${toolNames.join(', ')}. If none apply, answer in plain text.`
    : undefined

  const systemMessages: SystemModelMessage[] = []
  if (systemMessage) {
    systemMessages.push({ role: 'system', content: systemMessage })
  }
  if (policyMessage) {
    systemMessages.push({ role: 'system', content: policyMessage })
  }
  if (systemMessages.length > 0) {
    modelMessages.unshift(...systemMessages)
  }

  const lastUserMessage = [...validatedMessages].reverse().find((message) => message.role === 'user')
  if (!lastUserMessage) {
    throw new Error('No user message found in payload.')
  }

  const userMessageText = renderUiMessageText(lastUserMessage)
  if (persistMessages) {
    await chatService.addMessage(chatId, {
      role: 'user',
      content: userMessageText,
      metadata: {
        uiMessage: lastUserMessage
      }
    })
  }

  if (debug) {
    console.debug('[streamChatSession] configuration', {
      chatId,
      modelIdentifier,
      provider: resolvedProvider,
      requestedToolChoice,
      resolvedToolChoice: shouldEnableTools ? requestedToolChoice : 'none',
      toolsEnabled,
      toolNames,
      maxStepsRequested: maxSteps ?? null,
      resolvedMaxSteps,
      forceFinalText,
      desiredParallelToolCalls,
      providerCaps: resolvedProviderKeyName
    })
  }

  const aiSdkOptions = convertDbOptionsToAiSdk(effectiveOptions)
  const resolvedToolChoice: ToolChoice = shouldEnableTools ? requestedToolChoice : 'none'

  const finishState: StreamWithState['finishState'] = {
    finishReason: 'unknown',
    lastToolResultText: undefined,
    finalText: undefined
  }

  const buildProviderOptions = (): UnknownRecord | undefined => {
    if (!providerCaps.supportsParallelToggle || typeof desiredParallelToolCalls !== 'boolean') {
      return undefined
    }
    const style = providerCaps.parallelToggleStyle
    if (!style) return undefined
    if (style.kind === 'openai') {
      return {
        [style.providerKey]: { [style.bodyField]: desiredParallelToolCalls }
      }
    }
    if (style.kind === 'openai-compatible') {
      return {
        [resolvedProviderKeyName]: { [style.bodyField]: desiredParallelToolCalls }
      }
    }
    return undefined
  }

  const streamParams: UnknownRecord = {
    model: modelInstance,
    messages: modelMessages,
    ...aiSdkOptions,
    ...(shouldEnableTools && toolNames.length > 0
      ? {
          tools: combinedToolMap as unknown as ToolSet,
          toolChoice: resolvedToolChoice,
          stopWhen: stepCountIs(resolvedMaxSteps)
        }
      : { toolChoice: resolvedToolChoice }),
    maxSteps: resolvedMaxSteps,
    prepareStep: async ({ stepNumber }: { stepNumber: number }) => {
      if (forceFinalText && stepNumber === resolvedMaxSteps - 1) {
        return { toolChoice: 'none' as const }
      }
      return {}
    },
    onStepFinish: ({ toolResults, text, usage }: any) => {
      try {
        const toolText = Array.isArray(toolResults)
          ? toolResults
              .map((entry) => {
                if (typeof entry === 'string') return entry
                if (!entry) return ''
                try {
                  return JSON.stringify(entry)
                } catch {
                  return ''
                }
              })
              .filter(Boolean)
              .join('\n')
          : undefined
        const candidate =
          (toolText && toolText.trim()) || (typeof text === 'string' ? text.trim() : '')
        if (candidate) {
          finishState.lastToolResultText = candidate
        }
        if (usage) {
          const finishStateWithSteps = finishState as unknown as { stepsUsage?: unknown[] }
          const existingUsage = finishStateWithSteps.stepsUsage ?? []
          finishStateWithSteps.stepsUsage = [...existingUsage, usage]
        }
      } catch {}
    },
    onFinish: async (result: OnFinishParam) => {
      const finishResult = result as FinishResultPayload
      const { text, usage, finishReason, steps } = finishResult
      const responseMessagesCandidate =
        finishResult.responseMessages ?? finishResult.response?.messages ?? finishResult.messages
      const responseMessages = Array.isArray(responseMessagesCandidate) ? responseMessagesCandidate : []
      const stepList = toStepList(steps)

      if (debug) {
        try {
          const summary = {
            keys: getKeyList(result),
            responseKeys: getKeyList(finishResult.response),
            messageCount: responseMessages.length,
            hasSteps: stepList.length > 0 ? stepList.length : typeof steps
          }
          console.debug('[streamChatSession] onFinish summary', summary)

          if (stepList.length > 0) {
            stepList.forEach((step, index) => {
              const toolCallRecords = toToolCallRecords(step.toolCalls)
              const toolResultRecords = toToolResultRecords(step.toolResults)
              const toolCalls = toolCallRecords.length > 0
                ? toolCallRecords.map((call) => ({
                    name: getToolCallDisplayName(call),
                    args: 'args' in call ? call.args : call.arguments,
                    hasResult: hasMatchingToolResult(toolResultRecords, call)
                  }))
                : undefined
              const toolResultCount = toolResultRecords.length
              const snippet = extractString(getStepResponseRecord(step)).slice(0, 200)
              console.debug('[streamChatSession] step detail', {
                index,
                toolCalls,
                toolResultCount,
                snippet
              })
            })
          }
        } catch (logError) {
          console.debug('[streamChatSession] onFinish summary failed', logError)
        }
      }

      const normalizedUsage = normalizeUsage(usage)
      if (normalizedUsage) {
        finishState.usage = normalizedUsage
      }

      const finalTextCandidates: string[] = []
      const resolvedFromSteps = resolveFinalAssistantContent(
        text,
        stepList.length > 0
          ? (stepList as Parameters<typeof resolveFinalAssistantContent>[1])
          : undefined
      )
      if (resolvedFromSteps) finalTextCandidates.push(resolvedFromSteps)

      if (responseMessages.length > 0) {
        for (const message of responseMessages) {
          const uiMessage = toUiMessage(message)
          if (uiMessage?.role === 'assistant') {
            const rendered = renderUiMessageText(uiMessage)
            const trimmed = rendered.trim()
            if (trimmed.length > 0) {
              finalTextCandidates.push(trimmed)
            }
          }

          const extracted = extractString(message)
          const trimmed = extracted.trim()
          if (trimmed.length > 0) {
            finalTextCandidates.push(trimmed)
          }
        }
      }

      const extractedFromResult = extractString(result)
      if (extractedFromResult.trim().length > 0) {
        finalTextCandidates.push(extractedFromResult.trim())
      }

      if (finalTextCandidates.length === 0 && process.env.PROMPTLIANO_DEBUG_STREAM === 'true') {
        try {
          const diagnosticSteps = stepList.length > 0
            ? stepList.map((step, index) => {
                const responseRecord = getStepResponseRecord(step)
                const toolResultRecords = toToolResultRecords(step.toolResults)
                return {
                  index,
                  responseKeys: getKeyList(responseRecord),
                  responseText: extractString(responseRecord),
                  outputText: responseRecord?.outputText ?? responseRecord?.output_text,
                  toolResults:
                    toolResultRecords.length > 0
                      ? toolResultRecords.map((resultRecord) => ({
                          toolCallId:
                            typeof resultRecord.toolCallId === 'string' ? resultRecord.toolCallId : undefined,
                          hasResult: resultRecord != null,
                          resultText: extractString(resultRecord)
                        }))
                      : undefined
                }
              })
            : steps
          console.debug('[streamChatSession] No finalTextCandidates', {
            text,
            responseMessages,
            resultKeys: getKeyList(result),
            stepsSummary: diagnosticSteps
          })
        } catch (diagError) {
          console.debug('[streamChatSession] Failed to log empty candidates', diagError)
        }
      }

      const finalText = finalTextCandidates.find((entry) => entry.trim().length > 0) ?? ''
      let assistantContent = finalText.trim()

      if (!assistantContent) {
        const fallback = finishState.lastToolResultText
        assistantContent = fallback ? formatToolFallback(fallback) : 'No response was generated.'
      }

      if ((!assistantContent || assistantContent === 'No response was generated.') && modelMessages.length > 0) {
        try {
          let fallbackCollected = ''
          let fallbackFinish: { text?: string; steps?: unknown } | null = null

          const fallbackParams = {
            model: modelInstance,
            messages: modelMessages,
            ...aiSdkOptions,
            toolChoice: 'none',
            maxSteps: 1,
            onFinish: (fallbackResult: OnFinishParam) => {
              const fallbackDetails = fallbackResult as FinishResultPayload
              fallbackFinish = {
                text: fallbackDetails.text,
                steps: fallbackDetails.steps ?? fallbackDetails.response?.steps
              }
            }
          }

          const fallbackStream = await streamText(fallbackParams as unknown as StreamTextParams)

          for await (const chunk of fallbackStream.textStream as AsyncIterable<unknown>) {
            const fragment = typeof chunk === 'string' ? chunk : extractString(chunk)
            if (fragment && fragment.length > 0) {
              fallbackCollected += fragment
            }
          }

          if ((!fallbackCollected || fallbackCollected.trim().length === 0) && fallbackFinish) {
            const { text: fallbackText, steps: fallbackStepsValue } = fallbackFinish
            const fallbackSteps = fallbackStepsValue ? toStepList(fallbackStepsValue) : []
            const resolved = resolveFinalAssistantContent(
              fallbackText,
              fallbackSteps.length > 0
                ? (fallbackSteps as Parameters<typeof resolveFinalAssistantContent>[1])
                : undefined
            )
            if (resolved && resolved.trim().length > 0) {
              fallbackCollected = resolved.trim()
            }
          }

          if (fallbackCollected && fallbackCollected.trim().length > 0) {
            assistantContent = fallbackCollected.trim()
          }
        } catch (fallbackError) {
          if (debug) {
            console.error('[streamChatSession] Tool-less stream fallback failed', fallbackError)
          }
        }
      }

      if (!assistantContent || assistantContent === 'No response was generated.') {
        try {
          const plainOptions: AiSdkCompatibleOptions = sanitizeModelOptions({
            ...effectiveOptions,
            provider: effectiveOptions.provider || provider,
            model: modelIdentifier
          })

          const nonStreaming = await generateSingleText({
            prompt: userMessageText,
            messages: modelMessages,
            options: plainOptions,
            systemMessage,
            debug
          })
          const nonStreamingText = nonStreaming.trim()
          if (nonStreamingText.length > 0) {
            assistantContent = nonStreamingText
          }
        } catch (fallbackError) {
          if (debug) {
            console.error('[streamChatSession] Non-stream fallback failed', fallbackError)
          }
        }
      }

      if (persistMessages) {
        await chatService.addMessage(chatId, {
          role: 'assistant',
          content: assistantContent,
          metadata: {
            finishReason: typeof finishReason === 'string' && finishReason.length > 0 ? finishReason : 'stop',
            usage: finishState.usage,
            uiMessage: {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              parts: [{ type: 'text', text: assistantContent }]
            }
          }
        })
      }

      if (enableChatAutoNaming) {
        try {
          const userMessageCount = validatedMessages.filter((msg) => msg.role === 'user').length
          if (userMessageCount === 1) {
            const name = await generateChatName(userMessageText)
            await chatService.update(chatId, { title: name })
          }
        } catch (error) {
          console.error('[streamChatSession] Failed to auto-name chat:', error)
        }
      }

      const resolvedFinishReason = typeof finishReason === 'string' && finishReason.length > 0 ? finishReason : 'stop'
      finishState.finishReason = resolvedFinishReason
      finishState.finalText = assistantContent
      if (!finishState.lastToolResultText && assistantContent && assistantContent !== 'No response was generated.') {
        finishState.lastToolResultText = assistantContent
      }
    },
    onError: (error: unknown) => {
      const mapped = mapProviderErrorToApiError(error, resolvedProvider, 'streamChat')
      finishState.finishReason = 'error'

      // Provide more helpful error messages for schema validation errors
      let errorMessage = mapped.message
      if (mapped.code === 'TOOL_SCHEMA_VALIDATION_ERROR') {
        errorMessage = `The AI attempted to use a tool with parameters that don't match the tool's schema. This has been fixed in the latest version. Error details: ${mapped.message}`
      }

      if (persistMessages) {
        chatService
          .addMessage(chatId, {
            role: 'assistant',
            content: errorMessage,
            metadata: {
              error: mapped
            }
          })
          .catch((err) => {
            console.error('[streamChatSession] Failed to persist error message:', err)
          })
      }

      throw mapped
    },
    onToolResult: ({ result }: { result: unknown }) => {
      const text = extractString(result)
      if (debug) {
        console.debug('[StreamChatSession] Tool result', { result, text })
      }
      if (text) {
        finishState.lastToolResultText = text
      }
    }
  }

  const providerOptionsFromToggle = buildProviderOptions()
  if (providerOptionsFromToggle) {
    const existingProviderOptions = isRecord(streamParams.providerOptions)
      ? (streamParams.providerOptions as UnknownRecord)
      : undefined
    streamParams.providerOptions = {
      ...(existingProviderOptions ?? {}),
      ...providerOptionsFromToggle
    }
  }

  const stream = await streamText(streamParams as unknown as StreamTextParams)

  const cleanup = async () => {
    await toolSuite.cleanup()
  }

  return {
    stream: {
      stream,
      finishState
    },
    cleanup,
    validatedMessages,
    streamKind: 'ui'
  }
}

export function renderUiMessageText(message: UIMessage): string {
  const parts = toMessageParts(message)
  const out: string[] = []

  for (const part of parts) {
    const partUnknown = part as unknown
    if (partUnknown == null) continue

    if (typeof partUnknown === 'string') {
      const trimmed = partUnknown.trim()
      if (trimmed) {
        out.push(trimmed)
      }
      continue
    }

    const partRecord = isRecord(partUnknown) ? (partUnknown as UnknownRecord) : null
    if (!partRecord) {
      const extracted = extractString(partUnknown)
      const trimmed = extracted.trim()
      if (trimmed) {
        out.push(trimmed)
      }
      continue
    }

    const typeValue = typeof partRecord.type === 'string' ? partRecord.type : undefined

    if (typeValue === 'text' || typeValue === 'reasoning') {
      const textValue = partRecord.text
      const text = typeof textValue === 'string' ? textValue : extractString(textValue)
      const trimmed = text.trim()
      if (trimmed) {
        out.push(trimmed)
      }
      continue
    }

    if (typeValue?.startsWith('tool-')) {
      const outputValue = partRecord.output
      const str = typeof outputValue === 'string' ? outputValue : extractString(outputValue)
      const trimmed = str.trim()
      if (trimmed) {
        out.push(trimmed)
      }
      continue
    }

    if (typeValue?.startsWith('data-')) {
      const str = extractString(partRecord.data)
      const trimmed = str.trim()
      if (trimmed) {
        out.push(trimmed)
      }
      continue
    }

    const extracted = extractString(partRecord)
    const trimmed = extracted.trim()
    if (trimmed) {
      out.push(trimmed)
    }
  }

  if (out.length > 0) return out.join('\n')

  const messageWithContent = message as MessageWithOptionalParts & { content?: unknown }
  const maybeContent = messageWithContent.content
  if (typeof maybeContent === 'string') {
    return maybeContent.trim()
  }
  if (maybeContent != null) {
    const extracted = extractString(maybeContent)
    const trimmed = extracted.trim()
    if (trimmed) {
      return trimmed
    }
  }

  return extractString(message).trim()
}
