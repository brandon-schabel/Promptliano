/**
 * Enhanced Security Module for Process Management
 * 
 * This module implements comprehensive security measures for process spawning:
 * - Strict command validation and allow-listing
 * - Script name validation against package.json
 * - Path traversal protection with sandboxing
 * - Resource limits enforcement
 * - Rate limiting per user/project
 * - Comprehensive audit logging
 * - Environment variable sanitization
 */

import { resolve, sep, join, basename } from 'node:path'
import { readFile, access } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { createServiceLogger } from '../core/base-service'
import { ApiError, ErrorFactory } from '@promptliano/shared'
import type { ProcessConfig } from '../process-management-service'

// Security constants
const MAX_PROCESSES_PER_PROJECT = 5
const MAX_PROCESSES_PER_USER = 10
const DEFAULT_MEMORY_LIMIT = 512 * 1024 * 1024 // 512MB
const DEFAULT_CPU_LIMIT = 2 // logical CPUs
const DEFAULT_TIMEOUT_MS = 300_000 // 5 minutes
const RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10

// Command patterns
const SAFE_ARG_PATTERN = /^[\w@.\-+:=\/,\[\]"'\\]*$/
const DANGEROUS_ARG_PATTERNS = [
  /\.\./,           // Path traversal
  /\/etc\//,        // System paths
  /\/proc\//,       // Process filesystem
  /\/sys\//,        // System filesystem
  /\$\(/,          // Command substitution
  /`/,             // Backticks
  /&&|;|\|/,       // Command chaining
  /<script/i,      // Script injection
  /eval\(/,        // Code evaluation
]

// Environment variable patterns
const ALLOWED_ENV_PATTERNS = [
  /^(NODE_|NPM_|YARN_|BUN_|PNPM_)/,
  /^(CI|PORT|HOME|USER|PATH|PWD)$/,
  /^(TERM|LANG|LC_)/, // Terminal/locale
  /^DEBUG$/,
]

const BLOCKED_ENV_PATTERNS = [
  /^(AWS_|GOOGLE_|AZURE_)/,  // Cloud credentials
  /^(DB_|DATABASE_)/,         // Database credentials
  /_SECRET|_KEY|_TOKEN$/,     // Any secrets/keys/tokens
  /^(ADMIN_|ROOT_)/,         // Admin credentials
]

export interface SecurityContext {
  userId?: string
  userRole: 'user' | 'admin' | 'system'
  projectId: number
  clientIp?: string
  userAgent?: string
}

export interface ProcessLimits {
  maxMemory: number     // bytes
  maxCpu: number        // logical CPU cores
  maxTimeout: number    // milliseconds
  maxArgs: number       // max command arguments
  maxEnvVars: number    // max environment variables
}

export interface RateLimitEntry {
  timestamp: number
  count: number
  userId?: string
  projectId?: number
}

export class ProcessSecurityManager {
  private logger = createServiceLogger('ProcessSecurity')
  private rateLimits = new Map<string, RateLimitEntry[]>()
  private processCountByProject = new Map<number, number>()
  private processCountByUser = new Map<string, number>()
  private sandboxRoot: string

  // Role-based command permissions
  private commandPermissions = new Map<string, Set<string>>([
    ['admin', new Set(['bun', 'npm', 'node', 'yarn', 'pnpm', 'git', 'python3', 'python'])],
    ['user', new Set(['bun', 'npm', 'yarn'])],
    ['system', new Set(['bun', 'npm', 'node', 'yarn', 'pnpm'])]
  ])

  // Default limits by role
  private defaultLimits = new Map<string, ProcessLimits>([
    ['admin', {
      maxMemory: 1024 * 1024 * 1024, // 1GB
      maxCpu: 4,
      maxTimeout: 600_000, // 10 minutes
      maxArgs: 50,
      maxEnvVars: 100
    }],
    ['user', {
      maxMemory: DEFAULT_MEMORY_LIMIT,
      maxCpu: DEFAULT_CPU_LIMIT,
      maxTimeout: DEFAULT_TIMEOUT_MS,
      maxArgs: 20,
      maxEnvVars: 50
    }],
    ['system', {
      maxMemory: 2048 * 1024 * 1024, // 2GB
      maxCpu: 8,
      maxTimeout: 1800_000, // 30 minutes
      maxArgs: 100,
      maxEnvVars: 200
    }]
  ])

  constructor(sandboxRoot?: string) {
    this.sandboxRoot = sandboxRoot || this.inferSandboxRoot()
    this.logger.info('Security manager initialized', { sandboxRoot: this.sandboxRoot })
  }

  /**
   * Comprehensive validation of process configuration
   */
  async validateProcessConfig(
    config: ProcessConfig,
    context: SecurityContext
  ): Promise<void> {
    const { userRole, userId, projectId } = context

    // Step 1: Basic validation
    if (!config.command || config.command.length === 0) {
      throw ErrorFactory.badRequest('Command is required')
    }

    // Step 2: Rate limiting
    await this.checkRateLimit(context)

    // Step 3: Resource limits validation
    await this.validateResourceLimits(config, context)

    // Step 4: Command validation
    await this.validateCommand(config.command, userRole)

    // Step 5: Path validation and sandboxing
    await this.validatePaths(config, context)

    // Step 6: Environment validation
    await this.validateEnvironment(config.env, userRole)

    // Step 7: Script validation (if running npm/yarn/bun script)
    await this.validateScript(config, context)

    // Step 8: Concurrency limits
    await this.checkConcurrencyLimits(context)

    this.logger.info('Process config validation passed', {
      userId,
      projectId,
      command: config.command[0],
      args: config.command.slice(1, 3) // Log first few args only
    })
  }

  /**
   * Validate command and arguments against security policies
   */
  private async validateCommand(command: string[], userRole: string): Promise<void> {
    const [binRaw, ...args] = command
    const bin: string = binRaw ?? ''
    const allowedCommands = this.commandPermissions.get(userRole) || new Set()

    // Check if command is allowed
    if (!allowedCommands.has(bin)) {
      throw ErrorFactory.forbidden(`Command "${bin}" not allowed for role ${userRole}`)
    }

    // Check argument count
    const limits = this.defaultLimits.get(userRole)!
    if (args.length > limits.maxArgs) {
      throw ErrorFactory.badRequest(`Too many arguments: ${args.length} > ${limits.maxArgs}`)
    }

    // Validate each argument
    for (const arg of args) {
      if (!arg) continue

      // Check basic pattern
      if (!SAFE_ARG_PATTERN.test(arg)) {
        throw ErrorFactory.badRequest(`Invalid characters in argument: ${arg}`)
      }

      // Check dangerous patterns
      for (const pattern of DANGEROUS_ARG_PATTERNS) {
        if (pattern.test(arg)) {
          throw ErrorFactory.badRequest(`Dangerous pattern in argument: ${arg}`)
        }
      }

      // Length check
      if (arg.length > 1000) {
        throw ErrorFactory.badRequest(`Argument too long: ${arg.length} characters`)
      }
    }
  }

  /**
   * Validate script execution against package.json
   */
  private async validateScript(config: ProcessConfig, context: SecurityContext): Promise<void> {
    const { command } = config
    const [binRaw, scriptCmd, scriptName] = command
    const bin: string = binRaw ?? ''

    // Only validate if this looks like a script command
    if (!['npm', 'yarn', 'bun', 'pnpm'].includes(bin) || scriptCmd !== 'run' || !scriptName) {
      return
    }

    try {
      // Find package.json in the working directory
      const cwd = config.cwd || this.sandboxRoot
      const packageJsonPath = join(cwd, 'package.json')
      
      await access(packageJsonPath, fsConstants.F_OK)
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'))

      if (!packageJson.scripts || !packageJson.scripts[scriptName]) {
        throw ErrorFactory.badRequest(`Script "${scriptName}" not found in package.json`)
      }

      // Validate the script command itself for dangerous patterns
      const scriptCommand = packageJson.scripts[scriptName]
      for (const pattern of DANGEROUS_ARG_PATTERNS) {
        if (pattern.test(scriptCommand)) {
          throw ErrorFactory.badRequest(`Dangerous pattern in script "${scriptName}": ${pattern}`)
        }
      }

      this.logger.debug('Script validation passed', {
        projectId: context.projectId,
        scriptName,
        scriptCommand
      })

    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      throw ErrorFactory.badRequest(`Failed to validate script: ${error}`)
    }
  }

  /**
   * Validate and sanitize environment variables
   */
  private async validateEnvironment(
    env: Record<string, string | undefined> = {},
    userRole: string
  ): Promise<void> {
    const limits = this.defaultLimits.get(userRole)!
    const envEntries = Object.entries(env).filter(([, v]) => v !== undefined)

    if (envEntries.length > limits.maxEnvVars) {
      throw ErrorFactory.badRequest(
        `Too many environment variables: ${envEntries.length} > ${limits.maxEnvVars}`
      )
    }

    for (const [key, value] of envEntries) {
      if (!value) continue

      // Check blocked patterns first
      for (const pattern of BLOCKED_ENV_PATTERNS) {
        if (pattern.test(key)) {
          throw ErrorFactory.forbidden(`Environment variable "${key}" not allowed`)
        }
      }

      // Check if allowed
      const isAllowed = ALLOWED_ENV_PATTERNS.some(pattern => pattern.test(key))
      if (!isAllowed) {
        throw ErrorFactory.forbidden(`Environment variable "${key}" not in allowed list`)
      }

      // Length checks
      if (key.length > 100) {
        throw ErrorFactory.badRequest(`Environment variable name too long: ${key}`)
      }
      
      if (value.length > 10000) {
        throw ErrorFactory.badRequest(`Environment variable value too long: ${key}`)
      }

      // Value pattern checks
      if (DANGEROUS_ARG_PATTERNS.some(pattern => pattern.test(value))) {
        throw ErrorFactory.badRequest(`Dangerous pattern in environment variable ${key}`)
      }
    }
  }

  /**
   * Validate working directory and prevent path traversal
   */
  private async validatePaths(config: ProcessConfig, context: SecurityContext): Promise<void> {
    const cwd = config.cwd || this.sandboxRoot
    
    try {
      const resolvedCwd = resolve(cwd)
      const resolvedSandbox = resolve(this.sandboxRoot)

      // Ensure working directory is within sandbox
      if (!resolvedCwd.startsWith(resolvedSandbox + sep) && resolvedCwd !== resolvedSandbox) {
        throw ErrorFactory.forbidden(`Working directory outside sandbox: ${resolvedCwd}`)
      }

      // Verify directory exists and is accessible
      await access(resolvedCwd, fsConstants.F_OK | fsConstants.R_OK)

      // Update config with resolved path
      config.cwd = resolvedCwd

    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      throw ErrorFactory.badRequest(`Invalid working directory: ${config.cwd}`)
    }
  }

  /**
   * Validate resource limits
   */
  private async validateResourceLimits(
    config: ProcessConfig,
    context: SecurityContext
  ): Promise<void> {
    const limits = this.defaultLimits.get(context.userRole)!

    // Apply default limits if not specified
    config.limits = config.limits || {}
    config.limits.maxMemory = Math.min(config.limits.maxMemory || limits.maxMemory, limits.maxMemory)
    config.limits.maxCpu = Math.min(config.limits.maxCpu || limits.maxCpu, limits.maxCpu)
    config.timeout = Math.min(config.timeout || limits.maxTimeout, limits.maxTimeout)

    // Validate maxBuffer (Bun-specific)
    if (config.maxBuffer && config.maxBuffer > 10 * 1024 * 1024) { // 10MB max
      throw ErrorFactory.badRequest(`maxBuffer too large: ${config.maxBuffer}`)
    }
  }

  /**
   * Check rate limits per user and project
   */
  private async checkRateLimit(context: SecurityContext): Promise<void> {
    const now = Date.now()
    const { userId, projectId } = context
    
    // User-based rate limiting
    if (userId) {
      const userKey = `user:${userId}`
      if (!this.isWithinRateLimit(userKey, now, MAX_REQUESTS_PER_WINDOW)) {
        throw ErrorFactory.rateLimitExceeded(MAX_REQUESTS_PER_WINDOW, '1 minute')
      }
    }

    // Project-based rate limiting
    const projectKey = `project:${projectId}`
    if (!this.isWithinRateLimit(projectKey, now, MAX_REQUESTS_PER_WINDOW)) {
      throw ErrorFactory.rateLimitExceeded(MAX_REQUESTS_PER_WINDOW, '1 minute')
    }
  }

  /**
   * Check concurrency limits
   */
  private async checkConcurrencyLimits(context: SecurityContext): Promise<void> {
    const { userId, projectId } = context

    // Project concurrency check
    const projectProcesses = this.processCountByProject.get(projectId) || 0
    if (projectProcesses >= MAX_PROCESSES_PER_PROJECT) {
      throw ErrorFactory.rateLimitExceeded(MAX_PROCESSES_PER_PROJECT, 'current')
    }

    // User concurrency check
    if (userId) {
      const userProcesses = this.processCountByUser.get(userId) || 0
      if (userProcesses >= MAX_PROCESSES_PER_USER) {
        throw ErrorFactory.rateLimitExceeded(MAX_PROCESSES_PER_USER, 'current')
      }
    }
  }

  /**
   * Create sanitized environment for process execution
   */
  createSecureEnvironment(
    userEnv: Record<string, string | undefined> = {},
    userRole: string
  ): Record<string, string> {
    const secure: Record<string, string> = {
      PATH: process.env.PATH ?? '',
      NODE_ENV: process.env.NODE_ENV ?? 'production',
      HOME: process.env.HOME ?? '/tmp',
      USER: process.env.USER ?? 'process-user'
    }

    // Add allowed environment variables
    for (const [key, value] of Object.entries(userEnv)) {
      if (!value) continue

      const isAllowed = ALLOWED_ENV_PATTERNS.some(pattern => pattern.test(key))
      const isBlocked = BLOCKED_ENV_PATTERNS.some(pattern => pattern.test(key))

      if (isAllowed && !isBlocked) {
        secure[key] = value
      }
    }

    return secure
  }

  /**
   * Audit process execution attempts
   */
  async auditProcessExecution(
    config: ProcessConfig,
    context: SecurityContext,
    outcome: 'allowed' | 'blocked',
    reason?: string
  ): Promise<void> {
    try {
      const auditEvent = {
        timestamp: Date.now(),
        userId: context.userId || 'anonymous',
        userRole: context.userRole,
        projectId: context.projectId,
        clientIp: context.clientIp || 'unknown',
        userAgent: context.userAgent || 'unknown',
        action: 'PROCESS_EXECUTION',
        outcome,
        reason,
        command: config.command[0],
        args: config.command.slice(1, 5), // First 5 args only
        cwd: config.cwd,
        processType: config.type || 'short-lived'
      }

      this.logger.info('Process execution audit', auditEvent)

      // TODO: Persist to database audit table
      // await processAuditRepository.create(auditEvent)

    } catch (error) {
      // Audit failures should not block execution
      this.logger.warn('Audit logging failed', { error })
    }
  }

  /**
   * Track process start for concurrency limits
   */
  trackProcessStart(context: SecurityContext): void {
    const { userId, projectId } = context

    // Increment counters
    this.processCountByProject.set(
      projectId, 
      (this.processCountByProject.get(projectId) || 0) + 1
    )

    if (userId) {
      this.processCountByUser.set(
        userId,
        (this.processCountByUser.get(userId) || 0) + 1
      )
    }
  }

  /**
   * Track process end for concurrency limits
   */
  trackProcessEnd(context: SecurityContext): void {
    const { userId, projectId } = context

    // Decrement counters
    const projectCount = this.processCountByProject.get(projectId) || 0
    if (projectCount > 0) {
      this.processCountByProject.set(projectId, projectCount - 1)
    }

    if (userId) {
      const userCount = this.processCountByUser.get(userId) || 0
      if (userCount > 0) {
        this.processCountByUser.set(userId, userCount - 1)
      }
    }
  }

  /**
   * Helper methods
   */
  private isWithinRateLimit(key: string, now: number, maxRequests: number): boolean {
    const requests = this.rateLimits.get(key) || []
    
    // Remove expired entries
    const validRequests = requests.filter(entry => 
      now - entry.timestamp < RATE_LIMIT_WINDOW_MS
    )

    if (validRequests.length >= maxRequests) {
      return false
    }

    // Add current request
    validRequests.push({ timestamp: now, count: 1, userId: key })
    this.rateLimits.set(key, validRequests)

    return true
  }

  private inferSandboxRoot(): string {
    // Try environment variable first
    if (process.env.PROCESS_SANDBOX_ROOT) {
      return resolve(process.env.PROCESS_SANDBOX_ROOT)
    }

    // Try to find monorepo root
    const cwd = process.cwd()
    if (cwd.includes('packages/server') || cwd.includes('packages/services')) {
      // Assume we're in a monorepo
      const parts = cwd.split(sep)
      const packagesIndex = parts.findIndex(part => part === 'packages')
      if (packagesIndex > 0) {
        return parts.slice(0, packagesIndex).join(sep)
      }
    }

    // Default to current working directory
    return cwd
  }
}

export const processSecurityManager = new ProcessSecurityManager()
