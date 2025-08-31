/**
 * AUTO-GENERATED ROUTE FILE FOR SELECTEDFILE
 * Generated at: 2025-08-30T20:39:29.818Z
 * 
 * ⚠️  DO NOT EDIT MANUALLY - Changes will be overwritten
 * ⚙️  Generated from schema: @promptliano/schemas
 * 🏭 Generated from service: @promptliano/services
 * 📊 Reduces ~300 lines to ~50 lines (83% reduction)
 */

import { OpenAPIHono } from '@hono/zod-openapi'
import { createAndRegisterEntityRoutes, type EntityConfig } from '../../codegen/route-factory'
import { selectedfileServiceV2 } from '@promptliano/services'
import {
  SelectedFileSchema,
  CreateSelectedFileSchema,
  UpdateSelectedFileSchema,
  SelectedFileIdParamsSchema,
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

const selectedfileConfig: EntityConfig = {
  name: 'SelectedFile',
  plural: 'selectedfiles',
  tableName: 'selected_files',
  schemas: {
    entity: SelectedFileSchema,
    create: CreateSelectedFileSchema,
    update: UpdateSelectedFileSchema,
    id: SelectedFileIdParamsSchema.shape.id
  },
  service: selectedfileServiceV2,
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
 * Register all SelectedFile routes with the Hono app
 * Auto-generates CRUD routes with proper OpenAPI documentation
 */
export function registerSelectedFileRoutes(app: OpenAPIHono): OpenAPIHono {
  const { app: updatedApp, routes } = createAndRegisterEntityRoutes(app, selectedfileConfig)
  
  console.log(`✅ Registered ${Object.keys(routes).length} routes for SelectedFile`)
  
  return updatedApp
}

// =============================================================================
// ROUTE DEFINITIONS (for type exports)
// =============================================================================

export const selectedfileRoutes = {
  create: `POST /api/selectedfiles`,
  list: `GET /api/selectedfiles`,
  get: `GET /api/selectedfiles/{id}`,
  update: `PUT /api/selectedfiles/{id}`,
  delete: `DELETE /api/selectedfiles/{id}`,
} as const

export type SelectedFileRouteTypes = typeof selectedfileRoutes
