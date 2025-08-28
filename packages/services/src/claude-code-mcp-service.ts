// Claude Code MCP Service (Functional Factory Pattern)
// Handles Claude Code MCP status and session management
// Includes type conversion between file-based and database formats

import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { z } from 'zod'
import { createLogger } from './utils/logger'
import { getProjectById } from './project-service'
import { createHash } from 'crypto'
import { claudeCodeFileReaderService } from './claude-code-file-reader-service'
import { withErrorContext, withRetry } from './utils/service-helpers'
import { 
  MCPErrorFactory, 
  MCPFileOps, 
  MCPRetryConfig, 
  withMCPCache,
  MCPCacheConfig,
  MCPValidation
} from './utils/mcp-service-helpers'

// Import database types for return values
import type {
  ClaudeSession as DbClaudeSession,
  ClaudeMessage as DbClaudeMessage,
  ClaudeSessionMetadata as DbClaudeSessionMetadata,
  TokenUsage as DbTokenUsage
} from '@promptliano/database'

// Import file-based types from schemas for Claude Code file reading
import type {
  ClaudeSession as FileClaudeSession,
  ClaudeMessage as FileClaudeMessage,
  ClaudeSessionMetadata as FileClaudeSessionMetadata,
  ClaudeProjectData,
  TokenUsage as FileTokenUsage
} from '@promptliano/schemas'

const logger = createLogger('ClaudeCodeMCPService')

// Configuration schemas
const MCPServerConfigSchema = z.object({
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional()
})

const ClaudeDesktopConfigSchema = z.object({
  mcpServers: z.record(MCPServerConfigSchema).optional()
})

const ClaudeCodeConfigSchema = z.object({
  mcpServers: z.record(MCPServerConfigSchema).optional(),
  defaultMcpServers: z.array(z.string()).optional(),
  projectBindings: z.record(z.any()).optional()
})

const ProjectMCPConfigSchema = z.object({
  mcpServers: z.record(MCPServerConfigSchema).optional()
})

export interface ClaudeCodeMCPStatus {
  claudeDesktop: {
    installed: boolean
    configExists: boolean
    hasPromptliano: boolean
    configPath?: string
    error?: string
  }
  claudeCode: {
    globalConfigExists: boolean
    globalHasPromptliano: boolean
    globalConfigPath?: string
    projectConfigExists: boolean
    projectHasPromptliano: boolean
    projectConfigPath?: string
    localConfigExists: boolean
    localHasPromptliano: boolean
    localConfigPath?: string
    error?: string
  }
  projectId: string
  installCommand: string
}

export interface ClaudeCodeMCPDependencies {
  logger?: ReturnType<typeof createLogger>
  platform?: string
  projectService?: { getById: (id: number) => Promise<any> }
  fileReaderService?: any
  cacheConfig?: { ttl?: number; maxEntries?: number }
  enableSessionCaching?: boolean
}

export interface ClaudeCodeMCPService {
  getMCPStatus(projectId: number): Promise<ClaudeCodeMCPStatus>
  getSessions(projectId: number): Promise<DbClaudeSession[]>
  getRecentSessions(projectId: number, limit?: number): Promise<DbClaudeSession[]>
  getSessionsPaginated(
    projectId: number,
    offset?: number,
    limit?: number
  ): Promise<{ sessions: DbClaudeSession[]; total: number; hasMore: boolean }>
  getSessionsMetadata(projectId: number): Promise<DbClaudeSessionMetadata[]>
  getFullSession(projectId: number, sessionId: string): Promise<DbClaudeSession | null>
  getSessionMessages(projectId: number, sessionId: string): Promise<DbClaudeMessage[]>
  getProjectData(projectId: number): Promise<ClaudeProjectData | null>
  watchChatHistory(projectId: number, onUpdate: (messages: DbClaudeMessage[]) => void): () => void
}

export function createClaudeCodeMCPService(deps?: ClaudeCodeMCPDependencies): ClaudeCodeMCPService {
  const {
    logger = createLogger('ClaudeCodeMCPService'),
    platform = process.platform,
    projectService = { getById: getProjectById },
    fileReaderService = claudeCodeFileReaderService,
    cacheConfig = MCPCacheConfig.metadata || { ttl: 60000, maxEntries: 100 },
    enableSessionCaching = true
  } = deps || {}

  /**
   * Type conversion functions to bridge file-based types and database types
   */
  const TypeConverter = {
    /**
     * Convert file-based ClaudeSession to database ClaudeSession
     */
    fileSessionToDbSession(fileSession: FileClaudeSession, projectId: number): DbClaudeSession {
      const now = Date.now()
      return {
        id: fileSession.sessionId, // sessionId as primary key in database
        projectId: projectId,
        projectPath: fileSession.projectPath,
        startTime: fileSession.startTime,
        lastUpdate: fileSession.lastUpdate,
        messageCount: fileSession.messageCount,
        gitBranch: fileSession.gitBranch || null,
        cwd: fileSession.cwd || null,
        tokenUsage: fileSession.tokenUsage ? this.fileTokenUsageToDbTokenUsage(fileSession.tokenUsage) : null,
        serviceTiers: fileSession.serviceTiers || [],
        totalTokensUsed: fileSession.totalTokensUsed || null,
        totalCostUsd: fileSession.totalCostUsd || null,
        createdAt: now,
        updatedAt: now
      }
    },

    /**
     * Convert file toolUseResult to database ToolUseResult
     */
    convertToolUseResult(toolUseResult: any): any | null {
      if (!toolUseResult) return null
      if (typeof toolUseResult === 'string') {
        try {
          return JSON.parse(toolUseResult)
        } catch {
          return null
        }
      }
      return toolUseResult
    },

    /**
     * Convert file content to database ClaudeContentBlock[]
     */
    convertContent(content: any): any | null {
      if (!content) return null
      if (typeof content === 'string') return null // String content goes in message.content, not top-level content
      if (Array.isArray(content)) return content
      return null
    },

    /**
     * Convert file-based ClaudeMessage to database ClaudeMessage
     */
    fileMessageToDbMessage(fileMessage: FileClaudeMessage, projectId: number): DbClaudeMessage {
      const now = Date.now()

      // Generate a numeric ID from UUID, timestamp, or current time
      let numericId = now
      if (fileMessage.uuid) {
        // Try to extract numeric part from UUID or hash it
        const match = fileMessage.uuid.match(/\d+/)
        if (match) {
          numericId = parseInt(match[0])
        } else {
          // Simple hash of UUID to get a number
          numericId = fileMessage.uuid.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
        }
      } else if (fileMessage.timestamp) {
        // Use timestamp as ID
        const timestampNum = new Date(fileMessage.timestamp).getTime()
        numericId = timestampNum
      }

      return {
        id: numericId,
        projectId: projectId,
        type: fileMessage.type as 'user' | 'assistant' | 'result' | 'system' | 'summary',
        message: fileMessage.message || null,
        timestamp: fileMessage.timestamp,
        sessionId: fileMessage.sessionId,
        uuid: fileMessage.uuid || null,
        parentUuid: fileMessage.parentUuid || null,
        requestId: fileMessage.requestId || null,
        userType: fileMessage.userType || null,
        isSidechain: fileMessage.isSidechain || null,
        cwd: fileMessage.cwd || null,
        version: fileMessage.version || null,
        gitBranch: fileMessage.gitBranch || null,
        toolUseResult: this.convertToolUseResult(fileMessage.toolUseResult),
        content: this.convertContent(fileMessage.content),
        isMeta: fileMessage.isMeta || null,
        toolUseID: fileMessage.toolUseID || null,
        level: fileMessage.level || null,
        tokensUsed: fileMessage.tokensUsed || null,
        costUsd: fileMessage.costUsd || null,
        durationMs: fileMessage.durationMs || null,
        model: fileMessage.model || null,
        createdAt: new Date(fileMessage.timestamp).getTime(),
        updatedAt: new Date(fileMessage.timestamp).getTime()
      }
    },

    /**
     * Convert file-based ClaudeSessionMetadata to database ClaudeSessionMetadata
     */
    fileSessionMetadataToDbSessionMetadata(fileMetadata: FileClaudeSessionMetadata): DbClaudeSessionMetadata {
      const now = Date.now()
      return {
        id: now, // Generate a unique ID
        sessionId: fileMetadata.sessionId,
        projectPath: fileMetadata.projectPath,
        startTime: fileMetadata.startTime,
        lastUpdate: fileMetadata.lastUpdate,
        messageCount: fileMetadata.messageCount,
        fileSize: fileMetadata.fileSize,
        hasGitBranch: fileMetadata.hasGitBranch,
        hasCwd: fileMetadata.hasCwd,
        firstMessagePreview: fileMetadata.firstMessagePreview || null,
        lastMessagePreview: fileMetadata.lastMessagePreview || null,
        createdAt: now,
        updatedAt: now
      }
    },

    /**
     * Convert file-based TokenUsage to database TokenUsage
     */
    fileTokenUsageToDbTokenUsage(fileTokenUsage: any): DbTokenUsage {
      // Handle both the nested tokenUsage object and direct properties
      if (fileTokenUsage.totalInputTokens !== undefined) {
        return {
          input_tokens: fileTokenUsage.totalInputTokens,
          cache_creation_input_tokens: fileTokenUsage.totalCacheCreationTokens,
          cache_read_input_tokens: fileTokenUsage.totalCacheReadTokens,
          output_tokens: fileTokenUsage.totalOutputTokens,
          service_tier: undefined // Not available in file format
        }
      }
      // Handle direct token usage format (from individual messages)
      return {
        input_tokens: fileTokenUsage.input_tokens,
        cache_creation_input_tokens: fileTokenUsage.cache_creation_input_tokens,
        cache_read_input_tokens: fileTokenUsage.cache_read_input_tokens,
        output_tokens: fileTokenUsage.output_tokens,
        service_tier: fileTokenUsage.service_tier
      }
    }
  }

  /**
   * Get Claude Desktop config path based on platform
   */
  const getClaudeDesktopConfigPath = (): string => {
    if (platform === 'darwin') {
      return path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
    } else if (platform === 'win32') {
      return path.join(os.homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json')
    } else {
      return path.join(os.homedir(), '.config', 'claude', 'claude_desktop_config.json')
    }
  }

  /**
   * Get Claude Code config paths
   */
  const getClaudeCodeConfigPaths = () => {
    return {
      global: path.join(os.homedir(), '.claude.json'),
      local: path.join(os.homedir(), '.claude.json') // Same file but with project-specific sections
    }
  }

  /**
   * Check if configuration has Promptliano server
   */
  const hasPromptlianoServer = (servers: Record<string, any> | undefined): boolean => {
    if (!servers) return false
    return Object.keys(servers).some((key) => key.toLowerCase().includes('promptliano'))
  }

  /**
   * Generate project ID from path
   */
  const generateProjectId = (projectPath: string): string => {
    const hash = createHash('sha256')
    hash.update(projectPath)
    const hexHash = hash.digest('hex')
    const numericHash = parseInt(hexHash.substring(0, 8), 16)
    return Math.abs(numericHash).toString()
  }

  /**
   * Check Claude Desktop installation and configuration
   */
  const checkClaudeDesktop = async (): Promise<ClaudeCodeMCPStatus['claudeDesktop']> => {
    return withErrorContext(
      async () => {
        const configPath = getClaudeDesktopConfigPath()

        try {
          // Check if Claude Desktop is installed
          let installed = false
          if (platform === 'darwin') {
            installed = await MCPFileOps.fileExists('/Applications/Claude.app')
          } else if (platform === 'win32') {
            const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files'
            installed = await MCPFileOps.fileExists(path.join(programFiles, 'Claude', 'Claude.exe'))
          }

          // Check configuration
          const configExists = await MCPFileOps.fileExists(configPath)
          let hasPromptliano = false

          if (configExists) {
            const config = await MCPFileOps.readJsonFile<z.infer<typeof ClaudeDesktopConfigSchema>>(configPath, 'ClaudeDesktop')
            if (config) {
              try {
                const validConfig = ClaudeDesktopConfigSchema.parse(config)
                hasPromptliano = hasPromptlianoServer(validConfig.mcpServers)
              } catch {
                // Invalid config format
              }
            }
          }

          return {
            installed,
            configExists,
            hasPromptliano,
            configPath
          }
        } catch (error) {
          logger.error('Error checking Claude Desktop:', error)
          return {
            installed: false,
            configExists: false,
            hasPromptliano: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      },
      { entity: 'ClaudeDesktop', action: 'checkInstallation' }
    )
  }

  /**
   * Check Claude Code CLI configuration
   */
  const checkClaudeCode = async (projectPath: string): Promise<ClaudeCodeMCPStatus['claudeCode']> => {
    return withErrorContext(
      async () => {
        const paths = getClaudeCodeConfigPaths()
        const projectMCPPath = path.join(projectPath, '.mcp.json')
        const projectId = generateProjectId(projectPath)

        try {
          // Check global config
          const globalConfigExists = await MCPFileOps.fileExists(paths.global)
          let globalHasPromptliano = false

          if (globalConfigExists) {
            const config = await MCPFileOps.readJsonFile<z.infer<typeof ClaudeCodeConfigSchema>>(paths.global, 'ClaudeCode')
            if (config) {
              try {
                const validConfig = ClaudeCodeConfigSchema.parse(config)
                globalHasPromptliano = hasPromptlianoServer(validConfig.mcpServers)
              } catch {
                // Invalid config format
              }
            }
          }

          // Check project config (.mcp.json)
          const projectConfigExists = await MCPFileOps.fileExists(projectMCPPath)
          let projectHasPromptliano = false

          if (projectConfigExists) {
            const config = await MCPFileOps.readJsonFile<z.infer<typeof ProjectMCPConfigSchema>>(projectMCPPath, 'ProjectMCP')
            if (config) {
              try {
                const validConfig = ProjectMCPConfigSchema.parse(config)
                projectHasPromptliano = hasPromptlianoServer(validConfig.mcpServers)
              } catch {
                // Invalid config format
              }
            }
          }

          // Check local config (project-specific section in global config)
          let localHasPromptliano = false
          if (globalConfigExists) {
            const config = await MCPFileOps.readJsonFile<any>(paths.global, 'ClaudeCodeGlobal')
            if (config?.projectBindings?.[projectId]) {
              localHasPromptliano = true
            }
          }

          return {
            globalConfigExists,
            globalHasPromptliano,
            globalConfigPath: paths.global,
            projectConfigExists,
            projectHasPromptliano,
            projectConfigPath: projectMCPPath,
            localConfigExists: globalConfigExists,
            localHasPromptliano,
            localConfigPath: paths.local
          }
        } catch (error) {
          logger.error('Error checking Claude Code:', error)
          return {
            globalConfigExists: false,
            globalHasPromptliano: false,
            projectConfigExists: false,
            projectHasPromptliano: false,
            localConfigExists: false,
            localHasPromptliano: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      },
      { entity: 'ClaudeCode', action: 'checkConfiguration', projectPath }
    )
  }

  /**
   * Get MCP status for Claude Code with caching
   */
  const getMCPStatus = withMCPCache(
    async (projectId: number): Promise<ClaudeCodeMCPStatus> => {
      return withErrorContext(
        async () => {
          const project = await projectService.getById(projectId)
          if (!project) {
            throw MCPErrorFactory.configNotFound('Project', projectId.toString())
          }

          const projectPath = project.path
          const projectIdStr = generateProjectId(projectPath)

          const [claudeDesktop, claudeCode] = await Promise.allSettled([
            checkClaudeDesktop(),
            checkClaudeCode(projectPath)
          ])

          // Generate install command using the actual Promptliano project ID
          const serverUrl = process.env.PROMPTLIANO_SERVER_URL || 'http://localhost:3147/api/mcp'
          const installCommand = `claude add promptliano --url ${serverUrl} --project-id ${projectId} --global`

          return {
            claudeDesktop: claudeDesktop.status === 'fulfilled' ? claudeDesktop.value : {
              installed: false,
              configExists: false,
              hasPromptliano: false,
              error: claudeDesktop.status === 'rejected' ? String(claudeDesktop.reason) : 'Unknown error'
            },
            claudeCode: claudeCode.status === 'fulfilled' ? claudeCode.value : {
              globalConfigExists: false,
              globalHasPromptliano: false,
              projectConfigExists: false,
              projectHasPromptliano: false,
              localConfigExists: false,
              localHasPromptliano: false,
              error: claudeCode.status === 'rejected' ? String(claudeCode.reason) : 'Unknown error'
            },
            projectId: projectIdStr,
            installCommand
          }
        },
        { entity: 'ClaudeCodeMCP', action: 'getMCPStatus', id: projectId }
      )
    },
    enableSessionCaching ? { 
      ttl: (cacheConfig?.ttl ?? 300000) / 2, 
      maxEntries: (cacheConfig?.maxEntries ?? 100), 
      keyGenerator: (projectId) => `status-${projectId}` 
    } : undefined
  )

  /**
   * Get all Claude Code sessions for a project (metadata only for performance)
   */
  const getSessions = async (projectId: number): Promise<DbClaudeSession[]> => {
    return withErrorContext(
      async () => {
        const project = await projectService.getById(projectId)
        if (!project) {
          throw MCPErrorFactory.configNotFound('Project', projectId.toString())
        }

        try {
          // First check if Claude Code is installed
          const isInstalled = await fileReaderService.isClaudeCodeInstalled()
          if (!isInstalled) {
            logger.debug('Claude Code is not installed')
            return []
          }

          // Try to find Claude project that matches
          const claudeProjectPath = await fileReaderService.findProjectByPath(project.path)
          if (!claudeProjectPath) {
            logger.debug(`No Claude Code data found for project: ${project.path}`)
            return []
          }

          // Use optimized method that returns lightweight sessions without loading full message data
          const fileSessions = await fileReaderService.getRecentSessions(claudeProjectPath, 50)

          // Convert file-based sessions to database-compatible sessions
          return fileSessions.map((fileSession: FileClaudeSession) => TypeConverter.fileSessionToDbSession(fileSession, projectId))
        } catch (error) {
          logger.error('Failed to get Claude sessions:', error)
          return []
        }
      },
      { entity: 'ClaudeCodeMCP', action: 'getSessions', id: projectId }
    )
  }

  /**
   * Get recent Claude Code sessions for a project (optimized for performance)
   */
  const getRecentSessions = withMCPCache(
    async (projectId: number, limit: number = 10): Promise<DbClaudeSession[]> => {
      return withErrorContext(
        async () => {
          const project = await projectService.getById(projectId)
          if (!project) {
            throw MCPErrorFactory.configNotFound('Project', projectId.toString())
          }

          try {
            // First check if Claude Code is installed
            const isInstalled = await fileReaderService.isClaudeCodeInstalled()
            if (!isInstalled) {
              logger.debug('Claude Code is not installed')
              return []
            }

            // Try to find Claude project that matches
            const claudeProjectPath = await fileReaderService.findProjectByPath(project.path)
            if (!claudeProjectPath) {
              logger.debug(`No Claude Code data found for project: ${project.path}`)
              return []
            }

            const fileSessions = await fileReaderService.getRecentSessions(claudeProjectPath, limit)

            // Convert file-based sessions to database-compatible sessions
            return fileSessions.map((fileSession: FileClaudeSession) => TypeConverter.fileSessionToDbSession(fileSession, projectId))
          } catch (error) {
            logger.error('Failed to get recent Claude sessions:', error)
            return []
          }
        },
        { entity: 'ClaudeCodeMCP', action: 'getRecentSessions', id: projectId }
      )
    },
    enableSessionCaching ? { 
      ttl: cacheConfig?.ttl || 60000, 
      maxEntries: (cacheConfig?.maxEntries ?? 100), 
      keyGenerator: (projectId, limit) => `recent-${projectId}-${limit}` 
    } : undefined
  )

  /**
   * Get paginated Claude Code sessions for a project
   */
  const getSessionsPaginated = async (
    projectId: number,
    offset: number = 0,
    limit: number = 20
  ): Promise<{ sessions: DbClaudeSession[]; total: number; hasMore: boolean }> => {
    return withErrorContext(
      async () => {
        const project = await projectService.getById(projectId)
        if (!project) {
          throw MCPErrorFactory.configNotFound('Project', projectId.toString())
        }

        try {
          // First check if Claude Code is installed
          const isInstalled = await fileReaderService.isClaudeCodeInstalled()
          if (!isInstalled) {
            logger.debug('Claude Code is not installed')
            return { sessions: [], total: 0, hasMore: false }
          }

          // Try to find Claude project that matches
          const claudeProjectPath = await fileReaderService.findProjectByPath(project.path)
          if (!claudeProjectPath) {
            logger.debug(`No Claude Code data found for project: ${project.path}`)
            return { sessions: [], total: 0, hasMore: false }
          }

          const result = await fileReaderService.getSessionsPaginated(claudeProjectPath, { offset, limit })

          // Convert file-based sessions to database-compatible sessions
          const dbSessions = result.sessions.map((fileSession: FileClaudeSession) =>
            TypeConverter.fileSessionToDbSession(fileSession, projectId)
          )

          return {
            sessions: dbSessions,
            total: result.total,
            hasMore: result.hasMore
          }
        } catch (error) {
          logger.error('Failed to get paginated Claude sessions:', error)
          return { sessions: [], total: 0, hasMore: false }
        }
      },
      { entity: 'ClaudeCodeMCP', action: 'getSessionsPaginated', id: projectId }
    )
  }

  /**
   * Get Claude Code sessions metadata only (fastest, no message loading)
   */
  const getSessionsMetadata = withMCPCache(
    async (projectId: number): Promise<DbClaudeSessionMetadata[]> => {
      return withErrorContext(
        async () => {
          const project = await projectService.getById(projectId)
          if (!project) {
            throw MCPErrorFactory.configNotFound('Project', projectId.toString())
          }

          try {
            // First check if Claude Code is installed
            const isInstalled = await fileReaderService.isClaudeCodeInstalled()
            if (!isInstalled) {
              logger.debug('Claude Code is not installed')
              return []
            }

            // Try to find Claude project that matches
            const claudeProjectPath = await fileReaderService.findProjectByPath(project.path)
            if (!claudeProjectPath) {
              logger.debug(`No Claude Code data found for project: ${project.path}`)
              return []
            }

            const fileMetadata = await fileReaderService.getSessionsMetadata(claudeProjectPath)

            // Convert file-based metadata to database-compatible metadata
            return fileMetadata.map((fileMeta: FileClaudeSessionMetadata) => TypeConverter.fileSessionMetadataToDbSessionMetadata(fileMeta))
          } catch (error) {
            logger.error('Failed to get Claude sessions metadata:', error)
            return []
          }
        },
        { entity: 'ClaudeCodeMCP', action: 'getSessionsMetadata', id: projectId }
      )
    },
    enableSessionCaching ? { 
      ttl: (cacheConfig?.ttl ?? 300000) * 2, 
      maxEntries: (cacheConfig?.maxEntries ?? 100), 
      keyGenerator: (projectId) => `metadata-${projectId}` 
    } : undefined
  )

  /**
   * Get full session data with all messages (use sparingly, loads all message data)
   */
  const getFullSession = async (projectId: number, sessionId: string): Promise<DbClaudeSession | null> => {
    return withErrorContext(
      async () => {
        const project = await projectService.getById(projectId)
        if (!project) {
          throw MCPErrorFactory.configNotFound('Project', projectId.toString())
        }

        try {
          const claudeProjectPath = await fileReaderService.findProjectByPath(project.path)
          if (!claudeProjectPath) {
            return null
          }

          const messages = await fileReaderService.getSessionMessages(claudeProjectPath, sessionId)
          if (messages.length === 0) {
            return null
          }

          const firstMessage = messages[0]
          const lastMessage = messages[messages.length - 1]

          if (!firstMessage || !lastMessage) return null

          // Find most recent git branch and cwd
          let gitBranch: string | undefined, cwd: string | undefined
          for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i]
            if (!gitBranch && msg?.gitBranch) gitBranch = msg.gitBranch
            if (!cwd && msg?.cwd) cwd = msg.cwd
            if (gitBranch && cwd) break
          }

          // Create a file-based session first
          const fileSession: FileClaudeSession = {
            sessionId,
            projectPath: claudeProjectPath,
            startTime: firstMessage.timestamp,
            lastUpdate: lastMessage.timestamp,
            messageCount: messages.length,
            gitBranch: gitBranch || undefined,
            cwd: cwd || undefined,
            tokenUsage: undefined,
            serviceTiers: undefined,
            totalTokensUsed: undefined,
            totalCostUsd: undefined
          }

          // Convert to database-compatible session
          return TypeConverter.fileSessionToDbSession(fileSession, projectId)
        } catch (error) {
          logger.error('Failed to get full session:', error)
          return null
        }
      },
      { entity: 'ClaudeCodeMCP', action: 'getFullSession', id: projectId, sessionId }
    )
  }

  /**
   * Get messages for a specific Claude Code session
   */
  const getSessionMessages = async (projectId: number, sessionId: string): Promise<DbClaudeMessage[]> => {
    return withErrorContext(
      async () => {
        const project = await projectService.getById(projectId)
        if (!project) {
          throw MCPErrorFactory.configNotFound('Project', projectId.toString())
        }

        try {
          const claudeProjectPath = await fileReaderService.findProjectByPath(project.path)
          if (!claudeProjectPath) {
            return []
          }

          // Get file-based messages from Claude Code
          const fileMessages = await fileReaderService.getSessionMessages(claudeProjectPath, sessionId)

          // Convert file messages to database-compatible format
          return fileMessages.map((fileMessage: FileClaudeMessage) => TypeConverter.fileMessageToDbMessage(fileMessage, projectId))
        } catch (error) {
          logger.error('Failed to get session messages:', error)
          return []
        }
      },
      { entity: 'ClaudeCodeMCP', action: 'getSessionMessages', id: projectId, sessionId }
    )
  }

  /**
   * Get Claude Code project data with caching
   */
  const getProjectData = withMCPCache(
    async (projectId: number): Promise<ClaudeProjectData | null> => {
      return withErrorContext(
        async () => {
          const project = await projectService.getById(projectId)
          if (!project) {
            throw MCPErrorFactory.configNotFound('Project', projectId.toString())
          }

          try {
            const claudeProjectPath = await fileReaderService.findProjectByPath(project.path)
            if (!claudeProjectPath) {
              return null
            }

            return await fileReaderService.getProjectData(claudeProjectPath)
          } catch (error) {
            logger.error('Failed to get project data:', error)
            return null
          }
        },
        { entity: 'ClaudeCodeMCP', action: 'getProjectData', id: projectId }
      )
    },
    enableSessionCaching ? { 
      ttl: (cacheConfig?.ttl ?? 300000) * 3, 
      maxEntries: Math.floor((cacheConfig?.maxEntries ?? 100) / 2), 
      keyGenerator: (projectId) => `project-data-${projectId}` 
    } : undefined
  )

  /**
   * Watch for Claude Code chat updates
   */
  const watchChatHistory = (projectId: number, onUpdate: (messages: DbClaudeMessage[]) => void): () => void => {
    let cleanup: (() => void) | null = null

    // Async initialization
    projectService.getById(projectId)
      .then((project) => {
        if (!project) {
          logger.error(`Project ${projectId} not found for chat watcher`)
          return
        }

        fileReaderService.findProjectByPath(project.path).then((claudeProjectPath: string | null) => {
          if (claudeProjectPath) {
            // Wrap the callback to convert file messages to database format
            cleanup = fileReaderService.watchChatHistory(claudeProjectPath, (fileMessages: FileClaudeMessage[]) => {
              // Convert file messages to database-compatible format
              const dbMessages = fileMessages.map((fileMessage: FileClaudeMessage) =>
                TypeConverter.fileMessageToDbMessage(fileMessage, projectId)
              )
              onUpdate(dbMessages)
            })
          }
        })
      })
      .catch((error) => {
        logger.error('Failed to set up chat watcher:', error)
      })

    // Return cleanup function
    return () => {
      if (cleanup) {
        cleanup()
      }
    }
  }

  return {
    getMCPStatus,
    getSessions,
    getRecentSessions,
    getSessionsPaginated,
    getSessionsMetadata,
    getFullSession,
    getSessionMessages,
    getProjectData,
    watchChatHistory
  }
}

// Create singleton instance
export const claudeCodeMCPService = createClaudeCodeMCPService()

// Export factory function for consistency
export function createClaudeCodeMCPServiceLegacy(): ClaudeCodeMCPService {
  return claudeCodeMCPService
}

// Export types for consumers
export type { ClaudeCodeMCPService as ClaudeCodeMCPServiceType }