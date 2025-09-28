import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import type { Context } from 'hono'
import type { UIMessage } from 'ai'

import { createChatService, createChatStreamService } from '@promptliano/services'
import { ErrorFactory, withErrorContext } from '@promptliano/shared'
import {
  ChatListResponseSchema,
  ChatResponseSchema,
  CreateChatBodySchema,
  DeleteChatParamsSchema,
  DeleteMessageParamsSchema,
  ForkChatBodySchema,
  ForkChatFromMessageBodySchema,
  ForkChatFromMessageParamsSchema,
  ForkChatParamsSchema,
  GetMessagesParamsSchema,
  MessageListResponseSchema,
  MessageRoleEnum,
  OperationSuccessResponseSchema,
  UpdateChatBodySchema,
  UpdateChatParamsSchema
} from '@promptliano/schemas'
import { chatRepository } from '@promptliano/database'
import {
  createStandardResponses,
  createStandardResponsesWithStatus,
  successResponse
} from '../utils/route-helpers'
import { streamChatSession, renderUiMessageText, type ToolChoice } from '../ai/chat/session'
import { createPersistedUIStreamResponse } from '../ai/chat/persisting-ui-stream'
import { deserializeChatMessage } from '../utils/chat-message-serializer'

const chatService = createChatService()
const chatStreamService = createChatStreamService()

const getAllChatsRoute = createRoute({
  method: 'get',
  path: '/api/chats',
  tags: ['Chats'],
  summary: 'Get all chat sessions',
  responses: createStandardResponses(ChatListResponseSchema)
})

const createChatRoute = createRoute({
  method: 'post',
  path: '/api/chats',
  tags: ['Chats'],
  summary: 'Create a new chat session',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateChatBodySchema
        }
      },
      required: true,
      description: 'Data for the new chat session'
    }
  },
  responses: createStandardResponsesWithStatus(ChatResponseSchema, 201, 'Chat created successfully')
})

const getChatMessagesRoute = createRoute({
  method: 'get',
  path: '/api/chats/{chatId}/messages',
  tags: ['Chats'],
  summary: 'Get messages for a specific chat',
  request: {
    params: GetMessagesParamsSchema
  },
  responses: createStandardResponses(MessageListResponseSchema)
})

const forkChatRoute = createRoute({
  method: 'post',
  path: '/api/chats/{chatId}/fork',
  tags: ['Chats'],
  summary: 'Fork a chat session',
  request: {
    params: ForkChatParamsSchema,
    body: {
      content: { 'application/json': { schema: ForkChatBodySchema } },
      required: true,
      description: 'Optional message IDs to exclude from the fork'
    }
  },
  responses: createStandardResponsesWithStatus(ChatResponseSchema, 201, 'Chat forked successfully')
})

const forkChatFromMessageRoute = createRoute({
  method: 'post',
  path: '/api/chats/{chatId}/fork/{messageId}',
  tags: ['Chats'],
  summary: 'Fork a chat session from a specific message',
  request: {
    params: ForkChatFromMessageParamsSchema,
    body: {
      content: { 'application/json': { schema: ForkChatFromMessageBodySchema } },
      required: true,
      description: 'Optional message IDs to exclude from the fork'
    }
  },
  responses: createStandardResponsesWithStatus(
    ChatResponseSchema,
    201,
    'Chat forked successfully from message'
  )
})

const deleteMessageRoute = createRoute({
  method: 'delete',
  path: '/api/chats/{chatId}/messages/{messageId}',
  tags: ['Messages'],
  summary: 'Delete a specific message',
  request: {
    params: DeleteMessageParamsSchema
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

const updateChatRoute = createRoute({
  method: 'patch',
  path: '/api/chats/{chatId}',
  tags: ['Chats'],
  summary: 'Update chat properties (e.g., title)',
  request: {
    params: UpdateChatParamsSchema,
    body: {
      content: { 'application/json': { schema: UpdateChatBodySchema } },
      required: true,
      description: 'Data to update for the chat'
    }
  },
  responses: createStandardResponses(ChatResponseSchema)
})

const deleteChatRoute = createRoute({
  method: 'delete',
  path: '/api/chats/{chatId}',
  tags: ['Chats'],
  summary: 'Delete a chat session and its messages',
  request: {
    params: DeleteChatParamsSchema
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

const getChatByIdRoute = createRoute({
  method: 'get',
  path: '/api/chats/{id}',
  tags: ['Chats'],
  summary: 'Get a chat by ID',
  request: {
    params: z.object({
      id: z
        .string()
        .regex(/^\d+$/)
        .transform(Number)
        .openapi({
          param: {
            name: 'id',
            in: 'path'
          },
          example: '1'
        })
    })
  },
  responses: createStandardResponses(ChatResponseSchema)
})

const updateChatByIdRoute = createRoute({
  method: 'put',
  path: '/api/chats/{id}',
  tags: ['Chats'],
  summary: 'Update a chat by ID',
  request: {
    params: z.object({
      id: z
        .string()
        .regex(/^\d+$/)
        .transform(Number)
        .openapi({
          param: {
            name: 'id',
            in: 'path'
          },
          example: '1'
        })
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateChatBodySchema
        }
      }
    }
  },
  responses: createStandardResponses(ChatResponseSchema)
})

const deleteChatByIdRoute = createRoute({
  method: 'delete',
  path: '/api/chats/{id}',
  tags: ['Chats'],
  summary: 'Delete a chat by ID',
  request: {
    params: z.object({
      id: z
        .string()
        .regex(/^\d+$/)
        .transform(Number)
        .openapi({
          param: {
            name: 'id',
            in: 'path'
          },
          example: '1'
        })
    })
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

export const chatRoutes = new OpenAPIHono()

chatRoutes
  .openapi(getAllChatsRoute, async (c) => {
    return await withErrorContext(
      async () => {
        const userChats = await chatService.getAllChats()
        return c.json(
          {
            success: true,
            data: userChats
          } satisfies z.infer<typeof ChatListResponseSchema>,
          200
        )
      },
      { entity: 'Chat', action: 'list' }
    )
  })
  .openapi(createChatRoute, async (c): Promise<any> => {
    const body = c.req.valid('json')

    const chat = await chatService.createChat(body.title, {
      copyExisting: body.copyExisting,
      currentChatId: body.currentChatId
    })

    return c.json(successResponse(chat), 201)
  })
  .openapi(getChatMessagesRoute, async (c) => {
    const { chatId } = c.req.valid('param')
    const messages = await chatService.getChatMessages(chatId)
    return c.json(
      {
        success: true,
        data: messages.map((msg) => ({
          ...msg,
          role: msg.role as z.infer<typeof MessageRoleEnum>
        }))
      } satisfies z.infer<typeof MessageListResponseSchema>,
      200
    )
  })
  .openapi(forkChatRoute, async (c): Promise<any> => {
    const { chatId } = c.req.valid('param')
    const { excludedMessageIds } = c.req.valid('json')
    const newChat = await chatService.forkChat(chatId, excludedMessageIds)
    return c.json(successResponse(newChat), 201)
  })
  .openapi(forkChatFromMessageRoute, async (c): Promise<any> => {
    const { chatId, messageId } = c.req.valid('param')
    const { excludedMessageIds } = c.req.valid('json')
    const newChat = await chatService.forkChatFromMessage(chatId, messageId, excludedMessageIds)
    return c.json(successResponse(newChat), 201)
  })
  .openapi(deleteMessageRoute, async (c) => {
    const { messageId, chatId } = c.req.valid('param')
    await chatService.deleteMessage(chatId, messageId)
    return c.json(
      {
        success: true,
        message: 'Message deleted successfully'
      } satisfies z.infer<typeof OperationSuccessResponseSchema>,
      200
    )
  })
  .openapi(updateChatRoute, async (c) => {
    const { chatId } = c.req.valid('param')
    const { title } = c.req.valid('json')
    const updatedChat = await chatService.updateChat(chatId, title)
    return c.json(
      {
        success: true,
        data: updatedChat
      } satisfies z.infer<typeof ChatResponseSchema>,
      200
    )
  })
  .openapi(deleteChatRoute, async (c) => {
    const { chatId } = c.req.valid('param')
    await chatService.deleteChat(chatId)
    return c.json(
      {
        success: true,
        message: 'Chat deleted successfully'
      } satisfies z.infer<typeof OperationSuccessResponseSchema>,
      200
    )
  })
  .openapi(getChatByIdRoute, async (c) => {
    const { id } = c.req.valid('param')
    return await withErrorContext(
      async () => {
        const chat = await chatService.getById(id)
        if (!chat) {
          throw ErrorFactory.notFound('Chat', id)
        }
        return c.json(
          {
            success: true,
            data: chat
          } satisfies z.infer<typeof ChatResponseSchema>,
          200
        )
      },
      { entity: 'Chat', action: 'get', correlationId: String(id) }
    )
  })
  .openapi(updateChatByIdRoute, async (c) => {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    return await withErrorContext(
      async () => {
        const updatedChat = await chatService.updateChat(id, typeof body === 'string' ? body : body.title)
        return c.json(
          {
            success: true,
            data: updatedChat
          } satisfies z.infer<typeof ChatResponseSchema>,
          200
        )
      },
      { entity: 'Chat', action: 'update', correlationId: String(id) }
    )
  })
  .openapi(deleteChatByIdRoute, async (c) => {
    const { id } = c.req.valid('param')
    return await withErrorContext(
      async () => {
        await chatService.deleteChat(id)
        return c.json(
          {
            success: true,
            message: 'Chat deleted successfully'
          } satisfies z.infer<typeof OperationSuccessResponseSchema>,
          200
        )
      },
      { entity: 'Chat', action: 'delete', correlationId: String(id) }
    )
  })

type ChatUiMessage = UIMessage & {
  content?: string
  createdAt?: number
}

const MessageMetadataEntrySchema = z.object({
  key: z.string(),
  value: z.any()
})

const UiMessageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(['user', 'assistant', 'system']),
  parts: z.array(z.any()),
  createdAt: z
    .preprocess((value) => {
      if (value === undefined || value === null) return undefined
      if (typeof value === 'number') return value
      if (typeof value === 'string') {
        const parsed = Date.parse(value)
        return Number.isNaN(parsed) ? undefined : parsed
      }
      return undefined
    }, z.number().nonnegative().optional()),
  metadata: z
    .union([z.record(z.string(), z.any()), z.array(MessageMetadataEntrySchema)])
    .optional()
    .transform((value) => {
      if (!value) return undefined
      if (Array.isArray(value)) {
        const metadataRecord: Record<string, unknown> = {}
        for (const entry of value) {
          if (typeof entry.key === 'string' && entry.key.length > 0) {
            metadataRecord[entry.key] = entry.value
          }
        }
        return metadataRecord
      }
      return value
    })
})

const StreamDirectionEnum = z.enum(['assistant', 'user'])

const StreamReferenceSchema = z.object({
  id: z.number(),
  chatId: z.number(),
  direction: StreamDirectionEnum,
  provider: z.string(),
  model: z.string(),
  startedAt: z.number(),
  finishedAt: z.number().nullable(),
  finishReason: z.string().nullable(),
  eventCount: z.number(),
  latestEventTs: z.number().nullable(),
  assistantMessageId: z.number().nullable(),
  eventsUrl: z.string(),
  replayUrl: z.string()
})

const StreamSummarySchema = StreamReferenceSchema.extend({
  usage: z.record(z.string(), z.any()).nullable(),
  messageMetadata: z.record(z.string(), z.any()).nullable(),
  format: z.enum(['ui', 'data']),
  version: z.number(),
  createdAt: z.number(),
  updatedAt: z.number()
})

const StreamEventSchema = z.object({
  id: z.number(),
  seq: z.number(),
  ts: z.number(),
  type: z.string(),
  payload: z.unknown()
})

type StreamSummaryResponse = z.infer<typeof StreamSummarySchema>
type StreamReferenceResponse = z.infer<typeof StreamReferenceSchema>

type StreamSummary = {
  id: number
  chatId: number
  direction: 'assistant' | 'user'
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

const toStreamReferenceResponse = (summary: StreamSummary): StreamReferenceResponse => ({
  id: summary.id,
  chatId: summary.chatId,
  direction: summary.direction,
  provider: summary.provider,
  model: summary.model,
  startedAt: summary.startedAt,
  finishedAt: summary.finishedAt ?? null,
  finishReason: summary.finishReason ?? null,
  eventCount: summary.eventCount,
  latestEventTs: summary.latestEventTs ?? null,
  assistantMessageId: summary.assistantMessageId ?? null,
  eventsUrl: `/api/streams/${summary.id}/events`,
  replayUrl: `/api/streams/${summary.id}/replay`
})

const toStreamSummaryResponse = (summary: StreamSummary): StreamSummaryResponse => ({
  ...toStreamReferenceResponse(summary),
  usage: summary.usageJson ?? null,
  messageMetadata: summary.messageMetadataJson ?? null,
  format: summary.format,
  version: summary.version,
  createdAt: summary.createdAt,
  updatedAt: summary.updatedAt
})

const ToolChoiceSchema = z.union([
  z.enum(['auto', 'none', 'required']),
  z.object({
    type: z.literal('tool'),
    toolName: z.string().min(1)
  })
])

const ChatRequestSchema = z.object({
  chatId: z.string().optional(),
  chatTitle: z.string().optional(),
  enableMcp: z.boolean().optional().default(true),
  provider: z.string().optional(),
  model: z.string().optional(),
  system: z.string().optional(),
  maxSteps: z.number().int().positive().optional(),
  forceFinalText: z.boolean().optional(),
  parallelToolCalls: z.boolean().optional(),
  toolChoice: ToolChoiceSchema.optional(),
  temperature: z.number().optional(),
  maxTokens: z.number().int().positive().optional(),
  topP: z.number().optional(),
  frequencyPenalty: z.number().optional(),
  presencePenalty: z.number().optional(),
  messages: z.array(UiMessageSchema).min(1, 'At least one message is required')
})

const StreamsQuerySchema = z.object({
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform((value) => Number.parseInt(value, 10))
    .optional(),
  direction: StreamDirectionEnum.optional(),
  includeUnfinished: z
    .string()
    .transform((value) => value !== 'false')
    .optional()
})

const StreamEventsQuerySchema = z.object({
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform((value) => Number.parseInt(value, 10))
    .optional(),
  since: z
    .string()
    .regex(/^\d+$/)
    .transform((value) => Number.parseInt(value, 10))
    .optional()
})

const HistoryResponseSchema = z.object({
  chatId: z.string(),
  messages: z.array(UiMessageSchema),
  streams: z.array(StreamReferenceSchema).optional()
})

interface ErrorBody {
  success: false
  error: {
    message: string
    code: string
    details?: Record<string, unknown>
  }
}

const errorResponse = (c: Context, status: number, message: string, details?: Record<string, unknown>) =>
  c.json(
    {
      success: false,
      error: {
        message,
        code: 'CHAT_ROUTER_ERROR',
        ...(details ? { details } : {})
      }
    } satisfies ErrorBody,
    status as any
  )

const parseChatId = (raw?: string | null): number | null => {
  if (!raw) return null
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : null
}

const ensureChat = async (requestedId: number | null, title?: string) => {
  if (requestedId) {
    const existing = await chatRepository.getById(requestedId)
    if (existing) return existing
  }

  return chatRepository.create({
    title: title?.trim() || 'Untitled Chat'
  })
}

const resolveProviderAndModel = (
  rawProvider?: string | null,
  rawModel?: string | null
): { provider: string; model: string } => {
  const trimmedModel = rawModel?.trim() ?? ''
  const trimmedProvider = rawProvider?.trim()

  if (trimmedProvider && trimmedProvider.length > 0) {
    return {
      provider: trimmedProvider,
      model: trimmedModel
    }
  }

  if (trimmedModel.includes(':')) {
    const [providerPart, ...rest] = trimmedModel.split(':')
    const modelPart = rest.join(':').trim()
    return {
      provider: providerPart || 'openai',
      model: modelPart || trimmedModel
    }
  }

  return {
    provider: 'openrouter',
    model: trimmedModel
  }
}

chatRoutes.get('/api/chats/:chatId/streams', async (c) => {
  const chatId = parseChatId(c.req.param('chatId'))
  if (!chatId) {
    return errorResponse(c, 400, 'Invalid chatId parameter')
  }

  const queryResult = StreamsQuerySchema.safeParse({
    limit: c.req.query('limit') ?? undefined,
    direction: c.req.query('direction') ?? undefined,
    includeUnfinished: c.req.query('includeUnfinished') ?? undefined
  })

  if (!queryResult.success) {
    return errorResponse(c, 400, 'Invalid stream query parameters', queryResult.error.flatten().fieldErrors)
  }

  const limit = queryResult.data.limit ? Math.min(Math.max(queryResult.data.limit, 1), 200) : undefined
  const options = {
    ...(limit ? { limit } : {}),
    ...(queryResult.data.direction ? { direction: queryResult.data.direction } : {}),
    ...(queryResult.data.includeUnfinished !== undefined
      ? { includeUnfinished: queryResult.data.includeUnfinished }
      : {})
  }

  const streams = await chatStreamService.listStreams(chatId, options)
  const responseStreams = streams.map(toStreamSummaryResponse)

  return c.json({
    success: true,
    data: responseStreams
  })
})

chatRoutes.get('/api/streams/:streamId/events', async (c) => {
  const streamId = parseChatId(c.req.param('streamId'))
  if (!streamId) {
    return errorResponse(c, 400, 'Invalid streamId parameter')
  }

  const stream = await chatStreamService.getStream(streamId)
  if (!stream) {
    return errorResponse(c, 404, `Stream ${streamId} not found`)
  }

  const queryResult = StreamEventsQuerySchema.safeParse({
    limit: c.req.query('limit') ?? undefined,
    since: c.req.query('since') ?? undefined
  })

  if (!queryResult.success) {
    return errorResponse(c, 400, 'Invalid stream events query parameters', queryResult.error.flatten().fieldErrors)
  }

  const limit = queryResult.data.limit ? Math.min(Math.max(queryResult.data.limit, 1), 1000) : undefined
  const sinceSeq = queryResult.data.since

  const events = await chatStreamService.getEvents(streamId)
  let filtered = events
  if (typeof sinceSeq === 'number') {
    filtered = filtered.filter((event) => event.seq > sinceSeq)
  }
  if (typeof limit === 'number') {
    filtered = filtered.slice(0, limit)
  }

  const responseEvents = filtered.map((event) => ({
    id: event.id,
    seq: event.seq,
    ts: event.ts,
    type: event.type,
    payload: event.payload
  }))

  return c.json({
    success: true,
    stream: {
      id: stream.id,
      chatId: stream.chatId
    },
    events: responseEvents
  })
})

chatRoutes.get('/api/streams/:streamId/replay', async (c) => {
  const streamId = parseChatId(c.req.param('streamId'))
  if (!streamId) {
    return errorResponse(c, 400, 'Invalid streamId parameter')
  }

  const streamRecord = await chatStreamService.getStream(streamId)
  if (!streamRecord) {
    return errorResponse(c, 404, `Stream ${streamId} not found`)
  }

  const events = await chatStreamService.getEvents(streamId)
  const encoder = new TextEncoder()
  const isUiStream = (streamRecord.format ?? 'data') === 'ui'

  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      try {
        const enqueueJson = (value: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(value ?? null)}\n\n`))
        }

        if (isUiStream) {
          for (const event of events) {
            const payload = event.payload && typeof event.payload === 'object'
              ? { ...(event.payload as Record<string, unknown>) }
              : event.payload ?? null
            if (payload && typeof payload === 'object' && typeof (payload as Record<string, unknown>).type !== 'string') {
              ;(payload as Record<string, unknown>).type = event.type
            }
            enqueueJson(payload)
          }
        } else {
          for (const event of events) {
            const payload = JSON.stringify(event.payload ?? null)
            const chunk = `event: ${event.type}\ndata: ${payload}\n\n`
            controller.enqueue(encoder.encode(chunk))
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    }
  })

  const headers: Record<string, string> = {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'x-stream-id': String(streamId),
    'x-chat-id': String(streamRecord.chatId),
    'x-stream-format': isUiStream ? 'ui' : (streamRecord.format ?? 'data')
  }

  if (isUiStream) {
    headers['x-vercel-ai-ui-message-stream'] = 'v1'
  }

  return new Response(readable, {
    headers
  })
})

chatRoutes.post('/api/chat', async (c) => {
  const parseResult = ChatRequestSchema.safeParse(await c.req.json())
  if (!parseResult.success) {
    return errorResponse(c, 400, 'Invalid chat request payload', parseResult.error.flatten().fieldErrors)
  }

  const payload = parseResult.data
  const requestedId = parseChatId(payload.chatId)
  const chat = await ensureChat(requestedId, payload.chatTitle)
  const chatId = chat.id

  const normalizeUiMessages = (messages: ChatUiMessage[]): ChatUiMessage[] => {
    return messages.map((message) => {
      const resolvedContent =
        typeof message.content === 'string' && message.content.trim().length > 0
          ? message.content
          : renderUiMessageText(message as UIMessage)

      return {
        ...message,
        content: resolvedContent
      }
    })
  }

  const uiMessages = normalizeUiMessages(payload.messages as ChatUiMessage[])

  const { provider, model } = resolveProviderAndModel(payload.provider, payload.model)
  const toolsEnabled = payload.enableMcp !== false
  const toolChoice: ToolChoice = payload.toolChoice ?? (toolsEnabled ? 'auto' : 'none')
  const options = {
    ...(payload.temperature !== undefined && { temperature: payload.temperature }),
    ...(payload.maxTokens !== undefined && { maxTokens: payload.maxTokens }),
    ...(payload.topP !== undefined && { topP: payload.topP }),
    ...(payload.frequencyPenalty !== undefined && { frequencyPenalty: payload.frequencyPenalty }),
    ...(payload.presencePenalty !== undefined && { presencePenalty: payload.presencePenalty })
  }

  console.debug('[ChatRoutes] Streaming request', {
    provider,
    model,
    toolsEnabled,
    toolChoice,
    options
  })

  const debugStream = process.env.PROMPTLIANO_DEBUG_STREAM === 'true'

  const lastMessage = uiMessages[uiMessages.length - 1]
  if (lastMessage?.role === 'user') {
    try {
      await chatStreamService.recordUserInput(chatId, lastMessage)
    } catch (error) {
      console.error('[AI] Failed to persist user input stream', error)
    }
  }

  const agenticOverrides: {
    maxSteps?: number
    forceFinalText?: boolean
    parallelToolCalls?: boolean
  } = {}
  if (payload.maxSteps !== undefined) agenticOverrides.maxSteps = payload.maxSteps
  if (payload.forceFinalText !== undefined) agenticOverrides.forceFinalText = payload.forceFinalText
  if (payload.parallelToolCalls !== undefined) agenticOverrides.parallelToolCalls = payload.parallelToolCalls
  const hasAgenticOverrides = Object.keys(agenticOverrides).length > 0

  let sessionResult
  try {
    sessionResult = await streamChatSession({
      chatId,
      messages: uiMessages,
      provider,
      model,
      systemMessage: payload.system,
      options,
      toolsEnabled,
      toolChoice,
      maxSteps: payload.maxSteps ?? undefined,
      providerKey: provider,
      agenticOverrides: hasAgenticOverrides ? agenticOverrides : undefined,
      debug: debugStream,
      persistMessages: false
    })
  } catch (error) {
    console.error('[AI] Failed to start streaming session', error)
    return errorResponse(c, 500, 'Failed to start assistant stream')
  }

  const { stream, cleanup } = sessionResult

  const cleanupOnce = (() => {
    let done = false
    return async () => {
      if (done) return
      done = true
      await cleanup()
    }
  })()

  const { stream: sessionStream, finishState } = stream

  let persistedStream
  try {
    persistedStream = await createPersistedUIStreamResponse({
      chatId,
      provider,
      model,
      stream: sessionStream,
      finishState,
      chatStreamService
    })
  } catch (error) {
    await cleanupOnce()
    console.error('[AI] Failed to initialize persisted stream', error)
    return errorResponse(c, 500, 'Failed to initialize assistant stream')
  }

  let finalized = false
  const finalizeStream = async (metadata: Record<string, unknown> | null) => {
    if (finalized) return
    finalized = true
    try {
      await chatStreamService.finalizeAssistantStream(chatId, persistedStream.streamId, {
        finishReason: finishState.finishReason,
        usage: finishState.usage ?? undefined,
        messageMetadata: metadata ?? undefined
      })
    } catch (error) {
      console.error('[AI] Failed to finalize assistant stream', error)
    }
  }

  persistedStream.completion
    .then(async ({ messageMetadata, error }) => {
      if (error) {
        console.error('[AI] Stream pipeline error', error)
      }
      await finalizeStream(messageMetadata)
    })
    .catch(async (completionError) => {
      console.error('[AI] Stream completion failed', completionError)
      await finalizeStream(null)
    })
    .finally(() => {
      cleanupOnce().catch((cleanupError) => {
        console.error('[AI] Failed to clean up stream resources', cleanupError)
      })
    })

  const response = persistedStream.response
  response.headers.set('x-chat-id', String(chatId))
  response.headers.set('x-stream-id', String(persistedStream.streamId))
  response.headers.set('x-stream-format', 'ui')
  return response
})

chatRoutes.get('/api/history', async (c) => {
  const chatIdRaw = c.req.query('chatId')
  const parsedId = parseChatId(chatIdRaw)
  if (!parsedId) {
    return errorResponse(c, 400, 'chatId query parameter is required')
  }

  const chat = await chatRepository.getById(parsedId)
  if (!chat) {
    return errorResponse(c, 404, `Chat ${parsedId} not found`)
  }

  const messages = await chatRepository.getMessages(parsedId)
  const uiMessages = messages.map(deserializeChatMessage)
  const normalizedUiMessages = uiMessages.map((message) => ({
    ...message,
    metadata: message.metadata ?? undefined
  }))

  const includeRawParam = (c.req.query('includeRaw') ?? '').toLowerCase()
  const includeRaw = includeRawParam === 'true' || includeRawParam === '1'
  const streamLimitParam = c.req.query('streamLimit') ?? undefined
  const streamLimit = streamLimitParam && /^\d+$/.test(streamLimitParam)
    ? Math.min(Math.max(Number.parseInt(streamLimitParam, 10), 1), 200)
    : undefined

  let streamSummaries: StreamSummary[] | undefined
  if (includeRaw) {
    streamSummaries = await chatStreamService.listStreams(parsedId, {
      ...(streamLimit ? { limit: streamLimit } : {})
    })
  }

  const responseBody: z.infer<typeof HistoryResponseSchema> = {
    chatId: String(parsedId),
    messages: normalizedUiMessages,
    ...(streamSummaries ? { streams: streamSummaries.map(toStreamReferenceResponse) } : {})
  }

  return c.json(responseBody)
})

export type ChatRouteTypes = typeof chatRoutes
