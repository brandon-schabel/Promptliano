import { createRoute, z } from '@hono/zod-openapi'

import { createChatService, handleChatMessage } from '@promptliano/services'
import { ApiError, ErrorFactory, withErrorContext } from '@promptliano/shared'
import { ApiErrorResponseSchema, MessageRoleEnum, OperationSuccessResponseSchema } from '@promptliano/schemas'
import {
  createStandardResponses,
  createStandardResponsesWithStatus,
  standardResponses,
  successResponse,
  operationSuccessResponse
} from '../utils/route-helpers'
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
  UpdateChatBodySchema,
  UpdateChatParamsSchema,
  AiChatStreamRequestSchema
} from '@promptliano/schemas'

import { OpenAPIHono } from '@hono/zod-openapi'
import { type APIProviders, type ProviderKey } from '@promptliano/database'
import { stream } from 'hono/streaming'

const chatService = createChatService()

// GET /chats
const getAllChatsRoute = createRoute({
  method: 'get',
  path: '/api/chats',
  tags: ['Chats'],
  summary: 'Get all chat sessions',
  responses: createStandardResponses(ChatListResponseSchema)
})

// POST /chats
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

// GET /chats/:chatId/messages
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

const postAiChatSdkRoute = createRoute({
  method: 'post',
  path: '/api/ai/chat', // Keeping the path
  tags: ['AI'],
  summary: 'Chat completion (streaming, chat-associated)',
  description:
    'Continues a chat session identified by chatId, streams response using Vercel AI SDK via UnifiedProviderService.',
  request: {
    body: {
      content: {
        'application/json': { schema: AiChatStreamRequestSchema } // Use the REVISED schema
      },
      required: true,
      description: 'Chat ID, user message, provider, model, and options for the streaming AI chat completion.'
    }
  },
  responses: {
    200: {
      content: {
        'text/event-stream': {
          schema: z.string().openapi({ description: 'Stream of response tokens (Vercel AI SDK format)' })
        }
      },
      description: 'Successfully initiated AI response stream.'
    },
    ...standardResponses
  }
})

// POST /chats/{chatId}/fork
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

// POST /chats/{chatId}/fork/{messageId}
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
  responses: createStandardResponsesWithStatus(ChatResponseSchema, 201, 'Chat forked successfully from message')
})

// DELETE /chats/{chatId}/messages/{messageId}
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

// PATCH /chats/{chatId}
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

// DELETE /chats/{chatId}
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
export const chatRoutes = new OpenAPIHono()
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
  .openapi(postAiChatSdkRoute, async (c) => {
    const { chatId, userMessage, options, systemMessage, tempId, enableChatAutoNaming } = c.req.valid('json')

    const provider = options?.provider as APIProviders
    const model = options?.model as string

    console.log(`[Hono AI Chat] /ai/chat request: ChatID=${chatId}, Provider=${provider}, Model=${model}`)

    return await withErrorContext(
      async () => {
        const unifiedOptions = { ...options, model }

        c.header('Content-Type', 'text/event-stream; charset=utf-8')
        c.header('Cache-Control', 'no-cache')
        c.header('Connection', 'keep-alive')

        const readableStream = await handleChatMessage({
          chatId,
          userMessage,
          options: unifiedOptions,
          systemMessage,
          tempId,
          enableChatAutoNaming
        })

        return stream(c, async (streamInstance) => {
          await streamInstance.pipe(readableStream.toDataStream())
        })
      },
      {
        entity: 'Chat',
        action: 'ai_stream',
        correlationId: String(chatId),
        metadata: { provider, model, tempId }
      }
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

export type ChatRouteTypes = typeof chatRoutes
