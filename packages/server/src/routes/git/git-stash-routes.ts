/**
 * Git Stash Routes
 * Handles stash operations including create, apply, pop, and drop
 */

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { ApiErrorResponseSchema, OperationSuccessResponseSchema } from '@promptliano/schemas'
import { gitStashSchema as GitStashSchema, IDParamsSchema } from '@promptliano/schemas'

// Define missing schemas locally
const CreateStashBodySchema = z.object({
  message: z.string().optional()
})

const ApplyStashBodySchema = z.object({
  stashRef: z.string().optional().default('stash@{0}')
})

const PopStashBodySchema = z.object({
  stashRef: z.string().optional().default('stash@{0}')
})

const DropStashBodySchema = z.object({
  stashRef: z.string().optional().default('stash@{0}')
})
import { stashList, stash, clearGitStatusCache, stashApply, stashPop, stashDrop } from '@promptliano/services'
import {
  createStandardResponses,
  createStandardResponsesWithStatus,
  createRouteHandler,
  successResponse,
  operationSuccessResponse
} from '../../utils/route-helpers'

// Response schemas
const StashListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(GitStashSchema)
  })
  .openapi('StashListResponse')

// Use canonical ProjectIdParamsSchema with {id}

// Get stash list
const getStashListRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/git/stash',
  tags: ['Git', 'Stash'],
  summary: 'List all stashes',
  description: 'Retrieves the list of all stashed changes',
  request: {
    params: IDParamsSchema
  },
  responses: createStandardResponses(StashListResponseSchema)
})

// Create stash
const createStashRoute = createRoute({
  method: 'post',
  path: '/api/projects/{id}/git/stash',
  tags: ['Git', 'Stash'],
  summary: 'Create a new stash',
  description: 'Stashes the current working directory changes',
  request: {
    params: IDParamsSchema,
    body: {
      content: { 'application/json': { schema: CreateStashBodySchema } },
      required: false
    }
  },
  responses: createStandardResponsesWithStatus(OperationSuccessResponseSchema, 201, 'Stash created successfully')
})

// Apply stash
const applyStashRoute = createRoute({
  method: 'post',
  path: '/api/projects/{id}/git/stash/apply',
  tags: ['Git', 'Stash'],
  summary: 'Apply a stash',
  description: 'Applies the specified stash without removing it from the stash list',
  request: {
    params: IDParamsSchema,
    body: {
      content: { 'application/json': { schema: ApplyStashBodySchema } },
      required: false
    }
  },
  responses: {
    ...createStandardResponses(OperationSuccessResponseSchema)
  }
})

// Pop stash
const popStashRoute = createRoute({
  method: 'post',
  path: '/api/projects/{id}/git/stash/pop',
  tags: ['Git', 'Stash'],
  summary: 'Pop a stash',
  description: 'Applies the specified stash and removes it from the stash list',
  request: {
    params: IDParamsSchema,
    body: {
      content: { 'application/json': { schema: PopStashBodySchema } },
      required: false
    }
  },
  responses: {
    ...createStandardResponses(OperationSuccessResponseSchema)
  }
})

// Drop stash
const dropStashRoute = createRoute({
  method: 'delete',
  path: '/api/projects/{id}/git/stash',
  tags: ['Git', 'Stash'],
  summary: 'Drop a stash',
  description: 'Removes the specified stash from the stash list',
  request: {
    params: IDParamsSchema,
    body: {
      content: { 'application/json': { schema: DropStashBodySchema } },
      required: false
    }
  },
  responses: {
    ...createStandardResponses(OperationSuccessResponseSchema)
  }
})

// Export routes with simplified handlers
export const gitStashRoutes = new OpenAPIHono()
  .openapi(getStashListRoute, async (c): Promise<any> => {
    const { id: projectId } = c.req.valid('param')
    const stashes = await stashList(projectId)
    return c.json(successResponse(stashes))
  })
  .openapi(createStashRoute, async (c): Promise<any> => {
    const { id: projectId } = c.req.valid('param')
    const body = c.req.valid('json')
    await stash(projectId, body?.message)
    clearGitStatusCache(projectId)
    return c.json(operationSuccessResponse('Stash created successfully'))
  })
  .openapi(applyStashRoute, async (c): Promise<any> => {
    const { id: projectId } = c.req.valid('param')
    const body = c.req.valid('json')
    const stashRef = body?.stashRef || 'stash@{0}'
    await stashApply(projectId, stashRef)
    clearGitStatusCache(projectId)
    return c.json(operationSuccessResponse('Stash applied successfully'))
  })
  .openapi(popStashRoute, async (c): Promise<any> => {
    const { id: projectId } = c.req.valid('param')
    const body = c.req.valid('json')
    const stashRef = body?.stashRef || 'stash@{0}'
    await stashPop(projectId, stashRef)
    clearGitStatusCache(projectId)
    return c.json(operationSuccessResponse('Stash popped successfully'))
  })
  .openapi(dropStashRoute, async (c): Promise<any> => {
    const { id: projectId } = c.req.valid('param')
    const body = c.req.valid('json')
    const stashRef = body?.stashRef || 'stash@{0}'
    await stashDrop(projectId, stashRef)
    return c.json(operationSuccessResponse('Stash dropped successfully'))
  })

export type GitStashRouteTypes = typeof gitStashRoutes
