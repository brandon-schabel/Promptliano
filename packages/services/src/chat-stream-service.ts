import { chatStreamRepository as defaultChatStreamRepository, type ChatStreamEvent } from '@promptliano/database'

type StreamDirection = 'assistant' | 'user'

export interface GetStreamsForChatOptions {
  limit?: number
  direction?: StreamDirection
  includeUnfinished?: boolean
}

export interface StreamSummary {
  id: number
  chatId: number
  direction: StreamDirection
  provider: string
  model: string
  startedAt: number
  finishedAt: number | null
  finishReason: string | null
  usageJson: Record<string, unknown> | null
  messageMetadataJson: Record<string, unknown> | null
  format: 'ui' | 'data'
  version: number
  assistantMessageId: number | null
  createdAt: number
  updatedAt: number
  eventCount: number
  latestEventTs: number | null
}
import { createChatService, type ChatService } from './chat-service'
import { extractString } from './gen-ai-services'

export interface ChatStreamServiceDeps {
  chatStreamRepository?: typeof defaultChatStreamRepository
  chatService?: ChatService
}

export interface StartStreamOptions {
  provider: string
  model: string
  messageMetadata?: Record<string, unknown> | null
}

export interface FinalizeStreamOptions {
  finishReason?: string | null
  usage?: Record<string, unknown> | null
  messageMetadata?: Record<string, unknown> | null
}

export interface AppendEventsResult {
  lastSeq: number
}

const TEXT_EVENT_TYPES = new Set([
  'text',
  'text_delta',
  'response_output_text',
  'response_output_text_delta',
  'response_text',
  'response_text_delta',
  'assistant_message',
  'assistant_message_delta'
])

const PART_EVENT_PREFIXES = [
  'reasoning',
  'tool_',
  'tool-',
  'data_',
  'data-',
  'message_metadata',
  'message-metadata',
  'start',
  'finish',
  'step'
]

const normalizeEventType = (type: string): string => type.replace(/[\-.]/g, '_')

const shouldMaterializePart = (type: string): boolean => {
  const normalized = normalizeEventType(type)
  if (TEXT_EVENT_TYPES.has(normalized)) return false
  return PART_EVENT_PREFIXES.some((prefix) => normalized.startsWith(prefix))
}

const collectTextFromEvent = (event: ChatStreamEvent, textSegments: string[]) => {
  const normalized = normalizeEventType(event.type)
  if (!TEXT_EVENT_TYPES.has(normalized)) return

  const payload = event.payload

  if (normalized === 'text_delta' && payload && typeof payload === 'object') {
    const delta = (payload as Record<string, unknown>).delta
    const extractedDelta = extractString(delta)
    if (extractedDelta && extractedDelta.trim().length > 0) {
      textSegments.push(extractedDelta)
    }
    return
  }

  const extracted = extractString(payload)
  if (extracted && extracted.trim().length > 0) {
    textSegments.push(extracted)
  }
}

const collectMaterializedPartPayload = (event: ChatStreamEvent): Record<string, unknown> | null => {
  if (!shouldMaterializePart(event.type)) return null
  const payload: Record<string, unknown> =
    event.payload && typeof event.payload === 'object'
      ? { ...(event.payload as Record<string, unknown>) }
      : event.payload !== undefined && event.payload !== null
        ? { value: event.payload }
        : {}
  if (typeof payload.type !== 'string') {
    payload.type = event.type
  }
  if (payload.type === 'tool-output-available' && payload.output !== undefined) {
    const summary = extractString(payload.output)
    if (summary && summary.trim().length > 0) {
      payload.outputText = summary.trim()
    }
  }
  return payload
}

const toUserString = (value: unknown): string => {
  if (typeof value === 'string') return value
  const extracted = extractString(value)
  return extracted.trim()
}

type ExtendedChatStreamRepository = typeof defaultChatStreamRepository & {
  getStreamsForChat: (chatId: number, options?: GetStreamsForChatOptions) => Promise<StreamSummary[]>
  getStreamWithEvents: (
    streamId: number
  ) => Promise<
    | (StreamSummary & {
        events: Array<{
          id: number
          streamId: number
          seq: number
          ts: number
          type: string
          payload: unknown
        }>
      })
    | null
  >
}

export function createChatStreamService(deps: ChatStreamServiceDeps = {}) {
  const repo = (deps.chatStreamRepository ?? defaultChatStreamRepository) as ExtendedChatStreamRepository
  const chatService = deps.chatService ?? createChatService()

  const reduceEventsToMessage = (events: ChatStreamEvent[]) => {
    const textSegments: string[] = []
    const rawParts: Array<Record<string, unknown>> = []

    for (const event of events) {
      collectTextFromEvent(event, textSegments)
      const part = collectMaterializedPartPayload(event)
      if (part) {
        rawParts.push(part)
      }
    }

    const reasoningBuffers = new Map<string, string[]>()
    const materializedParts: Array<Record<string, unknown>> = []

    const flushReasoning = (id: string) => {
      const buffer = reasoningBuffers.get(id)
      if (!buffer) return
      const text = buffer.join('').trim()
      if (text.length > 0) {
        materializedParts.push({ type: 'reasoning', id, text })
      }
      reasoningBuffers.delete(id)
    }

    for (const part of rawParts) {
      const partType = typeof part.type === 'string' ? part.type : ''
      switch (partType) {
        case 'reasoning-start': {
          const reasoningId = typeof part.id === 'string' ? part.id : `reasoning-${materializedParts.length}`
          reasoningBuffers.set(reasoningId, [])
          break
        }
        case 'reasoning-delta': {
          const reasoningId = typeof part.id === 'string' ? part.id : `reasoning-${materializedParts.length}`
          const delta = typeof part.delta === 'string' ? part.delta : extractString(part.delta)
          if (!reasoningBuffers.has(reasoningId)) {
            reasoningBuffers.set(reasoningId, [])
          }
          if (delta && delta.length > 0) {
            reasoningBuffers.get(reasoningId)!.push(delta)
          }
          break
        }
        case 'reasoning-end': {
          const reasoningId = typeof part.id === 'string' ? part.id : `reasoning-${materializedParts.length}`
          flushReasoning(reasoningId)
          break
        }
        case 'reasoning': {
          const text = typeof part.text === 'string' ? part.text : extractString(part.text)
          if (text && text.trim().length > 0) {
            materializedParts.push({ type: 'reasoning', text: text.trim() })
          }
          break
        }
        case 'reasoning-part-finish':
          // ignore
          break
        default:
          materializedParts.push(part)
          break
      }
    }

    for (const [reasoningId] of reasoningBuffers) {
      flushReasoning(reasoningId)
    }

    const finalText = textSegments.join('')
    return {
      finalText: finalText.trim(),
      parts: materializedParts
    }
  }

  return {
    async startAssistantStream(chatId: number, options: StartStreamOptions) {
      const result = await repo.createStream({
        chatId,
        direction: 'assistant',
        provider: options.provider,
        model: options.model,
        messageMetadata: options.messageMetadata ?? null,
        format: 'ui'
      })
      return result
    },

    async recordUserInput(chatId: number, uiMessage: unknown) {
      const stream = await repo.createStream({
        chatId,
        direction: 'user',
        provider: 'client',
        model: 'user',
        messageMetadata: null,
        format: 'data'
      })

      const now = Date.now()
      const normalizedUiMessage =
        uiMessage && typeof uiMessage === 'object'
          ? (uiMessage as Record<string, unknown>)
          : { content: toUserString(uiMessage) }
      await repo.appendEvents(
        stream.id,
        [
          {
            type: 'user_message',
            payload: normalizedUiMessage,
            ts: now
          }
        ],
        0
      )

      const userContent =
        typeof normalizedUiMessage.content === 'string' && normalizedUiMessage.content.length > 0
          ? normalizedUiMessage.content
          : toUserString(normalizedUiMessage)
      const message = await chatService.addMessage(chatId, {
        role: 'user',
        content: userContent,
        metadata: {
          streamId: stream.id,
          sourceOfTruth: 'stream',
          uiMessage: normalizedUiMessage
        }
      })

      await repo.finalizeStream(stream.id, {
        finishedAt: now,
        assistantMessageId: null
      })

      return { streamId: stream.id, messageId: message.id }
    },

    async appendBatch(
      streamId: number,
      events: Array<{ type: string; payload: unknown; ts?: number }>,
      lastSeq: number = 0
    ): Promise<AppendEventsResult> {
      const updatedSeq = await repo.appendEvents(streamId, events, lastSeq)
      return { lastSeq: updatedSeq }
    },

    async finalizeAssistantStream(chatId: number, streamId: number, options: FinalizeStreamOptions = {}) {
      const events = await repo.getEvents(streamId)
      const { finalText, parts } = reduceEventsToMessage(events)

      const assistantContent = finalText.length > 0 ? finalText : 'No response was generated.'
      const uiMessageParts = assistantContent.length > 0 ? [{ type: 'text', text: assistantContent }] : []
      const uiMessage = {
        id: `assistant-${streamId}`,
        role: 'assistant' as const,
        parts: uiMessageParts
      }
      const message = await chatService.addMessage(chatId, {
        role: 'assistant',
        content: assistantContent,
        metadata: {
          streamId,
          finishReason: options.finishReason ?? 'stop',
          usage: options.usage ?? null,
          parts,
          sourceOfTruth: 'stream',
          ...(options.messageMetadata ? { messageMetadata: options.messageMetadata } : {}),
          uiMessage
        }
      })

      await repo.finalizeStream(streamId, {
        finishedAt: Date.now(),
        finishReason: options.finishReason ?? 'stop',
        usage: options.usage ?? null,
        assistantMessageId: message.id,
        messageMetadata: options.messageMetadata
      })

      return {
        messageId: message.id,
        finalText: assistantContent,
        parts
      }
    },

    async listStreams(chatId: number, options: GetStreamsForChatOptions = {}): Promise<StreamSummary[]> {
      return repo.getStreamsForChat(chatId, options)
    },

    async getEvents(streamId: number) {
      return repo.getEvents(streamId)
    },

    async getStream(streamId: number) {
      return repo.getStreamById(streamId)
    },

    async getStreamWithEvents(streamId: number) {
      return repo.getStreamWithEvents(streamId)
    },

    async replay(streamId: number) {
      const events = await repo.getEvents(streamId)
      return events.map((event) => ({ type: event.type, payload: event.payload }))
    },

    materializeFromEvents: reduceEventsToMessage
  }
}

export type ChatStreamService = ReturnType<typeof createChatStreamService>
