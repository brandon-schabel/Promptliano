import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'

// Define valid HTTP status codes that have response bodies (are "contentful")
type ContentfulStatusCode = 200 | 201 | 202 | 400 | 401 | 403 | 404 | 409 | 422 | 500 | 502 | 503 | 504

import {
  gitOperationResponseSchema,
  gitRemoteSchema,
  gitTagSchema,
  gitStashSchema,
  gitPushRequestSchema,
  gitResetRequestSchema,
  ApiErrorResponseSchema
} from '@promptliano/schemas'
import {
  getRemotes,
  push,
  fetch,
  pull,
  getTags,
  createTag,
  stash,
  stashList,
  stashApply,
  reset
} from '@promptliano/services'
import { createStandardResponses, createStandardResponsesWithStatus, createListResponseSchema, successResponse, operationSuccessResponse } from '../utils/route-helpers'

// Define reusable response schemas using factory functions
const RemotesResponseSchema = createListResponseSchema(gitRemoteSchema, 'RemotesResponse')
const TagsResponseSchema = createListResponseSchema(gitTagSchema, 'TagsResponse')
const StashListResponseSchema = createListResponseSchema(gitStashSchema, 'StashListResponse')

export const gitAdvancedRoutes = new OpenAPIHono()

// ============================================
// Remote Management Routes
// ============================================

// Get remotes route
const getRemotesRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/git/remotes',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    })
  },
  responses: createStandardResponses(RemotesResponseSchema),
  tags: ['Git'],
  description: 'Get all configured remotes for a git repository'
})

gitAdvancedRoutes.openapi(getRemotesRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const remotes = await getRemotes(projectId)
  return c.json(successResponse(remotes))
})

// Push route
const pushRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/push',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: gitPushRequestSchema
        }
      }
    }
  },
  responses: createStandardResponses(gitOperationResponseSchema),
  tags: ['Git'],
  description: 'Push changes to a remote repository'
})

gitAdvancedRoutes.openapi(pushRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const { remote, branch, force, setUpstream } = c.req.valid('json')

  await push(projectId, remote || 'origin', branch, { force, setUpstream })

  return c.json(operationSuccessResponse(`Successfully pushed to ${remote || 'origin'}${branch ? `/${branch}` : ''}`))
})

// Fetch route
const fetchRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/fetch',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            remote: z.string().optional().default('origin'),
            prune: z.boolean().optional()
          })
        }
      }
    }
  },
  responses: createStandardResponses(gitOperationResponseSchema),
  tags: ['Git'],
  description: 'Fetch updates from a remote repository'
})

gitAdvancedRoutes.openapi(fetchRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const { remote, prune } = c.req.valid('json')

  await fetch(projectId, remote || 'origin', { prune })

  return c.json(operationSuccessResponse(`Successfully fetched from ${remote || 'origin'}`))
})

// Pull route
const pullRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/pull',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            remote: z.string().optional().default('origin'),
            branch: z.string().optional(),
            rebase: z.boolean().optional()
          })
        }
      }
    }
  },
  responses: createStandardResponses(gitOperationResponseSchema),
  tags: ['Git'],
  description: 'Pull changes from a remote repository'
})

gitAdvancedRoutes.openapi(pullRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const { remote, branch, rebase } = c.req.valid('json')

  await pull(projectId, remote || 'origin', branch, { rebase })

  return c.json(operationSuccessResponse(`Successfully pulled from ${remote || 'origin'}${branch ? `/${branch}` : ''}`))
})

// ============================================
// Tag Management Routes
// ============================================

// Get tags route
const getTagsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/git/tags',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    })
  },
  responses: createStandardResponses(TagsResponseSchema),
  tags: ['Git'],
  description: 'Get all tags for a git repository'
})

gitAdvancedRoutes.openapi(getTagsRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const tags = await getTags(projectId)
  return c.json(successResponse(tags))
})

// Create tag route
const createTagRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/tags',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string(),
            message: z.string().optional(),
            ref: z.string().optional()
          })
        }
      }
    }
  },
  responses: createStandardResponses(gitOperationResponseSchema),
  tags: ['Git'],
  description: 'Create a new tag in the git repository'
})

gitAdvancedRoutes.openapi(createTagRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const { name, message, ref } = c.req.valid('json')

  await createTag(projectId, name, { message, ref })

  return c.json(operationSuccessResponse(`Tag '${name}' created successfully`))
})

// ============================================
// Stash Management Routes
// ============================================

// Stash changes route
const stashRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/stash',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            message: z.string().optional()
          })
        }
      }
    }
  },
  responses: createStandardResponses(gitOperationResponseSchema),
  tags: ['Git'],
  description: 'Stash current changes'
})

gitAdvancedRoutes.openapi(stashRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const { message } = c.req.valid('json')

  await stash(projectId, message)

  return c.json(operationSuccessResponse(`Changes stashed successfully${message ? `: ${message}` : ''}`))
})

// Get stash list route
const getStashListRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/git/stash',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    })
  },
  responses: createStandardResponses(StashListResponseSchema),
  tags: ['Git'],
  description: 'Get list of all stashes'
})

gitAdvancedRoutes.openapi(getStashListRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const stashes = await stashList(projectId)
  return c.json(successResponse(stashes))
})

// Apply stash route
const applyStashRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/stash/apply',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            ref: z.string().optional().default('stash@{0}')
          })
        }
      }
    }
  },
  responses: createStandardResponses(gitOperationResponseSchema),
  tags: ['Git'],
  description: 'Apply a stash without removing it from the stash list'
})

gitAdvancedRoutes.openapi(applyStashRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const { ref } = c.req.valid('json')

  await stashApply(projectId, ref || 'stash@{0}')

  return c.json(operationSuccessResponse(`Applied stash: ${ref || 'stash@{0}'}`))
})

// ============================================
// Reset & Revert Routes
// ============================================

// Reset route
const resetRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/git/reset',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: gitResetRequestSchema
        }
      }
    }
  },
  responses: createStandardResponses(gitOperationResponseSchema),
  tags: ['Git'],
  description: 'Reset current HEAD to a specified state'
})

gitAdvancedRoutes.openapi(resetRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const { ref, mode } = c.req.valid('json')

  await reset(projectId, ref, mode || 'mixed')

  return c.json(operationSuccessResponse(`Reset to ${ref} (${mode || 'mixed'} mode)`))
})
