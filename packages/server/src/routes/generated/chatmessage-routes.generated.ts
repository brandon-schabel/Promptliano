/**
 * AUTO-GENERATED ROUTE FILE FOR CHATMESSAGE
 * Generated at: 2025-09-06T07:22:36.773Z
 * 
 * ⚠️  DO NOT EDIT MANUALLY - Changes will be overwritten
 * ⚙️  Generated from schema: @promptliano/schemas
 * 🏭 Generated from service: @promptliano/services
 * 📊 Reduces ~300 lines to ~50 lines (83% reduction)
 */

import { OpenAPIHono } from '@hono/zod-openapi'
import { createAndRegisterEntityRoutes, type EntityConfig } from '../../codegen/route-factory'
import { chatmessageServiceV2 } from '@promptliano/services'
import {
  ChatMessageSchema,
  CreateChatMessageSchema,
  UpdateChatMessageSchema,
  ChatMessageIdParamsSchema,
  OperationSuccessResponseSchema,
  FileListResponseSchema,
  ProjectSummaryResponseSchema,
  SuggestFilesBodySchema,
  SuggestFilesResponseSchema,
  TaskListResponseSchema,
  ChatMessageCreateSchema,
  ChatMessageResponseSchema,
  ChatMessageListResponseSchema,
  QueueItemCreateSchema,
  QueueItemResponseSchema,
  QueueStatsResponseSchema,
  OptimizePromptResponseSchema
} from '@promptliano/schemas'
import { z } from '@hono/zod-openapi'

// =============================================================================
// ENTITY CONFIGURATION
// =============================================================================

const chatmessageConfig: EntityConfig = {
  name: 'ChatMessage',
  plural: 'chatmessages',
  tableName: 'chat_messages',
  schemas: {
    entity: ChatMessageSchema,
    create: CreateChatMessageSchema,
    update: UpdateChatMessageSchema,
    id: ChatMessageIdParamsSchema.shape.id
  },
  service: chatmessageServiceV2,
  options: {
    includeSoftDelete: true,
    enableBatch: true,
    enableSearch: false
  }
}

// =============================================================================
// ROUTE REGISTRATION
// =============================================================================

/**
 * Register all ChatMessage routes with the Hono app
 * Auto-generates CRUD routes with proper OpenAPI documentation
 */
export function registerChatMessageRoutes(app: OpenAPIHono): OpenAPIHono {
  const { app: updatedApp, routes } = createAndRegisterEntityRoutes(app, chatmessageConfig)
  
  console.log(`✅ Registered ${Object.keys(routes).length} routes for ChatMessage`)
  
  return updatedApp
}

// =============================================================================
// ROUTE DEFINITIONS (for type exports)
// =============================================================================

export const chatmessageRoutes = {
  create: `POST /api/chatmessages`,
  list: `GET /api/chatmessages`,
  get: `GET /api/chatmessages/{id}`,
  update: `PUT /api/chatmessages/{id}`,
  delete: `DELETE /api/chatmessages/{id}`,
} as const

export type ChatMessageRouteTypes = typeof chatmessageRoutes
