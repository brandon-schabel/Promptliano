import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { createStandardResponses, successResponse } from '../utils/route-helpers'
import { ErrorFactory } from '@promptliano/shared'
import {
  ProcessInfoSchema,
  ProcessStartRequestSchema,
  ProcessDetailResponseSchema,
  ProcessListResponseSchema,
  ProjectScriptListResponseSchema,
  createListResponseSchema,
  createSuccessResponseSchema
} from '@promptliano/schemas'
import {
  listProjectProcesses,
  listProjectScripts,
  startProjectProcess,
  stopProjectProcess,
  createProcessManagementService
} from '@promptliano/services'
import { projectService } from '@promptliano/services'
import { resolve as pathResolve } from 'node:path'
import { processRunsRepository, processLogsRepository, processPortsRepository } from '@promptliano/database'

// Additional schemas for new features
const ProcessLogSchema = z.object({
  id: z.number(),
  runId: z.number(),
  timestamp: z.number(),
  type: z.enum(['stdout', 'stderr', 'system']),
  content: z.string(),
  lineNumber: z.number()
})

const ProcessPortSchema = z.object({
  id: z.number(),
  port: z.number(),
  protocol: z.enum(['tcp', 'udp']),
  address: z.string(),
  pid: z.number().nullable().optional(),
  processName: z.string().nullable().optional(),
  state: z.enum(['listening', 'established', 'closed'])
})

const ProcessHistorySchema = z.object({
  id: z.number(),
  projectId: z.number(),
  processId: z.string(),
  pid: z.number().nullable().optional(),
  name: z.string().nullable().optional(),
  command: z.string(),
  status: z.enum(['running', 'stopped', 'exited', 'error', 'killed']),
  startedAt: z.number(),
  exitedAt: z.number().nullable().optional(),
  exitCode: z.number().nullable().optional()
})

// Initialize enhanced service
const processService = createProcessManagementService()

const listProcessesRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/processes',
  request: {
    params: z.object({ id: z.string().transform(Number) })
  },
  responses: createStandardResponses(ProcessListResponseSchema),
  tags: ['Processes'],
  operationId: 'listProjectProcesses',
  summary: 'List processes for a project'
})

const startProcessRoute = createRoute({
  method: 'post',
  path: '/api/projects/{id}/processes/start',
  request: {
    params: z.object({ id: z.string().transform(Number) }),
    body: {
      content: {
        'application/json': { schema: ProcessStartRequestSchema }
      }
    }
  },
  responses: createStandardResponses(ProcessDetailResponseSchema),
  tags: ['Processes'],
  operationId: 'startProjectProcess',
  summary: 'Start a new process for a project'
})

const stopProcessRoute = createRoute({
  method: 'post',
  path: '/api/projects/{id}/processes/{processId}/stop',
  request: {
    params: z.object({ id: z.string().transform(Number), processId: z.string() })
  },
  responses: createStandardResponses(
    z.object({ success: z.literal(true), data: ProcessInfoSchema }).openapi('ProcessStopResponse')
  ),
  tags: ['Processes'],
  operationId: 'stopProjectProcess',
  summary: 'Stop a running process'
})

// Get process history route
const getProcessHistoryRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/processes/history',
  request: {
    params: z.object({ id: z.string().transform(Number) }),
    query: z.object({
      limit: z.string().transform(Number).optional().default(50),
      offset: z.string().transform(Number).optional().default(0)
    })
  },
  responses: createStandardResponses(createListResponseSchema(ProcessHistorySchema, { name: 'ProcessHistory' })),
  tags: ['Processes'],
  operationId: 'getProcessHistory',
  summary: 'Get process execution history'
})

// Get process logs route
const getProcessLogsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/processes/{processId}/logs',
  request: {
    params: z.object({
      id: z.string().transform(Number),
      processId: z.string()
    }),
    query: z.object({
      limit: z.string().transform(Number).optional().default(1000),
      offset: z.string().transform(Number).optional().default(0),
      type: z.enum(['stdout', 'stderr', 'system', 'all']).optional().default('all')
    })
  },
  responses: createStandardResponses(createListResponseSchema(ProcessLogSchema, { name: 'ProcessLogs' })),
  tags: ['Processes'],
  operationId: 'getProcessLogs',
  summary: 'Get logs for a process'
})

// Get ports route
const getPortsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/processes/ports',
  request: {
    params: z.object({ id: z.string().transform(Number) }),
    query: z.object({
      state: z.enum(['listening', 'established', 'closed', 'all']).optional().default('listening')
    })
  },
  responses: createStandardResponses(createListResponseSchema(ProcessPortSchema, { name: 'ProcessPorts' })),
  tags: ['Processes'],
  operationId: 'getProcessPorts',
  summary: 'Get ports used by processes'
})

// Kill process by port route
const killByPortRoute = createRoute({
  method: 'post',
  path: '/api/projects/{id}/processes/ports/{port}/kill',
  request: {
    params: z.object({
      id: z.string().transform(Number),
      port: z.string().transform(Number)
    })
  },
  responses: createStandardResponses(
    createSuccessResponseSchema(z.object({ pid: z.number() }), { name: 'KillByPort' })
  ),
  tags: ['Processes'],
  operationId: 'killProcessByPort',
  summary: 'Kill process using a specific port'
})

// Scan ports route
const scanPortsRoute = createRoute({
  method: 'post',
  path: '/api/projects/{id}/processes/ports/scan',
  request: {
    params: z.object({ id: z.string().transform(Number) })
  },
  responses: createStandardResponses(createListResponseSchema(ProcessPortSchema, { name: 'ScanPorts' })),
  tags: ['Processes'],
  operationId: 'scanProcessPorts',
  summary: 'Scan and update port usage'
})

// Run script route
const runScriptRoute = createRoute({
  method: 'post',
  path: '/api/projects/{id}/processes/scripts/run',
  request: {
    params: z.object({ id: z.string().transform(Number) }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            scriptName: z.string(),
            packageManager: z.enum(['npm', 'bun', 'yarn', 'pnpm']).optional().default('bun'),
            packagePath: z.string().optional()
          })
        }
      }
    }
  },
  responses: createStandardResponses(ProcessDetailResponseSchema),
  tags: ['Processes'],
  operationId: 'runProjectScript',
  summary: 'Run a package.json script'
})

// List available package.json scripts
const listScriptsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{id}/processes/scripts',
  request: {
    params: z.object({ id: z.string().transform(Number) })
  },
  responses: createStandardResponses(ProjectScriptListResponseSchema),
  tags: ['Processes'],
  operationId: 'listProjectScripts',
  summary: 'List package.json scripts in the project (root + workspaces)'
})

export const processManagementRoutes = new OpenAPIHono()
  .openapi(listProcessesRoute, async (c) => {
    const { id } = c.req.valid('param')
    const processes = await listProjectProcesses(id)
    return c.json(successResponse(processes), 200)
  })
  .openapi(listScriptsRoute, async (c) => {
    const { id } = c.req.valid('param')
    const scripts = await listProjectScripts(id)
    return c.json(successResponse(scripts), 200)
  })
  .openapi(startProcessRoute, async (c) => {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')

    try {
      const processInfo = await startProjectProcess(id, body)
      return c.json(successResponse(processInfo), 200)
    } catch (e: any) {
      throw ErrorFactory.wrap(e, 'Failed to start process')
    }
  })
  .openapi(stopProcessRoute, async (c) => {
    const { id, processId } = c.req.valid('param')
    try {
      const processInfo = await stopProjectProcess(id, processId)
      return c.json(successResponse(processInfo), 200)
    } catch (e: any) {
      throw ErrorFactory.wrap(e, 'Failed to stop process')
    }
  })
  .openapi(getProcessHistoryRoute, async (c) => {
    const { id } = c.req.valid('param')
    const { limit, offset } = c.req.valid('query')

    try {
      const history = await processRunsRepository.getHistory(id, limit, offset)
      return c.json(successResponse(history), 200)
    } catch (e: any) {
      throw ErrorFactory.wrap(e, 'Failed to get process history')
    }
  })
  .openapi(getProcessLogsRoute, async (c) => {
    const { id, processId } = c.req.valid('param')
    const { limit, offset, type } = c.req.valid('query')

    try {
      // Get process run to get the runId
      const processRun = await processRunsRepository.getByProcessId(processId)
      if (!processRun) {
        throw ErrorFactory.notFound('Process', processId)
      }

      let logs
      if (type === 'all') {
        logs = await processLogsRepository.getByRunId(processRun.id, limit, offset)
      } else {
        logs = await processLogsRepository.getByType(processRun.id, type as any)
      }

      return c.json(successResponse(logs), 200)
    } catch (e: any) {
      throw ErrorFactory.wrap(e, 'Failed to get process logs')
    }
  })
  .openapi(getPortsRoute, async (c) => {
    const { id } = c.req.valid('param')
    const { state } = c.req.valid('query')

    try {
      let ports
      if (state === 'all') {
        ports = await processPortsRepository.getByProject(id)
      } else {
        ports = await processPortsRepository.getByState(id, state as any)
      }

      return c.json(successResponse(ports), 200)
    } catch (e: any) {
      throw ErrorFactory.wrap(e, 'Failed to get ports')
    }
  })
  .openapi(killByPortRoute, async (c) => {
    const { id, port } = c.req.valid('param')

    try {
      // Find process using this port
      const ports = await processPortsRepository.getByState(id, 'listening')
      const portInfo = ports.find((p) => p.port === port)

      if (!portInfo || !portInfo.pid) {
        throw ErrorFactory.notFound('Port', port)
      }

      // Kill the process
      try {
        process.kill(portInfo.pid, 'SIGTERM')

        // Update port status
        await processPortsRepository.releasePort(id, port)

        return c.json(successResponse({ pid: portInfo.pid }), 200)
      } catch (killError: any) {
        throw ErrorFactory.wrap(killError, `Failed to kill process on port ${port}`)
      }
    } catch (e: any) {
      throw ErrorFactory.wrap(e, 'Failed to kill process by port')
    }
  })
  .openapi(scanPortsRoute, async (c) => {
    const { id } = c.req.valid('param')

    try {
      const ports = await processService.scanPorts()
      return c.json(successResponse(ports), 200)
    } catch (e: any) {
      throw ErrorFactory.wrap(e, 'Failed to scan ports')
    }
  })
  .openapi(runScriptRoute, async (c) => {
    const { id } = c.req.valid('param')
    const { scriptName, packageManager, packagePath } = c.req.valid('json')

    try {
      // Get project path
      const project = await projectService.getById(id)
      if (!project) {
        throw ErrorFactory.notFound('Project', id)
      }

      // Optional safety: ensure provided packagePath (if any) is inside project path
      let cwd = project.path
      if (packagePath) {
        const resolved = pathResolve(packagePath)
        const projectResolved = pathResolve(project.path)
        if (!resolved.startsWith(projectResolved)) {
          throw ErrorFactory.badRequest('Invalid packagePath: outside project')
        }
        cwd = resolved
      }

      // Run the script
      const processInfo = await startProjectProcess(id, {
        command: packageManager,
        args: ['run', scriptName],
        name: scriptName,
        cwd
      })

      return c.json(successResponse(processInfo), 200)
    } catch (e: any) {
      throw ErrorFactory.wrap(e, 'Failed to run script')
    }
  })

export type ProcessManagementRoutes = typeof processManagementRoutes
