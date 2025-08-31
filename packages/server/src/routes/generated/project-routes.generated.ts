/**
 * AUTO-GENERATED ROUTE FILE FOR PROJECT
 * Generated at: 2025-08-30T20:39:29.813Z
 * 
 * ⚠️  DO NOT EDIT MANUALLY - Changes will be overwritten
 * ⚙️  Generated from schema: @promptliano/schemas
 * 🏭 Generated from service: @promptliano/services
 * 📊 Reduces ~300 lines to ~50 lines (83% reduction)
 */

import { OpenAPIHono } from '@hono/zod-openapi'
import { createAndRegisterEntityRoutes, type EntityConfig } from '../../codegen/route-factory'
import { projectServiceV2 } from '@promptliano/services'
import {
  ProjectSchema,
  CreateProjectSchema,
  UpdateProjectSchema,
  ProjectIdParamsSchema,
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
  OptimizePromptResponseSchema,
  TicketListResponseSchema,
  ChatListResponseSchema,
  PromptListResponseSchema,
  QueueListResponseSchema,
  SelectedFileListResponseSchema,
  ActiveTabListResponseSchema
} from '@promptliano/schemas'
import { z } from '@hono/zod-openapi'

// =============================================================================
// ENTITY CONFIGURATION
// =============================================================================

const projectConfig: EntityConfig = {
  name: 'Project',
  plural: 'projects',
  tableName: 'projects',
  schemas: {
    entity: ProjectSchema,
    create: CreateProjectSchema,
    update: UpdateProjectSchema,
    id: ProjectIdParamsSchema.shape.id
  },
  service: projectServiceV2,
  options: {
    includeSoftDelete: true,
    enableBatch: false,
    enableSearch: true
  },
  customRoutes: [
    {
      method: 'get',
      path: '/{id}/tickets',
      summary: 'Get Ticket for Project',
      description: 'Retrieve all Ticket associated with this Project',
      handlerName: 'getTickets',
      response: TicketListResponseSchema,
    },
    {
      method: 'get',
      path: '/{id}/chats',
      summary: 'Get Chat for Project',
      description: 'Retrieve all Chat associated with this Project',
      handlerName: 'getChats',
      response: ChatListResponseSchema,
    },
    {
      method: 'get',
      path: '/{id}/prompts',
      summary: 'Get Prompt for Project',
      description: 'Retrieve all Prompt associated with this Project',
      handlerName: 'getPrompts',
      response: PromptListResponseSchema,
    },
    {
      method: 'get',
      path: '/{id}/queues',
      summary: 'Get Queue for Project',
      description: 'Retrieve all Queue associated with this Project',
      handlerName: 'getQueues',
      response: QueueListResponseSchema,
    },
    {
      method: 'get',
      path: '/{id}/files',
      summary: 'Get File for Project',
      description: 'Retrieve all File associated with this Project',
      handlerName: 'getFiles',
      response: FileListResponseSchema,
    },
    {
      method: 'get',
      path: '/{id}/selectedfiles',
      summary: 'Get SelectedFile for Project',
      description: 'Retrieve all SelectedFile associated with this Project',
      handlerName: 'getSelectedFiles',
      response: SelectedFileListResponseSchema,
    },
    {
      method: 'get',
      path: '/{id}/activetabs',
      summary: 'Get ActiveTab for Project',
      description: 'Retrieve all ActiveTab associated with this Project',
      handlerName: 'getActiveTabs',
      response: ActiveTabListResponseSchema,
    },
    {
      method: 'post',
      path: '/{id}/sync',
      summary: 'Sync project files',
      description: 'Trigger a manual sync of project files',
      handlerName: 'sync',
      response: OperationSuccessResponseSchema,
    },
    {
      method: 'get',
      path: '/{id}/allfiles',
      summary: 'Get all project files',
      description: 'Get all files in the project (alternative endpoint)',
      handlerName: 'getAllFiles',
      response: FileListResponseSchema,
    },
    {
      method: 'get',
      path: '/{id}/summary',
      summary: 'Get project summary',
      description: 'Get AI-generated project summary',
      handlerName: 'getSummary',
      response: ProjectSummaryResponseSchema,
    }
  ]
}

// =============================================================================
// ROUTE REGISTRATION
// =============================================================================

/**
 * Register all Project routes with the Hono app
 * Auto-generates CRUD routes with proper OpenAPI documentation
 */
export function registerProjectRoutes(app: OpenAPIHono): OpenAPIHono {
  const { app: updatedApp, routes } = createAndRegisterEntityRoutes(app, projectConfig)

  console.log(`✅ Registered ${Object.keys(routes).length} routes for Project`)

  return updatedApp
}

// =============================================================================
// ROUTE DEFINITIONS (for type exports)
// =============================================================================

export const projectRoutes = {
  create: `POST /api/projects`,
  list: `GET /api/projects`,
  get: `GET /api/projects/{id}`,
  update: `PUT /api/projects/{id}`,
  delete: `DELETE /api/projects/{id}`,
  getTickets: `GET /api/projects/{id}/tickets`,
  getChats: `GET /api/projects/{id}/chats`,
  getPrompts: `GET /api/projects/{id}/prompts`,
  getQueues: `GET /api/projects/{id}/queues`,
  getFiles: `GET /api/projects/{id}/files`,
  getSelectedFiles: `GET /api/projects/{id}/selectedfiles`,
  getActiveTabs: `GET /api/projects/{id}/activetabs`,
  sync: `POST /api/projects/{id}/sync`,
  getAllFiles: `GET /api/projects/{id}/allfiles`,
  getSummary: `GET /api/projects/{id}/summary`
} as const

export type ProjectRouteTypes = typeof projectRoutes
