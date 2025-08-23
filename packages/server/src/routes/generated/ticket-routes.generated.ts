/**
 * AUTO-GENERATED ROUTE FILE FOR TICKET
 * Generated at: 2025-08-22T23:50:50.383Z
 * 
 * ⚠️  DO NOT EDIT MANUALLY - Changes will be overwritten
 * ⚙️  Generated from schema: @promptliano/schemas
 * 🏭 Generated from service: @promptliano/services
 * 📊 Reduces ~300 lines to ~50 lines (83% reduction)
 */

import { OpenAPIHono } from '@hono/zod-openapi'
import { createAndRegisterEntityRoutes, type EntityConfig } from '../../codegen/route-factory'
import { ticketService } from '@promptliano/services'
import {
  TicketSchema,
  CreateTicketSchema,
  UpdateTicketSchema,
  TicketIdParamsSchema,
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

const ticketConfig: EntityConfig = {
  name: 'Ticket',
  plural: 'tickets',
  tableName: 'tickets',
  schemas: {
    entity: TicketSchema,
    create: CreateTicketSchema,
    update: UpdateTicketSchema,
    id: TicketIdParamsSchema.shape.id
  },
  service: ticketService,
  options: {
    includeSoftDelete: true,
    enableBatch: true,
    enableSearch: false
  },
  customRoutes: [
    {
      method: 'post',
      path: '/{id}/tasks/generate',
      summary: 'Generate tasks',
      description: 'Auto-generate tasks for this ticket',
      handlerName: 'generateTasks',
      response: TaskListResponseSchema,
    }
  ]
}

// =============================================================================
// ROUTE REGISTRATION
// =============================================================================

/**
 * Register all Ticket routes with the Hono app
 * Auto-generates CRUD routes with proper OpenAPI documentation
 */
export function registerTicketRoutes(app: OpenAPIHono): OpenAPIHono {
  const { app: updatedApp, routes } = createAndRegisterEntityRoutes(app, ticketConfig)
  
  console.log(`✅ Registered ${Object.keys(routes).length} routes for Ticket`)
  
  return updatedApp
}

// =============================================================================
// ROUTE DEFINITIONS (for type exports)
// =============================================================================

export const ticketRoutes = {
  create: `POST /api/tickets`,
  list: `GET /api/tickets`,
  get: `GET /api/tickets/{id}`,
  update: `PUT /api/tickets/{id}`,
  delete: `DELETE /api/tickets/{id}`,
  generateTasks: `POST /api/tickets/{id}/tasks/generate`
} as const

export type TicketRouteTypes = typeof ticketRoutes
