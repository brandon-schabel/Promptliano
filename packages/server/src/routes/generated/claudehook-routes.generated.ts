/**
 * AUTO-GENERATED ROUTE FILE FOR CLAUDEHOOK
 * Generated at: 2025-08-22T23:50:50.384Z
 * 
 * ⚠️  DO NOT EDIT MANUALLY - Changes will be overwritten
 * ⚙️  Generated from schema: @promptliano/schemas
 * 🏭 Generated from service: @promptliano/services
 * 📊 Reduces ~300 lines to ~50 lines (83% reduction)
 */

import { OpenAPIHono } from '@hono/zod-openapi'
import { createAndRegisterEntityRoutes, type EntityConfig } from '../../codegen/route-factory'
import { claudehookServiceV2 } from '@promptliano/services'
import {
  ClaudeHookSchema,
  CreateClaudeHookSchema,
  UpdateClaudeHookSchema
} from '@promptliano/database'
import {
  ClaudeHookIdParamsSchema,
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

const claudehookConfig: EntityConfig = {
  name: 'ClaudeHook',
  plural: 'claudehooks',
  tableName: 'claude_hooks',
  schemas: {
    entity: ClaudeHookSchema,
    create: CreateClaudeHookSchema,
    update: UpdateClaudeHookSchema,
    id: ClaudeHookIdParamsSchema.shape.id
  },
  service: claudehookServiceV2,
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
 * Register all ClaudeHook routes with the Hono app
 * Auto-generates CRUD routes with proper OpenAPI documentation
 */
export function registerClaudeHookRoutes(app: OpenAPIHono): OpenAPIHono {
  const { app: updatedApp, routes } = createAndRegisterEntityRoutes(app, claudehookConfig)
  
  console.log(`✅ Registered ${Object.keys(routes).length} routes for ClaudeHook`)
  
  return updatedApp
}

// =============================================================================
// ROUTE DEFINITIONS (for type exports)
// =============================================================================

export const claudehookRoutes = {
  create: `POST /api/claudehooks`,
  list: `GET /api/claudehooks`,
  get: `GET /api/claudehooks/{id}`,
  update: `PUT /api/claudehooks/{id}`,
  delete: `DELETE /api/claudehooks/{id}`,
} as const

export type ClaudeHookRouteTypes = typeof claudehookRoutes
