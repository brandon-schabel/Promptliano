import type { Resource, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js'
import {
  listProjects,
  getProjectById,
  getProjectFiles,
  getProjectOverview,
  getProjectStats,
  getProjectFileTree,
  listTicketsByProject,
  ticketService,
  getQueuesWithStats,
  getQueueWithStats,
  getQueueTimeline,
  getMCPAnalyticsOverview,
  getTopErrorPatterns,
  mcpConfigManager,
  providerKeyService,
  gitStatusService,
  gitCommitService,
  gitBranchService,
  listProjectProcesses
} from '@promptliano/services'
import { mcpServerRepository } from '@promptliano/database'
import { CONSOLIDATED_TOOLS } from '../tools'

const GENERAL_RESOURCES: Resource[] = [
  {
    uri: 'promptliano://info',
    name: 'Promptliano Info',
    description: 'Information about the Promptliano MCP server',
    mimeType: 'text/plain'
  },
  {
    uri: 'promptliano://tools',
    name: 'Available MCP Tools',
    description: 'List of available tools and their input schemas',
    mimeType: 'application/json'
  },
  {
    uri: 'promptliano://mcp/usage',
    name: 'MCP Usage Overview',
    description: 'Aggregated usage stats for MCP tools across projects',
    mimeType: 'application/json'
  },
  {
    uri: 'promptliano://providers',
    name: 'Provider Keys Status',
    description: 'Installed provider keys (censored) and availability flags',
    mimeType: 'application/json'
  },
  {
    uri: 'promptliano://health',
    name: 'Server Health',
    description: 'Basic server health and versions',
    mimeType: 'application/json'
  },
  {
    uri: 'promptliano://projects',
    name: 'Available Projects',
    description: 'List of available Promptliano projects',
    mimeType: 'application/json'
  }
]

const MAX_FILE_RESOURCES = 20

function toMimeType(path: string, extension?: string | null): string {
  const value = (extension || path.split('.').pop() || '').toLowerCase()
  switch (value) {
    case 'json':
      return 'application/json'
    case 'md':
      return 'text/markdown'
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
      return 'text/javascript'
    default:
      return 'text/plain'
  }
}

function buildProjectResources(projectId: number): Resource[] {
  return [
    {
      uri: `promptliano://projects/${projectId}/overview`,
      name: 'Project Overview',
      description: 'Human-friendly project overview (open tickets, queues, etc.)',
      mimeType: 'text/plain'
    },
    {
      uri: `promptliano://projects/${projectId}/stats`,
      name: 'Project Stats',
      description: 'Project metrics: tickets, tasks, queues, prompts, chats',
      mimeType: 'application/json'
    },
    {
      uri: `promptliano://projects/${projectId}/file-tree`,
      name: 'Project File Tree',
      description: 'Compact file tree with metadata (capped for performance)',
      mimeType: 'application/json'
    },
    {
      uri: `promptliano://projects/${projectId}/tickets/summary`,
      name: 'Tickets Summary',
      description: 'Counts by status and top recent tickets',
      mimeType: 'application/json'
    },
    {
      uri: `promptliano://projects/${projectId}/tickets/open`,
      name: 'Open Tickets',
      description: 'Top open tickets for this project',
      mimeType: 'application/json'
    },
    {
      uri: `promptliano://projects/${projectId}/queues`,
      name: 'Queues Overview',
      description: 'Queues with basic stats',
      mimeType: 'application/json'
    },
    {
      uri: `promptliano://projects/${projectId}/queues/timeline`,
      name: 'Queues Timeline',
      description: 'Recent queue activity timeline',
      mimeType: 'application/json'
    },
    {
      uri: `promptliano://projects/${projectId}/mcp/usage`,
      name: 'MCP Usage (Project)',
      description: 'Per-tool usage, success/error rates, execution trends',
      mimeType: 'application/json'
    },
    {
      uri: `promptliano://projects/${projectId}/mcp/errors`,
      name: 'MCP Error Patterns',
      description: 'Top recurring error patterns for MCP tools',
      mimeType: 'application/json'
    },
    {
      uri: `promptliano://projects/${projectId}/git/status`,
      name: 'Git Status',
      description: 'Branch and working tree status',
      mimeType: 'application/json'
    },
    {
      uri: `promptliano://projects/${projectId}/git/log`,
      name: 'Recent Git Commits',
      description: 'Recent commit log with basic metadata',
      mimeType: 'application/json'
    },
    {
      uri: `promptliano://projects/${projectId}/git/branches`,
      name: 'Git Branches',
      description: 'List of branches for the project repository',
      mimeType: 'application/json'
    },
    {
      uri: `promptliano://projects/${projectId}/config/mcp`,
      name: 'MCP Project Config',
      description: 'Merged MCP config for project (expanded variables)',
      mimeType: 'application/json'
    },
    {
      uri: `promptliano://projects/${projectId}/mcp/servers`,
      name: 'MCP Servers',
      description: 'Configured MCP servers for this project',
      mimeType: 'application/json'
    },
    {
      uri: `promptliano://projects/${projectId}/search/config`,
      name: 'Search Backend Config',
      description: 'File search backend and tool paths (no secrets)',
      mimeType: 'application/json'
    },
    {
      uri: `promptliano://projects/${projectId}/processes`,
      name: 'Processes',
      description: 'Active processes managed by Promptliano',
      mimeType: 'application/json'
    },
    {
      uri: `promptliano://projects/${projectId}/suggest-files`,
      name: 'File Suggestions',
      description: 'AI-powered file suggestions based on prompts',
      mimeType: 'application/json'
    }
  ]
}

type MinimalProjectFile = {
  id: string
  name: string
  path: string
  size?: number | null
  extension?: string | null
}

function buildFileResources(projectId: number, files: MinimalProjectFile[]): Resource[] {
  return files.map((file) => ({
    uri: `promptliano://projects/${projectId}/files/${file.id}`,
    name: file.name,
    description: `File: ${file.path} (${typeof file.size === 'number' ? file.size : 'unknown'} bytes)`,
    mimeType: toMimeType(file.path, file.extension ?? undefined)
  }))
}

export async function listResources(projectId: number | null): Promise<Resource[]> {
  const resources: Resource[] = [...GENERAL_RESOURCES]

  if (!projectId) {
    return resources
  }

  try {
    await getProjectById(projectId)
    const files = (await getProjectFiles(projectId)) ?? []
    resources.push(...buildProjectResources(projectId))
    resources.push(...buildFileResources(projectId, files.slice(0, MAX_FILE_RESOURCES)))
  } catch (error) {
    console.error('[MCP] Failed to build project resources:', error)
  }

  return resources
}

function requireProjectId(projectId: number | null): number {
  if (typeof projectId === 'number' && !Number.isNaN(projectId)) {
    return projectId
  }

  throw new Error('Project-specific resources require PROMPTLIANO_PROJECT_ID or a projectId argument.')
}

export async function readResource(uri: string, projectId: number | null): Promise<ReadResourceResult> {
  if (!uri.startsWith('promptliano://')) {
    throw new Error(`Unknown resource URI: ${uri}`)
  }

  const parts = uri.replace('promptliano://', '').split('/')
  const [root, ...rest] = parts

  switch (root) {
    case 'info': {
      return {
        contents: [
          {
            uri,
            mimeType: 'text/plain',
            text: `Promptliano MCP Server\n\nSet PROMPTLIANO_PROJECT_ID to scope resources and tool calls to a project.`
          }
        ]
      }
    }
    case 'tools': {
      const toolsInfo = CONSOLIDATED_TOOLS.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }))
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(toolsInfo, null, 2)
          }
        ]
      }
    }
    case 'mcp': {
      if (rest[0] === 'usage' && !rest[1]) {
        const overview = await getMCPAnalyticsOverview()
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(overview, null, 2)
            }
          ]
        }
      }
      break
    }
    case 'providers': {
      const keys = await providerKeyService.getAll()
      const simplified = keys.map((key: any) => ({
        id: key.id,
        provider: key.provider,
        isActive: !!key.isActive,
        isDefault: !!key.isDefault,
        storageMethod: key.storageMethod || (key.key ? 'direct' : key.secretRef ? 'env' : null),
        display: key.displayValue || (key.secretRef ? `ENV: ${key.secretRef}` : key.key ? '****' : null)
      }))
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({ providers: simplified }, null, 2)
          }
        ]
      }
    }
    case 'health': {
      const payload = {
        ok: true,
        server: 'promptliano-mcp',
        version: '0.11.0',
        time: Date.now()
      }
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(payload, null, 2)
          }
        ]
      }
    }
    case 'projects': {
      if (!rest[0]) {
        const projects = await listProjects()
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(projects, null, 2)
            }
          ]
        }
      }

      const scopedProjectId = requireProjectId(projectId)
      if (rest[0] !== String(scopedProjectId)) {
        throw new Error(`Access to project ${rest[0]} is not allowed. Current scope: ${scopedProjectId}`)
      }

      const section = rest[1]

      switch (section) {
        case 'overview': {
          const overview = await getProjectOverview(scopedProjectId)
          return {
            contents: [
              {
                uri,
                mimeType: 'text/plain',
                text: overview
              }
            ]
          }
        }
        case 'stats': {
          const stats = await getProjectStats(scopedProjectId)
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(stats, null, 2)
              }
            ]
          }
        }
        case 'file-tree': {
          const tree = await getProjectFileTree(scopedProjectId, { maxDepth: 6, limit: 800 })
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(tree, null, 2)
              }
            ]
          }
        }
        case 'tickets': {
          if (rest[2] === 'summary') {
            const tickets = await listTicketsByProject(scopedProjectId)
            const counts = tickets.reduce(
              (acc: any, ticket: any) => {
                acc.total += 1
                acc.byStatus[ticket.status] = (acc.byStatus[ticket.status] || 0) + 1
                return acc
              },
              { total: 0, byStatus: {} as Record<string, number> }
            )
            const recent = [...tickets]
              .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
              .slice(0, 10)
              .map((ticket) => ({
                id: ticket.id,
                title: ticket.title,
                status: ticket.status,
                priority: ticket.priority,
                updatedAt: ticket.updatedAt
              }))

            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify({ counts, recent }, null, 2)
                }
              ]
            }
          }

          if (rest[2] === 'open') {
            const tickets = await listTicketsByProject(scopedProjectId)
            const openTickets = tickets.filter((ticket: any) => ticket.status !== 'closed')
            const top = openTickets
              .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
              .slice(0, 15)
              .map((ticket) => ({
                id: ticket.id,
                title: ticket.title,
                status: ticket.status,
                priority: ticket.priority,
                updatedAt: ticket.updatedAt
              }))
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(top, null, 2)
                }
              ]
            }
          }

          if (rest[2] && !Number.isNaN(Number(rest[2]))) {
            const ticketId = Number(rest[2])
            const ticket = await ticketService.getWithTasks(ticketId)
            const payload = {
              id: ticket.id,
              title: ticket.title,
              status: ticket.status,
              priority: ticket.priority,
              overview: ticket.overview,
              tasks: (ticket.tasks || []).map((task: any) => ({
                id: task.id,
                title: task.title,
                status: task.status,
                orderIndex: task.orderIndex
              }))
            }
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(payload, null, 2)
                }
              ]
            }
          }

          break
        }
        case 'queues': {
          if (!rest[2]) {
            const queues = await getQueuesWithStats(scopedProjectId)
            const slim = queues.map((queue: any) => ({
              id: queue.queue.id,
              name: queue.queue.name,
              isActive: queue.queue.isActive,
              stats: queue.stats
            }))
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(slim, null, 2)
                }
              ]
            }
          }

          if (rest[2] === 'timeline') {
            const timeline = await getQueueTimeline(scopedProjectId)
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(timeline, null, 2)
                }
              ]
            }
          }

          if (!Number.isNaN(Number(rest[2]))) {
            const queueId = Number(rest[2])
            const details = await getQueueWithStats(queueId)
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(details, null, 2)
                }
              ]
            }
          }

          break
        }
        case 'mcp': {
          if (rest[2] === 'usage') {
            const overview = await getMCPAnalyticsOverview(scopedProjectId)
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(overview, null, 2)
                }
              ]
            }
          }

          if (rest[2] === 'errors') {
            const top = await getTopErrorPatterns(scopedProjectId, 10)
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(top, null, 2)
                }
              ]
            }
          }

          if (rest[2] === 'servers') {
            const servers = await mcpServerRepository.getByProject(scopedProjectId)
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(servers, null, 2)
                }
              ]
            }
          }

          break
        }
        case 'git': {
          if (rest[2] === 'status') {
            const status = await gitStatusService.getProjectGitStatus(scopedProjectId)
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(status, null, 2)
                }
              ]
            }
          }

          if (rest[2] === 'log') {
            const log = await gitCommitService.getCommitLog(scopedProjectId, { limit: 20 })
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(log, null, 2)
                }
              ]
            }
          }

          if (rest[2] === 'branches') {
            const branches = await gitBranchService.getBranches(scopedProjectId)
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(branches, null, 2)
                }
              ]
            }
          }

          break
        }
        case 'config': {
          if (rest[2] === 'mcp') {
            const config = await mcpConfigManager.getMergedProjectMCPConfig(scopedProjectId)
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(config, null, 2)
                }
              ]
            }
          }
          break
        }
        case 'search': {
          if (rest[2] === 'config') {
            const payload = {
              backend: process.env.FILE_SEARCH_BACKEND || 'sg',
              astGrepPath: process.env.FILE_SEARCH_ASTGREP_PATH || null,
              ripgrepPath: process.env.FILE_SEARCH_RIPGREP_PATH || null
            }
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(payload, null, 2)
                }
              ]
            }
          }
          break
        }
        case 'processes': {
          const processes = await listProjectProcesses(scopedProjectId)
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(processes, null, 2)
              }
            ]
          }
        }
        case 'suggest-files': {
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(
                  {
                    message: 'This resource requires a prompt parameter. Use the suggest_files tool instead.',
                    example: {
                      tool: 'suggest_files',
                      arguments: {
                        prompt: 'components for user authentication',
                        limit: 10
                      }
                    }
                  },
                  null,
                  2
                )
              }
            ]
          }
        }
        case 'files': {
          if (!rest[2]) {
            break
          }

          const fileId = rest.slice(2).join('/')
          const files = await getProjectFiles(scopedProjectId)
          const file = files?.find((item: any) => item.id === fileId)

          if (!file) {
            throw new Error(`File not found with ID: ${fileId}`)
          }

          return {
            contents: [
              {
                uri,
                mimeType: toMimeType(file.path, file.extension ?? undefined),
                text: file.content
              }
            ]
          }
        }
        default:
          break
      }

      break
    }
    default:
      break
  }

  throw new Error(`Unknown resource URI: ${uri}`)
}
