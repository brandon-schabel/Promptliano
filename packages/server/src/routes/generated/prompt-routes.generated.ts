/**
 * AUTO-GENERATED ROUTE FILE FOR PROMPT
 * Generated at: 2025-08-22T23:50:50.384Z
 *
 * ⚠️  DO NOT EDIT MANUALLY - Changes will be overwritten
 * ⚙️  Generated from schema: @promptliano/schemas
 * 🏭 Generated from service: @promptliano/services
 * 📊 Reduces ~300 lines to ~50 lines (83% reduction)
 */

import { OpenAPIHono } from '@hono/zod-openapi'
import { createAndRegisterEntityRoutes, type EntityConfig } from '../../codegen/route-factory'
import { promptService } from '@promptliano/services'
import { PromptSchema, CreatePromptSchema, UpdatePromptSchema } from '@promptliano/database'
import {
  PromptIdParamsSchema,
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

const promptConfig: EntityConfig = {
  name: 'Prompt',
  plural: 'prompts',
  tableName: 'prompts',
  schemas: {
    entity: PromptSchema,
    create: CreatePromptSchema,
    update: UpdatePromptSchema,
    id: PromptIdParamsSchema.shape.promptId
  },
  service: promptService,
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
 * Register all Prompt routes with the Hono app
 * Auto-generates CRUD routes with proper OpenAPI documentation
 */
export function registerPromptRoutes(app: OpenAPIHono): OpenAPIHono {
  const { app: updatedApp, routes } = createAndRegisterEntityRoutes(app, promptConfig)

  console.log(`✅ Registered ${Object.keys(routes).length} routes for Prompt`)

  return updatedApp
}

// =============================================================================
// ROUTE DEFINITIONS (for type exports)
// =============================================================================

export const promptRoutes = {
  create: `POST /api/prompts`,
  list: `GET /api/prompts`,
  get: `GET /api/prompts/{id}`,
  update: `PUT /api/prompts/{id}`,
  delete: `DELETE /api/prompts/{id}`
} as const

export type PromptRouteTypes = typeof promptRoutes
