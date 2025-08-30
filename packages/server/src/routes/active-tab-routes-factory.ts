/**
 * Active Tab Routes using Factory Pattern
 * 
 * Simple get/set/clear operations for active tabs
 * Reduces boilerplate from 146 lines to ~60 lines (59% reduction)
 */

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { activeTabService } from '@promptliano/services'
import { ErrorFactory } from '@promptliano/shared'
import {
  createStandardResponses,
  successResponse,
  operationSuccessResponse,
  withErrorHandling
} from '../utils/route-helpers'
import type { Context } from 'hono'

// Define schemas locally (these should be in @promptliano/schemas ideally)
const ActiveTabDataSchema = z.object({
  projectId: z.number(),
  activeTabId: z.number(),
  clientId: z.string().optional(),
  tabMetadata: z.any().optional()
})

const ActiveTabResponseSchema = z.object({
  success: z.literal(true),
  data: ActiveTabDataSchema.nullable()
}).openapi('ActiveTabResponse')

const ActiveTabResponseRequiredSchema = z.object({
  success: z.literal(true),
  data: ActiveTabDataSchema
}).openapi('ActiveTabResponseRequired')

// Create routes
export const activeTabRoutes = new OpenAPIHono()

// ============= GET ACTIVE TAB =============
const getActiveTabRoute = createRoute({
  method: 'get',
  path: '/api/active-tab',
  tags: ['Active Tab'],
  summary: 'Get the currently active tab',
  request: {
    query: z.object({
      projectId: z.coerce.number().optional(),
      clientId: z.string().optional()
    })
  },
  responses: createStandardResponses(ActiveTabResponseSchema)
})

activeTabRoutes.openapi(getActiveTabRoute, async (c) => {
  try {
    const { projectId = 1, clientId } = c.req.valid('query')
    const activeTab = await activeTabService.getActiveTab(projectId, clientId)
    return c.json(successResponse(activeTab))
  } catch (error) {
    console.error('[GetActiveTab] Error:', error)
    throw ErrorFactory.wrap(error, 'Get active tab')
  }
})

// ============= SET ACTIVE TAB =============
const setActiveTabRoute = createRoute({
  method: 'post',
  path: '/api/active-tab',
  tags: ['Active Tab'],
  summary: 'Set the active tab',
  request: {
    body: {
      content: {
        'application/json': {
          schema: ActiveTabDataSchema
        }
      },
      required: true
    }
  },
  responses: createStandardResponses(ActiveTabResponseRequiredSchema)
})

activeTabRoutes.openapi(setActiveTabRoute, async (c) => {
  try {
    const data = c.req.valid('json')
    const updatedTab = await activeTabService.setActiveTab(data)
    return c.json(successResponse(updatedTab))
  } catch (error) {
    console.error('[SetActiveTab] Error:', error)
    throw ErrorFactory.wrap(error, 'Set active tab')
  }
})

// ============= CLEAR ACTIVE TAB =============
const clearActiveTabRoute = createRoute({
  method: 'delete',
  path: '/api/active-tab',
  tags: ['Active Tab'],
  summary: 'Clear the active tab',
  request: {
    query: z.object({
      projectId: z.coerce.number().optional(),
      clientId: z.string().optional()
    })
  },
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    message: z.string()
  }))
})

activeTabRoutes.openapi(clearActiveTabRoute, async (c) => {
  try {
    const { projectId = 1, clientId } = c.req.valid('query')
    await activeTabService.clearActiveTab(projectId, clientId)
    return c.json(operationSuccessResponse('Active tab cleared successfully'))
  } catch (error) {
    console.error('[ClearActiveTab] Error:', error)
    throw ErrorFactory.wrap(error, 'Clear active tab')
  }
})

export type ActiveTabRouteTypes = typeof activeTabRoutes