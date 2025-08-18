import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { createReadStream, existsSync } from 'fs'
import { createInterface } from 'readline'
import { watch } from 'chokidar'
import { z } from 'zod'
import {
  ClaudeMessageSchema,
  ClaudeMessageLenientSchema,
  ClaudeSessionSchema,
  ClaudeSessionMetadataSchema,
  ClaudeSessionCursorSchema,
  ClaudeProjectDataSchema,
  type ClaudeMessage,
  type ClaudeMessageLenient,
  type ClaudeSession,
  type ClaudeSessionMetadata,
  type ClaudeSessionCursor,
  type ClaudeProjectData
} from '@promptliano/schemas'
import { createLogger } from './utils/logger'
import { ApiError } from '@promptliano/shared'
import { ErrorFactory, withErrorContext, createEntityErrorFactory } from './utils/error-factory'
import { withCache } from './utils/service-helpers'

const logger = createLogger('ClaudeCodeFileReaderService')

export class ClaudeCodeFileReaderService {
  private readonly platform = process.platform
  private readonly sessionErrors = createEntityErrorFactory('session')
  
  // Cache for file stats to avoid repeated filesystem calls
  private readonly getFileStatsCache = withCache(
    this.getFileStats.bind(this),
    { ttl: 30000 } // Cache for 30 seconds
  )

  /**
   * Get Claude Code config directory based on platform
   */
  getClaudeConfigDir(): string {
    const home = os.homedir()

    switch (this.platform) {
      case 'darwin':
        return path.join(home, '.claude')
      case 'linux':
        // Check new location first, fall back to legacy
        const newPath = path.join(home, '.config', 'claude')
        const legacyPath = path.join(home, '.claude')
        return existsSync(newPath) ? newPath : legacyPath
      case 'win32':
        return path.join(process.env.APPDATA || home, 'Claude')
      default:
        return path.join(home, '.claude')
    }
  }

  /**
   * Encode project path for Claude's directory structure
   */
  encodeProjectPath(projectPath: string): string {
    // Replace all path separators with hyphens
    return projectPath.replace(/[/\\]/g, '-')
  }

  /**
   * Decode Claude's encoded path back to original
   */
  decodeProjectPath(encodedPath: string): string {
    // This is lossy - we can't perfectly reconstruct the original path
    // But we can make a reasonable guess based on platform
    if (this.platform === 'win32' && encodedPath.startsWith('C--')) {
      return encodedPath.replace(/^C--/, 'C:\\').replace(/-/g, '\\')
    }
    return encodedPath.replace(/-/g, '/')
  }

  /**
   * Check if Claude Code is installed and accessible
   */
  async isClaudeCodeInstalled(): Promise<boolean> {
    try {
      const configDir = this.getClaudeConfigDir()
      await fs.access(configDir)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get all project directories in Claude config
   */
  async getClaudeProjects(): Promise<string[]> {
    const configDir = this.getClaudeConfigDir()
    const projectsDir = path.join(configDir, 'projects')

    try {
      const entries = await fs.readdir(projectsDir, { withFileTypes: true })
      return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
    } catch (error) {
      logger.debug('Failed to read Claude projects directory:', error)
      return []
    }
  }

  /**
   * Sanitize data for safe logging (remove sensitive content, truncate large fields)
   */
  private sanitizeForLogging(data: any): any {
    if (!data || typeof data !== 'object') {
      return data
    }

    const sanitized: any = { ...data }
    
    // Truncate content fields to prevent log spam
    if (sanitized.content && typeof sanitized.content === 'string' && sanitized.content.length > 200) {
      sanitized.content = sanitized.content.substring(0, 200) + '...[truncated]'
    }
    
    if (sanitized.message?.content && typeof sanitized.message.content === 'string' && sanitized.message.content.length > 200) {
      sanitized.message.content = sanitized.message.content.substring(0, 200) + '...[truncated]'
    }
    
    // Remove potentially sensitive tool inputs
    if (sanitized.message?.input) {
      sanitized.message.input = '[REDACTED]'
    }
    
    // Truncate arrays to first few items
    Object.keys(sanitized).forEach(key => {
      if (Array.isArray(sanitized[key]) && sanitized[key].length > 3) {
        sanitized[key] = sanitized[key].slice(0, 3).concat(['...[truncated]'])
      }
    })
    
    return sanitized
  }

  /**
   * Parse a single JSONL line into a Claude message
   */
  private parseJsonLine(line: string): ClaudeMessage | null {
    if (!line.trim()) return null

    try {
      const data = JSON.parse(line)
      
      // First try strict validation for well-formed messages
      const strictValidation = ClaudeMessageSchema.safeParse(data)
      if (strictValidation.success) {
        return strictValidation.data
      }

      // Fall back to lenient validation for third-party data
      const lenientValidation = ClaudeMessageLenientSchema.safeParse(data)
      if (lenientValidation.success) {
        const normalized = this.normalizeClaudeMessage(lenientValidation.data)
        
        // Enhanced debugging for strict validation failures
        const strictErrors = strictValidation.error?.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
          expected: 'expected' in issue ? issue.expected : undefined,
          received: 'received' in issue ? issue.received : undefined
        })) || []
        
        logger.debug('Used lenient validation for Claude message:', {
          sessionId: normalized.sessionId,
          timestamp: normalized.timestamp,
          strictErrorsDetailed: strictErrors,
          originalData: this.sanitizeForLogging(data)
        })
        return normalized
      } else {
        // Enhanced debugging for both validation failures
        const strictErrors = strictValidation.error?.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
          expected: 'expected' in issue ? issue.expected : undefined,
          received: 'received' in issue ? issue.received : undefined
        })) || []
        
        const lenientErrors = lenientValidation.error?.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
          expected: 'expected' in issue ? issue.expected : undefined,
          received: 'received' in issue ? issue.received : undefined
        })) || []
        
        logger.debug('Failed to parse Claude message with both strict and lenient validation:', {
          strictErrorsDetailed: strictErrors,
          lenientErrorsDetailed: lenientErrors,
          originalData: this.sanitizeForLogging(data)
        })
        
        // Fallback to raw session info extraction
        return this.extractRawSessionInfo(data)
      }
    } catch (error) {
      logger.debug('Failed to parse JSONL line:', {
        error: error instanceof Error ? error.message : String(error),
        lineLength: line.length,
        linePreview: line.substring(0, 100) + (line.length > 100 ? '...' : '')
      })
      
      // Try to extract session info even from malformed JSON
      return this.extractRawSessionInfoFromString(line)
    }
  }

  /**
   * Extract minimal session information from malformed data
   */
  private extractRawSessionInfo(data: any): ClaudeMessage | null {
    try {
      // Try to extract basic required fields for session metadata
      const sessionId = this.extractFieldValue(data, ['sessionId', 'session_id', 'id']) || 'unknown'
      const timestamp = this.extractFieldValue(data, ['timestamp', 'time', 'created_at', 'createdAt']) || new Date().toISOString()
      
      // Extract message content from various possible locations
      let content = ''
      if (data.content) {
        content = String(data.content)
      } else if (data.message?.content) {
        content = String(data.message.content)
      } else if (data.text) {
        content = String(data.text)
      }
      
      // Create minimal valid message
      return {
        type: 'assistant' as const,
        message: {
          role: 'assistant' as const,
          content: content.substring(0, 1000) // Limit content length
        },
        timestamp,
        sessionId: String(sessionId),
        uuid: undefined,
        parentUuid: undefined,
        requestId: undefined,
        userType: undefined,
        isSidechain: undefined,
        cwd: this.extractFieldValue(data, ['cwd', 'workingDirectory']),
        version: undefined,
        gitBranch: this.extractFieldValue(data, ['gitBranch', 'git_branch', 'branch']),
        toolUseResult: undefined,
        content: undefined,
        isMeta: undefined,
        toolUseID: undefined,
        level: undefined,
        tokensUsed: undefined,
        costUsd: undefined,
        durationMs: undefined,
        model: undefined
      }
    } catch (error) {
      logger.debug('Failed to extract raw session info:', error)
      return null
    }
  }

  /**
   * Extract minimal session information from malformed JSON string
   */
  private extractRawSessionInfoFromString(line: string): ClaudeMessage | null {
    try {
      // Use regex patterns to extract common fields
      const sessionIdMatch = line.match(/"sessionId"\s*:\s*"([^"]+)"/)
      const timestampMatch = line.match(/"timestamp"\s*:\s*"([^"]+)"/)
      const gitBranchMatch = line.match(/"gitBranch"\s*:\s*"([^"]+)"/)
      const cwdMatch = line.match(/"cwd"\s*:\s*"([^"]+)"/)
      
      if (!sessionIdMatch && !timestampMatch) {
        // Can't extract any useful session info
        return null
      }
      
      return {
        type: 'assistant' as const,
        message: {
          role: 'assistant' as const,
          content: '[Malformed message data]'
        },
        timestamp: timestampMatch?.[1] || new Date().toISOString(),
        sessionId: sessionIdMatch?.[1] || 'unknown',
        uuid: undefined,
        parentUuid: undefined,
        requestId: undefined,
        userType: undefined,
        isSidechain: undefined,
        cwd: cwdMatch?.[1],
        version: undefined,
        gitBranch: gitBranchMatch?.[1],
        toolUseResult: undefined,
        content: undefined,
        isMeta: undefined,
        toolUseID: undefined,
        level: undefined,
        tokensUsed: undefined,
        costUsd: undefined,
        durationMs: undefined,
        model: undefined
      }
    } catch (error) {
      logger.debug('Failed to extract session info from string:', error)
      return null
    }
  }

  /**
   * Safely extract field value from nested object
   */
  private extractFieldValue(data: any, fieldPaths: string[]): string | undefined {
    for (const path of fieldPaths) {
      try {
        const value = data[path]
        if (value !== null && value !== undefined) {
          return String(value)
        }
      } catch {
        // Continue to next path
      }
    }
    return undefined
  }

  /**
   * Normalize lenient Claude message data to match strict schema expectations
   */
  private normalizeClaudeMessage(lenientMessage: ClaudeMessageLenient): ClaudeMessage {
    // Normalize null values to undefined for optional fields
    const nullToUndefined = <T>(value: T | null | undefined): T | undefined => 
      value === null ? undefined : value

    // Convert various types to string for string fields (or undefined)
    const toStringOrUndefined = (value: any): string | undefined => {
      if (value === null || value === undefined || value === '') return undefined
      if (typeof value === 'string') return value
      if (typeof value === 'number' || typeof value === 'boolean') return String(value)
      if (value instanceof Date) return value.toISOString()
      if (typeof value === 'symbol') return value.toString()
      if (typeof value === 'object') return JSON.stringify(value)
      return String(value)
    }

    // Convert various types to boolean for boolean fields
    const toBooleanOrUndefined = (value: any): boolean | undefined => {
      if (value === null || value === undefined) return undefined
      if (typeof value === 'boolean') return value
      if (typeof value === 'string') {
        const lower = value.toLowerCase()
        if (lower === 'true' || lower === '1') return true
        if (lower === 'false' || lower === '0') return false
        return Boolean(value)
      }
      return Boolean(value)
    }

    // Normalize toolUseResult: handle various formats
    let toolUseResult: any = lenientMessage.toolUseResult
    if (typeof toolUseResult === 'string') {
      try {
        toolUseResult = JSON.parse(toolUseResult)
      } catch {
        // If it's not valid JSON, wrap it in an object
        toolUseResult = { data: toolUseResult }
      }
    } else if (Array.isArray(toolUseResult)) {
      // Convert arrays to objects
      toolUseResult = { items: toolUseResult }
    }
    // null values are preserved as they're now allowed in the schema

    // Normalize message field - handle different formats
    let messageData: any = lenientMessage.message
    
    // If there's no message object but there's top-level content, create a message object
    if (!messageData && lenientMessage.content) {
      messageData = {
        role: lenientMessage.type === 'system' ? 'system' : 'assistant',
        content: lenientMessage.content
      }
    } else if (!messageData) {
      messageData = {}
    }
    
    if (typeof messageData === 'string') {
      // If message is a string, create a message object with that content
      messageData = {
        role: 'assistant',
        content: messageData
      }
    } else if (Array.isArray(messageData)) {
      // If message is an array, treat it as content
      messageData = {
        role: 'assistant',
        content: messageData
      }
    }

    // Ensure message has the required structure
    const normalizedMessage = {
      role: (messageData.role || (lenientMessage.type === 'system' ? 'system' : 'assistant')).toLowerCase(),
      content: messageData.content ?? lenientMessage.content ?? '', // Handle top-level content fallback
      id: nullToUndefined(messageData.id),
      model: nullToUndefined(messageData.model),
      stop_reason: messageData.stop_reason,
      stop_sequence: messageData.stop_sequence,
      usage: messageData.usage
    }

    // Normalize message type - keep 'system' and 'summary' as they're now valid
    let normalizedType = (lenientMessage.type || 'assistant').toLowerCase()
    
    // Handle any unknown types by defaulting to 'assistant'
    if (!['user', 'assistant', 'result', 'system', 'summary'].includes(normalizedType)) {
      normalizedType = 'assistant'
    }

    // Return normalized message that should pass strict validation
    return {
      type: normalizedType as 'user' | 'assistant' | 'result' | 'system' | 'summary',
      message: normalizedMessage,
      timestamp: (typeof lenientMessage.timestamp === 'string' ? lenientMessage.timestamp : null) || new Date().toISOString(),
      sessionId: (typeof lenientMessage.sessionId === 'string' ? lenientMessage.sessionId : null) || 'unknown',
      uuid: toStringOrUndefined(lenientMessage.uuid),
      parentUuid: toStringOrUndefined(lenientMessage.parentUuid),
      requestId: toStringOrUndefined(lenientMessage.requestId),
      userType: toStringOrUndefined(lenientMessage.userType),
      isSidechain: toBooleanOrUndefined(lenientMessage.isSidechain),
      cwd: toStringOrUndefined(lenientMessage.cwd),
      version: toStringOrUndefined(lenientMessage.version),
      gitBranch: toStringOrUndefined(lenientMessage.gitBranch),
      toolUseResult,
      // Additional fields from real Claude Code data
      content: lenientMessage.content ? lenientMessage.content : undefined,
      isMeta: lenientMessage.isMeta,
      toolUseID: toStringOrUndefined(lenientMessage.toolUseID),
      level: toStringOrUndefined(lenientMessage.level),
      // Legacy fields - these are already coerced by Zod
      tokensUsed: nullToUndefined(lenientMessage.tokensUsed),
      costUsd: nullToUndefined(lenientMessage.costUsd),
      durationMs: nullToUndefined(lenientMessage.durationMs),
      model: nullToUndefined(lenientMessage.model)
    } as ClaudeMessage
  }

  /**
   * Read all chat messages for a project
   */
  async readChatHistory(projectPath: string): Promise<ClaudeMessage[]> {
    const configDir = this.getClaudeConfigDir()
    const encodedPath = this.encodeProjectPath(projectPath)
    const projectDir = path.join(configDir, 'projects', encodedPath)

    if (!existsSync(projectDir)) {
      logger.debug(`No Claude data found for project: ${projectPath}`)
      return []
    }

    const messages: ClaudeMessage[] = []

    try {
      const files = await fs.readdir(projectDir)
      const jsonlFiles = files.filter((file) => file.endsWith('.jsonl'))

      for (const file of jsonlFiles) {
        const filePath = path.join(projectDir, file)
        const fileMessages = await this.readJsonlFile(filePath)
        messages.push(...fileMessages)
      }

      // Sort by timestamp
      return messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    } catch (error) {
      logger.error('Failed to read chat history:', error)
      throw new ApiError(500, 'Failed to read Claude chat history')
    }
  }

  /**
   * Read a single JSONL file
   */
  private async readJsonlFile(filePath: string): Promise<ClaudeMessage[]> {
    const messages: ClaudeMessage[] = []

    return new Promise((resolve, reject) => {
      const fileStream = createReadStream(filePath)
      const rl = createInterface({
        input: fileStream,
        crlfDelay: Infinity
      })

      rl.on('line', (line) => {
        const message = this.parseJsonLine(line)
        if (message) {
          messages.push(message)
        }
      })

      rl.on('close', () => resolve(messages))
      rl.on('error', reject)
    })
  }

  /**
   * Get basic file stats for performance optimization
   */
  private async getFileStats(filePath: string): Promise<{ size: number; mtime: Date } | null> {
    try {
      const stats = await fs.stat(filePath)
      return {
        size: stats.size,
        mtime: stats.mtime
      }
    } catch (error) {
      return null
    }
  }

  /**
   * Read first and last non-empty lines from a JSONL file efficiently
   */
  private async getFileFirstLastLines(filePath: string): Promise<{
    firstLine: string | null
    lastLine: string | null
    lineCount: number
  }> {
    return new Promise((resolve, reject) => {
      let fileStream: any
      let rl: any
      let hasResolved = false

      // Enhanced cleanup function
      const cleanup = () => {
        if (hasResolved) return
        
        try {
          if (rl) {
            rl.close()
            rl.removeAllListeners()
          }
        } catch (e) {
          // Ignore cleanup errors
        }
        
        try {
          if (fileStream) {
            fileStream.destroy()
            fileStream.removeAllListeners()
          }
        } catch (e) {
          // Ignore cleanup errors
        }
      }

      // Safe resolve function
      const safeResolve = (result: { firstLine: string | null; lastLine: string | null; lineCount: number }) => {
        if (hasResolved) return
        hasResolved = true
        cleanup()
        resolve(result)
      }

      // Safe reject function
      const safeReject = (error: Error) => {
        if (hasResolved) return
        hasResolved = true
        cleanup()
        reject(error)
      }

      try {
        fileStream = createReadStream(filePath, { 
          encoding: 'utf8',
          highWaterMark: 64 * 1024 // 64KB buffer for better performance
        })
        
        rl = createInterface({
          input: fileStream,
          crlfDelay: Infinity
        })

        let firstLine: string | null = null
        let lastLine: string | null = null
        let lineCount = 0
        let totalLinesProcessed = 0
        const maxLinesToProcess = 100000 // Prevent memory issues with very large files

        rl.on('line', (line: string) => {
          totalLinesProcessed++
          
          // Prevent processing too many lines to avoid memory issues
          if (totalLinesProcessed > maxLinesToProcess) {
            logger.warn(`File ${filePath} has too many lines, stopping at ${maxLinesToProcess}`)
            timeoutSafeResolve({ firstLine, lastLine, lineCount })
            return
          }

          const trimmedLine = line.trim()
          if (trimmedLine && trimmedLine.length > 0) {
            if (!firstLine) {
              firstLine = trimmedLine
            }
            lastLine = trimmedLine
            lineCount++
          }
        })

        rl.on('close', () => {
          // Handle edge cases
          if (lineCount === 0) {
            logger.debug(`No valid lines found in file: ${filePath}`)
          }
          timeoutSafeResolve({ firstLine, lastLine, lineCount })
        })

        rl.on('error', (error: Error) => {
          logger.debug(`Error reading lines from file ${filePath}:`, error)
          timeoutSafeReject(new Error(`Failed to read file lines: ${error.message}`))
        })

        // Handle file stream errors
        fileStream.on('error', (error: Error) => {
          logger.debug(`File stream error for ${filePath}:`, error)
          timeoutSafeReject(new Error(`File stream error: ${error.message}`))
        })

        // Add timeout to prevent hanging
        const timeout = setTimeout(() => {
          logger.warn(`Timeout reading file: ${filePath}`)
          timeoutSafeReject(new Error(`Timeout reading file: ${filePath}`))
        }, 30000) // 30 second timeout

        // Store original functions and create new ones that clear timeout
        const originalResolve = safeResolve
        const originalReject = safeReject
        
        const timeoutSafeResolve = (result: { firstLine: string | null; lastLine: string | null; lineCount: number }) => {
          clearTimeout(timeout)
          originalResolve(result)
        }
        
        const timeoutSafeReject = (error: Error) => {
          clearTimeout(timeout)
          originalReject(error)
        }

      } catch (error) {
        logger.debug(`Failed to create file stream for ${filePath}:`, error)
        safeReject(new Error(`Failed to create file stream: ${error instanceof Error ? error.message : String(error)}`))
      }
    })
  }

  /**
   * Create session metadata from first and last message lines without loading all messages
   */
  private createSessionMetadataFromLines(
    projectPath: string,
    firstLine: string | null,
    lastLine: string | null,
    lineCount: number,
    fileSize: number
  ): ClaudeSessionMetadata | null {
    if (!firstLine || !lastLine) {
      // Try to create minimal metadata even with missing lines
      return this.createMinimalMetadata(projectPath, firstLine || lastLine, lineCount, fileSize)
    }

    try {
      const firstMessage = this.parseJsonLine(firstLine)
      const lastMessage = lineCount === 1 ? firstMessage : this.parseJsonLine(lastLine)

      // Handle cases where parsing fails but we still have line data
      if (!firstMessage && !lastMessage) {
        return this.createMinimalMetadata(projectPath, firstLine, lineCount, fileSize)
      }

      // Use the available message data, even if one is null
      const validFirstMessage = firstMessage || lastMessage
      const validLastMessage = lastMessage || firstMessage

      if (!validFirstMessage || !validLastMessage) {
        return this.createMinimalMetadata(projectPath, firstLine, lineCount, fileSize)
      }

      return ClaudeSessionMetadataSchema.parse({
        sessionId: validFirstMessage.sessionId,
        projectPath,
        startTime: validFirstMessage.timestamp,
        lastUpdate: validLastMessage.timestamp,
        messageCount: lineCount,
        fileSize,
        hasGitBranch: Boolean(validFirstMessage.gitBranch || validLastMessage.gitBranch),
        hasCwd: Boolean(validFirstMessage.cwd || validLastMessage.cwd),
        firstMessagePreview: validFirstMessage.message?.content
          ? String(validFirstMessage.message.content).substring(0, 100)
          : undefined,
        lastMessagePreview: validLastMessage.message?.content
          ? String(validLastMessage.message.content).substring(0, 100)
          : undefined
      })
    } catch (error) {
      logger.debug('Failed to create session metadata from lines, falling back to minimal metadata:', {
        error: error instanceof Error ? error.message : String(error),
        projectPath,
        lineCount,
        fileSize
      })
      return this.createMinimalMetadata(projectPath, firstLine, lineCount, fileSize)
    }
  }

  /**
   * Create minimal metadata when parsing fails
   */
  private createMinimalMetadata(
    projectPath: string,
    availableLine: string | null,
    lineCount: number,
    fileSize: number
  ): ClaudeSessionMetadata | null {
    if (!availableLine) return null
    
    // Check if the line has any JSON-like structure before attempting fallback
    // If it doesn't contain basic JSON patterns, return null
    const hasJsonStructure = availableLine.includes('{') && availableLine.includes('}') && availableLine.includes('"')
    if (!hasJsonStructure) {
      logger.debug('Line does not contain JSON structure, skipping minimal metadata creation:', {
        linePreview: availableLine.substring(0, 100)
      })
      return null
    }

    try {
      // Extract basic session info using regex patterns as fallback
      const sessionIdMatch = availableLine.match(/"sessionId"\s*:\s*"([^"]+)"/)
      const timestampMatch = availableLine.match(/"timestamp"\s*:\s*"([^"]+)"/)
      const gitBranchMatch = availableLine.match(/"gitBranch"\s*:\s*"([^"]+)"/)
      const cwdMatch = availableLine.match(/"cwd"\s*:\s*"([^"]+)"/)
      
      // If we can't extract any meaningful JSON properties, return null
      if (!sessionIdMatch && !timestampMatch) {
        logger.debug('No extractable JSON properties found, cannot create minimal metadata')
        return null
      }

      // Generate fallback values if we can't extract from the line
      const sessionId = sessionIdMatch?.[1] || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const timestamp = timestampMatch?.[1] || new Date().toISOString()

      return ClaudeSessionMetadataSchema.parse({
        sessionId,
        projectPath,
        startTime: timestamp,
        lastUpdate: timestamp,
        messageCount: lineCount,
        fileSize,
        hasGitBranch: Boolean(gitBranchMatch?.[1]),
        hasCwd: Boolean(cwdMatch?.[1]),
        firstMessagePreview: '[Unable to parse message content]',
        lastMessagePreview: lineCount === 1 ? '[Unable to parse message content]' : undefined
      })
    } catch (error) {
      logger.debug('Failed to create minimal metadata:', {
        error: error instanceof Error ? error.message : String(error),
        projectPath,
        lineCount,
        fileSize,
        linePreview: availableLine?.substring(0, 100)
      })
      return null
    }
  }

  /**
   * Check if a JSONL file contains session data (not just a summary)
   * Returns true if the file contains actual session messages
   */
  private async isSessionFile(filePath: string): Promise<boolean> {
    try {
      const readStream = createReadStream(filePath, { encoding: 'utf8' })
      const rl = createInterface({
        input: readStream,
        crlfDelay: Infinity
      })

      // Read only the first line to determine file type
      for await (const line of rl) {
        const trimmedLine = line.trim()
        if (!trimmedLine) continue

        try {
          const firstLineData = JSON.parse(trimmedLine)
          
          // Check if it's a summary file (which we should skip)
          if (firstLineData.type === 'summary') {
            rl.close()
            readStream.destroy()
            return false
          }
          
          // Check if it has session data fields
          if (firstLineData.sessionId || firstLineData.message) {
            rl.close()
            readStream.destroy()
            return true
          }
        } catch (parseError) {
          // If first line can't be parsed as JSON, it's likely not a valid session file
          logger.debug(`First line of ${filePath} is not valid JSON, skipping`)
          rl.close()
          readStream.destroy()
          return false
        }

        // Only check the first non-empty line
        break
      }

      rl.close()
      readStream.destroy()
      return false
    } catch (error) {
      logger.debug(`Failed to check file type for ${filePath}:`, error)
      return false
    }
  }

  /**
   * Get lightweight session metadata without loading all messages
   * This is the fastest way to get session information
   */
  async getSessionsMetadata(projectPath: string): Promise<ClaudeSessionMetadata[]> {
    return withErrorContext(
      async () => {
        const configDir = this.getClaudeConfigDir()
        const encodedPath = this.encodeProjectPath(projectPath)
        const projectDir = path.join(configDir, 'projects', encodedPath)

        if (!existsSync(projectDir)) {
          logger.debug(`No Claude data found for project: ${projectPath}`)
          return []
        }

        let files: string[] = []
        try {
          files = await fs.readdir(projectDir)
        } catch (error) {
          logger.warn(`Failed to read directory ${projectDir}:`, error)
          return []
        }

        const jsonlFiles = files.filter((file) => file.endsWith('.jsonl'))
        
        if (jsonlFiles.length === 0) {
          logger.debug(`No JSONL files found in directory: ${projectDir}`)
          return []
        }

        logger.debug(`Found ${jsonlFiles.length} JSONL files in ${projectDir}`)
        
        // Filter out summary files early to avoid wasted processing
        const sessionFileCheckPromises = jsonlFiles.map(async (file) => {
          const filePath = path.join(projectDir, file)
          const isSession = await this.isSessionFile(filePath)
          return { file, filePath, isSession }
        })

        const fileChecks = await Promise.all(sessionFileCheckPromises)
        const sessionFiles = fileChecks.filter(check => check.isSession)
        const summaryFiles = fileChecks.filter(check => !check.isSession)

        logger.debug(`File filtering results:`, {
          totalFiles: jsonlFiles.length,
          sessionFiles: sessionFiles.length,
          summaryFiles: summaryFiles.length,
          projectPath
        })

        if (sessionFiles.length === 0) {
          logger.debug(`No valid session files found in directory: ${projectDir}`)
          return []
        }

        const metadataList: ClaudeSessionMetadata[] = []
        let successCount = 0
        let errorCount = 0

        // Process only the valid session files
        const metadataPromises = sessionFiles.map(async ({ file, filePath }) => {
          
          try {
            // Get file stats efficiently
            const stats = await this.getFileStatsCache(filePath) as { size: number; mtime: Date } | null
            if (!stats) {
              logger.debug(`Failed to get stats for file: ${filePath}`)
              return null
            }

            // Get first and last lines efficiently
            const { firstLine, lastLine, lineCount } = await this.getFileFirstLastLines(filePath)
            
            if (lineCount === 0) {
              logger.debug(`No valid lines found in file: ${filePath}`)
              return null
            }

            const metadata = this.createSessionMetadataFromLines(
              projectPath,
              firstLine,
              lastLine,
              lineCount,
              stats.size
            )

            if (metadata) {
              successCount++
              return metadata
            } else {
              errorCount++
              logger.debug(`Failed to create metadata for file: ${filePath}`)
              return null
            }
          } catch (error) {
            errorCount++
            logger.debug(`Error processing file ${filePath}:`, {
              error: error instanceof Error ? error.message : String(error),
              file
            })
            return null
          }
        })

        const results = await Promise.allSettled(metadataPromises)
        
        // Process results and handle any rejected promises
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value) {
            metadataList.push(result.value)
          } else if (result.status === 'rejected') {
            errorCount++
            logger.debug('Promise rejected while processing metadata:', result.reason)
          }
        }

        logger.debug(`Metadata processing complete:`, {
          totalFiles: jsonlFiles.length,
          sessionFilesProcessed: sessionFiles.length,
          summaryFilesSkipped: summaryFiles.length,
          successCount,
          errorCount,
          metadataCount: metadataList.length,
          projectPath
        })

        // Sort by last update time (most recent first)
        const sortedMetadata = metadataList.sort((a, b) => 
          new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime()
        )

        // If we got no metadata but had files, log a warning
        if (sortedMetadata.length === 0 && jsonlFiles.length > 0) {
          logger.warn(`No valid session metadata extracted from ${jsonlFiles.length} JSONL files in ${projectDir}. This may indicate malformed data or parsing issues.`)
        }

        return sortedMetadata
      },
      { entity: 'session', action: 'getMetadata' }
    )
  }

  /**
   * Get sessions with pagination support (offset-based)
   */
  async getSessionsPaginated(
    projectPath: string,
    options: {
      limit?: number
      offset?: number
      sortBy?: 'lastUpdate' | 'startTime' | 'messageCount'
      sortOrder?: 'asc' | 'desc'
      search?: string
    } = {}
  ): Promise<{ sessions: ClaudeSession[]; total: number; hasMore: boolean }> {
    return withErrorContext(
      async () => {
        const { limit = 20, offset = 0, sortBy = 'lastUpdate', sortOrder = 'desc', search } = options

        // First get lightweight metadata to determine which sessions to load
        const allMetadata = await this.getSessionsMetadata(projectPath)
        
        // Apply search filter if provided
        let filteredMetadata = allMetadata
        if (search) {
          const searchLower = search.toLowerCase()
          filteredMetadata = allMetadata.filter(meta => 
            meta.sessionId.toLowerCase().includes(searchLower) ||
            meta.firstMessagePreview?.toLowerCase().includes(searchLower) ||
            meta.lastMessagePreview?.toLowerCase().includes(searchLower)
          )
        }

        // Apply sorting
        filteredMetadata.sort((a, b) => {
          let comparison = 0
          switch (sortBy) {
            case 'startTime':
              comparison = new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
              break
            case 'messageCount':
              comparison = a.messageCount - b.messageCount
              break
            case 'lastUpdate':
            default:
              comparison = new Date(a.lastUpdate).getTime() - new Date(b.lastUpdate).getTime()
              break
          }
          return sortOrder === 'desc' ? -comparison : comparison
        })

        const total = filteredMetadata.length
        const paginatedMetadata = filteredMetadata.slice(offset, offset + limit)
        
        // Convert metadata directly to lightweight sessions (no message loading)
        const sessions = paginatedMetadata.map(metadata => this.createSessionFromMetadata(metadata))

        return {
          sessions,
          total,
          hasMore: offset + limit < total
        }
      },
      { entity: 'session', action: 'getPaginated' }
    )
  }

  /**
   * Get recent sessions (optimized for fastest loading)
   * Returns lightweight session data - use getSessionWithMessages() for full data
   */
  async getRecentSessions(
    projectPath: string,
    limit: number = 10
  ): Promise<ClaudeSession[]> {
    return withErrorContext(
      async () => {
        // Use metadata-based approach for fastest loading
        const metadata = await this.getSessionsMetadata(projectPath)
        
        // Take the most recent sessions (already sorted by lastUpdate desc)
        const recentMetadata = metadata.slice(0, limit)
        
        // Convert metadata directly to lightweight sessions (no message loading)
        return recentMetadata.map(meta => this.createSessionFromMetadata(meta))
      },
      { entity: 'session', action: 'getRecent' }
    )
  }

  /**
   * Get sessions with cursor-based pagination for better performance
   */
  async getSessionsCursor(
    projectPath: string,
    cursor: ClaudeSessionCursor
  ): Promise<{
    sessions: ClaudeSession[]
    nextCursor?: string
    hasMore: boolean
  }> {
    return withErrorContext(
      async () => {
        const { limit = 20, sortBy = 'lastUpdate', sortOrder = 'desc', search } = cursor

        // Get all metadata first
        const allMetadata = await this.getSessionsMetadata(projectPath)
        
        // Apply search filter
        let filteredMetadata = allMetadata
        if (search) {
          const searchLower = search.toLowerCase()
          filteredMetadata = allMetadata.filter(meta => 
            meta.sessionId.toLowerCase().includes(searchLower) ||
            meta.firstMessagePreview?.toLowerCase().includes(searchLower) ||
            meta.lastMessagePreview?.toLowerCase().includes(searchLower)
          )
        }

        // Apply date filters
        if (cursor.startDate || cursor.endDate) {
          filteredMetadata = filteredMetadata.filter(meta => {
            const metaDate = new Date(meta.lastUpdate)
            if (cursor.startDate && metaDate < new Date(cursor.startDate)) return false
            if (cursor.endDate && metaDate > new Date(cursor.endDate)) return false
            return true
          })
        }

        // Sort metadata
        filteredMetadata.sort((a, b) => {
          let comparison = 0
          switch (sortBy) {
            case 'startTime':
              comparison = new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
              break
            case 'messageCount':
              comparison = a.messageCount - b.messageCount
              break
            case 'fileSize':
              comparison = a.fileSize - b.fileSize
              break
            case 'lastUpdate':
            default:
              comparison = new Date(a.lastUpdate).getTime() - new Date(b.lastUpdate).getTime()
              break
          }
          return sortOrder === 'desc' ? -comparison : comparison
        })

        // Handle cursor-based pagination
        let startIndex = 0
        if (cursor.cursor) {
          try {
            const decodedCursor = JSON.parse(Buffer.from(cursor.cursor, 'base64').toString())
            const cursorValue = decodedCursor.value
            
            // Find the starting position based on cursor
            startIndex = filteredMetadata.findIndex(meta => {
              switch (sortBy) {
                case 'startTime':
                  return sortOrder === 'desc' 
                    ? new Date(meta.startTime).getTime() < cursorValue
                    : new Date(meta.startTime).getTime() > cursorValue
                case 'messageCount':
                  return sortOrder === 'desc' ? meta.messageCount < cursorValue : meta.messageCount > cursorValue
                case 'fileSize':
                  return sortOrder === 'desc' ? meta.fileSize < cursorValue : meta.fileSize > cursorValue
                case 'lastUpdate':
                default:
                  return sortOrder === 'desc'
                    ? new Date(meta.lastUpdate).getTime() < cursorValue
                    : new Date(meta.lastUpdate).getTime() > cursorValue
              }
            })
            
            if (startIndex === -1) startIndex = filteredMetadata.length
          } catch (error) {
            logger.debug('Invalid cursor provided, starting from beginning:', error)
            startIndex = 0
          }
        }

        const pageMetadata = filteredMetadata.slice(startIndex, startIndex + limit)
        const hasMore = startIndex + limit < filteredMetadata.length

        // Generate next cursor if there are more results
        let nextCursor: string | undefined
        if (hasMore) {
          const lastItem = pageMetadata[pageMetadata.length - 1]
          if (lastItem) {
            let cursorValue: number
            switch (sortBy) {
              case 'startTime':
                cursorValue = new Date(lastItem.startTime).getTime()
                break
              case 'messageCount':
                cursorValue = lastItem.messageCount
                break
              case 'fileSize':
                cursorValue = lastItem.fileSize
                break
              case 'lastUpdate':
              default:
                cursorValue = new Date(lastItem.lastUpdate).getTime()
                break
            }
            
            nextCursor = Buffer.from(JSON.stringify({
              value: cursorValue,
              sortBy,
              sortOrder
            })).toString('base64')
          }
        }

        // Convert metadata directly to lightweight sessions (no message loading)
        const sessions = pageMetadata.map(metadata => this.createSessionFromMetadata(metadata))

        return {
          sessions,
          nextCursor,
          hasMore
        }
      },
      { entity: 'session', action: 'getCursor' }
    )
  }

  /**
   * Get complete session with full message data (for detailed views)
   * Use this when user clicks on a specific session to see full details
   */
  async getSessionWithMessages(
    projectPath: string,
    sessionId: string
  ): Promise<ClaudeSession | null> {
    return withErrorContext(
      async () => {
        const sessionMessages = await this.getSessionMessages(projectPath, sessionId)
        if (sessionMessages.length === 0) {
          return null
        }
        
        return this.createSessionFromMessages(sessionId, projectPath, sessionMessages)
      },
      { entity: 'session', action: 'getWithMessages', id: sessionId }
    )
  }

  /**
   * Create a lightweight session from metadata (for fast loading)
   */
  private createSessionFromMetadata(metadata: ClaudeSessionMetadata): ClaudeSession {
    return {
      sessionId: metadata.sessionId,
      projectPath: metadata.projectPath,
      startTime: metadata.startTime,
      lastUpdate: metadata.lastUpdate,
      messageCount: metadata.messageCount,
      gitBranch: metadata.hasGitBranch ? 'Unknown' : undefined, // We can't know exact branch from metadata
      cwd: metadata.hasCwd ? 'Unknown' : undefined, // We can't know exact cwd from metadata
      // Token usage data not available from metadata - will be loaded separately if needed
      tokenUsage: undefined,
      serviceTiers: undefined,
      totalTokensUsed: undefined,
      totalCostUsd: undefined
    }
  }

  /**
   * Helper method to create a session from messages (extracted from existing getSessions logic)
   */
  private createSessionFromMessages(
    sessionId: string,
    projectPath: string,
    sessionMessages: ClaudeMessage[]
  ): ClaudeSession | null {
    if (sessionMessages.length === 0) return null

    const firstMessage = sessionMessages[0]
    const lastMessage = sessionMessages[sessionMessages.length - 1]

    if (!firstMessage || !lastMessage) return null

    // Find the most recent git branch and cwd
    let gitBranch: string | undefined
    let cwd: string | undefined

    for (let i = sessionMessages.length - 1; i >= 0; i--) {
      const msg = sessionMessages[i]
      if (!msg) continue
      if (!gitBranch && msg.gitBranch) gitBranch = msg.gitBranch
      if (!cwd && msg.cwd) cwd = msg.cwd
      if (gitBranch && cwd) break
    }

    // Calculate token breakdown
    let totalInputTokens = 0
    let totalCacheCreationTokens = 0
    let totalCacheReadTokens = 0
    let totalOutputTokens = 0
    let totalTokensUsed = 0
    let totalCostUsd = 0
    const serviceTiers = new Set<string>()

    for (const msg of sessionMessages) {
      // New token usage format
      if (msg.message?.usage) {
        if (msg.message.usage.input_tokens) {
          totalInputTokens += msg.message.usage.input_tokens
        }
        if (msg.message.usage.cache_creation_input_tokens) {
          totalCacheCreationTokens += msg.message.usage.cache_creation_input_tokens
        }
        if (msg.message.usage.cache_read_input_tokens) {
          totalCacheReadTokens += msg.message.usage.cache_read_input_tokens
        }
        if (msg.message.usage.output_tokens) {
          totalOutputTokens += msg.message.usage.output_tokens
        }
        if (msg.message.usage.service_tier) {
          serviceTiers.add(msg.message.usage.service_tier)
        }
      }
      // Legacy fields
      if (msg.tokensUsed) totalTokensUsed += msg.tokensUsed
      if (msg.costUsd) totalCostUsd += msg.costUsd
    }

    const totalTokens = totalInputTokens + totalCacheCreationTokens + totalCacheReadTokens + totalOutputTokens

    try {
      return ClaudeSessionSchema.parse({
        sessionId,
        projectPath,
        startTime: firstMessage.timestamp,
        lastUpdate: lastMessage.timestamp,
        messageCount: sessionMessages.length,
        gitBranch,
        cwd,
        tokenUsage:
          totalTokens > 0
            ? {
                totalInputTokens,
                totalCacheCreationTokens,
                totalCacheReadTokens,
                totalOutputTokens,
                totalTokens
              }
            : undefined,
        serviceTiers: serviceTiers.size > 0 ? Array.from(serviceTiers) : undefined,
        totalTokensUsed: totalTokensUsed > 0 ? totalTokensUsed : undefined,
        totalCostUsd: totalCostUsd > 0 ? totalCostUsd : undefined
      })
    } catch (error) {
      logger.debug('Failed to create session from messages:', error)
      return null
    }
  }

  /**
   * Get all sessions for a project (OPTIMIZED VERSION)
   * Now uses metadata-first approach to avoid loading all messages unnecessarily
   */
  async getSessions(projectPath: string): Promise<ClaudeSession[]> {
    return withErrorContext(
      async () => {
        // For backward compatibility, use the optimized approach but load all sessions
        // This is still faster than the old method because we use metadata first
        const metadata = await this.getSessionsMetadata(projectPath)
        
        // Load full session data for all sessions
        const sessions: ClaudeSession[] = []
        
        // Process sessions in parallel for better performance
        const sessionPromises = metadata.map(async (meta) => {
          try {
            const sessionMessages = await this.getSessionMessages(projectPath, meta.sessionId)
            if (sessionMessages.length > 0) {
              return this.createSessionFromMessages(meta.sessionId, projectPath, sessionMessages)
            }
          } catch (error) {
            logger.debug(`Failed to load session ${meta.sessionId}:`, error)
          }
          return null
        })

        const results = await Promise.all(sessionPromises)
        
        for (const session of results) {
          if (session) {
            sessions.push(session)
          }
        }

        // Sort by last update time (most recent first) - already sorted in metadata but ensure consistency
        return sessions.sort((a, b) => new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime())
      },
      { entity: 'session', action: 'getAll' }
    )
  }

  /**
   * Get messages for a specific session
   */
  async getSessionMessages(projectPath: string, sessionId: string): Promise<ClaudeMessage[]> {
    const allMessages = await this.readChatHistory(projectPath)
    return allMessages.filter((msg) => msg.sessionId === sessionId)
  }

  /**
   * Get project metadata from Claude files
   */
  async getProjectData(projectPath: string): Promise<ClaudeProjectData> {
    const messages = await this.readChatHistory(projectPath)
    const sessions = await this.getSessions(projectPath)

    // Extract unique branches and working directories
    const branches = new Set<string>()
    const workingDirectories = new Set<string>()

    for (const msg of messages) {
      if (msg.gitBranch) branches.add(msg.gitBranch)
      if (msg.cwd) workingDirectories.add(msg.cwd)
    }

    // Find first and last message times
    let firstMessageTime: string | undefined
    let lastMessageTime: string | undefined

    if (messages.length > 0) {
      const sorted = [...messages].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      if (first) firstMessageTime = first.timestamp
      if (last) lastMessageTime = last.timestamp
    }

    return {
      projectPath,
      encodedPath: this.encodeProjectPath(projectPath),
      sessions,
      totalMessages: messages.length,
      firstMessageTime,
      lastMessageTime,
      branches: Array.from(branches).sort(),
      workingDirectories: Array.from(workingDirectories).sort()
    }
  }

  /**
   * Watch for real-time updates to Claude chat files
   */
  watchChatHistory(projectPath: string, onUpdate: (messages: ClaudeMessage[]) => void): () => void {
    const configDir = this.getClaudeConfigDir()
    const encodedPath = this.encodeProjectPath(projectPath)
    const watchPath = path.join(configDir, 'projects', encodedPath, '*.jsonl')

    const watcher = watch(watchPath, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100
      }
    })

    const handleUpdate = async () => {
      try {
        const messages = await this.readChatHistory(projectPath)
        onUpdate(messages)
      } catch (error) {
        logger.error('Error in file watcher:', error)
      }
    }

    watcher.on('add', handleUpdate).on('change', handleUpdate)

    // Return cleanup function
    return () => {
      watcher.close()
    }
  }

  /**
   * Find Claude project by fuzzy matching path
   */
  async findProjectByPath(targetPath: string): Promise<string | null> {
    const encodedTarget = this.encodeProjectPath(targetPath)
    const projects = await this.getClaudeProjects()

    // First try exact match
    if (projects.includes(encodedTarget)) {
      return this.decodeProjectPath(encodedTarget)
    }

    // Try to find a project that ends with the target path
    for (const encodedProject of projects) {
      const decodedPath = this.decodeProjectPath(encodedProject)
      if (decodedPath.endsWith(targetPath) || targetPath.endsWith(decodedPath)) {
        return decodedPath
      }
    }

    return null
  }
}

// Create singleton instance
export const claudeCodeFileReaderService = new ClaudeCodeFileReaderService()

// Export factory function for consistency
export function createClaudeCodeFileReaderService(): ClaudeCodeFileReaderService {
  return claudeCodeFileReaderService
}
