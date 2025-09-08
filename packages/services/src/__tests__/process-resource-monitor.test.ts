/**
 * Unit Tests for Process Resource Monitoring
 * 
 * Tests memory and CPU monitoring, resource limits enforcement,
 * and automatic process termination on resource exhaustion
 */

import { describe, beforeEach, afterEach, test, expect, mock, spyOn } from 'bun:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'

// Mock resource monitoring class
class ProcessResourceMonitor {
  private processes = new Map<string, any>()
  private monitorInterval?: ReturnType<typeof setInterval>
  private isMonitoring = false
  private resourceCallbacks = new Map<string, (stats: any) => void>()

  constructor(private checkIntervalMs = 1000) {}

  startMonitoring(): void {
    if (this.isMonitoring) return
    
    this.isMonitoring = true
    this.monitorInterval = setInterval(() => {
      this.checkAllProcesses()
    }, this.checkIntervalMs)
  }

  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval)
    }
    this.isMonitoring = false
    this.processes.clear()
  }

  trackProcess(processId: string, pid: number, limits: {
    maxMemory?: number
    maxCpu?: number
  }): void {
    this.processes.set(processId, {
      pid,
      limits,
      violations: 0,
      lastCheck: Date.now()
    })
  }

  untrackProcess(processId: string): void {
    this.processes.delete(processId)
    this.resourceCallbacks.delete(processId)
  }

  onResourceViolation(processId: string, callback: (stats: any) => void): void {
    this.resourceCallbacks.set(processId, callback)
  }

  getProcessStats(processId: string): any {
    return this.processes.get(processId)
  }

  private checkAllProcesses(): void {
    for (const [processId, processInfo] of this.processes.entries()) {
      this.checkProcessResources(processId, processInfo)
    }
  }

  private async checkProcessResources(processId: string, processInfo: any): Promise<void> {
    try {
      // Mock getting process stats
      const stats = await this.getSystemStats(processInfo.pid)
      
      if (this.isResourceViolation(stats, processInfo.limits)) {
        processInfo.violations++
        
        if (processInfo.violations >= 3) {
          const callback = this.resourceCallbacks.get(processId)
          if (callback) {
            callback({
              processId,
              violation: 'resource_limit',
              stats,
              limits: processInfo.limits
            })
          }
        }
      } else {
        processInfo.violations = Math.max(0, processInfo.violations - 1)
      }
    } catch (error) {
      // Process may have ended
      this.untrackProcess(processId)
    }
  }

  private async getSystemStats(pid: number): Promise<any> {
    // Mock implementation - in real world would use ps, proc filesystem, or native APIs
    return {
      pid,
      memoryMB: Math.random() * 1000, // Random memory usage 0-1000MB
      cpuPercent: Math.random() * 200, // Random CPU 0-200%
      timestamp: Date.now()
    }
  }

  private isResourceViolation(stats: any, limits: any): boolean {
    if (limits.maxMemory && stats.memoryMB * 1024 * 1024 > limits.maxMemory) {
      return true
    }
    
    if (limits.maxCpu && stats.cpuPercent > limits.maxCpu * 50) { // 50% per CPU core
      return true
    }
    
    return false
  }
}

describe('ProcessResourceMonitor', () => {
  let monitor: ProcessResourceMonitor
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'resource-monitor-test-'))
    monitor = new ProcessResourceMonitor(100) // Check every 100ms for testing
  })

  afterEach(async () => {
    monitor.stopMonitoring()
    await rm(tempDir, { recursive: true, force: true })
  })

  describe('Monitoring Lifecycle', () => {
    test('should start and stop monitoring', () => {
      expect(monitor.isMonitoring).toBe(false)
      
      monitor.startMonitoring()
      expect(monitor.isMonitoring).toBe(true)
      
      monitor.stopMonitoring()
      expect(monitor.isMonitoring).toBe(false)
    })

    test('should not start monitoring twice', () => {
      monitor.startMonitoring()
      const firstState = monitor.isMonitoring
      
      monitor.startMonitoring() // Should be no-op
      expect(monitor.isMonitoring).toBe(firstState)
    })

    test('should handle stop monitoring when not started', () => {
      expect(() => monitor.stopMonitoring()).not.toThrow()
    })
  })

  describe('Process Tracking', () => {
    beforeEach(() => {
      monitor.startMonitoring()
    })

    test('should track process with resource limits', () => {
      const limits = {
        maxMemory: 512 * 1024 * 1024, // 512MB
        maxCpu: 2
      }

      monitor.trackProcess('proc1', 12345, limits)
      
      const stats = monitor.getProcessStats('proc1')
      expect(stats).toBeDefined()
      expect(stats.pid).toBe(12345)
      expect(stats.limits).toEqual(limits)
      expect(stats.violations).toBe(0)
    })

    test('should untrack process', () => {
      monitor.trackProcess('proc1', 12345, { maxMemory: 1024 })
      expect(monitor.getProcessStats('proc1')).toBeDefined()
      
      monitor.untrackProcess('proc1')
      expect(monitor.getProcessStats('proc1')).toBeUndefined()
    })

    test('should track multiple processes', () => {
      monitor.trackProcess('proc1', 12345, { maxMemory: 512 * 1024 * 1024 })
      monitor.trackProcess('proc2', 12346, { maxCpu: 2 })
      monitor.trackProcess('proc3', 12347, { maxMemory: 256 * 1024 * 1024, maxCpu: 1 })

      expect(monitor.getProcessStats('proc1')).toBeDefined()
      expect(monitor.getProcessStats('proc2')).toBeDefined()
      expect(monitor.getProcessStats('proc3')).toBeDefined()
    })
  })

  describe('Resource Violation Detection', () => {
    beforeEach(() => {
      monitor.startMonitoring()
    })

    test('should detect memory violations', async () => {
      const violations: any[] = []
      
      monitor.trackProcess('proc1', 12345, {
        maxMemory: 100 * 1024 * 1024 // 100MB limit
      })

      monitor.onResourceViolation('proc1', (stats) => {
        violations.push(stats)
      })

      // Mock high memory usage
      const originalGetSystemStats = (monitor as any).getSystemStats
      spyOn(monitor as any, 'getSystemStats').mockImplementation(async (pid) => ({
        pid,
        memoryMB: 500, // 500MB usage (exceeds 100MB limit)
        cpuPercent: 10,
        timestamp: Date.now()
      }))

      // Wait for multiple monitoring cycles to trigger violation
      await new Promise(resolve => setTimeout(resolve, 400))

      expect(violations.length).toBeGreaterThan(0)
      expect(violations[0].violation).toBe('resource_limit')
      expect(violations[0].stats.memoryMB).toBe(500)
    })

    test('should detect CPU violations', async () => {
      const violations: any[] = []
      
      monitor.trackProcess('proc1', 12345, {
        maxCpu: 1 // 1 CPU core limit
      })

      monitor.onResourceViolation('proc1', (stats) => {
        violations.push(stats)
      })

      // Mock high CPU usage
      spyOn(monitor as any, 'getSystemStats').mockImplementation(async (pid) => ({
        pid,
        memoryMB: 50,
        cpuPercent: 150, // 150% CPU (exceeds 1 core = 50%)
        timestamp: Date.now()
      }))

      // Wait for violations to be detected
      await new Promise(resolve => setTimeout(resolve, 400))

      expect(violations.length).toBeGreaterThan(0)
      expect(violations[0].stats.cpuPercent).toBe(150)
    })

    test('should require multiple violations before triggering callback', async () => {
      const violations: any[] = []
      
      monitor.trackProcess('proc1', 12345, {
        maxMemory: 100 * 1024 * 1024
      })

      monitor.onResourceViolation('proc1', (stats) => {
        violations.push(stats)
      })

      let violationCount = 0
      spyOn(monitor as any, 'getSystemStats').mockImplementation(async (pid) => {
        violationCount++
        return {
          pid,
          memoryMB: violationCount < 3 ? 500 : 50, // Violate first 2 times, then normal
          cpuPercent: 10,
          timestamp: Date.now()
        }
      })

      // Wait for multiple checks
      await new Promise(resolve => setTimeout(resolve, 400))

      // Should not trigger callback until 3rd violation
      expect(violations.length).toBe(0)

      // Reset to continuous violations
      spyOn(monitor as any, 'getSystemStats').mockImplementation(async (pid) => ({
        pid,
        memoryMB: 500,
        cpuPercent: 10,
        timestamp: Date.now()
      }))

      await new Promise(resolve => setTimeout(resolve, 400))
      expect(violations.length).toBeGreaterThan(0)
    })

    test('should reset violation count when resource usage is normal', async () => {
      const violations: any[] = []
      
      monitor.trackProcess('proc1', 12345, {
        maxMemory: 100 * 1024 * 1024
      })

      monitor.onResourceViolation('proc1', (stats) => {
        violations.push(stats)
      })

      let checkCount = 0
      spyOn(monitor as any, 'getSystemStats').mockImplementation(async (pid) => {
        checkCount++
        return {
          pid,
          // Alternating high/low usage to test violation reset
          memoryMB: checkCount % 2 === 0 ? 500 : 50,
          cpuPercent: 10,
          timestamp: Date.now()
        }
      })

      await new Promise(resolve => setTimeout(resolve, 800))

      // Should not trigger callback due to alternating usage
      expect(violations.length).toBe(0)

      const stats = monitor.getProcessStats('proc1')
      expect(stats.violations).toBeLessThan(3)
    })
  })

  describe('Resource Limit Enforcement Integration', () => {
    test('should integrate with process manager for automatic termination', async () => {
      const killedProcesses: string[] = []
      
      // Mock process manager that kills processes
      const mockProcessManager = {
        terminateProcess: mock((processId: string, signal = 'SIGTERM') => {
          killedProcesses.push(processId)
          return Promise.resolve(true)
        })
      }

      monitor.startMonitoring()
      monitor.trackProcess('proc1', 12345, {
        maxMemory: 100 * 1024 * 1024
      })

      monitor.onResourceViolation('proc1', async (stats) => {
        // Simulate process manager killing the process
        await mockProcessManager.terminateProcess(stats.processId, 'SIGKILL')
        monitor.untrackProcess(stats.processId)
      })

      // Mock continuous high memory usage
      spyOn(monitor as any, 'getSystemStats').mockImplementation(async (pid) => ({
        pid,
        memoryMB: 500,
        cpuPercent: 10,
        timestamp: Date.now()
      }))

      await new Promise(resolve => setTimeout(resolve, 400))

      expect(killedProcesses).toContain('proc1')
      expect(mockProcessManager.terminateProcess).toHaveBeenCalledWith('proc1', 'SIGKILL')
    })

    test('should handle different resource limit policies', async () => {
      const policies = [
        { maxMemory: 128 * 1024 * 1024, policy: 'kill' },
        { maxCpu: 2, policy: 'throttle' },
        { maxMemory: 256 * 1024 * 1024, maxCpu: 1, policy: 'warn' }
      ]

      const actions: any[] = []

      monitor.startMonitoring()

      policies.forEach((policy, i) => {
        const processId = `proc${i + 1}`
        monitor.trackProcess(processId, 12345 + i, policy)
        
        monitor.onResourceViolation(processId, (stats) => {
          actions.push({
            processId,
            policy: policy.policy,
            violation: stats.violation
          })
        })
      })

      // Mock violations for all processes
      spyOn(monitor as any, 'getSystemStats').mockImplementation(async (pid) => ({
        pid,
        memoryMB: 500, // Exceeds all memory limits
        cpuPercent: 200, // Exceeds all CPU limits
        timestamp: Date.now()
      }))

      await new Promise(resolve => setTimeout(resolve, 400))

      expect(actions.length).toBeGreaterThan(0)
      
      // Each process should have triggered its policy
      const processIds = actions.map(a => a.processId)
      expect(processIds).toContain('proc1')
      expect(processIds).toContain('proc2')
      expect(processIds).toContain('proc3')
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      monitor.startMonitoring()
    })

    test('should handle process that no longer exists', async () => {
      monitor.trackProcess('proc1', 99999, { maxMemory: 100 * 1024 * 1024 })
      
      // Mock getSystemStats to throw error (process not found)
      spyOn(monitor as any, 'getSystemStats').mockRejectedValue(
        new Error('Process not found')
      )

      expect(monitor.getProcessStats('proc1')).toBeDefined()

      await new Promise(resolve => setTimeout(resolve, 200))

      // Process should be automatically untracked
      expect(monitor.getProcessStats('proc1')).toBeUndefined()
    })

    test('should continue monitoring other processes when one fails', async () => {
      monitor.trackProcess('proc1', 12345, { maxMemory: 100 * 1024 * 1024 })
      monitor.trackProcess('proc2', 12346, { maxCpu: 2 })

      let callCount = 0
      spyOn(monitor as any, 'getSystemStats').mockImplementation(async (pid) => {
        callCount++
        if (pid === 12345) {
          throw new Error('Process 1 not found')
        }
        return {
          pid,
          memoryMB: 50,
          cpuPercent: 10,
          timestamp: Date.now()
        }
      })

      await new Promise(resolve => setTimeout(resolve, 200))

      // proc1 should be untracked, proc2 should remain
      expect(monitor.getProcessStats('proc1')).toBeUndefined()
      expect(monitor.getProcessStats('proc2')).toBeDefined()
      expect(callCount).toBeGreaterThan(2) // Should continue trying both
    })

    test('should not crash on malformed resource stats', async () => {
      const violations: any[] = []
      
      monitor.trackProcess('proc1', 12345, {
        maxMemory: 100 * 1024 * 1024,
        maxCpu: 2
      })

      monitor.onResourceViolation('proc1', (stats) => {
        violations.push(stats)
      })

      // Mock malformed stats
      spyOn(monitor as any, 'getSystemStats').mockImplementation(async (pid) => ({
        pid,
        // Missing required fields or malformed data
        memoryMB: null,
        cpuPercent: undefined,
        timestamp: Date.now()
      }))

      await new Promise(resolve => setTimeout(resolve, 200))

      // Should not crash, but also should not trigger violations
      expect(violations.length).toBe(0)
      expect(monitor.getProcessStats('proc1')).toBeDefined()
    })
  })

  describe('Performance and Scalability', () => {
    test('should handle monitoring many processes efficiently', async () => {
      monitor.startMonitoring()

      // Track 100 processes
      for (let i = 0; i < 100; i++) {
        monitor.trackProcess(`proc${i}`, 12345 + i, {
          maxMemory: (100 + i) * 1024 * 1024,
          maxCpu: 1 + (i % 4)
        })
      }

      let statsCalls = 0
      spyOn(monitor as any, 'getSystemStats').mockImplementation(async (pid) => {
        statsCalls++
        return {
          pid,
          memoryMB: Math.random() * 200,
          cpuPercent: Math.random() * 100,
          timestamp: Date.now()
        }
      })

      await new Promise(resolve => setTimeout(resolve, 300))

      // Should have called getSystemStats for all processes
      expect(statsCalls).toBeGreaterThan(100)

      // All processes should still be tracked
      for (let i = 0; i < 100; i++) {
        expect(monitor.getProcessStats(`proc${i}`)).toBeDefined()
      }
    })
  })
})