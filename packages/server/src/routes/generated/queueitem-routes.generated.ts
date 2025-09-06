/**
 * AUTO-GENERATED ROUTE FILE FOR QUEUEITEM
 * Generated at: 2025-09-06T07:22:36.774Z
 * 
 * ⚠️  DO NOT EDIT MANUALLY - Changes will be overwritten
 * ⚙️  Generated from schema: @promptliano/schemas
 * 🏭 Generated from service: @promptliano/services
 * 📊 Reduces ~300 lines to ~50 lines (83% reduction)
 */

import { OpenAPIHono } from '@hono/zod-openapi'
import { createAndRegisterEntityRoutes, type EntityConfig } from '../../codegen/route-factory'
import { queueitemServiceV2 } from '@promptliano/services'
import {
  QueueItemSchema,
  CreateQueueItemSchema,
  UpdateQueueItemSchema,
  QueueItemIdParamsSchema,
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

const queueitemConfig: EntityConfig = {
  name: 'QueueItem',
  plural: 'queueitems',
  tableName: 'queue_items',
  schemas: {
    entity: QueueItemSchema,
    create: CreateQueueItemSchema,
    update: UpdateQueueItemSchema,
    id: QueueItemIdParamsSchema.shape.id
  },
  service: queueitemServiceV2,
  options: {
    includeSoftDelete: true,
    enableBatch: false,
    enableSearch: false
  }
}

// =============================================================================
// ROUTE REGISTRATION
// =============================================================================

/**
 * Register all QueueItem routes with the Hono app
 * Auto-generates CRUD routes with proper OpenAPI documentation
 */
export function registerQueueItemRoutes(app: OpenAPIHono): OpenAPIHono {
  const { app: updatedApp, routes } = createAndRegisterEntityRoutes(app, queueitemConfig)
  
  console.log(`✅ Registered ${Object.keys(routes).length} routes for QueueItem`)
  
  return updatedApp
}

// =============================================================================
// ROUTE DEFINITIONS (for type exports)
// =============================================================================

export const queueitemRoutes = {
  create: `POST /api/queueitems`,
  list: `GET /api/queueitems`,
  get: `GET /api/queueitems/{id}`,
  update: `PUT /api/queueitems/{id}`,
  delete: `DELETE /api/queueitems/{id}`,
} as const

export type QueueItemRouteTypes = typeof queueitemRoutes
