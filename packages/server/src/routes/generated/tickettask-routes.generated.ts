/**
 * AUTO-GENERATED ROUTE FILE FOR TICKETTASK
 * Generated at: 2025-08-22T23:50:50.383Z
 * 
 * ⚠️  DO NOT EDIT MANUALLY - Changes will be overwritten
 * ⚙️  Generated from schema: @promptliano/schemas
 * 🏭 Generated from service: @promptliano/services
 * 📊 Reduces ~300 lines to ~50 lines (83% reduction)
 */

import { OpenAPIHono } from '@hono/zod-openapi'
import { createAndRegisterEntityRoutes, type EntityConfig } from '../../codegen/route-factory'
import { tickettaskServiceV2 } from '@promptliano/services'
import {
  TaskSchema as TicketTaskSchema,
  CreateTaskSchema as CreateTicketTaskSchema,
  UpdateTaskSchema as UpdateTicketTaskSchema
} from '@promptliano/database'
import {
  TicketTaskIdParamsSchema,
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

const tickettaskConfig: EntityConfig = {
  name: 'TicketTask',
  plural: 'tickettasks',
  tableName: 'ticket_tasks',
  schemas: {
    entity: TicketTaskSchema,
    create: CreateTicketTaskSchema,
    update: UpdateTicketTaskSchema,
    id: TicketTaskIdParamsSchema.shape.id
  },
  service: tickettaskServiceV2,
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
 * Register all TicketTask routes with the Hono app
 * Auto-generates CRUD routes with proper OpenAPI documentation
 */
export function registerTicketTaskRoutes(app: OpenAPIHono): OpenAPIHono {
  const { app: updatedApp, routes } = createAndRegisterEntityRoutes(app, tickettaskConfig)
  
  console.log(`✅ Registered ${Object.keys(routes).length} routes for TicketTask`)
  
  return updatedApp
}

// =============================================================================
// ROUTE DEFINITIONS (for type exports)
// =============================================================================

export const tickettaskRoutes = {
  create: `POST /api/tickettasks`,
  list: `GET /api/tickettasks`,
  get: `GET /api/tickettasks/{id}`,
  update: `PUT /api/tickettasks/{id}`,
  delete: `DELETE /api/tickettasks/{id}`,
} as const

export type TicketTaskRouteTypes = typeof tickettaskRoutes
