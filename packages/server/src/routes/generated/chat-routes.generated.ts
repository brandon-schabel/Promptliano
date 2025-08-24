/**
 * AUTO-GENERATED ROUTE FILE FOR CHAT
 * Generated at: 2025-08-22T23:50:50.383Z
 * 
 * ⚠️  DO NOT EDIT MANUALLY - Changes will be overwritten
 * ⚙️  Generated from schema: @promptliano/schemas
 * 🏭 Generated from service: @promptliano/services
 * 📊 Reduces ~300 lines to ~50 lines (83% reduction)
 */

import { OpenAPIHono } from '@hono/zod-openapi'
import { createAndRegisterEntityRoutes, type EntityConfig } from '../../codegen/route-factory'
import { chatService } from '@promptliano/services'
import {
  ChatSchema,
  CreateChatSchema,
  UpdateChatSchema
} from '@promptliano/database'
import {
  ChatIdParamsSchema,
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

const chatConfig: EntityConfig = {
  name: 'Chat',
  plural: 'chats',
  tableName: 'chats',
  schemas: {
    entity: ChatSchema,
    create: CreateChatSchema,
    update: UpdateChatSchema,
    id: ChatIdParamsSchema.shape.id
  },
  service: chatService,
  options: {
    includeSoftDelete: true,
    enableBatch: false,
    enableSearch: false
  },
  customRoutes: [
    {
      method: 'post',
      path: '/{id}/messages',
      summary: 'Add message',
      description: 'Send a new message to the chat',
      handlerName: 'addMessage',
      request: {
        body: ChatMessageCreateSchema
      },
      response: ChatMessageResponseSchema,
    }
  ]
}

// =============================================================================
// ROUTE REGISTRATION
// =============================================================================

/**
 * Register all Chat routes with the Hono app
 * Auto-generates CRUD routes with proper OpenAPI documentation
 */
export function registerChatRoutes(app: OpenAPIHono): OpenAPIHono {
  const { app: updatedApp, routes } = createAndRegisterEntityRoutes(app, chatConfig)
  
  console.log(`✅ Registered ${Object.keys(routes).length} routes for Chat`)
  
  return updatedApp
}

// =============================================================================
// ROUTE DEFINITIONS (for type exports)
// =============================================================================

export const chatRoutes = {
  create: `POST /api/chats`,
  list: `GET /api/chats`,
  get: `GET /api/chats/{id}`,
  update: `PUT /api/chats/{id}`,
  delete: `DELETE /api/chats/{id}`,
  addMessage: `POST /api/chats/{id}/messages`
} as const

export type ChatRouteTypes = typeof chatRoutes
