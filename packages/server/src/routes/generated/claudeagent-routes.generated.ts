/**
 * AUTO-GENERATED ROUTE FILE FOR CLAUDEAGENT
 * Generated at: 2025-08-22T23:50:50.384Z
 * 
 * ⚠️  DO NOT EDIT MANUALLY - Changes will be overwritten
 * ⚙️  Generated from schema: @promptliano/schemas
 * 🏭 Generated from service: @promptliano/services
 * 📊 Reduces ~300 lines to ~50 lines (83% reduction)
 */

import { OpenAPIHono } from '@hono/zod-openapi'
import { createAndRegisterEntityRoutes, type EntityConfig } from '../../codegen/route-factory'
import { claudeagentServiceV2 } from '@promptliano/services'
import {
  ClaudeAgentSchema,
  CreateClaudeAgentSchema,
  UpdateClaudeAgentSchema,
  ClaudeAgentIdParamsSchema,
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

const claudeagentConfig: EntityConfig = {
  name: 'ClaudeAgent',
  plural: 'claudeagents',
  tableName: 'claude_agents',
  schemas: {
    entity: ClaudeAgentSchema,
    create: CreateClaudeAgentSchema,
    update: UpdateClaudeAgentSchema,
    id: ClaudeAgentIdParamsSchema.shape.id
  },
  service: claudeagentServiceV2,
  options: {
    includeSoftDelete: true,
    enableBatch: false,
    enableSearch: true
  }
}

// =============================================================================
// ROUTE REGISTRATION
// =============================================================================

/**
 * Register all ClaudeAgent routes with the Hono app
 * Auto-generates CRUD routes with proper OpenAPI documentation
 */
export function registerClaudeAgentRoutes(app: OpenAPIHono): OpenAPIHono {
  const { app: updatedApp, routes } = createAndRegisterEntityRoutes(app, claudeagentConfig)
  
  console.log(`✅ Registered ${Object.keys(routes).length} routes for ClaudeAgent`)
  
  return updatedApp
}

// =============================================================================
// ROUTE DEFINITIONS (for type exports)
// =============================================================================

export const claudeagentRoutes = {
  create: `POST /api/claudeagents`,
  list: `GET /api/claudeagents`,
  get: `GET /api/claudeagents/{id}`,
  update: `PUT /api/claudeagents/{id}`,
  delete: `DELETE /api/claudeagents/{id}`,
} as const

export type ClaudeAgentRouteTypes = typeof claudeagentRoutes
