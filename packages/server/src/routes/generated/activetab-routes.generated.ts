/**
 * AUTO-GENERATED ROUTE FILE FOR ACTIVETAB
 * Generated at: 2025-09-06T07:22:36.774Z
 * 
 * ⚠️  DO NOT EDIT MANUALLY - Changes will be overwritten
 * ⚙️  Generated from schema: @promptliano/schemas
 * 🏭 Generated from service: @promptliano/services
 * 📊 Reduces ~300 lines to ~50 lines (83% reduction)
 */

import { OpenAPIHono } from '@hono/zod-openapi'
import { createAndRegisterEntityRoutes, type EntityConfig } from '../../codegen/route-factory'
import { activetabServiceV2 } from '@promptliano/services'
import {
  ActiveTabSchema,
  CreateActiveTabSchema,
  UpdateActiveTabSchema,
  ActiveTabIdParamsSchema,
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

const activetabConfig: EntityConfig = {
  name: 'ActiveTab',
  plural: 'activetabs',
  tableName: 'active_tabs',
  schemas: {
    entity: ActiveTabSchema,
    create: CreateActiveTabSchema,
    update: UpdateActiveTabSchema,
    id: ActiveTabIdParamsSchema.shape.id
  },
  service: activetabServiceV2,
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
 * Register all ActiveTab routes with the Hono app
 * Auto-generates CRUD routes with proper OpenAPI documentation
 */
export function registerActiveTabRoutes(app: OpenAPIHono): OpenAPIHono {
  const { app: updatedApp, routes } = createAndRegisterEntityRoutes(app, activetabConfig)
  
  console.log(`✅ Registered ${Object.keys(routes).length} routes for ActiveTab`)
  
  return updatedApp
}

// =============================================================================
// ROUTE DEFINITIONS (for type exports)
// =============================================================================

export const activetabRoutes = {
  create: `POST /api/activetabs`,
  list: `GET /api/activetabs`,
  get: `GET /api/activetabs/{id}`,
  update: `PUT /api/activetabs/{id}`,
  delete: `DELETE /api/activetabs/{id}`,
} as const

export type ActiveTabRouteTypes = typeof activetabRoutes
