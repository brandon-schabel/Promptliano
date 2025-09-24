import { formatDataStreamPart } from '@ai-sdk/ui-utils'
import {
  extractString,
  formatToolFallback,
  extractTextFromAssistantMessage
} from '@promptliano/services'
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

const isMessageMetadataEvent = (type: string): boolean => {
  const normalized = type.replace(/[\-.]/g, '_')
  return normalized === 'message_metadata'
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
  'tool-input-start',
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

  const buffer: Array<{ type: string; payload: unknown | null; ts: number }> = []
  let lastSeq = 0
  let flushTimer: ReturnType<typeof setTimeout> | null = null
  let pendingPersist: Promise<void> = Promise.resolve()
  let recordedError: unknown
  let messageMetadata: Record<string, unknown> | null = null
  const loggedFormatErrors = new Set<string>()

  const persistBatch = (batch: Array<{ type: string; payload: unknown | null; ts: number }>) => {
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
      let hasTextOutput = false
      let lastTextId: string | undefined
      let lastReasoningId: string | undefined
      let closed = false

      const emit = (type: UiEventType, payload: Record<string, unknown>) => {
        if (closed || !SENDABLE_EVENT_TYPES.has(type)) return
        try {
          if (type === 'start' || type === 'start-step' || type === 'finish-step') {
            controller.enqueue(encoder.encode(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`))
            return
          }
          const data = formatDataStreamPart(type as any, payload as any)
          controller.enqueue(encoder.encode(data))
        } catch (error) {
          if (!loggedFormatErrors.has(type)) {
            loggedFormatErrors.add(type)
            console.warn('[ChatStream] Failed to format UI stream part; falling back to raw SSE', {
              type,
              error: error instanceof Error ? error.message : error
            })
          }

          try {
            controller.enqueue(encoder.encode(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`))
          } catch (serializationError) {
            console.warn('[ChatStream] Failed to serialize UI stream fallback payload', {
              type,
              error:
                serializationError instanceof Error
                  ? serializationError.message
                  : serializationError
            })
          }
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
              emit('start', { type: 'start' })
              break
            case 'start_step':
              emit('start-step', { type: 'start-step' })
              break
            case 'finish_step':
              emit('finish-step', { type: 'finish-step' })
              break
            case 'text_start': {
              const id = ensureId('txt', chunkAny.id ?? lastTextId)
              lastTextId = id
              emit('text-start', { type: 'text-start', id })
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
                emit('text-delta', { type: 'text-delta', id, delta })
                hasTextOutput = true
              }
              break
            }
            case 'text_end': {
              const id = ensureId('txt', chunkAny.id ?? lastTextId)
              emit('text-end', { type: 'text-end', id })
              break
            }
            case 'text':
            case 'response_output_text':
            case 'response_text': {
              const text =
                typeof chunkAny.text === 'string'
                  ? chunkAny.text
                  : extractString(chunkAny.text ?? chunkAny.value ?? chunkAny.message)
              if (text && text.length > 0) emitTextBlock(text)
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
                if (text.length > 0) emitTextBlock(text)
              }
              break
            }
            case 'reasoning_start': {
              const id = ensureId('reasoning', chunkAny.id ?? lastReasoningId)
              lastReasoningId = id
              emit('reasoning-start', { type: 'reasoning-start', id })
              break
            }
            case 'reasoning_delta': {
              const id = ensureId('reasoning', chunkAny.id ?? lastReasoningId)
              lastReasoningId = id
              const delta =
                typeof chunkAny.delta === 'string'
                  ? chunkAny.delta
                  : extractString(chunkAny.delta)
              if (delta && delta.length > 0) emit('reasoning-delta', { type: 'reasoning-delta', id, delta })
              break
            }
            case 'reasoning_end': {
              const id = ensureId('reasoning', chunkAny.id ?? lastReasoningId)
              emit('reasoning-end', { type: 'reasoning-end', id })
              break
            }
            case 'reasoning': {
              const text = typeof chunkAny.text === 'string' ? chunkAny.text : extractString(chunkAny.text)
              if (text && text.length > 0) emit('reasoning', { type: 'reasoning', text })
              break
            }
            case 'tool_input_start': {
              const toolCallId = String(chunkAny.toolCallId ?? '')
              const toolName =
                typeof chunkAny.toolName === 'string' && chunkAny.toolName.length > 0
                  ? chunkAny.toolName
                  : toolCallId || 'unknown-tool'
              emit('tool-input-start', {
                type: 'tool-input-start',
                toolCallId,
                toolName
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
                  emit('tool-input-delta', {
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
              emit('tool-input-available', {
                type: 'tool-input-available',
                toolCallId,
                toolName,
                input
              })
              break
            }
            case 'tool_input_error': {
              const input = chunkAny.input ?? {}
              toolInputs.set(chunkAny.toolCallId, input)
              const errorText = typeof chunkAny.errorText === 'string' ? chunkAny.errorText : 'Tool input failed'
              if (errorText) finishState.lastToolResultText = errorText
              emit('tool-input-error', {
                type: 'tool-input-error',
                toolCallId: chunkAny.toolCallId,
                input,
                errorText
              })
              break
            }
            case 'tool_output_available':
              emit('tool-output-available', {
                type: 'tool-output-available',
                toolCallId: chunkAny.toolCallId,
                output: chunkAny.output
              })
              break
            case 'tool_output_error': {
              const errorText = typeof chunkAny.errorText === 'string' ? chunkAny.errorText : 'Tool execution failed'
              if (errorText) finishState.lastToolResultText = errorText
              emit('tool-output-error', {
                type: 'tool-output-error',
                toolCallId: chunkAny.toolCallId,
                errorText
              })
              break
            }
            case 'message_metadata': {
              if (Array.isArray(chunkAny.messageMetadata)) {
                emit('message-metadata', {
                  type: 'message-metadata',
                  messageMetadata: chunkAny.messageMetadata
                })
              }
              break
            }
            case 'error': {
              const errorText = typeof chunkAny.errorText === 'string' ? chunkAny.errorText : 'Stream error'
              emit('error', { type: 'error', errorText })
              break
            }
            default: {
              const text = extractString(chunkAny.delta ?? chunkAny.text ?? chunkAny.value ?? chunkAny.message)
              if (text && text.length > 0) emitTextBlock(text)
              break
            }
          }

          buffer.push({ type: rawType, payload: chunk, ts: Date.now() })
          if (isMessageMetadataEvent(rawType) && chunk) {
            const metadata = (chunk as any).messageMetadata
            if (metadata && typeof metadata === 'object') {
              messageMetadata = metadata as Record<string, unknown>
            }
          }

          if (buffer.length >= flushBatchMax) {
            flushBuffer()
            await pendingPersist
          } else {
            scheduleFlush()
          }
        }
      } catch (error) {
        recordedError = error
        const message = error instanceof Error ? error.message : String(error)
        buffer.push({ type: 'error', payload: { error: message }, ts: Date.now() })
        emit('error', { type: 'error', errorText: message })
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
            emitTextBlock(fallbackText)
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
          emit('message-metadata', {
            type: 'message-metadata',
            messageMetadata: finishMetadataEntries
          })
          messageMetadata = {
            ...(messageMetadata ?? {}),
            finishReason,
            ...(finishState.usage ? { usage: finishState.usage } : {})
          }
        }

        emit('finish', { type: 'finish' })

        if (!closed) {
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
