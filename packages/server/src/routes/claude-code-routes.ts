import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { 
  ApiErrorResponseSchema, 
  ProjectIdParamsSchema,
  ClaudeSessionsResponseSchema,
  ClaudeMessagesResponseSchema,
  ClaudeProjectDataResponseSchema,
  ClaudeSessionQuerySchema,
  ClaudeMessageQuerySchema,
  ClaudeSessionsMetadataResponseSchema,
  ClaudeSessionsPaginatedResponseSchema,
  ClaudeSessionCursorSchema,
  ChatResponseSchema
} from '@promptliano/schemas'
import { claudeCodeMCPService, claudeCodeImportService, claudeCodeFileReaderService } from '@promptliano/services'
import { ApiError } from '@promptliano/shared'
import { createStandardResponses, successResponse } from '../utils/route-helpers'

// Response schema for MCP status
const MCPStatusResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      claudeDesktop: z.object({
        installed: z.boolean(),
        configExists: z.boolean(),
        hasPromptliano: z.boolean(),
        configPath: z.string().optional(),
        error: z.string().optional()
      }),
      claudeCode: z.object({
        globalConfigExists: z.boolean(),
        globalHasPromptliano: z.boolean(),
        globalConfigPath: z.string().optional(),
        projectConfigExists: z.boolean(),
        projectHasPromptliano: z.boolean(),
        projectConfigPath: z.string().optional(),
        localConfigExists: z.boolean(),
        localHasPromptliano: z.boolean(),
        localConfigPath: z.string().optional(),
        error: z.string().optional()
      }),
      projectId: z.string(),
      installCommand: z.string()
    })
  })
  .openapi('MCPStatusResponse')

// Get MCP status route
const getMCPStatusRoute = createRoute({
  method: 'get',
  path: '/api/claude-code/mcp-status/{projectId}',
  tags: ['Claude Code'],
  summary: 'Get MCP installation status for Claude Code and Claude Desktop',
  description: 'Checks MCP configuration status across Claude Desktop and Claude Code CLI',
  request: {
    params: ProjectIdParamsSchema
  },
  responses: createStandardResponses(MCPStatusResponseSchema)
})

// Get sessions route (enhanced with cursor support)
const getSessionsRoute = createRoute({
  method: 'get',
  path: '/api/claude-code/sessions/{projectId}',
  tags: ['Claude Code'],
  summary: 'Get all Claude Code chat sessions for a project',
  description: 'Retrieves all chat sessions from Claude Code local storage with optional cursor-based pagination',
  request: {
    params: ProjectIdParamsSchema,
    query: ClaudeSessionQuerySchema.extend({
      useCursor: z.coerce.boolean().optional().default(false),
      cursor: z.string().optional(),
      sortBy: z.enum(['lastUpdate', 'startTime', 'messageCount']).optional().default('lastUpdate'),
      sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
    }).openapi('ClaudeSessionQueryEnhanced')
  },
  responses: createStandardResponses(ClaudeSessionsResponseSchema.extend({
    pagination: z.object({
      hasMore: z.boolean(),
      nextCursor: z.string().optional(),
      total: z.number().optional()
    }).optional()
  }).openapi('ClaudeSessionsEnhancedResponse'))
})

// Get session messages route
const getSessionMessagesRoute = createRoute({
  method: 'get',
  path: '/api/claude-code/sessions/{projectId}/{sessionId}',
  tags: ['Claude Code'],
  summary: 'Get messages for a specific Claude Code session',
  description: 'Retrieves all messages from a specific chat session',
  request: {
    params: z.object({
      projectId: z.coerce.number().int().positive(),
      sessionId: z.string()
    }),
    query: ClaudeMessageQuerySchema
  },
  responses: createStandardResponses(ClaudeMessagesResponseSchema)
})

// Get project data route
const getProjectDataRoute = createRoute({
  method: 'get',
  path: '/api/claude-code/project-data/{projectId}',
  tags: ['Claude Code'],
  summary: 'Get Claude Code project metadata',
  description: 'Retrieves project-level data including branches, working directories, and statistics',
  request: {
    params: ProjectIdParamsSchema
  },
  responses: createStandardResponses(ClaudeProjectDataResponseSchema)
})

// Import session to chat route
const importSessionRoute = createRoute({
  method: 'post',
  path: '/api/claude-code/import-session/{projectId}/{sessionId}',
  tags: ['Claude Code'],
  summary: 'Import a Claude Code session into a Promptliano chat',
  description: 'Imports all messages from a Claude Code session into a new Promptliano chat',
  request: {
    params: z.object({
      projectId: z.coerce.number().int().positive(),
      sessionId: z.string()
    })
  },
  responses: createStandardResponses(ChatResponseSchema)
})

// Get sessions metadata route (lightweight)
const getSessionsMetadataRoute = createRoute({
  method: 'get',
  path: '/api/claude-code/sessions/{projectId}/metadata',
  tags: ['Claude Code'],
  summary: 'Get lightweight session metadata for a project',
  description: 'Retrieves session metadata without full message content for fast loading',
  request: {
    params: ProjectIdParamsSchema,
    query: z.object({
      search: z.string().optional(),
      branch: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional()
    }).openapi('ClaudeSessionMetadataQuery')
  },
  responses: createStandardResponses(ClaudeSessionsMetadataResponseSchema)
})

// Get sessions with cursor-based pagination route
const getSessionsPaginatedRoute = createRoute({
  method: 'get',
  path: '/api/claude-code/sessions/{projectId}/paginated',
  tags: ['Claude Code'],
  summary: 'Get sessions with cursor-based pagination',
  description: 'Retrieves sessions with efficient cursor-based pagination for large datasets',
  request: {
    params: ProjectIdParamsSchema,
    query: ClaudeSessionCursorSchema
  },
  responses: createStandardResponses(ClaudeSessionsPaginatedResponseSchema)
})

// Get recent sessions route (fast access)
const getRecentSessionsRoute = createRoute({
  method: 'get',
  path: '/api/claude-code/sessions/{projectId}/recent',
  tags: ['Claude Code'],
  summary: 'Get recent Claude Code sessions',
  description: 'Retrieves the most recent sessions for fast access (default 10 sessions)',
  request: {
    params: ProjectIdParamsSchema,
    query: z.object({
      limit: z.coerce.number().int().positive().max(50).optional().default(10)
    }).openapi('ClaudeRecentSessionsQuery')
  },
  responses: createStandardResponses(ClaudeSessionsResponseSchema)
})

// Get full session with complete message data
const getFullSessionRoute = createRoute({
  method: 'get',
  path: '/api/claude-code/sessions/{projectId}/{sessionId}/full',
  tags: ['Claude Code'],
  summary: 'Get complete Claude Code session with full message data',
  description: 'Retrieves a complete session including all messages and token usage data',
  request: {
    params: z.object({
      projectId: z.coerce.number().int().positive(),
      sessionId: z.string()
    }).openapi('ClaudeFullSessionParams')
  },
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.object({
      sessionId: z.string(),
      projectPath: z.string(),
      startTime: z.string(),
      lastUpdate: z.string(),
      messageCount: z.number(),
      gitBranch: z.string().optional(),
      cwd: z.string().optional(),
      tokenUsage: z.object({
        totalInputTokens: z.number(),
        totalCacheCreationTokens: z.number(),
        totalCacheReadTokens: z.number(),
        totalOutputTokens: z.number(),
        totalTokens: z.number()
      }).optional(),
      serviceTiers: z.array(z.string()).optional(),
      totalTokensUsed: z.number().optional(),
      totalCostUsd: z.number().optional()
    }).nullable()
  }).openapi('ClaudeFullSessionResponse'))
})

export const claudeCodeRoutes = new OpenAPIHono()
  .openapi(getMCPStatusRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    
    try {
      const status = await claudeCodeMCPService.getMCPStatus(projectId)
      return c.json(successResponse(status))
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        500,
        `Failed to get MCP status: ${error instanceof Error ? error.message : String(error)}`,
        'MCP_STATUS_FAILED'
      )
    }
  })
  // Register specific routes FIRST before the generic ones
  .openapi(getSessionsMetadataRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const query = c.req.valid('query')
    
    console.log(`[DEBUG] getSessionsMetadata called with projectId: ${projectId}`)
    
    try {
      // Use optimized MCP service method that returns only metadata (fastest option)
      let metadata = await claudeCodeMCPService.getSessionsMetadata(projectId)
      
      console.log(`[DEBUG] getSessionsMetadata returned ${metadata.length} sessions`)
      
      // Apply filters
      if (query.search) {
        const searchLower = query.search.toLowerCase()
        metadata = metadata.filter(m => 
          m.sessionId.toLowerCase().includes(searchLower) ||
          m.firstMessagePreview?.toLowerCase().includes(searchLower) ||
          m.lastMessagePreview?.toLowerCase().includes(searchLower)
        )
      }
      
      if (query.branch) {
        metadata = metadata.filter(m => m.hasGitBranch) // Can't filter exact branch without loading full data
      }
      
      if (query.startDate) {
        const startTime = new Date(query.startDate).getTime()
        metadata = metadata.filter(m => new Date(m.startTime).getTime() >= startTime)
      }
      
      if (query.endDate) {
        const endTime = new Date(query.endDate).getTime()
        metadata = metadata.filter(m => new Date(m.lastUpdate).getTime() <= endTime)
      }
      
      return c.json(successResponse(metadata))
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        500,
        `Failed to get sessions metadata: ${error instanceof Error ? error.message : String(error)}`,
        'GET_SESSIONS_METADATA_FAILED'
      )
    }
  })
  .openapi(getRecentSessionsRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const query = c.req.valid('query')
    
    console.log(`[DEBUG] getRecentSessions called with projectId: ${projectId}, limit: ${query.limit}`)
    
    try {
      // Use optimized MCP service method that includes proper error handling and path resolution
      const sessions = await claudeCodeMCPService.getRecentSessions(projectId, query.limit)
      
      console.log(`[DEBUG] getRecentSessions returned ${sessions.length} sessions`)
      
      return c.json(successResponse(sessions))
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        500,
        `Failed to get recent sessions: ${error instanceof Error ? error.message : String(error)}`,
        'GET_RECENT_SESSIONS_FAILED'
      )
    }
  })
  .openapi(getSessionsPaginatedRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const query = c.req.valid('query')
    
    try {
      // Convert cursor string to offset number for pagination
      const offset = query.cursor ? parseInt(atob(query.cursor), 10) || 0 : 0
      
      // Use optimized MCP service method with cursor-based pagination
      const result = await claudeCodeMCPService.getSessionsPaginated(projectId, offset, query.limit)
      
      return c.json({
        success: true,
        data: result.sessions,
        pagination: {
          hasMore: result.hasMore,
          total: result.total
        }
      })
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        500,
        `Failed to get paginated sessions: ${error instanceof Error ? error.message : String(error)}`,
        'GET_PAGINATED_SESSIONS_FAILED'
      )
    }
  })
  .openapi(getFullSessionRoute, async (c) => {
    const { projectId, sessionId } = c.req.valid('param')
    
    try {
      // Use optimized MCP service method for loading complete session data
      const session = await claudeCodeMCPService.getFullSession(projectId, sessionId)
      
      if (!session) {
        throw new ApiError(404, 'Session not found')
      }
      
      return c.json(successResponse(session))
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        500,
        `Failed to get full session: ${error instanceof Error ? error.message : String(error)}`,
        'GET_FULL_SESSION_FAILED'
      )
    }
  })
  .openapi(getSessionMessagesRoute, async (c) => {
    const { projectId, sessionId } = c.req.valid('param')
    const query = c.req.valid('query')
    
    try {
      let messages = await claudeCodeMCPService.getSessionMessages(projectId, sessionId)
      
      // Apply filters
      if (query.search) {
        const searchLower = query.search.toLowerCase()
        messages = messages.filter(m => {
          if (!m.message) return false
          const content = typeof m.message.content === 'string' 
            ? m.message.content 
            : m.message.content && Array.isArray(m.message.content)
              ? m.message.content.map(c => 
                  typeof c === 'string' ? c : (c && typeof c === 'object' && 'type' in c && c.type === 'text' && 'text' in c) ? c.text : ''
                ).join(' ')
              : ''
          return content.toLowerCase().includes(searchLower)
        })
      }
      
      if (query.role && query.role !== 'all') {
        messages = messages.filter(m => m.message?.role === query.role)
      }
      
      // Apply pagination
      const start = query.offset || 0
      const limit = query.limit || 100
      const paginated = messages.slice(start, start + limit)
      
      return c.json(successResponse(paginated))
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        500,
        `Failed to get messages: ${error instanceof Error ? error.message : String(error)}`,
        'GET_MESSAGES_FAILED'
      )
    }
  })
  .openapi(getSessionsRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const query = c.req.valid('query')
    
    try {
      // Use cursor-based pagination if requested, otherwise fall back to offset-based
      if (query.useCursor) {
        // Get project path from the database via claudeCodeMCPService helper logic
        const project = await claudeCodeMCPService.getProjectData(projectId)
        if (!project) {
          throw new ApiError(404, 'Project not found or no Claude Code data available')
        }
        
        // Convert query to cursor format
        const cursorQuery = {
          cursor: query.cursor,
          limit: query.limit || 50,
          sortBy: query.sortBy || 'lastUpdate',
          sortOrder: query.sortOrder || 'desc',
          search: query.search,
          branch: query.branch,
          startDate: query.startDate,
          endDate: query.endDate
        }
        
        const result = await claudeCodeFileReaderService.getSessionsCursor(project.projectPath, cursorQuery)
        
        return c.json({
          success: true,
          data: result.sessions,
          pagination: {
            hasMore: !!result.nextCursor,
            nextCursor: result.nextCursor
          }
        })
      } else {
        // Legacy offset-based pagination
        let sessions = await claudeCodeMCPService.getSessions(projectId)
        
        // Apply filters
        if (query.search) {
          const searchLower = query.search.toLowerCase()
          sessions = sessions.filter(s => 
            s.id.toLowerCase().includes(searchLower) ||
            s.gitBranch?.toLowerCase().includes(searchLower) ||
            s.cwd?.toLowerCase().includes(searchLower)
          )
        }
        
        if (query.branch) {
          sessions = sessions.filter(s => s.gitBranch === query.branch)
        }
        
        if (query.startDate) {
          const startTime = new Date(query.startDate).getTime()
          sessions = sessions.filter(s => new Date(s.startTime).getTime() >= startTime)
        }
        
        if (query.endDate) {
          const endTime = new Date(query.endDate).getTime()
          sessions = sessions.filter(s => new Date(s.lastUpdate).getTime() <= endTime)
        }
        
        // Apply sorting
        if (query.sortBy) {
          sessions.sort((a, b) => {
            let aVal: any, bVal: any
            
            switch (query.sortBy) {
              case 'startTime':
                aVal = new Date(a.startTime).getTime()
                bVal = new Date(b.startTime).getTime()
                break
              case 'messageCount':
                aVal = a.messageCount
                bVal = b.messageCount
                break
              case 'lastUpdate':
              default:
                aVal = new Date(a.lastUpdate).getTime()
                bVal = new Date(b.lastUpdate).getTime()
                break
            }
            
            const result = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
            return query.sortOrder === 'desc' ? -result : result
          })
        }
        
        // Apply pagination
        const start = query.offset || 0
        const limit = query.limit || 50
        const paginated = sessions.slice(start, start + limit)
        
        return c.json(successResponse(paginated))
      }
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        500,
        `Failed to get sessions: ${error instanceof Error ? error.message : String(error)}`,
        'GET_SESSIONS_FAILED'
      )
    }
  })
  .openapi(getProjectDataRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    
    try {
      const projectData = await claudeCodeMCPService.getProjectData(projectId)
      
      if (!projectData) {
        throw new ApiError(404, 'No Claude Code data found for this project')
      }
      
      return c.json(successResponse(projectData))
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        500,
        `Failed to get project data: ${error instanceof Error ? error.message : String(error)}`,
        'GET_PROJECT_DATA_FAILED'
      )
    }
  })
  .openapi(importSessionRoute, async (c) => {
    const { projectId, sessionId } = c.req.valid('param')
    
    try {
      const chat = await claudeCodeImportService.importSession(projectId, sessionId)
      
      return c.json(successResponse(chat))
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        500,
        `Failed to import session: ${error instanceof Error ? error.message : String(error)}`,
        'IMPORT_SESSION_FAILED'
      )
    }
  })

export type ClaudeCodeRouteTypes = typeof claudeCodeRoutes

