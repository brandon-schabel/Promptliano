/**
 * AUTO-GENERATED ROUTE FILE FOR FILE
 * Generated at: 2025-08-22T23:50:50.384Z
 * 
 * ⚠️  DO NOT EDIT MANUALLY - Changes will be overwritten
 * ⚙️  Generated from schema: @promptliano/schemas
 * 🏭 Generated from service: @promptliano/services
 * 📊 Reduces ~300 lines to ~50 lines (83% reduction)
 */

import { OpenAPIHono } from '@hono/zod-openapi'
import { createAndRegisterEntityRoutes, type EntityConfig } from '../../codegen/route-factory'
import { fileService } from '@promptliano/services'
import {
  FileSchema,
  CreateFileSchema,
  UpdateFileSchema,
  FileIdParamsSchema,
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

const fileConfig: EntityConfig = {
  name: 'File',
  plural: 'files',
  tableName: 'files',
  schemas: {
    entity: FileSchema,
    create: CreateFileSchema,
    update: UpdateFileSchema,
    id: FileIdParamsSchema.shape.id
  },
  service: fileService,
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
 * Register all File routes with the Hono app
 * Auto-generates CRUD routes with proper OpenAPI documentation
 */
export function registerFileRoutes(app: OpenAPIHono): OpenAPIHono {
  const { app: updatedApp, routes } = createAndRegisterEntityRoutes(app, fileConfig)
  
  console.log(`✅ Registered ${Object.keys(routes).length} routes for File`)
  
  return updatedApp
}

// =============================================================================
// ROUTE DEFINITIONS (for type exports)
// =============================================================================

export const fileRoutes = {
  create: `POST /api/files`,
  list: `GET /api/files`,
  get: `GET /api/files/{id}`,
  update: `PUT /api/files/{id}`,
  delete: `DELETE /api/files/{id}`,
} as const

export type FileRouteTypes = typeof fileRoutes
