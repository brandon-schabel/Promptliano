/**
 * AUTO-GENERATED ROUTE FILE FOR QUEUE
 * Generated at: 2025-08-22T23:50:50.384Z
 * 
 * ⚠️  DO NOT EDIT MANUALLY - Changes will be overwritten
 * ⚙️  Generated from schema: @promptliano/schemas
 * 🏭 Generated from service: @promptliano/services
 * 📊 Reduces ~300 lines to ~50 lines (83% reduction)
 */

import { OpenAPIHono } from '@hono/zod-openapi'
import { createAndRegisterEntityRoutes, type EntityConfig } from '../../codegen/route-factory'
import { queueService } from '@promptliano/services'
import {
  QueueSchema,
  CreateQueueSchema,
  UpdateQueueSchema
} from '@promptliano/database'
import {
  QueueIdParamsSchema,
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

const queueConfig: EntityConfig = {
  name: 'Queue',
  plural: 'queues',
  tableName: 'queues',
  schemas: {
    entity: QueueSchema,
    create: CreateQueueSchema,
    update: UpdateQueueSchema,
    id: QueueIdParamsSchema.shape.id
  },
  service: queueService,
  options: {
    includeSoftDelete: true,
    enableBatch: false,
    enableSearch: false
  },
  customRoutes: [
    {
      method: 'post',
      path: '/{id}/process',
      summary: 'Process queue',
      description: 'Start processing items in the queue',
      handlerName: 'process',
      response: OperationSuccessResponseSchema,
    }
  ]
}

// =============================================================================
// ROUTE REGISTRATION
// =============================================================================

/**
 * Register all Queue routes with the Hono app
 * Auto-generates CRUD routes with proper OpenAPI documentation
 */
export function registerQueueRoutes(app: OpenAPIHono): OpenAPIHono {
  const { app: updatedApp, routes } = createAndRegisterEntityRoutes(app, queueConfig)
  
  console.log(`✅ Registered ${Object.keys(routes).length} routes for Queue`)
  
  return updatedApp
}

// =============================================================================
// ROUTE DEFINITIONS (for type exports)
// =============================================================================

export const queueRoutes = {
  create: `POST /api/queues`,
  list: `GET /api/queues`,
  get: `GET /api/queues/{id}`,
  update: `PUT /api/queues/{id}`,
  delete: `DELETE /api/queues/{id}`,
  process: `POST /api/queues/{id}/process`
} as const

export type QueueRouteTypes = typeof queueRoutes
