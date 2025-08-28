import { z } from '@hono/zod-openapi'
import { MessageRoleEnum } from './common.schemas'

// =============================================================================
// CHAT API REQUEST SCHEMAS
// =============================================================================
// These schemas validate incoming requests to chat-related endpoints

// Create Chat Request Body Schema
export const CreateChatBodySchema = z
  .object({
    title: z.string().min(1).max(255),
    projectId: z.number().int().positive(),
    copyExisting: z.boolean().optional(),
    currentChatId: z.number().int().positive().optional()
  })
  .openapi('CreateChatBody')

// Update Chat Request Body Schema
export const UpdateChatBodySchema = z
  .object({
    title: z.string().min(1).max(255)
  })
  .openapi('UpdateChatBody')

// Fork Chat Request Body Schema
export const ForkChatBodySchema = z
  .object({
    excludedMessageIds: z.array(z.number().int().positive()).optional().default([])
  })
  .openapi('ForkChatBody')

// Fork Chat From Message Request Body Schema
export const ForkChatFromMessageBodySchema = z
  .object({
    excludedMessageIds: z.array(z.number().int().positive()).optional().default([])
  })
  .openapi('ForkChatFromMessageBody')

// =============================================================================
// PARAMETER SCHEMAS
// =============================================================================

// Delete Chat Parameters Schema
export const DeleteChatParamsSchema = z
  .object({
    chatId: z.string().transform((val) => parseInt(val, 10))
  })
  .openapi('DeleteChatParams')

// Update Chat Parameters Schema
export const UpdateChatParamsSchema = z
  .object({
    chatId: z.string().transform((val) => parseInt(val, 10))
  })
  .openapi('UpdateChatParams')

// Get Messages Parameters Schema
export const GetMessagesParamsSchema = z
  .object({
    chatId: z.string().transform((val) => parseInt(val, 10))
  })
  .openapi('GetMessagesParams')

// Fork Chat Parameters Schema
export const ForkChatParamsSchema = z
  .object({
    chatId: z.string().transform((val) => parseInt(val, 10))
  })
  .openapi('ForkChatParams')

// Fork Chat From Message Parameters Schema
export const ForkChatFromMessageParamsSchema = z
  .object({
    chatId: z.string().transform((val) => parseInt(val, 10)),
    messageId: z.string().transform((val) => parseInt(val, 10))
  })
  .openapi('ForkChatFromMessageParams')

// Delete Message Parameters Schema
export const DeleteMessageParamsSchema = z
  .object({
    chatId: z.string().transform((val) => parseInt(val, 10)),
    messageId: z.string().transform((val) => parseInt(val, 10))
  })
  .openapi('DeleteMessageParams')

// =============================================================================
// AI CHAT STREAMING SCHEMA
// =============================================================================

// AI Chat Stream Request Schema
export const AiChatStreamRequestSchema = z
  .object({
    chatId: z.number().int().positive(),
    userMessage: z.string().min(1),
    systemMessage: z.string().optional(),
    tempId: z.string().optional(),
    enableChatAutoNaming: z.boolean().optional().default(false),
    options: z
      .object({
        provider: z.string(),
        model: z.string(),
        temperature: z.number().min(0).max(2).optional(),
        maxTokens: z.number().int().positive().optional(),
        topP: z.number().min(0).max(1).optional(),
        stream: z.boolean().optional().default(true)
      })
      .optional()
  })
  .openapi('AiChatStreamRequest')

// =============================================================================
// MESSAGE LIST RESPONSE SCHEMA
// =============================================================================

// Message List Response Schema
export const MessageListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(
      z.object({
        id: z.number(),
        chatId: z.number(),
        role: MessageRoleEnum,
        content: z.string(),
        metadata: z.record(z.any()).nullable(),
        createdAt: z.number()
      })
    )
  })
  .openapi('MessageListResponse')

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type CreateChatBody = z.infer<typeof CreateChatBodySchema>
export type UpdateChatBody = z.infer<typeof UpdateChatBodySchema>
export type ForkChatBody = z.infer<typeof ForkChatBodySchema>
export type ForkChatFromMessageBody = z.infer<typeof ForkChatFromMessageBodySchema>
export type DeleteChatParams = z.infer<typeof DeleteChatParamsSchema>
export type UpdateChatParams = z.infer<typeof UpdateChatParamsSchema>
export type GetMessagesParams = z.infer<typeof GetMessagesParamsSchema>
export type ForkChatParams = z.infer<typeof ForkChatParamsSchema>
export type ForkChatFromMessageParams = z.infer<typeof ForkChatFromMessageParamsSchema>
export type DeleteMessageParams = z.infer<typeof DeleteMessageParamsSchema>
export type MessageRole = z.infer<typeof MessageRoleEnum>
export { MessageRoleEnum }
export type AiChatStreamRequest = z.infer<typeof AiChatStreamRequestSchema>
export type MessageListResponse = z.infer<typeof MessageListResponseSchema>
