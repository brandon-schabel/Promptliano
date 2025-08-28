import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { successResponse } from '../utils/route-helpers'
import { QueueWithStatsSchema } from '@promptliano/schemas'
import { flowService } from '@promptliano/services'
import { CreateQueueBodySchema, TaskQueueSchema } from '@promptliano/schemas'

const app = new OpenAPIHono()

// Get queues with stats for a project
const getQueuesWithStatsRoute = createRoute({
  method: 'get',
  path: '/api/projects/:projectId/queues-with-stats',
  request: {
    params: z.object({ projectId: z.coerce.number().int().positive() })
  },
  responses: {
    200: {
      description: 'List of queues with statistics for the project',
      content: {
        'application/json': {
          schema: z.object({ success: z.literal(true), data: z.array(QueueWithStatsSchema) })
        }
      }
    }
  },
  tags: ['Queues'],
  summary: 'Get queues with statistics for a project'
})

app.openapi(getQueuesWithStatsRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const data = await flowService.getQueuesWithStats(projectId)
  return c.json(successResponse(data), 200)
})

export const projectQueueRoutes = app
export type ProjectQueueRouteTypes = typeof projectQueueRoutes

// Backward-compatibility: create queue under project scope
const createQueueForProjectRoute = createRoute({
  method: 'post',
  path: '/api/projects/:projectId/queues',
  request: {
    params: z.object({ projectId: z.coerce.number().int().positive() }),
    body: {
      content: { 'application/json': { schema: CreateQueueBodySchema.omit({ projectId: true }) } },
      required: true
    }
  },
  responses: {
    200: {
      description: 'Queue created for project (compatibility route)',
      content: { 'application/json': { schema: z.object({ success: z.literal(true), data: TaskQueueSchema }) } }
    }
  },
  tags: ['Queues'],
  summary: 'Create queue for a project (compat)'
})

app.openapi(createQueueForProjectRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const body = c.req.valid('json')
  const created = await flowService.createQueue({ ...body, projectId })
  return c.json(successResponse(created), 200)
})
