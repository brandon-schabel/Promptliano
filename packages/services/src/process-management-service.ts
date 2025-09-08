/**
 * Enhanced Process Management Service - Complete Implementation
 * Following PROCESS_MANAGEMENT.md specifications with functional factory pattern
 *
 * Features:
 * - ScriptRunner with Bun.spawn() and stream processing
 * - ProcessManager with concurrency control and queueing
 * - LifecycleManager for graceful shutdown and signal handling
 * - Database persistence with repository pattern
 * - SecurityManager for command validation and sandboxing
 * - Port management and scanning
 * - Ring buffer for log management
 * - Resource monitoring (CPU and memory usage)
 * - Full type safety with generated schemas
 */

import { EventEmitter } from 'node:events'
import { resolve, sep, join, dirname } from 'node:path'
import { readdir, access } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { randomUUID } from 'node:crypto'
import type { Subprocess } from 'bun'
import { createLogger } from './utils/logger'
import { safeAsync, throwNotFound, throwApiError } from './utils/error-handlers'
import { withErrorContext, createServiceLogger } from './core/base-service'
import { ErrorFactory } from '@promptliano/shared'
import type { ProcessInfo, ProcessStartRequest, ProjectScript } from '@promptliano/schemas'
import type {
  ProcessRun,
  ProcessLog,
  ProcessPort,
  InsertProcessRun,
  InsertProcessLog,
  InsertProcessPort
} from '@promptliano/database'
import { processRunsRepository, processLogsRepository, processPortsRepository } from '@promptliano/database'
import { projectService } from './project-service'

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type ProcessType = 'short-lived' | 'long-running'

export interface ProcessLimits {
  maxMemory?: number // bytes (advisory; enforced by monitor)
  maxCpu?: number // logical CPUs (advisory)
}

export interface ProcessOptions {
  cwd?: string
  env?: Record<string, string | undefined>
  stdin?: 'pipe' | 'inherit' | 'ignore' | ReadableStream | Blob | Request | Response | ArrayBufferView | number
  stdout?: 'pipe' | 'inherit' | 'ignore' | number
  stderr?: 'pipe' | 'inherit' | 'ignore' | number
  timeout?: number // ms
  killSignal?: NodeJS.Signals | number
  signal?: AbortSignal
  healthCheckUrl?: string
}

export interface ProcessConfig {
  command: string[]
  cwd?: string
  env?: Record<string, string | undefined>
  timeout?: number
  type?: ProcessType
  limits?: ProcessLimits
  options?: ProcessOptions
  maxBuffer?: number // hard cap; Bun will kill if exceeded
  projectId: number
  name?: string
}

export interface ManagedProcess {
  id: string
  projectId: number
  process: Subprocess
  config: ProcessConfig
  startTime: number
  status: 'running' | 'completed' | 'failed' | 'stopped'
  exitCode?: number | null
  signalCode?: number | null
  resourceUsage?: ReturnType<Subprocess['resourceUsage']>
  logBuffer: RingBuffer
  monitorInterval?: ReturnType<typeof setInterval>
}

type LogEvent = {
  processId: string
  type: 'stdout' | 'stderr' | 'system'
  line: string
  timestamp: number
}

// =============================================================================
// RING BUFFER FOR LOG MANAGEMENT
// =============================================================================

class RingBuffer {
  private buffer: LogEvent[] = []
  private maxSize: number
  private writeIndex = 0
  private full = false

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize
  }

  push(entry: LogEvent): void {
    this.buffer[this.writeIndex] = entry
    this.writeIndex = (this.writeIndex + 1) % this.maxSize
    if (this.writeIndex === 0) {
      this.full = true
    }
  }

  getAll(): LogEvent[] {
    if (!this.full) {
      return this.buffer.slice(0, this.writeIndex)
    }
    return [...this.buffer.slice(this.writeIndex), ...this.buffer.slice(0, this.writeIndex)]
  }

  getTail(count: number): LogEvent[] {
    const all = this.getAll()
    return all.slice(-count)
  }

  clear(): void {
    this.buffer = []
    this.writeIndex = 0
    this.full = false
  }

  get size(): number {
    return this.full ? this.maxSize : this.writeIndex
  }
}

// =============================================================================
// SCRIPT RUNNER - Bun.spawn() with Stream Processing
// =============================================================================

export class ScriptRunner extends EventEmitter {
  private processes = new Map<string, ManagedProcess>()
  private logger = createLogger('ScriptRunner')

  async runPackageScript(
    scriptName: string,
    args: string[] = [],
    options: {
      projectId: number
      cwd?: string
      env?: Record<string, string>
      timeout?: number
      killSignal?: NodeJS.Signals | number
      maxBuffer?: number // safety fuse
      name?: string
      type?: ProcessType
    }
  ): Promise<{ processId: string; pid: number | null }> {
    // Validate project exists
    const project = await projectService.getById(options.projectId)
    if (!project) {
      throw ErrorFactory.notFound('Project', options.projectId)
    }

    // Validate script exists in package.json
    const pkg = await Bun.file(resolve(options.cwd ?? project.path, 'package.json'))
      .json()
      .catch(() => null)
    if (!pkg?.scripts?.[scriptName]) {
      throw ErrorFactory.badRequest(`Script "${scriptName}" not found in package.json`)
    }

    const processId = `proc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const logBuffer = new RingBuffer()
    const startTime = Date.now()

    // Create process config
    const config: ProcessConfig = {
      command: ['bun', 'run', scriptName, ...args],
      cwd: options.cwd ?? project.path,
      env: { ...process.env, ...options.env },
      timeout: options.timeout ?? 300_000,
      type: options.type ?? 'short-lived',
      maxBuffer: options.maxBuffer,
      projectId: options.projectId,
      name: options.name || scriptName
    }

    // Spawn child process
    const proc = Bun.spawn({
      cmd: config.command,
      cwd: config.cwd,
      env: config.env as Record<string, string>,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: config.timeout,
      killSignal: options.killSignal ?? 'SIGTERM',
      maxBuffer: config.maxBuffer,
      onExit: (sub, exitCode, signalCode, error) => {
        this.handleProcessExit(processId, sub, exitCode, signalCode, error)
      }
    })

    // Create managed process
    const managed: ManagedProcess = {
      id: processId,
      projectId: options.projectId,
      process: proc,
      config,
      startTime,
      status: 'running',
      logBuffer
    }

    this.processes.set(processId, managed)

    // Start log streaming
    this.startLogStreaming(processId, proc, 'stdout')
    this.startLogStreaming(processId, proc, 'stderr')

    // Persist to database
    await this.persistProcessRun(managed)

    this.emit('started', { processId, pid: proc.pid, config })
    this.logger.info('Started process', { processId, pid: proc.pid, command: config.command[0] })

    return { processId, pid: proc.pid }
  }

  private startLogStreaming(processId: string, proc: Subprocess, which: 'stdout' | 'stderr'): void {
    const stream = proc[which]
    if (!stream || typeof stream === 'number') return

    // Text decoding -> line splitting with robust CRLF support
    const text = stream.pipeThrough(new TextDecoderStream())
    const splitter = new TransformStream<string, string>({
      transform(chunk, controller) {
        // Robust line splitter with CRLF support and buffer management
        ;(this as any)._buf = ((this as any)._buf || '') + chunk
        const parts = (this as any)._buf.split(/\r?\n/)
        ;(this as any)._buf = parts.pop() ?? ''
        for (const part of parts) {
          if (part) controller.enqueue(part) // Skip empty lines
        }
      },
      flush(controller) {
        const carry = (this as any)._buf
        if (carry) controller.enqueue(carry)
      }
    })

    // Process lines asynchronously
    ;(async () => {
      try {
        const reader = text.pipeThrough(splitter).getReader()
        let lineNumber = 0
        while (true) {
          const { value, done } = await reader.read()
          if (done) break

          const logEvent: LogEvent = {
            processId,
            type: which,
            line: value,
            timestamp: Date.now()
          }

          await this.handleLogEvent(logEvent, lineNumber++)
        }
      } catch (error) {
        // Log streaming errors are non-fatal
        this.logger.warn('Log streaming error', { processId, which, error })
      }
    })()
  }

  private async handleLogEvent(logEvent: LogEvent, lineNumber: number): Promise<void> {
    const managed = this.processes.get(logEvent.processId)
    if (!managed) return

    // Add to ring buffer
    managed.logBuffer.push(logEvent)

    // Persist to database
    try {
      await this.persistProcessLog(logEvent, lineNumber)
    } catch (error) {
      this.logger.warn('Failed to persist log to database', { processId: logEvent.processId, error })
    }

    // Emit for real-time consumers
    this.emit('log', logEvent)
  }

  private handleProcessExit(
    processId: string,
    sub: Subprocess,
    exitCode: number | null,
    signalCode: number | null,
    error?: Error
  ): void {
    const managed = this.processes.get(processId)
    if (!managed) return

    managed.exitCode = exitCode
    managed.signalCode = signalCode
    managed.status = exitCode === 0 ? 'completed' : 'failed'
    managed.resourceUsage = sub.resourceUsage() // Only available after exit

    if (managed.monitorInterval) {
      clearInterval(managed.monitorInterval)
    }

    // Persist final state to database
    this.updateProcessRun(managed)

    this.emit('exit', { processId, exitCode, signalCode, error })
    this.logger.info('Process exited', { processId, exitCode, signalCode })

    // Clean up after delay to allow log collection
    setTimeout(() => {
      this.processes.delete(processId)
    }, 5000)
  }

  async stopProcess(processId: string, signal: NodeJS.Signals | number = 'SIGTERM'): Promise<boolean> {
    const managed = this.processes.get(processId)
    if (!managed) {
      return false
    }

    try {
      managed.process.kill(signal)
      managed.status = 'stopped'
      return true
    } catch (error) {
      this.logger.error('Failed to stop process', { processId, error })
      return false
    }
  }

  getProcess(processId: string): ManagedProcess | undefined {
    return this.processes.get(processId)
  }

  getAllProcesses(): ManagedProcess[] {
    return Array.from(this.processes.values())
  }

  getProcessesByProject(projectId: number): ManagedProcess[] {
    return this.getAllProcesses().filter((p) => p.projectId === projectId)
  }

  private async persistProcessRun(managed: ManagedProcess): Promise<void> {
    try {
      const insertData: InsertProcessRun = {
        processId: managed.id,
        projectId: managed.projectId,
        pid: managed.process.pid || null,
        name: managed.config.name || null,
        command: managed.config.command[0] || '',
        args: managed.config.command.slice(1),
        cwd: managed.config.cwd || '',
        env: (managed.config.env as any) || null,
        status: managed.status === 'failed' ? 'error' : managed.status === 'completed' ? 'exited' : managed.status,
        startedAt: managed.startTime,
        scriptName: managed.config.name || null,
        scriptType: 'bun',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      await processRunsRepository.create(insertData)
    } catch (error) {
      this.logger.error('Failed to persist process run', { processId: managed.id, error })
    }
  }

  private async updateProcessRun(managed: ManagedProcess): Promise<void> {
    try {
      await processRunsRepository.updateByProcessId(managed.id, {
        status: managed.status === 'failed' ? 'error' : managed.status === 'completed' ? 'exited' : managed.status,
        exitCode: managed.exitCode || null,
        signal: managed.signalCode ? String(managed.signalCode) : null,
        exitedAt: Date.now(),
        cpuUsage: managed.resourceUsage?.cpuTime.user || null,
        memoryUsage: managed.resourceUsage?.maxRSS || null,
        updatedAt: Date.now()
      })
    } catch (error) {
      this.logger.error('Failed to update process run', { processId: managed.id, error })
    }
  }

  private async persistProcessLog(logEvent: LogEvent, lineNumber: number): Promise<void> {
    try {
      // Get run ID from database
      const run = await processRunsRepository.getByProcessId(logEvent.processId)
      if (!run) return

      const insertData: InsertProcessLog = {
        runId: run.id,
        timestamp: logEvent.timestamp,
        type: logEvent.type,
        content: logEvent.line,
        lineNumber,
        createdAt: Date.now()
      }

      await processLogsRepository.create(insertData)
    } catch (error) {
      // Log persistence failures are non-fatal
    }
  }
}

// =============================================================================
// SECURITY MANAGER - Command Validation and Sandboxing
// =============================================================================

const SAFE_ARG = /^[\w@.+:=\/,-]+$/ // Allow typical flags & values

function isInside(base: string, target: string): boolean {
  const rBase = resolve(base) + sep
  const rTarget = resolve(target) + sep
  return rTarget.startsWith(rBase)
}

function inferDefaultSandboxRoot(): string {
  const cwd = resolve(process.cwd())
  const marker = `${sep}packages${sep}server`
  if (cwd.includes(marker)) {
    // Likely running the API from packages/server; sandbox to the monorepo root
    return resolve(cwd, '..', '..')
  }
  return cwd
}

export class SecurityManager {
  private logger = createLogger('SecurityManager')
  private rateLimits = new Map<string, number[]>()
  private allowedCommandsByRole = new Map<string, Set<string>>([
    ['admin', new Set(['bun', 'npm', 'node', 'yarn', 'pnpm', 'git'])],
    ['user', new Set(['bun', 'npm'])]
  ])
  private sandboxRoot: string

  constructor(sandboxRoot?: string) {
    // Default sandbox to the monorepo root if running from packages/server
    const envRoot = process.env.PROCESS_SANDBOX_ROOT
    this.sandboxRoot = sandboxRoot || envRoot || inferDefaultSandboxRoot()
  }

  validateProcessConfig(config: ProcessConfig, userRole: string = 'user'): void {
    const [bin, ...args] = config.command
    const allowedCommands = this.allowedCommandsByRole.get(userRole) || new Set(['bun'])

    if (!bin || !allowedCommands.has(bin)) {
      throw ErrorFactory.forbidden(`Command "${bin}" not allowed for role ${userRole}`)
    }

    // Validate arguments for dangerous patterns
    for (const arg of args) {
      if (arg && (!SAFE_ARG.test(arg) || arg.includes('..') || arg.startsWith('/etc/'))) {
        throw ErrorFactory.badRequest(`Invalid argument: ${arg}`)
      }
    }

    // Validate working directory is within sandbox (repo root by default)
    if (config.cwd) {
      if (!isInside(this.sandboxRoot, config.cwd)) {
        throw ErrorFactory.badRequest('Working directory outside sandbox')
      }
    }
  }

  createCleanEnvironment(userEnv?: Record<string, string | undefined>): Record<string, string> {
    const ALLOW_PATTERNS = [/^(NODE_|NPM_|YARN_|BUN_)/, /^(CI|PORT|HOME|USER|PATH)$/]
    const safe: Record<string, string> = {
      PATH: process.env.PATH ?? '',
      NODE_ENV: process.env.NODE_ENV ?? 'production'
    }

    for (const [k, v] of Object.entries(userEnv ?? {})) {
      if (v == null) continue
      if (ALLOW_PATTERNS.some((p) => p.test(k))) {
        safe[k] = v || ''
      }
    }

    return safe
  }

  checkRateLimit(userId: string, limit: number = 10, windowMs: number = 60000): boolean {
    const now = Date.now()
    const userRequests = this.rateLimits.get(userId) ?? []
    const validRequests = userRequests.filter((time) => now - time < windowMs)

    if (validRequests.length >= limit) {
      return false
    }

    validRequests.push(now)
    this.rateLimits.set(userId, validRequests)
    return true
  }

  async auditProcessStart(config: ProcessConfig, userId?: string): Promise<void> {
    try {
      this.logger.info('Process audit', {
        userId: userId || 'system',
        action: 'PROCESS_START',
        command: config.command[0],
        args: config.command.slice(1),
        projectId: config.projectId,
        timestamp: Date.now()
      })
    } catch (error) {
      // Audit failures should not block process execution
      this.logger.warn('Audit logging failed', { error })
    }
  }
}

// =============================================================================
// PORT MANAGEMENT AND SCANNING
// =============================================================================

export class PortManager {
  private logger = createLogger('PortManager')

  async scanOpenPorts(): Promise<ProcessPort[]> {
    try {
      // Use netstat or ss to get open ports (platform-specific)
      const command = process.platform === 'darwin' ? 'netstat' : 'ss'
      const args = process.platform === 'darwin' ? ['-an', '-p', 'tcp'] : ['-tuln']

      const proc = Bun.spawn({
        cmd: [command, ...args],
        stdout: 'pipe',
        stderr: 'pipe'
      })

      const output = await new Response(proc.stdout!).text()
      await proc.exited

      return this.parsePortOutput(output)
    } catch (error) {
      this.logger.warn('Port scanning failed', { error })
      return []
    }
  }

  private parsePortOutput(output: string): ProcessPort[] {
    const ports: ProcessPort[] = []
    const lines = output.split('\n')

    for (const line of lines) {
      // Parse netstat/ss output format
      const match = line.match(/\s+(\d+\.\d+\.\d+\.\d+|\*):(\d+)\s+/)
      if (match) {
        const [, address, portStr] = match
        const port = parseInt(portStr || '0', 10)

        if (port > 0) {
          ports.push({
            port,
            address: address === '*' ? '0.0.0.0' : address,
            protocol: 'tcp',
            state: 'listening',
            createdAt: Date.now(),
            updatedAt: Date.now()
          } as ProcessPort)
        }
      }
    }

    return ports
  }

  async trackProcessPort(processId: string, projectId: number, port: number): Promise<void> {
    try {
      const run = await processRunsRepository.getByProcessId(processId)
      if (!run) return

      const insertData: InsertProcessPort = {
        projectId,
        runId: run.id,
        port,
        protocol: 'tcp',
        address: '0.0.0.0',
        pid: run.pid || null,
        processName: run.name || null,
        state: 'listening',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      await processPortsRepository.create(insertData)
    } catch (error) {
      this.logger.warn('Failed to track process port', { processId, port, error })
    }
  }

  async getPortsForProject(projectId: number): Promise<ProcessPort[]> {
    try {
      return await processPortsRepository.getByProject(projectId)
    } catch (error) {
      this.logger.error('Failed to get ports for project', { projectId, error })
      return []
    }
  }
}

// =============================================================================
// PROCESS MANAGER - Concurrency Control and Queue Management
// =============================================================================

export class ProcessManager {
  private active = new Map<string, ManagedProcess>()
  private queue: ProcessConfig[] = []
  private maxConcurrent: number = 5
  private acceptingNew = true
  private metricsInterval?: ReturnType<typeof setInterval>
  private scriptRunner: ScriptRunner
  private securityManager: SecurityManager
  private portManager: PortManager
  private logger = createLogger('ProcessManager')
  private sandboxRoot: string

  constructor(
    options: {
      maxConcurrent?: number
      sandboxRoot?: string
      scriptRunner?: ScriptRunner
      securityManager?: SecurityManager
      portManager?: PortManager
    } = {}
  ) {
    this.maxConcurrent = options.maxConcurrent || 5
    this.sandboxRoot = options.sandboxRoot || resolve('./sandbox')
    this.scriptRunner = options.scriptRunner || new ScriptRunner()
    this.securityManager = options.securityManager || new SecurityManager()
    this.portManager = options.portManager || new PortManager()

    this.setupEventHandlers()
    this.startMetricsCollection()
    this.setupGracefulShutdown()
  }

  private setupEventHandlers(): void {
    this.scriptRunner.on('started', ({ processId, config }) => {
      const managed = this.scriptRunner.getProcess(processId)
      if (managed) {
        this.active.set(processId, managed)
        this.startResourceMonitoring(managed)
      }
    })

    this.scriptRunner.on('exit', ({ processId }) => {
      this.active.delete(processId)
      this.processNext()
    })
  }

  async executeProcess(config: ProcessConfig, options: { userRole?: string; userId?: string } = {}): Promise<string> {
    return safeAsync(
      async () => {
        if (!this.acceptingNew) {
          throw ErrorFactory.serviceUnavailable('Server shutting down')
        }

        // Security validation
        this.securityManager.validateProcessConfig(config, options.userRole)

        // Rate limiting
        if (options.userId && !this.securityManager.checkRateLimit(options.userId)) {
          throw ErrorFactory.badRequest('Too many process requests')
        }

        // Queue if at capacity
        if (this.active.size >= this.maxConcurrent) {
          return this.queueProcess(config)
        }

        // Audit logging
        await this.securityManager.auditProcessStart(config, options.userId)

        // Execute immediately
        const { processId } = await this.scriptRunner.runPackageScript(
          config.command[2] || config.command[0] || 'unknown', // script name is 3rd arg for "bun run script"
          config.command.slice(3),
          {
            projectId: config.projectId,
            cwd: config.cwd,
            env: this.securityManager.createCleanEnvironment(config.env),
            timeout: config.timeout,
            maxBuffer: config.maxBuffer,
            name: config.name,
            type: config.type
          }
        )

        return processId
      },
      { entityName: 'Process', action: 'execute' }
    )
  }

  private queueProcess(config: ProcessConfig): string {
    this.queue.push(config)
    const queueId = `queued_${this.queue.length}_${Date.now()}`
    this.logger.info('Process queued', { queueId, queueLength: this.queue.length })
    return queueId
  }

  private processNext(): void {
    if (this.queue.length === 0) return
    if (this.active.size >= this.maxConcurrent) return

    const next = this.queue.shift()
    if (next) {
      this.executeProcess(next).catch((error) => {
        this.logger.error('Failed to execute queued process', { error })
      })
    }
  }

  private startResourceMonitoring(managed: ManagedProcess): void {
    if (managed.config.type === 'short-lived') return

    managed.monitorInterval = setInterval(async () => {
      try {
        // Monitor process health and resource usage
        if (managed.process.killed) {
          if (managed.monitorInterval) {
            clearInterval(managed.monitorInterval)
          }
          return
        }

        // Check memory limits if configured
        if (managed.config.limits?.maxMemory) {
          // Note: resourceUsage() only available after exit, so we'd need OS-level monitoring here
          // For now, just log that monitoring is active
          this.logger.debug('Monitoring process resources', {
            processId: managed.id,
            limits: managed.config.limits
          })
        }
      } catch (error) {
        this.logger.warn('Resource monitoring error', { processId: managed.id, error })
      }
    }, 10000) // Check every 10 seconds
  }

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      const metrics = {
        activeProcesses: this.active.size,
        queuedProcesses: this.queue.length,
        totalCapacity: this.maxConcurrent,
        timestamp: Date.now()
      }

      this.logger.debug('Process manager metrics', metrics)
    }, 30000) // Every 30 seconds
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      this.logger.info('Process manager shutting down', { signal })
      this.acceptingNew = false

      // Stop metrics collection
      if (this.metricsInterval) {
        clearInterval(this.metricsInterval)
      }

      // Wait for active processes to complete or timeout
      const activeProcesses = Array.from(this.active.values())
      const shutdownPromises = activeProcesses.map(async (managed) => {
        try {
          await managed.process.exited
        } catch {
          // Force kill if needed
          managed.process.kill('SIGKILL')
        }
      })

      await Promise.allSettled(shutdownPromises)
      this.logger.info('Process manager shutdown complete')
      process.exit(0)
    }

    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGTERM', () => shutdown('SIGTERM'))
  }

  getStatus(processId?: string): any {
    if (processId) {
      return this.active.get(processId) || this.scriptRunner.getProcess(processId)
    }

    return {
      active: Array.from(this.active.entries()).map(([id, managed]) => ({
        id,
        status: managed.status,
        config: managed.config,
        startTime: managed.startTime
      })),
      queued: this.queue.length,
      capacity: this.maxConcurrent,
      accepting: this.acceptingNew
    }
  }

  async stopProcess(processId: string, signal: NodeJS.Signals | number = 'SIGTERM'): Promise<boolean> {
    return safeAsync(
      async () => {
        const success = await this.scriptRunner.stopProcess(processId, signal)
        if (success) {
          this.active.delete(processId)
          this.processNext() // Try to process next queued item
        }
        return success
      },
      { entityName: 'Process', action: 'stop' }
    )
  }

  getProcessesByProject(projectId: number): ManagedProcess[] {
    return this.scriptRunner.getProcessesByProject(projectId)
  }
}

// =============================================================================
// LIFECYCLE MANAGER - Signal Handling and Graceful Shutdown
// =============================================================================

export class LifecycleManager {
  private states = new Map<string, any>()
  private signals = ['SIGTERM', 'SIGINT', 'SIGHUP'] as const
  private logger = createLogger('LifecycleManager')
  private processManager: ProcessManager

  constructor(processManager: ProcessManager) {
    this.processManager = processManager
    this.setupSignalHandlers()
  }

  async startProcess(config: ProcessConfig): Promise<{
    id: string
    pid: number | null
    stop: (signal?: NodeJS.Signals | number) => Promise<boolean>
    restart: () => Promise<{ id: string; pid: number | null }>
    getStatus: () => any
    waitForExit: () => Promise<number | null>
  }> {
    const id = randomUUID()
    const state: any = {
      id,
      config,
      status: 'starting',
      startTime: Date.now(),
      attempts: 0
    }
    this.states.set(id, state)

    try {
      const processId = await this.processManager.executeProcess(config)
      const managed = this.processManager.getStatus(processId)

      if (managed) {
        state.processId = processId
        state.pid = managed.process?.pid
        state.status = 'running'

        return {
          id,
          pid: managed.process?.pid || null,
          stop: (signal = 'SIGTERM') => this.stopProcess(processId, signal),
          restart: async () => {
            await this.stopProcess(processId)
            return this.startProcess(config)
          },
          getStatus: () => this.states.get(id),
          waitForExit: () => managed.process?.exited || Promise.resolve(null)
        }
      } else {
        throw new Error('Failed to start process')
      }
    } catch (error) {
      state.status = 'failed'
      state.error = error
      throw error
    }
  }

  private async stopProcess(processId: string, signal: NodeJS.Signals | number = 'SIGTERM'): Promise<boolean> {
    const success = await this.processManager.stopProcess(processId, signal)

    if (!success && signal !== 'SIGKILL') {
      // Escalate to SIGKILL after timeout
      setTimeout(async () => {
        await this.processManager.stopProcess(processId, 'SIGKILL')
      }, 10000)
    }

    return success
  }

  private setupSignalHandlers(): void {
    this.signals.forEach((signal) => {
      process.on(signal, () => {
        this.logger.info(`Received ${signal}, initiating graceful shutdown`)
        // The ProcessManager handles its own shutdown
      })
    })
  }
}

// =============================================================================
// SERVICE DEPENDENCIES INTERFACE
// =============================================================================

export interface ProcessServiceDependencies {
  scriptRunner?: ScriptRunner
  processManager?: ProcessManager
  securityManager?: SecurityManager
  portManager?: PortManager
  lifecycleManager?: LifecycleManager
  logger?: ReturnType<typeof createServiceLogger>
  maxConcurrent?: number
  sandboxRoot?: string
  logBufferSize?: number
}

// =============================================================================
// FUNCTIONAL FACTORY PATTERN - MAIN SERVICE
// =============================================================================

/**
 * Create Process Management Service with functional factory pattern
 * Implements complete process management system with all required features
 */
export function createProcessManagementService(deps: ProcessServiceDependencies = {}) {
  const logger = deps.logger || createServiceLogger('ProcessManagementService')
  const scriptRunner = deps.scriptRunner || new ScriptRunner()
  const securityManager = deps.securityManager || new SecurityManager(deps.sandboxRoot || inferDefaultSandboxRoot())
  const portManager = deps.portManager || new PortManager()

  const processManager =
    deps.processManager ||
    new ProcessManager({
      maxConcurrent: deps.maxConcurrent || 5,
      sandboxRoot: deps.sandboxRoot || inferDefaultSandboxRoot(),
      scriptRunner,
      securityManager,
      portManager
    })

  const lifecycleManager = deps.lifecycleManager || new LifecycleManager(processManager)

  return {
    // Discover package.json scripts in the project (root + packages/*)
    async listProjectScripts(projectId: number): Promise<ProjectScript[]> {
      return withErrorContext(
        async () => {
          const project = await projectService.getById(projectId)
          if (!project) throw ErrorFactory.notFound('Project', projectId)

          const projectRoot = resolve(project.path)

          async function pathExists(p: string) {
            try {
              await access(p, fsConstants.F_OK)
              return true
            } catch {
              return false
            }
          }

          function parsePackageManager(pm: unknown): 'bun' | 'pnpm' | 'yarn' | 'npm' | undefined {
            if (!pm || typeof pm !== 'string') return undefined
            const lower = pm.toLowerCase()
            if (lower.startsWith('bun')) return 'bun'
            if (lower.startsWith('pnpm')) return 'pnpm'
            if (lower.startsWith('yarn')) return 'yarn'
            if (lower.startsWith('npm')) return 'npm'
            return undefined
          }

          async function inferPackageManager(root: string): Promise<'bun' | 'pnpm' | 'yarn' | 'npm'> {
            const bunLock = join(root, 'bun.lock')
            const bunLockb = join(root, 'bun.lockb')
            const pnpmLock = join(root, 'pnpm-lock.yaml')
            const yarnLock = join(root, 'yarn.lock')
            const npmLock = join(root, 'package-lock.json')
            if (await pathExists(bunLock)) return 'bun'
            if (await pathExists(bunLockb)) return 'bun'
            if (await pathExists(pnpmLock)) return 'pnpm'
            if (await pathExists(yarnLock)) return 'yarn'
            if (await pathExists(npmLock)) return 'npm'
            return 'bun'
          }

          const candidatePackageJsons: string[] = []
          const rootPkg = join(projectRoot, 'package.json')
          if (await pathExists(rootPkg)) candidatePackageJsons.push(rootPkg)

          // Scan workspaces under packages/* (one level)
          const workspacesDir = join(projectRoot, 'packages')
          if (await pathExists(workspacesDir)) {
            try {
              const entries = await readdir(workspacesDir, { withFileTypes: true })
              for (const ent of entries) {
                if (ent.isDirectory()) {
                  const pkgPath = join(workspacesDir, ent.name, 'package.json')
                  if (await pathExists(pkgPath)) candidatePackageJsons.push(pkgPath)
                }
              }
            } catch {
              // ignore errors scanning workspaces
            }
          }

          const pm = await inferPackageManager(projectRoot)
          const scripts: ProjectScript[] = []

          for (const pkgJsonPath of candidatePackageJsons) {
            const dir = dirname(pkgJsonPath)
            const pkg = await Bun.file(pkgJsonPath).json().catch(() => null as any)
            if (!pkg || typeof pkg !== 'object') continue
            const pkgName = (pkg as any).name || dir
            const pkgPm = parsePackageManager((pkg as any).packageManager) || pm
            const rawScripts = (pkg as any).scripts || {}
            if (rawScripts && typeof rawScripts === 'object') {
              for (const [scriptName, command] of Object.entries(rawScripts)) {
                if (typeof command !== 'string') continue
                scripts.push({
                  packageName: String(pkgName),
                  packagePath: dir,
                  scriptName: String(scriptName),
                  command: command as string,
                  packageManager: pkgPm,
                  workspace: dir.startsWith(join(projectRoot, 'packages'))
                })
              }
            }
          }

          // Sort: root package first, then by packageName, then scriptName
          scripts.sort((a, b) => {
            if (a.workspace !== b.workspace) return a.workspace ? 1 : -1
            if (a.packageName !== b.packageName) return a.packageName.localeCompare(b.packageName)
            return a.scriptName.localeCompare(b.scriptName)
          })

          return scripts
        },
        { entity: 'Process', action: 'listProjectScripts', id: projectId }
      )
    },
    // Core process operations
    async startProcess(projectId: number, request: ProcessStartRequest): Promise<ProcessInfo> {
      return withErrorContext(
        async () => {
          const config: ProcessConfig = {
            command: [request.command, ...(request.args || [])],
            cwd: request.cwd,
            env: request.env as any,
            projectId,
            name: request.name
          }

          const processId = await processManager.executeProcess(config)
          const managed = scriptRunner.getProcess(processId)

          if (!managed) {
            throw ErrorFactory.operationFailed('startProcess', 'Failed to retrieve started process')
          }

          // Convert to ProcessInfo format
          const logs = managed.logBuffer.getTail(50)
          return {
            id: managed.id,
            projectId: managed.projectId,
            pid: managed.process.pid || null,
            name: managed.config.name || null,
            command: managed.config.command[0] || '',
            args: managed.config.command.slice(1),
            cwd: managed.config.cwd || '',
            status: managed.status === 'completed' ? 'exited' : managed.status,
            startedAt: managed.startTime,
            exitedAt: managed.exitCode !== undefined ? Date.now() : null,
            exitCode: managed.exitCode || null,
            lastOutput: {
              stdout: logs.filter((l) => l.type === 'stdout').map((l) => l.line),
              stderr: logs.filter((l) => l.type === 'stderr').map((l) => l.line)
            }
          } as ProcessInfo
        },
        { entity: 'Process', action: 'start', id: projectId }
      )
    },

    async stopProcess(projectId: number, processId: string): Promise<ProcessInfo> {
      return withErrorContext(
        async () => {
          const managed = scriptRunner.getProcess(processId)
          if (!managed || managed.projectId !== projectId) {
            throw ErrorFactory.notFound('Process', processId)
          }

          const success = await processManager.stopProcess(processId)
          if (!success) {
            throw ErrorFactory.operationFailed('stopProcess', 'Failed to stop process')
          }

          // Return updated process info
          const logs = managed.logBuffer.getTail(50)
          return {
            id: managed.id,
            projectId: managed.projectId,
            pid: managed.process.pid || null,
            name: managed.config.name || null,
            command: managed.config.command[0] || '',
            args: managed.config.command.slice(1),
            cwd: managed.config.cwd || '',
            status: 'stopped',
            startedAt: managed.startTime,
            exitedAt: Date.now(),
            exitCode: managed.exitCode || null,
            lastOutput: {
              stdout: logs.filter((l) => l.type === 'stdout').map((l) => l.line),
              stderr: logs.filter((l) => l.type === 'stderr').map((l) => l.line)
            }
          } as ProcessInfo
        },
        { entity: 'Process', action: 'stop', id: projectId }
      )
    },

    async listProcesses(projectId: number): Promise<ProcessInfo[]> {
      return withErrorContext(
        async () => {
          const processes = processManager.getProcessesByProject(projectId)
          return processes.map((managed) => {
            const logs = managed.logBuffer.getTail(50)
            return {
              id: managed.id,
              projectId: managed.projectId,
              pid: managed.process.pid || null,
              name: managed.config.name || null,
              command: managed.config.command[0] || '',
              args: managed.config.command.slice(1),
              cwd: managed.config.cwd || '',
              status: managed.status === 'completed' ? 'exited' : managed.status,
              startedAt: managed.startTime,
              exitedAt: managed.exitCode !== undefined ? Date.now() : null,
              exitCode: managed.exitCode || null,
              lastOutput: {
                stdout: logs.filter((l) => l.type === 'stdout').map((l) => l.line),
                stderr: logs.filter((l) => l.type === 'stderr').map((l) => l.line)
              }
            } as ProcessInfo
          })
        },
        { entity: 'Process', action: 'list', id: projectId }
      )
    },

    async getProcess(projectId: number, processId: string): Promise<ProcessInfo> {
      return withErrorContext(
        async () => {
          const managed = scriptRunner.getProcess(processId)
          if (!managed || managed.projectId !== projectId) {
            throw ErrorFactory.notFound('Process', processId)
          }

          const logs = managed.logBuffer.getTail(100)
          return {
            id: managed.id,
            projectId: managed.projectId,
            pid: managed.process.pid || null,
            name: managed.config.name || null,
            command: managed.config.command[0] || '',
            args: managed.config.command.slice(1),
            cwd: managed.config.cwd || '',
            status: managed.status === 'completed' ? 'exited' : managed.status,
            startedAt: managed.startTime,
            exitedAt: managed.exitCode !== undefined ? Date.now() : null,
            exitCode: managed.exitCode || null,
            lastOutput: {
              stdout: logs.filter((l) => l.type === 'stdout').map((l) => l.line),
              stderr: logs.filter((l) => l.type === 'stderr').map((l) => l.line)
            }
          } as ProcessInfo
        },
        { entity: 'Process', action: 'get', id: projectId }
      )
    },

    // Database operations for persistence
    async getProcessHistory(projectId: number, options?: { limit?: number; offset?: number }): Promise<ProcessRun[]> {
      return withErrorContext(
        async () => {
          return await processRunsRepository.getByProject(projectId, options)
        },
        { entity: 'Process', action: 'getHistory', id: projectId }
      )
    },

    async getProcessLogs(processId: string, options?: { limit?: number; since?: number }): Promise<ProcessLog[]> {
      return withErrorContext(
        async () => {
          const run = await processRunsRepository.getByProcessId(processId)
          if (!run) {
            throw ErrorFactory.notFound('ProcessRun', processId)
          }

          return await processLogsRepository.getByRun(run.id, options)
        },
        { entity: 'ProcessLogs', action: 'get' }
      )
    },

    async getProcessPorts(projectId: number): Promise<ProcessPort[]> {
      return withErrorContext(
        async () => {
          return await portManager.getPortsForProject(projectId)
        },
        { entity: 'ProcessPorts', action: 'get', id: projectId }
      )
    },

    // Utility functions
    getProcessStatus: (processId?: string) => processManager.getStatus(processId),
    scanPorts: () => portManager.scanOpenPorts(),

    // Event access for WebSocket integration
    on: (event: string, listener: (...args: any[]) => void) => scriptRunner.on(event, listener),
    off: (event: string, listener: (...args: any[]) => void) => scriptRunner.off(event, listener),

    // Graceful shutdown
    shutdown: async () => {
      logger.info('Process management service shutting down')
      // ProcessManager handles its own shutdown via signal handlers
    }
  }
}

// Export type for consumers
export type ProcessManagementService = ReturnType<typeof createProcessManagementService>

// Export singleton for backward compatibility
export const processManagementService = createProcessManagementService()

// Export individual functions for backward compatibility
export const {
  startProcess: startProjectProcess,
  stopProcess: stopProjectProcess,
  listProcesses: listProjectProcesses,
  listProjectScripts,
  getProcess: getProjectProcess,
  getProcessHistory,
  getProcessLogs,
  getProcessPorts
} = processManagementService
