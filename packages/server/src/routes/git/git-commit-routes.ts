/**
 * Git Commit Routes
 * Handles commit creation, logs, and commit details
 */

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { ApiErrorResponseSchema, OperationSuccessResponseSchema } from '@promptliano/schemas'
import {
  gitCommitSchema as GitCommitSchema,
  gitLogResponseSchema as GitCommitLogSchema,
  gitLogEnhancedResponseSchema as GitCommitLogEnhancedSchema,
  gitDiffResponseSchema as GitDiffResponseSchema,
  IDParamsSchema,
  gitCommitDetailResponseSchema as GitCommitDetailSchema
} from '@promptliano/schemas'

// Define missing schemas locally
const CommitBodySchema = z.object({
  message: z.string().min(1)
})

const CommitLogQuerySchema = z.object({
  maxCount: z.coerce.number().optional().default(50),
  skip: z.coerce.number().optional().default(0),
  author: z.string().optional(),
  since: z.string().optional(),
  until: z.string().optional(),
  grep: z.string().optional(),
  branch: z.string().optional()
})
import {
  commitChanges,
  clearGitStatusCache,
  getCommitLog,
  getCommitLogEnhanced,
  getCommitDetail,
  getFileDiff
} from '@promptliano/services'
import {
  createStandardResponses,
  createRouteHandler,
  successResponse,
  operationSuccessResponse
} from '../../utils/route-helpers'

// Response schemas
const CommitLogResponseSchema = GitCommitLogSchema

const CommitLogEnhancedResponseSchema = z
  .object({
    success: z.literal(true),
    data: GitCommitLogEnhancedSchema.openapi('GitCommitLogEnhanced')
  })
  .openapi('CommitLogEnhancedResponse')

const CommitDetailResponseSchema = z
  .object({
    success: z.literal(true),
    data: GitCommitDetailSchema.openapi('GitCommitDetail')
  })
  .openapi('CommitDetailResponse')

const DiffResponseSchema = GitDiffResponseSchema

// Use canonical ProjectIdParamsSchema with {id}

// Create commit
const commitRoute = createRoute({
  method: 'post',
  path: '/api/projects/{id}/git/commit',
  tags: ['Git', 'Commits'],
  summary: 'Create a new commit',
  description: 'Creates a new commit with staged changes',
  request: {
    params: IDParamsSchema,
    body: {
      content: { 'application/json': { schema: CommitBodySchema } },
      required: true
    }
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

// Get commit log
const getCommitLogRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/git/log',
  tags: ['Git', 'Commits'],
  summary: 'Get commit history',
  description: 'Retrieves the commit history for the project',
  request: {
    params: IDParamsSchema,
    query: CommitLogQuerySchema
  },
  responses: createStandardResponses(CommitLogResponseSchema)
})

// Get enhanced commit log
const getCommitLogEnhancedRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/git/log-enhanced',
  tags: ['Git', 'Commits'],
  summary: 'Get enhanced commit history',
  description: 'Retrieves detailed commit history with additional metadata',
  request: {
    params: IDParamsSchema,
    query: CommitLogQuerySchema
  },
  responses: createStandardResponses(CommitLogEnhancedResponseSchema)
})

// Get commit details
const getCommitDetailRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/git/commits/{commitHash}',
  tags: ['Git', 'Commits'],
  summary: 'Get commit details',
  description: 'Retrieves detailed information about a specific commit',
  request: {
    params: z.object({
      id: IDParamsSchema.shape.id,
      commitHash: z.string()
    })
  },
  responses: createStandardResponses(CommitDetailResponseSchema)
})

// Get file diff
const getFileDiffRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/git/diff',
  tags: ['Git', 'Diff'],
  summary: 'Get file diff',
  description: 'Retrieves the diff for a specific file',
  request: {
    params: IDParamsSchema,
    query: z.object({
      filePath: z.string().openapi({
        description: 'Path to the file to diff'
      }),
      cached: z.coerce.boolean().optional().default(false).openapi({
        description: 'Whether to get the cached/staged diff'
      })
    })
  },
  responses: createStandardResponses(DiffResponseSchema)
})

// Export routes with simplified handlers
export const gitCommitRoutes = new OpenAPIHono()
  .openapi(commitRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')
    const body = c.req.valid('json')
    await commitChanges(projectId, body.message)
    clearGitStatusCache(projectId)
    return c.json(operationSuccessResponse('Commit created successfully'), 200)
  })
  .openapi(getCommitLogRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')
    const query = c.req.valid('query') || {}
    const { maxCount = 50, skip = 0, author, since, until, grep, branch } = query

    const commits = await getCommitLog(projectId, {
      limit: maxCount,
      skip,
      branch
    })

    return c.json(successResponse(commits), 200)
  })
  .openapi(getCommitLogEnhancedRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')
    const query = c.req.valid('query') || {}
    const { maxCount = 50, skip = 0, author, since, until, grep, branch } = query

    const result = await getCommitLogEnhanced(projectId, {
      page: Math.floor(skip / maxCount) + 1,
      perPage: maxCount,
      includeStats: true,
      includeFileDetails: true,
      search: grep,
      author,
      since,
      until,
      branch
    })

    return c.json(successResponse(result), 200)
  })
  .openapi(getCommitDetailRoute, async (c) => {
    const { id: projectId, commitHash } = c.req.valid('param')
    const detail = await getCommitDetail(projectId, commitHash)
    return c.json(successResponse(detail), 200)
  })
  .openapi(getFileDiffRoute, async (c) => {
    const { id: projectId } = c.req.valid('param')
    const { filePath, cached = false } = c.req.valid('query')
    const diff = await getFileDiff(projectId, filePath, { staged: cached })
    return c.json(
      {
        success: true,
        data: {
          filePath,
          diff,
          staged: cached
        }
      },
      200
    )
  })

export type GitCommitRouteTypes = typeof gitCommitRoutes
