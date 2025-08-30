/**
 * Git Branch Routes
 * Handles branch management, switching, and merging
 */

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { ApiErrorResponseSchema, OperationSuccessResponseSchema } from '@promptliano/schemas'
import {
  gitBranchSchema as GitBranchSchema,
  gitBranchListEnhancedResponseSchema as GitBranchListEnhancedResponseSchema,
  IDParamsSchema,
  gitCreateBranchRequestSchema as CreateBranchBodySchema,
  gitSwitchBranchRequestSchema as SwitchBranchBodySchema
} from '@promptliano/schemas'
import {
  getBranches,
  getBranchesEnhanced,
  createBranch,
  switchBranch,
  deleteBranch,
  clearGitStatusCache
} from '@promptliano/services'
import {
  createStandardResponses,
  createRouteHandler,
  successResponse,
  operationSuccessResponse
} from '../../utils/route-helpers'
import type { Context } from 'hono'

// Response schemas
const BranchListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(GitBranchSchema)
  })
  .openapi('BranchListResponse')

const BranchListEnhancedResponseSchema = z
  .object({
    success: z.literal(true),
    data: GitBranchListEnhancedResponseSchema
  })
  .openapi('BranchListEnhancedResponse')

// Use canonical ProjectIdParamsSchema with {id}

// Get branches
const getBranchesRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/git/branches',
  tags: ['Git', 'Branches'],
  summary: 'List all branches',
  description: 'Retrieves all local and remote branches for the project',
  request: {
    params: IDParamsSchema
  },
  responses: createStandardResponses(BranchListResponseSchema)
})

// Get enhanced branches
const getBranchesEnhancedRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/git/branches-enhanced',
  tags: ['Git', 'Branches'],
  summary: 'List branches with enhanced information',
  description: 'Retrieves branches with additional metadata like ahead/behind counts',
  request: {
    params: IDParamsSchema
  },
  responses: createStandardResponses(BranchListEnhancedResponseSchema)
})

// Create branch
const createBranchRoute = createRoute({
  method: 'post',
  path: '/api/projects/{id}/git/branches',
  tags: ['Git', 'Branches'],
  summary: 'Create a new branch',
  description: 'Creates a new branch from the specified starting point',
  request: {
    params: IDParamsSchema,
    body: {
      content: { 'application/json': { schema: CreateBranchBodySchema } },
      required: true
    }
  },
  responses: {
    201: {
      content: { 'application/json': { schema: OperationSuccessResponseSchema } },
      description: 'Branch created successfully'
    },
    ...createStandardResponses(OperationSuccessResponseSchema)
  }
})

// Switch branch
const switchBranchRoute = createRoute({
  method: 'post',
  path: '/api/projects/{id}/git/branches/switch',
  tags: ['Git', 'Branches'],
  summary: 'Switch to a different branch',
  description: 'Switches the working directory to the specified branch',
  request: {
    params: IDParamsSchema,
    body: {
      content: { 'application/json': { schema: SwitchBranchBodySchema } },
      required: true
    }
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

// Delete branch
const deleteBranchRoute = createRoute({
  method: 'delete',
  path: '/api/projects/{id}/git/branches/{branchName}',
  tags: ['Git', 'Branches'],
  summary: 'Delete a branch',
  description: 'Deletes the specified branch',
  request: {
    params: z.object({
      id: IDParamsSchema.shape.id,
      branchName: z.string()
    }),
    query: z.object({
      force: z.coerce.boolean().optional().default(false).openapi({
        description: 'Force delete even if branch has unmerged changes'
      })
    })
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

// Export routes with simplified handlers
export const gitBranchRoutes = new OpenAPIHono()
  .openapi(getBranchesRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')
    const branches = await getBranches(projectId)
    return c.json(successResponse(branches))
  })
  .openapi(getBranchesEnhancedRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')
    const result = await getBranchesEnhanced(projectId)
    return c.json(successResponse(result))
  })
  .openapi(createBranchRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')
    const body = c.req.valid('json')
    await createBranch(projectId, body.name, body.startPoint)
    return c.json(operationSuccessResponse('Branch created successfully'), 201)
  })
  .openapi(switchBranchRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')
    const body = c.req.valid('json')
    await switchBranch(projectId, body.name)
    clearGitStatusCache(projectId)
    return c.json(operationSuccessResponse('Branch switched successfully'))
  })
  .openapi(deleteBranchRoute, async (c) => {
    const { id: projectId, branchName } = c.req.valid('param')
    const { force = false } = c.req.valid('query') || {}
    await deleteBranch(projectId, branchName, force)
    return c.json(operationSuccessResponse('Branch deleted successfully'))
  })

export type GitBranchRouteTypes = typeof gitBranchRoutes
