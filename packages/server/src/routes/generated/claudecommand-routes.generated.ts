/**
 * AUTO-GENERATED ROUTE FILE FOR CLAUDECOMMAND
 * Generated at: 2025-08-27T15:26:33.553Z
 * 
 * ⚠️  DO NOT EDIT MANUALLY - Changes will be overwritten
 * ⚙️  Generated from schema: @promptliano/schemas
 * 🏭 Generated from service: @promptliano/services
 * 📊 Reduces ~300 lines to ~50 lines (83% reduction)
 */

import { OpenAPIHono } from '@hono/zod-openapi'
import { createAndRegisterEntityRoutes, type EntityConfig } from '../../codegen/route-factory'
import { claudecommandServiceV2 } from '@promptliano/services'
import {
  ClaudeCommandSchema,
  CreateClaudeCommandSchema,
  UpdateClaudeCommandSchema,
  ClaudeCommandIdParamsSchema,
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

const claudecommandConfig: EntityConfig = {
  name: 'ClaudeCommand',
  plural: 'claudecommands',
  tableName: 'claude_commands',
  schemas: {
    entity: ClaudeCommandSchema,
    create: CreateClaudeCommandSchema,
    update: UpdateClaudeCommandSchema,
    id: ClaudeCommandIdParamsSchema.shape.id
  },
  service: claudecommandServiceV2,
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
 * Register all ClaudeCommand routes with the Hono app
 * Auto-generates CRUD routes with proper OpenAPI documentation
 */
export function registerClaudeCommandRoutes(app: OpenAPIHono): OpenAPIHono {
  const { app: updatedApp, routes } = createAndRegisterEntityRoutes(app, claudecommandConfig)
  
  console.log(`✅ Registered ${Object.keys(routes).length} routes for ClaudeCommand`)
  
  return updatedApp
}

// =============================================================================
// ROUTE DEFINITIONS (for type exports)
// =============================================================================

export const claudecommandRoutes = {
  create: `POST /api/claudecommands`,
  list: `GET /api/claudecommands`,
  get: `GET /api/claudecommands/{id}`,
  update: `PUT /api/claudecommands/{id}`,
  delete: `DELETE /api/claudecommands/{id}`,
} as const

export type ClaudeCommandRouteTypes = typeof claudecommandRoutes
