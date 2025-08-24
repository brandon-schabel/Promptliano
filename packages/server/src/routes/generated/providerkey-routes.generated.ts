/**
 * AUTO-GENERATED ROUTE FILE FOR PROVIDERKEY
 * Generated at: 2025-08-22T23:50:50.384Z
 * 
 * ⚠️  DO NOT EDIT MANUALLY - Changes will be overwritten
 * ⚙️  Generated from schema: @promptliano/schemas
 * 🏭 Generated from service: @promptliano/services
 * 📊 Reduces ~300 lines to ~50 lines (83% reduction)
 */

import { OpenAPIHono } from '@hono/zod-openapi'
import { createAndRegisterEntityRoutes, type EntityConfig } from '../../codegen/route-factory'
import { providerkeyServiceV2 } from '@promptliano/services'
import {
  ProviderKeySchema,
  CreateProviderKeySchema,
  UpdateProviderKeySchema
} from '@promptliano/database'
import {
  ProviderKeyIdParamsSchema,
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

const providerkeyConfig: EntityConfig = {
  name: 'ProviderKey',
  plural: 'providerkeies',
  tableName: 'provider_keys',
  schemas: {
    entity: ProviderKeySchema,
    create: CreateProviderKeySchema,
    update: UpdateProviderKeySchema,
    id: ProviderKeyIdParamsSchema.shape.id
  },
  service: providerkeyServiceV2,
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
 * Register all ProviderKey routes with the Hono app
 * Auto-generates CRUD routes with proper OpenAPI documentation
 */
export function registerProviderKeyRoutes(app: OpenAPIHono): OpenAPIHono {
  const { app: updatedApp, routes } = createAndRegisterEntityRoutes(app, providerkeyConfig)
  
  console.log(`✅ Registered ${Object.keys(routes).length} routes for ProviderKey`)
  
  return updatedApp
}

// =============================================================================
// ROUTE DEFINITIONS (for type exports)
// =============================================================================

export const providerkeyRoutes = {
  create: `POST /api/providerkeies`,
  list: `GET /api/providerkeies`,
  get: `GET /api/providerkeies/{id}`,
  update: `PUT /api/providerkeies/{id}`,
  delete: `DELETE /api/providerkeies/{id}`,
} as const

export type ProviderKeyRouteTypes = typeof providerkeyRoutes
