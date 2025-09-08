/**
 * Process Resource Monitoring and Enforcement
 * 
 * This module provides real-time monitoring of process resource usage
 * and automatic enforcement of resource limits to prevent system abuse.
 * 
 * Features:
 * - Real-time CPU and memory monitoring
 * - Configurable resource limits per process
 * - Automatic process termination on resource exhaustion
 * - Resource usage statistics and reporting
 * - Integration with process management lifecycle
 */

import { EventEmitter } from 'node:events'
import { spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { createServiceLogger } from '../core/base-service'
import { cpus, totalmem } from 'node:os'
import { ErrorFactory } from '@promptliano/shared'

export interface ProcessResourceUsage {
  pid: number
  processId: string
  timestamp: number
  memoryMB: number
  memoryPercent: number
  cpuPercent: number
  cpuTime: {
    user: number
    system: number
  }
  threads: number
  openFiles?: number
  networkConnections?: number
}

export interface ResourceLimits {
  maxMemoryMB: number      // Maximum memory in MB
  maxCpuPercent: number    // Maximum CPU percentage (100% = 1 core)
  maxThreads?: number      // Maximum number of threads
  maxOpenFiles?: number    // Maximum open file descriptors
  maxNetworkConnections?: number // Maximum network connections
}

export interface ResourceViolation {
  processId: string
  pid: number
  violationType: 'memory' | 'cpu' | 'threads' | 'files' | 'network'
  currentUsage: number
  limit: number
  timestamp: number
  severity: 'warning' | 'critical'
}

export interface MonitoredProcess {
  processId: string
  pid: number
  limits: ResourceLimits
  violations: number
  lastCheck: number
  consecutiveViolations: number
  totalViolations: number
  startTime: number
}

export class ProcessResourceMonitor extends EventEmitter {
  private logger = createServiceLogger('ResourceMonitor')
  private monitoredProcesses = new Map<string, MonitoredProcess>()
  private monitorInterval?: ReturnType<typeof setInterval>
  private isRunning = false
  private prevWindowsCpu = new Map<number, { cpuSeconds: number; timestampMs: number }>()
  
  // Configuration
  private readonly checkIntervalMs: number
  private readonly violationThreshold: number
  private readonly criticalThreshold: number
  
  constructor(options: {
    checkIntervalMs?: number      // How often to check (default: 5000ms)
    violationThreshold?: number   // Consecutive violations before action (default: 3)
    criticalThreshold?: number    // Violations before immediate termination (default: 5)
  } = {}) {
    super()
    
    this.checkIntervalMs = options.checkIntervalMs || 5000
    this.violationThreshold = options.violationThreshold || 3
    this.criticalThreshold = options.criticalThreshold || 5
  }

  // Typed event helpers limited to this monitor instance
  override on<K extends keyof ResourceMonitorEvents>(
    event: K,
    listener: ResourceMonitorEvents[K]
  ): this {
    return super.on(event as string, listener as any)
  }

  override emit<K extends keyof ResourceMonitorEvents>(
    event: K,
    ...args: Parameters<ResourceMonitorEvents[K]>
  ): boolean {
    return super.emit(event as string, ...(args as any))
  }

  /**
   * Start monitoring all registered processes
   */
  startMonitoring(): void {
    if (this.isRunning) {
      this.logger.warn('Resource monitor already running')
      return
    }

    this.isRunning = true
    this.monitorInterval = setInterval(() => {
      this.checkAllProcesses().catch(error => {
        this.logger.error('Error during resource monitoring cycle', { error })
      })
    }, this.checkIntervalMs)

    this.logger.info('Resource monitoring started', {
      checkInterval: this.checkIntervalMs,
      violationThreshold: this.violationThreshold
    })
  }

  /**
   * Stop monitoring and clean up
   */
  stopMonitoring(): void {
    if (!this.isRunning) return

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval)
      this.monitorInterval = undefined
    }

    this.isRunning = false
    this.monitoredProcesses.clear()
    
    this.logger.info('Resource monitoring stopped')
  }

  /**
   * Add a process to monitoring
   */
  monitorProcess(processId: string, pid: number, limits: ResourceLimits): void {
    const monitoredProcess: MonitoredProcess = {
      processId,
      pid,
      limits,
      violations: 0,
      lastCheck: Date.now(),
      consecutiveViolations: 0,
      totalViolations: 0,
      startTime: Date.now()
    }

    this.monitoredProcesses.set(processId, monitoredProcess)
    
    this.logger.debug('Process added to monitoring', {
      processId,
      pid,
      limits
    })

    this.emit('process-monitored', { processId, pid, limits })
  }

  /**
   * Remove process from monitoring
   */
  stopMonitoringProcess(processId: string): void {
    const removed = this.monitoredProcesses.delete(processId)
    
    if (removed) {
      this.logger.debug('Process removed from monitoring', { processId })
      this.emit('process-unmonitored', { processId })
    }
  }

  /**
   * Get current resource usage for a process
   */
  async getProcessUsage(processId: string): Promise<ProcessResourceUsage | null> {
    const monitored = this.monitoredProcesses.get(processId)
    if (!monitored) return null

    try {
      return await this.gatherProcessStats(monitored.pid, processId)
    } catch (error) {
      this.logger.warn('Failed to get process usage', { processId, error })
      return null
    }
  }

  /**
   * Get monitoring status for all processes
   */
  getMonitoringStatus(): Array<{
    processId: string
    pid: number
    limits: ResourceLimits
    violations: number
    consecutiveViolations: number
    totalViolations: number
    lastCheck: number
    monitoringDuration: number
  }> {
    const now = Date.now()
    
    return Array.from(this.monitoredProcesses.values()).map(process => ({
      processId: process.processId,
      pid: process.pid,
      limits: process.limits,
      violations: process.violations,
      consecutiveViolations: process.consecutiveViolations,
      totalViolations: process.totalViolations,
      lastCheck: process.lastCheck,
      monitoringDuration: now - process.startTime
    }))
  }

  /**
   * Check all monitored processes for resource violations
   */
  private async checkAllProcesses(): Promise<void> {
    const promises = Array.from(this.monitoredProcesses.values()).map(async (process) => {
      try {
        await this.checkProcess(process)
      } catch (error) {
        this.logger.warn('Error checking process', {
          processId: process.processId,
          pid: process.pid,
          error
        })
        
        // If process is not found, remove it from monitoring
        if (this.isProcessNotFoundError(error)) {
          this.stopMonitoringProcess(process.processId)
        }
      }
    })

    await Promise.allSettled(promises)
  }

  /**
   * Check individual process for resource violations
   */
  private async checkProcess(monitored: MonitoredProcess): Promise<void> {
    const usage = await this.gatherProcessStats(monitored.pid, monitored.processId)
    const now = Date.now()
    
    monitored.lastCheck = now

    // Check for violations
    const violations = this.detectViolations(usage, monitored.limits)
    
    if (violations.length > 0) {
      monitored.consecutiveViolations++
      monitored.totalViolations += violations.length
      
      // Emit violation events
      for (const violation of violations) {
        this.emit('resource-violation', violation)
        
        this.logger.warn('Resource violation detected', {
          processId: monitored.processId,
          pid: monitored.pid,
          violation
        })
      }

      // Take action based on violation severity and count
      await this.handleViolations(monitored, violations)
      
    } else {
      // Reset consecutive violations on normal usage
      monitored.consecutiveViolations = Math.max(0, monitored.consecutiveViolations - 1)
    }

    // Emit usage stats
    this.emit('resource-usage', usage)
  }

  /**
   * Gather resource statistics for a process
   */
  private async gatherProcessStats(pid: number, processId: string): Promise<ProcessResourceUsage> {
    if (process.platform === 'win32') {
      return await this.getWindowsProcessStats(pid, processId)
    } else {
      return await this.getUnixProcessStats(pid, processId)
    }
  }

  /**
   * Get process stats on Unix-like systems (Linux, macOS)
   */
  private async getUnixProcessStats(pid: number, processId: string): Promise<ProcessResourceUsage> {
    try {
      // Use ps command to get detailed process information
      const psOutput = await this.executeCommand([
        'ps', '-o', 'pid,ppid,%cpu,%mem,rss,vsz,time,nlwp,comm', '-p', pid.toString()
      ])

      const lines = psOutput.trim().split('\n')
      if (lines.length < 2) {
        throw new Error(`Process ${pid} not found`)
      }

      const dataLine = lines[1]!
      const data = dataLine.trim().split(/\s+/)
      
      // Parse ps output
      const cpuPercent = parseFloat(data[2] ?? '0') || 0
      const memPercent = parseFloat(data[3] ?? '0') || 0
      const rssKB = parseInt(data[4] ?? '0', 10) || 0
      const rssMB = rssKB / 1024
      const threads = parseInt(data[7] ?? '1', 10) || 1

      // Get additional CPU time info
      const cpuTimeStr = data[6] ?? '0:00'
      const [minutes = 0, seconds = 0] = cpuTimeStr.split(':').map(Number)
      const totalCpuTime = minutes * 60 + seconds

      return {
        pid,
        processId,
        timestamp: Date.now(),
        memoryMB: rssMB,
        memoryPercent: memPercent,
        cpuPercent,
        cpuTime: {
          user: totalCpuTime,
          system: 0 // ps doesn't separate user/system easily
        },
        threads
      }
    } catch (error) {
      // Fallback to basic process information
      this.logger.debug('Failed to get detailed process stats, using fallback', { pid, error })
      
      return {
        pid,
        processId,
        timestamp: Date.now(),
        memoryMB: 0,
        memoryPercent: 0,
        cpuPercent: 0,
        cpuTime: { user: 0, system: 0 },
        threads: 1
      }
    }
  }

  /**
   * Get process stats on Windows
   */
  private async getWindowsProcessStats(pid: number, processId: string): Promise<ProcessResourceUsage> {
    try {
      const psScript = `
        try {
          $p = Get-Process -Id ${pid} -ErrorAction Stop
          [PSCustomObject]@{
            WorkingSetMB = [Math]::Round($p.WorkingSet64 / 1MB, 2)
            Threads = $p.Threads.Count
            CPUSeconds = $p.TotalProcessorTime.TotalSeconds
          } | ConvertTo-Json -Compress
        } catch {
          ''
        }
      `
      let output = ''
      try {
        output = await this.executeCommand(['powershell', '-NoProfile', '-Command', psScript])
      } catch {
        output = await this.executeCommand(['pwsh', '-NoProfile', '-Command', psScript])
      }

      if (!output || !output.trim()) throw new Error(`Process ${pid} not found`)
      const data = JSON.parse(output)

      const now = Date.now()
      const prev = this.prevWindowsCpu.get(pid)
      const cpuSeconds = Number(data.CPUSeconds || 0)
      let cpuPercent = 0
      if (prev && cpuSeconds >= prev.cpuSeconds) {
        const deltaCpu = cpuSeconds - prev.cpuSeconds
        const deltaWall = (now - prev.timestampMs) / 1000
        if (deltaWall > 0) {
          const cores = Math.max(1, cpus()?.length || 1)
          cpuPercent = (deltaCpu / deltaWall) * 100 / cores
        }
      }
      this.prevWindowsCpu.set(pid, { cpuSeconds, timestampMs: now })

      const memoryMB = Number(data.WorkingSetMB || 0)
      const totalMemMB = totalmem() / (1024 * 1024)
      const memoryPercent = totalMemMB > 0 ? (memoryMB / totalMemMB) * 100 : 0
      const threads = Number(data.Threads || 1)

      return {
        pid,
        processId,
        timestamp: now,
        memoryMB,
        memoryPercent,
        cpuPercent,
        cpuTime: { user: 0, system: 0 },
        threads
      }
    } catch (error) {
      // Fallback for Windows
      return {
        pid,
        processId,
        timestamp: Date.now(),
        memoryMB: 0,
        memoryPercent: 0,
        cpuPercent: 0,
        cpuTime: { user: 0, system: 0 },
        threads: 1
      }
    }
  }

  /**
   * Execute system command and return stdout
   */
  private executeCommand(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const [command, ...cmdArgs] = args
      if (!command) {
        reject(new Error('No command provided'))
        return
      }

      // Explicitly assert non-null stdio streams
      const child = spawn(command, cmdArgs, {
        stdio: ['ignore', 'pipe', 'pipe']
      }) as unknown as import('node:child_process').ChildProcessWithoutNullStreams

      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString()
      })

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      child.on('close', (code: number | null) => {
        if (code === 0) {
          resolve(stdout)
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`))
        }
      })

      child.on('error', reject)
    })
  }

  /**
   * Detect resource violations based on current usage and limits
   */
  private detectViolations(usage: ProcessResourceUsage, limits: ResourceLimits): ResourceViolation[] {
    const violations: ResourceViolation[] = []
    const now = Date.now()

    // Memory violation
    if (usage.memoryMB > limits.maxMemoryMB) {
      violations.push({
        processId: usage.processId,
        pid: usage.pid,
        violationType: 'memory',
        currentUsage: usage.memoryMB,
        limit: limits.maxMemoryMB,
        timestamp: now,
        severity: usage.memoryMB > limits.maxMemoryMB * 1.5 ? 'critical' : 'warning'
      })
    }

    // CPU violation
    if (usage.cpuPercent > limits.maxCpuPercent) {
      violations.push({
        processId: usage.processId,
        pid: usage.pid,
        violationType: 'cpu',
        currentUsage: usage.cpuPercent,
        limit: limits.maxCpuPercent,
        timestamp: now,
        severity: usage.cpuPercent > limits.maxCpuPercent * 1.5 ? 'critical' : 'warning'
      })
    }

    // Thread count violation
    if (limits.maxThreads && usage.threads > limits.maxThreads) {
      violations.push({
        processId: usage.processId,
        pid: usage.pid,
        violationType: 'threads',
        currentUsage: usage.threads,
        limit: limits.maxThreads,
        timestamp: now,
        severity: usage.threads > limits.maxThreads * 2 ? 'critical' : 'warning'
      })
    }

    return violations
  }

  /**
   * Handle resource violations with appropriate actions
   */
  private async handleViolations(
    monitored: MonitoredProcess,
    violations: ResourceViolation[]
  ): Promise<void> {
    const criticalViolations = violations.filter(v => v.severity === 'critical')
    const hasConsecutiveViolations = monitored.consecutiveViolations >= this.violationThreshold
    const hasCriticalViolations = criticalViolations.length > 0
    const shouldTerminate = monitored.consecutiveViolations >= this.criticalThreshold

    if (shouldTerminate || hasCriticalViolations) {
      // Emit termination request
      this.emit('resource-termination-required', {
        processId: monitored.processId,
        pid: monitored.pid,
        reason: shouldTerminate ? 'excessive_violations' : 'critical_violation',
        violations,
        consecutiveViolations: monitored.consecutiveViolations,
        totalViolations: monitored.totalViolations
      })

      this.logger.error('Process termination required due to resource violations', {
        processId: monitored.processId,
        pid: monitored.pid,
        consecutiveViolations: monitored.consecutiveViolations,
        totalViolations: monitored.totalViolations,
        violations
      })

    } else if (hasConsecutiveViolations) {
      // Emit warning for consecutive violations
      this.emit('resource-warning', {
        processId: monitored.processId,
        pid: monitored.pid,
        consecutiveViolations: monitored.consecutiveViolations,
        violations
      })

      this.logger.warn('Process approaching resource termination threshold', {
        processId: monitored.processId,
        consecutiveViolations: monitored.consecutiveViolations,
        threshold: this.criticalThreshold
      })
    }
  }

  /**
   * Check if error indicates process not found
   */
  private isProcessNotFoundError(error: any): boolean {
    const message = error?.message?.toLowerCase() || ''
    return message.includes('not found') || 
           message.includes('no such process') ||
           message.includes('access denied')
  }

  /**
   * Get resource monitoring statistics
   */
  getStatistics(): {
    totalProcesses: number
    violatingProcesses: number
    totalViolations: number
    averageViolationsPerProcess: number
    monitoringUptime: number
  } {
    const processes = Array.from(this.monitoredProcesses.values())
    const violatingProcesses = processes.filter(p => p.totalViolations > 0)
    const totalViolations = processes.reduce((sum, p) => sum + p.totalViolations, 0)

    return {
      totalProcesses: processes.length,
      violatingProcesses: violatingProcesses.length,
      totalViolations,
      averageViolationsPerProcess: processes.length > 0 ? totalViolations / processes.length : 0,
      monitoringUptime: this.isRunning ? Date.now() - (this.monitorInterval ? 0 : Date.now()) : 0
    }
  }
}

// Default instance for global use
export const processResourceMonitor = new ProcessResourceMonitor()

// Event type definitions for better TypeScript support
export interface ResourceMonitorEvents {
  'process-monitored': (data: { processId: string; pid: number; limits: ResourceLimits }) => void
  'process-unmonitored': (data: { processId: string }) => void
  'resource-usage': (usage: ProcessResourceUsage) => void
  'resource-violation': (violation: ResourceViolation) => void
  'resource-warning': (data: { processId: string; pid: number; consecutiveViolations: number; violations: ResourceViolation[] }) => void
  'resource-termination-required': (data: { 
    processId: string
    pid: number
    reason: string
    violations: ResourceViolation[]
    consecutiveViolations: number
    totalViolations: number
  }) => void
}
