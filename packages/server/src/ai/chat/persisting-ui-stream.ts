import { extractString, formatToolFallback, extractTextFromAssistantMessage } from '@promptliano/services'
import type { ChatStreamService } from '@promptliano/services'

interface PersistedStreamOptions {
  chatId: number
  provider: string
  model?: string | null
  stream: { toUIMessageStream: () => AsyncIterable<any> }
  finishState: {
    finishReason: string
    usage?: Record<string, unknown>
    lastToolResultText?: string
    finalText?: string
  }
  chatStreamService: ChatStreamService
  flushIntervalMs?: number
  flushBatchMax?: number
}

export interface PersistedStreamResult {
  response: Response
  streamId: number
  completion: Promise<{
    messageMetadata: Record<string, unknown> | null
    error?: unknown
  }>
}

const normalizeType = (type: unknown): string => (typeof type === 'string' ? type : 'unknown')

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
  | 'reasoning-part-finish'
  | 'tool-input-start'
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

interface PersistedUiEvent {
  type: UiEventType
  payload: Record<string, unknown>
  ts: number
}

const ensureId = (prefix: string, id?: unknown): string =>
  typeof id === 'string' && id.length > 0
    ? id
    : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

const SENDABLE_EVENT_TYPES = new Set<UiEventType>([
  'start',
  'start-step',
  'finish-step',
  'finish',
  'abort',
  'text-start',
  'text-delta',
  'text-end',
  'reasoning',
  'reasoning-start',
  'reasoning-delta',
  'reasoning-end',
  'reasoning-part-finish',
  'tool-input-start',
  'tool-input-delta',
  'tool-input-available',
  'tool-input-error',
  'tool-output-available',
  'tool-output-error',
  'message-metadata',
  'source-url',
  'source-document',
  'file',
  'error'
])

const STREAM_TOOL_INPUT_DELTAS =
  (process.env.PROMPTLIANO_STREAM_TOOL_INPUT_DELTAS ?? 'false').toLowerCase() === 'true'

export async function createPersistedUIStreamResponse(options: PersistedStreamOptions): Promise<PersistedStreamResult> {
  const {
    chatId,
    provider,
    model,
    stream,
    finishState,
    chatStreamService,
    flushIntervalMs = 80,
    flushBatchMax = 50
  } = options

  const streamRecord = await chatStreamService.startAssistantStream(chatId, {
    provider,
    model: model ?? 'unknown',
    messageMetadata: null
  })

  const streamId = streamRecord.id
  const encoder = new TextEncoder()
  const uiStream = stream.toUIMessageStream()

  const buffer: PersistedUiEvent[] = []
  let lastSeq = 0
  let flushTimer: ReturnType<typeof setTimeout> | null = null
  let pendingPersist: Promise<void> = Promise.resolve()
  let recordedError: unknown
  let messageMetadata: Record<string, unknown> | null = null
  const persistBatch = (batch: PersistedUiEvent[]) => {
    if (batch.length === 0) return
    pendingPersist = pendingPersist
      .then(async () => {
        try {
          const result = await chatStreamService.appendBatch(streamId, batch, lastSeq)
          lastSeq = result.lastSeq
        } catch (error) {
          console.error('[ChatStream] Failed to persist stream batch', error)
        }
      })
      .catch((error) => {
        console.error('[ChatStream] Failed to persist stream batch', error)
      })
  }

  const flushBuffer = () => {
    if (buffer.length === 0) return
    const batch = buffer.splice(0, buffer.length)
    persistBatch(batch)
  }

  const scheduleFlush = () => {
    if (flushTimer) return
    flushTimer = setTimeout(() => {
      flushTimer = null
      flushBuffer()
    }, flushIntervalMs)
  }

  let resolveCompletion: (value: { messageMetadata: Record<string, unknown> | null; error?: unknown }) => void
  let rejectCompletion: (reason?: unknown) => void

  const completion = new Promise<{ messageMetadata: Record<string, unknown> | null; error?: unknown }>((resolve, reject) => {
    resolveCompletion = resolve
    rejectCompletion = reject
  })

  let completionSettled = false

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      const toolInputs = new Map<string, unknown>()
      const toolInputBuffers = new Map<string, string>()
      const toolNames = new Map<string, string>()
      const toolDynamics = new Map<string, boolean>()
      const toolInputsAcknowledged = new Set<string>()
      let hasTextOutput = false
      let lastTextId: string | undefined
      let lastReasoningId: string | undefined
      let closed = false

      const recordEvent = (type: UiEventType, payload: Record<string, unknown> = {}) => {
        const eventPayload = payload ? { ...payload } : {}
        if (typeof eventPayload.type !== 'string') {
          eventPayload.type = type
        }
        buffer.push({ type, payload: eventPayload, ts: Date.now() })

        if (type === 'message-metadata') {
          const rawMetadata = eventPayload.messageMetadata
          if (Array.isArray(rawMetadata)) {
            const metadataRecord: Record<string, unknown> = {}
            for (const entry of rawMetadata as Array<Record<string, unknown>>) {
              const key = typeof entry.key === 'string' ? entry.key : undefined
              if (key && key.length > 0) {
                metadataRecord[key] = entry.value
              }
            }
            messageMetadata = {
              ...(messageMetadata ?? {}),
              ...metadataRecord
            }
          } else if (rawMetadata && typeof rawMetadata === 'object') {
            messageMetadata = {
              ...(messageMetadata ?? {}),
              ...(rawMetadata as Record<string, unknown>)
            }
          }
        }
      }

      const emit = (type: UiEventType, payload: Record<string, unknown> = {}) => {
        if (closed || !SENDABLE_EVENT_TYPES.has(type)) return
        const message = payload ? { ...payload } : {}
        if (typeof message.type !== 'string') {
          message.type = type
        }
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`))
        } catch (error) {
          console.warn('[ChatStream] Failed to enqueue UI stream payload', {
            type,
            error: error instanceof Error ? error.message : error
          })
        }
      }

      const emitAndRecord = async (
        type: UiEventType,
        payload: Record<string, unknown> = {},
        options?: {
          emitPayload?: Record<string, unknown>
          persistPayload?: Record<string, unknown>
        }
      ) => {
        const persistPayload = options?.persistPayload ?? payload
        recordEvent(type, persistPayload)
        const emitPayload = options?.emitPayload ?? payload
        emit(type, emitPayload)
        if (buffer.length >= flushBatchMax) {
          flushBuffer()
          await pendingPersist
        } else {
          scheduleFlush()
        }
      }

      const emitTextBlock = async (text: string) => {
        if (!text) return
        const id = ensureId('txt', lastTextId)
        lastTextId = id
        await emitAndRecord('text-start', { type: 'text-start', id })
        await emitAndRecord('text-delta', { type: 'text-delta', id, delta: text })
        await emitAndRecord('text-end', { type: 'text-end', id })
        hasTextOutput = true
      }

      try {
        for await (const rawChunk of uiStream) {
          if (!rawChunk || typeof rawChunk !== 'object') continue
          const chunk = rawChunk as Record<string, unknown>
          const rawType = normalizeType(chunk.type)
          const normalizedType = rawType.replace(/[-.]/g, '_')
          const chunkAny = chunk as any

          if (process.env.PROMPTLIANO_DEBUG_STREAM === 'true') {
            try {
              console.debug('[ChatStream][raw]', normalizedType, JSON.stringify(chunkAny))
            } catch (logError) {
              console.debug('[ChatStream][raw][error]', logError)
            }
          }

          switch (normalizedType) {
            case 'start':
              await emitAndRecord('start', { type: 'start' })
              break
            case 'start_step':
              await emitAndRecord('start-step', { type: 'start-step' })
              break
            case 'finish_step':
              await emitAndRecord('finish-step', { type: 'finish-step' })
              break
            case 'text_start': {
              const id = ensureId('txt', chunkAny.id ?? lastTextId)
              lastTextId = id
              await emitAndRecord('text-start', { type: 'text-start', id })
              break
            }
            case 'text_delta':
            case 'response_output_text_delta':
            case 'response_text_delta': {
              const id = ensureId('txt', chunkAny.id ?? lastTextId)
              lastTextId = id
              const delta =
                typeof chunkAny.delta === 'string'
                  ? chunkAny.delta
                  : typeof chunkAny.text === 'string'
                    ? chunkAny.text
                    : extractString(chunkAny.delta ?? chunkAny.text)
              if (delta && delta.length > 0) {
                await emitAndRecord('text-delta', { type: 'text-delta', id, delta })
                hasTextOutput = true
              }
              break
            }
            case 'text_end': {
              const id = ensureId('txt', chunkAny.id ?? lastTextId)
              await emitAndRecord('text-end', { type: 'text-end', id })
              break
            }
            case 'text':
            case 'response_output_text':
            case 'response_text': {
              const text =
                typeof chunkAny.text === 'string'
                  ? chunkAny.text
                  : extractString(chunkAny.text ?? chunkAny.value ?? chunkAny.message)
              if (text && text.length > 0) await emitTextBlock(text)
              break
            }
            case 'assistant_message':
            case 'assistant-message':
            case 'response_message':
            case 'response_message_delta': {
              const message =
                chunkAny.message ??
                chunkAny.value ??
                (chunkAny.delta && typeof chunkAny.delta === 'object'
                  ? (chunkAny.delta as any).message
                  : undefined)
              if (message && typeof message === 'object') {
                const text = extractTextFromAssistantMessage(message as any)
                if (text.length > 0) await emitTextBlock(text)
              }
              break
            }
            case 'reasoning_start': {
              const id = ensureId('reasoning', chunkAny.id ?? lastReasoningId)
              lastReasoningId = id
              await emitAndRecord('reasoning-start', { type: 'reasoning-start', id })
              break
            }
            case 'reasoning_delta': {
              const id = ensureId('reasoning', chunkAny.id ?? lastReasoningId)
              lastReasoningId = id
              const delta =
                typeof chunkAny.delta === 'string'
                  ? chunkAny.delta
                  : extractString(chunkAny.delta)
              if (delta && delta.length > 0)
                await emitAndRecord('reasoning-delta', { type: 'reasoning-delta', id, delta })
              break
            }
            case 'reasoning_end': {
              const id = ensureId('reasoning', chunkAny.id ?? lastReasoningId)
              await emitAndRecord('reasoning-end', { type: 'reasoning-end', id })
              break
            }
            case 'reasoning_part_finish': {
              await emitAndRecord('reasoning-part-finish', { type: 'reasoning-part-finish' })
              break
            }
            case 'reasoning': {
              const text = typeof chunkAny.text === 'string' ? chunkAny.text : extractString(chunkAny.text)
              if (text && text.length > 0)
                await emitAndRecord('reasoning', { type: 'reasoning', text })
              break
            }
            case 'tool_input_start': {
              const toolCallId = String(chunkAny.toolCallId ?? '')
              const toolName =
                typeof chunkAny.toolName === 'string' && chunkAny.toolName.length > 0
                  ? chunkAny.toolName
                  : toolCallId || 'unknown-tool'
              const isDynamic = chunkAny.dynamic === true
              toolNames.set(toolCallId, toolName)
              toolDynamics.set(toolCallId, isDynamic)
              await emitAndRecord('tool-input-start', {
                type: 'tool-input-start',
                toolCallId,
                toolName,
                ...(isDynamic ? { dynamic: true } : {})
              })
              break
            }
            case 'tool_input_delta': {
              const toolCallId = String(chunkAny.toolCallId ?? '')
              const delta =
                typeof chunkAny.inputTextDelta === 'string'
                  ? chunkAny.inputTextDelta
                  : extractString(chunkAny.inputTextDelta)
              if (delta && delta.length > 0) {
                toolInputBuffers.set(toolCallId, (toolInputBuffers.get(toolCallId) ?? '') + delta)
                if (STREAM_TOOL_INPUT_DELTAS) {
                  await emitAndRecord('tool-input-delta', {
                    type: 'tool-input-delta',
                    toolCallId,
                    inputTextDelta: delta
                  })
                }
              }
              break
            }
            case 'tool_input_available': {
              const toolCallId = String(chunkAny.toolCallId ?? '')
              let input = chunkAny.input ?? {}
              if ((!input || Object.keys(input).length === 0) && toolInputBuffers.has(toolCallId)) {
                const buf = toolInputBuffers.get(toolCallId) ?? ''
                try {
                  input = JSON.parse(buf)
                } catch {
                  input = { __raw: buf }
                }
              }
              toolInputs.set(toolCallId, input)
              const toolName =
                typeof chunkAny.toolName === 'string' && chunkAny.toolName.length > 0
                  ? chunkAny.toolName
                  : toolCallId || 'unknown-tool'
              toolNames.set(toolCallId, toolName)
              const isDynamic = chunkAny.dynamic === true
              if (chunkAny.dynamic !== undefined) {
                toolDynamics.set(toolCallId, isDynamic)
              }
              toolInputsAcknowledged.add(toolCallId)
              await emitAndRecord('tool-input-available', {
                type: 'tool-input-available',
                toolCallId,
                toolName,
                input,
                ...(isDynamic ? { dynamic: true } : {})
              })
              break
            }
            case 'tool_input_error': {
              const input = chunkAny.input ?? {}
              const toolCallId = String(chunkAny.toolCallId ?? '')
              toolInputs.set(toolCallId, input)
              const errorText = typeof chunkAny.errorText === 'string' ? chunkAny.errorText : 'Tool input failed'
              if (errorText) finishState.lastToolResultText = errorText
              await emitAndRecord('tool-input-error', {
                type: 'tool-input-error',
                toolCallId,
                input,
                errorText
              })
              break
            }
            case 'tool_output_available': {
              const toolCallId = String(chunkAny.toolCallId ?? '')
              const toolName = toolNames.get(toolCallId)
              const output = chunkAny.output
              const outputText = extractString(output)
              const providerExecuted = chunkAny.providerExecuted !== undefined ? !!chunkAny.providerExecuted : undefined
              const dynamic = chunkAny.dynamic !== undefined ? !!chunkAny.dynamic : undefined
              const preliminary = chunkAny.preliminary !== undefined ? !!chunkAny.preliminary : undefined
              if (chunkAny.dynamic !== undefined) {
                toolDynamics.set(toolCallId, dynamic ?? false)
              }
              if (!toolInputsAcknowledged.has(toolCallId)) {
                const syntheticInput = toolInputs.get(toolCallId)
                toolInputsAcknowledged.add(toolCallId)
                const syntheticDynamic = toolDynamics.get(toolCallId) === true
                await emitAndRecord(
                  'tool-input-available',
                  {
                    type: 'tool-input-available',
                    toolCallId,
                    toolName: toolName ?? (toolCallId || 'unknown-tool'),
                    input: syntheticInput ?? {},
                    ...(syntheticDynamic ? { dynamic: true } : {})
                  },
                  {
                    persistPayload: {
                      type: 'tool-input-available',
                      toolCallId,
                      toolName: toolName ?? (toolCallId || 'unknown-tool'),
                      input: syntheticInput ?? {},
                      ...(syntheticDynamic ? { dynamic: true } : {})
                    }
                  }
                )
              }
              const emitPayload: Record<string, unknown> = {
                type: 'tool-output-available',
                toolCallId,
                output,
                ...(providerExecuted !== undefined ? { providerExecuted } : {}),
                ...(dynamic !== undefined ? { dynamic } : {}),
                ...(preliminary !== undefined ? { preliminary } : {})
              }
              const persistPayload: Record<string, unknown> = {
                ...emitPayload,
                ...(toolName ? { toolName } : {}),
                ...(outputText && outputText.trim().length > 0 ? { outputText: outputText.trim() } : {})
              }
              await emitAndRecord('tool-output-available', emitPayload, { persistPayload })
              break
            }
            case 'tool_output_error': {
              const errorText = typeof chunkAny.errorText === 'string' ? chunkAny.errorText : 'Tool execution failed'
              if (errorText) finishState.lastToolResultText = errorText
              const toolCallId = String(chunkAny.toolCallId ?? '')
              const toolName = toolNames.get(toolCallId)
              const providerExecuted = chunkAny.providerExecuted !== undefined ? !!chunkAny.providerExecuted : undefined
              const dynamic = chunkAny.dynamic !== undefined ? !!chunkAny.dynamic : undefined
              if (chunkAny.dynamic !== undefined) {
                toolDynamics.set(toolCallId, dynamic ?? false)
              }
              if (!toolInputsAcknowledged.has(toolCallId)) {
                const syntheticInput = toolInputs.get(toolCallId)
                toolInputsAcknowledged.add(toolCallId)
                const syntheticDynamic = toolDynamics.get(toolCallId) === true
                await emitAndRecord(
                  'tool-input-available',
                  {
                    type: 'tool-input-available',
                    toolCallId,
                    toolName: toolName ?? (toolCallId || 'unknown-tool'),
                    input: syntheticInput ?? {},
                    ...(syntheticDynamic ? { dynamic: true } : {})
                  },
                  {
                    persistPayload: {
                      type: 'tool-input-available',
                      toolCallId,
                      toolName: toolName ?? (toolCallId || 'unknown-tool'),
                      input: syntheticInput ?? {},
                      ...(syntheticDynamic ? { dynamic: true } : {})
                    }
                  }
                )
              }
              const emitPayload: Record<string, unknown> = {
                type: 'tool-output-error',
                toolCallId,
                errorText,
                ...(providerExecuted !== undefined ? { providerExecuted } : {}),
                ...(dynamic !== undefined ? { dynamic } : {})
              }
              const persistPayload: Record<string, unknown> = {
                ...emitPayload,
                ...(toolName ? { toolName } : {})
              }
              await emitAndRecord('tool-output-error', emitPayload, { persistPayload })
              break
            }
            case 'message_metadata': {
              if (Array.isArray(chunkAny.messageMetadata)) {
                await emitAndRecord('message-metadata', {
                  type: 'message-metadata',
                  messageMetadata: chunkAny.messageMetadata
                })
              }
              break
            }
            case 'error': {
              const errorText = typeof chunkAny.errorText === 'string' ? chunkAny.errorText : 'Stream error'
              await emitAndRecord('error', { type: 'error', errorText })
              break
            }
            default: {
              const text = extractString(chunkAny.delta ?? chunkAny.text ?? chunkAny.value ?? chunkAny.message)
              if (text && text.length > 0) await emitTextBlock(text)
              break
            }
          }
        }
      } catch (error) {
        recordedError = error
        const message = error instanceof Error ? error.message : String(error)
        await emitAndRecord('error', { type: 'error', errorText: message })
      } finally {
        if (flushTimer) {
          clearTimeout(flushTimer)
          flushTimer = null
        }

        flushBuffer()
        await pendingPersist

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
            await emitTextBlock(fallbackText)
          }
        }

        const finishReason = finishState.finishReason ?? 'stop'
        const finishMetadataEntries: Array<{ key: string; value: unknown }> = []

        if (finishReason) {
          finishMetadataEntries.push({ key: 'finishReason', value: finishReason })
        }
        if (finishState.usage) {
          finishMetadataEntries.push({ key: 'usage', value: finishState.usage })
        }

        if (finishMetadataEntries.length > 0) {
          await emitAndRecord('message-metadata', {
            type: 'message-metadata',
            messageMetadata: finishMetadataEntries
          })
          messageMetadata = {
            ...(messageMetadata ?? {}),
            finishReason,
            ...(finishState.usage ? { usage: finishState.usage } : {})
          }
        }

        await emitAndRecord('finish', { type: 'finish' })

        flushBuffer()
        await pendingPersist

        if (!closed) {
          try {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          } catch (doneError) {
            console.warn('[ChatStream] Failed to enqueue DONE sentinel', doneError)
          }
          closed = true
          controller.close()
        }

        if (!completionSettled) {
          completionSettled = true
          try {
            resolveCompletion({ messageMetadata, error: recordedError })
          } catch {
            // Ignore resolution errors
          }
        }
      }
    },
    cancel(reason) {
      recordedError = reason
      if (!completionSettled) {
        completionSettled = true
        rejectCompletion(reason)
      }
    }
  })

  const response = new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'x-vercel-ai-ui-message-stream': 'v1'
    }
  })

  return {
    response,
    streamId,
    completion
  }
}
