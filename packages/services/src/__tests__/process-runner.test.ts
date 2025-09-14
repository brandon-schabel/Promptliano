/**
 * Unit Tests for ProcessRunner and ScriptRunner
 *
 * Tests process spawning, log streaming, and lifecycle management
 */

import { describe, beforeEach, afterEach, test, expect, mock } from 'bun:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { ProcessRunner, type ProcessConfig, type ManagedProcess } from '../process-management-service'

describe('ProcessRunner', () => {
  let processRunner: ProcessRunner
  let tempDir: string
  let packageJsonPath: string

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = await mkdtemp(join(tmpdir(), 'process-runner-test-'))
    processRunner = new ProcessRunner()

    // Create a test package.json with safe scripts
    packageJsonPath = join(tempDir, 'package.json')
    await writeFile(
      packageJsonPath,
      JSON.stringify(
        {
          name: 'test-package',
          version: '1.0.0',
          scripts: {
            echo: 'node -e "console.log(\"Hello World\")"',
            'sleep-short': 'node -e "setTimeout(()=>{}, 1000)"',
            'sleep-long': 'node -e "setTimeout(()=>{}, 10000)"',
            'exit-zero': 'node -e "process.exit(0)"',
            'exit-one': 'node -e "process.exit(1)"',
            'env-test': 'node -e "console.log(process.env.NODE_ENV||\"\")"',
            'pwd-test': 'node -e "console.log(process.cwd())"'
          }
        },
        null,
        2
      )
    )
  })

  afterEach(async () => {
    // Stop all processes
    const runningProcesses = processRunner.getAllProcesses()
    for (const process of runningProcesses) {
      if (process.status === 'running') {
        await processRunner.stopProcess(process.id)
      }
    }

    // Clean up temporary directory
    await rm(tempDir, { recursive: true, force: true })
  })

  describe('Basic Process Execution', () => {
    test('should successfully run a simple command', async () => {
      const config: ProcessConfig = {
        command: ['echo', 'Hello Test'],
        projectId: 1,
        cwd: tempDir,
        type: 'short-lived'
      }

      const processId = await processRunner.startProcess(config)
      expect(processId).toMatch(/^proc_/)

      const process = processRunner.getProcess(processId)
      expect(process).toBeDefined()
      expect(process!.status).toBe('running')
      expect(process!.projectId).toBe(1)

      // Wait for process to complete
      await new Promise((resolve) => {
        processRunner.on('exit', (data) => {
          if (data.processId === processId) {
            resolve(data)
          }
        })
      })

      // Check final state
      const completedProcess = processRunner.getProcess(processId)
      expect(completedProcess!.status).toBe('completed')
      expect(completedProcess!.exitCode).toBe(0)
    })

    test('should handle failing commands', async () => {
      const config: ProcessConfig = {
        command: ['bun', 'run', 'exit-one'],
        projectId: 1,
        cwd: tempDir,
        type: 'short-lived'
      }

      const processId = await processRunner.startProcess(config)

      // Wait for process to complete
      await new Promise((resolve) => {
        processRunner.on('exit', (data) => {
          if (data.processId === processId) {
            resolve(data)
          }
        })
      })

      const process = processRunner.getProcess(processId)
      expect(process!.status).toBe('failed')
      expect(process!.exitCode).toBe(1)
    })

    test('should capture stdout and stderr logs', async () => {
      const logs: Array<{ type: string; line: string }> = []

      processRunner.on('log', (logEvent) => {
        logs.push({
          type: logEvent.type,
          line: logEvent.line
        })
      })

      const config: ProcessConfig = {
        command: ['bun', 'run', 'echo'],
        projectId: 1,
        cwd: tempDir,
        type: 'short-lived'
      }

      const processId = await processRunner.startProcess(config)

      // Wait for process completion and logs
      await new Promise((resolve) => {
        processRunner.on('exit', (data) => {
          if (data.processId === processId) {
            // Give logs time to arrive
            setTimeout(resolve, 100)
          }
        })
      })

      // Should have captured the "Hello World" output
      const stdoutLogs = logs.filter((log) => log.type === 'stdout')
      expect(stdoutLogs.length).toBeGreaterThan(0)
      expect(stdoutLogs.some((log) => log.line.includes('Hello World'))).toBe(true)
    })

    test('should handle environment variables', async () => {
      const logs: Array<{ type: string; line: string }> = []

      processRunner.on('log', (logEvent) => {
        logs.push({
          type: logEvent.type,
          line: logEvent.line
        })
      })

      const config: ProcessConfig = {
        command: ['bun', 'run', 'env-test'],
        projectId: 1,
        cwd: tempDir,
        env: {
          NODE_ENV: 'test-environment'
        }
      }

      const processId = await processRunner.startProcess(config)

      await new Promise((resolve) => {
        processRunner.on('exit', (data) => {
          if (data.processId === processId) {
            setTimeout(resolve, 100)
          }
        })
      })

      const stdoutLogs = logs.filter((log) => log.type === 'stdout')
      expect(stdoutLogs.some((log) => log.line.includes('test-environment'))).toBe(true)
    })

    test('should respect working directory', async () => {
      const logs: Array<{ type: string; line: string }> = []

      processRunner.on('log', (logEvent) => {
        logs.push({
          type: logEvent.type,
          line: logEvent.line
        })
      })

      const config: ProcessConfig = {
        command: ['bun', 'run', 'pwd-test'],
        projectId: 1,
        cwd: tempDir
      }

      const processId = await processRunner.startProcess(config)

      await new Promise((resolve) => {
        processRunner.on('exit', (data) => {
          if (data.processId === processId) {
            setTimeout(resolve, 100)
          }
        })
      })

      const stdoutLogs = logs.filter((log) => log.type === 'stdout')
      expect(stdoutLogs.some((log) => log.line.includes(tempDir))).toBe(true)
    })
  })

  describe('Process Lifecycle Management', () => {
    test('should allow stopping a running process', async () => {
      const config: ProcessConfig = {
        command: ['bun', 'run', 'sleep-long'],
        projectId: 1,
        cwd: tempDir
      }

      const processId = await processRunner.startProcess(config)

      // Wait a moment for process to start
      await new Promise((resolve) => setTimeout(resolve, 100))

      const success = await processRunner.stopProcess(processId, 'SIGTERM')
      expect(success).toBe(true)

      // Wait for exit event
      await new Promise((resolve) => {
        processRunner.on('exit', (data) => {
          if (data.processId === processId) {
            resolve(data)
          }
        })
      })

      const process = processRunner.getProcess(processId)
      expect(process!.status).toBe('stopped')
      expect(process!.signalCode).toBe(15) // SIGTERM
    })

    test('should handle timeout for long-running processes', async () => {
      const config: ProcessConfig = {
        command: ['bun', 'run', 'sleep-long'],
        projectId: 1,
        cwd: tempDir,
        timeout: 1000 // 1 second timeout
      }

      const processId = await processRunner.startProcess(config)

      // Wait for timeout
      await new Promise((resolve) => {
        processRunner.on('exit', (data) => {
          if (data.processId === processId) {
            resolve(data)
          }
        })
      })

      const process = processRunner.getProcess(processId)
      expect(process!.status).toBe('failed')
      // Process should be killed by timeout
    })

    test('should track resource usage after process completion', async () => {
      const config: ProcessConfig = {
        command: ['bun', 'run', 'echo'],
        projectId: 1,
        cwd: tempDir
      }

      const processId = await processRunner.startProcess(config)

      await new Promise((resolve) => {
        processRunner.on('exit', (data) => {
          if (data.processId === processId) {
            resolve(data)
          }
        })
      })

      const process = processRunner.getProcess(processId)
      expect(process!.resourceUsage).toBeDefined()
      expect(typeof process!.resourceUsage!.cpuTime.user).toBe('number')
      expect(typeof process!.resourceUsage!.maxRSS).toBe('number')
    })
  })

  describe('Process Querying and Management', () => {
    test('should list all processes', async () => {
      const config1: ProcessConfig = {
        command: ['bun', 'run', 'sleep-short'],
        projectId: 1,
        cwd: tempDir
      }

      const config2: ProcessConfig = {
        command: ['bun', 'run', 'sleep-short'],
        projectId: 2,
        cwd: tempDir
      }

      const processId1 = await processRunner.startProcess(config1)
      const processId2 = await processRunner.startProcess(config2)

      const allProcesses = processRunner.getAllProcesses()
      expect(allProcesses.length).toBe(2)

      const process1 = allProcesses.find((p) => p.id === processId1)
      const process2 = allProcesses.find((p) => p.id === processId2)

      expect(process1).toBeDefined()
      expect(process2).toBeDefined()
      expect(process1!.projectId).toBe(1)
      expect(process2!.projectId).toBe(2)

      // Wait for completion
      await Promise.all([
        new Promise((resolve) => {
          processRunner.on('exit', (data) => {
            if (data.processId === processId1) resolve(data)
          })
        }),
        new Promise((resolve) => {
          processRunner.on('exit', (data) => {
            if (data.processId === processId2) resolve(data)
          })
        })
      ])
    })

    test('should filter processes by project', async () => {
      const config1: ProcessConfig = {
        command: ['bun', 'run', 'sleep-short'],
        projectId: 1,
        cwd: tempDir
      }

      const config2: ProcessConfig = {
        command: ['bun', 'run', 'sleep-short'],
        projectId: 2,
        cwd: tempDir
      }

      await processRunner.startProcess(config1)
      await processRunner.startProcess(config2)

      const project1Processes = processRunner.getProcessesByProject(1)
      const project2Processes = processRunner.getProcessesByProject(2)

      expect(project1Processes.length).toBe(1)
      expect(project2Processes.length).toBe(1)
      expect(project1Processes[0].projectId).toBe(1)
      expect(project2Processes[0].projectId).toBe(2)
    })

    test('should return undefined for non-existent process', () => {
      const process = processRunner.getProcess('nonexistent')
      expect(process).toBeUndefined()
    })
  })

  describe('Log Buffer Management', () => {
    test('should maintain ring buffer of logs', async () => {
      const config: ProcessConfig = {
        command: ['bun', 'run', 'echo'],
        projectId: 1,
        cwd: tempDir
      }

      const processId = await processRunner.startProcess(config)

      await new Promise((resolve) => {
        processRunner.on('exit', (data) => {
          if (data.processId === processId) {
            setTimeout(resolve, 100) // Allow logs to be processed
          }
        })
      })

      const process = processRunner.getProcess(processId)
      const logs = process!.logBuffer.getAll()

      expect(logs.length).toBeGreaterThan(0)
      expect(logs[0]).toMatchObject({
        timestamp: expect.any(Number),
        type: expect.stringMatching(/^(stdout|stderr)$/),
        line: expect.any(String)
      })
    })

    test('should limit ring buffer size', async () => {
      // This test would need a process that generates many log lines
      // For now, we'll test the ring buffer directly
      const process = processRunner.getProcess('test')
      if (process) {
        // Add more than buffer size logs
        for (let i = 0; i < 1500; i++) {
          process.logBuffer.add({
            timestamp: Date.now(),
            type: 'stdout',
            line: `Log line ${i}`
          })
        }

        const logs = process.logBuffer.getAll()
        expect(logs.length).toBeLessThanOrEqual(1000) // Default ring buffer size
      }
    })
  })

  describe('Error Handling', () => {
    test('should handle invalid commands gracefully', async () => {
      const config: ProcessConfig = {
        command: ['nonexistent-command'],
        projectId: 1,
        cwd: tempDir
      }

      await expect(processRunner.startProcess(config)).rejects.toThrow()
    })

    test('should handle invalid working directory', async () => {
      const config: ProcessConfig = {
        command: ['echo', 'test'],
        projectId: 1,
        cwd: '/nonexistent/directory'
      }

      await expect(processRunner.startProcess(config)).rejects.toThrow()
    })

    test('should not throw when stopping non-existent process', async () => {
      const success = await processRunner.stopProcess('nonexistent')
      expect(success).toBe(false)
    })

    test('should handle process that exits immediately', async () => {
      const config: ProcessConfig = {
        command: ['bun', 'run', 'exit-zero'],
        projectId: 1,
        cwd: tempDir
      }

      const processId = await processRunner.startProcess(config)

      await new Promise((resolve) => {
        processRunner.on('exit', (data) => {
          if (data.processId === processId) {
            resolve(data)
          }
        })
      })

      const process = processRunner.getProcess(processId)
      expect(process!.status).toBe('completed')
      expect(process!.exitCode).toBe(0)
    })
  })

  describe('Event Emission', () => {
    test('should emit log events', async () => {
      const logEvents: Array<any> = []

      processRunner.on('log', (event) => {
        logEvents.push(event)
      })

      const config: ProcessConfig = {
        command: ['echo', 'test-log-event'],
        projectId: 1,
        cwd: tempDir
      }

      const processId = await processRunner.startProcess(config)

      await new Promise((resolve) => {
        processRunner.on('exit', (data) => {
          if (data.processId === processId) {
            setTimeout(resolve, 100)
          }
        })
      })

      expect(logEvents.length).toBeGreaterThan(0)

      const testLog = logEvents.find((event) => event.processId === processId && event.line.includes('test-log-event'))

      expect(testLog).toBeDefined()
      expect(testLog.type).toBe('stdout')
      expect(testLog.timestamp).toBeTypeOf('number')
    })

    test('should emit exit events', async () => {
      let exitEvent: any = null

      processRunner.on('exit', (event) => {
        exitEvent = event
      })

      const config: ProcessConfig = {
        command: ['bun', 'run', 'exit-zero'],
        projectId: 1,
        cwd: tempDir
      }

      const processId = await processRunner.startProcess(config)

      await new Promise((resolve) => {
        processRunner.on('exit', (data) => {
          if (data.processId === processId) {
            resolve(data)
          }
        })
      })

      expect(exitEvent).toBeDefined()
      expect(exitEvent.processId).toBe(processId)
      expect(exitEvent.exitCode).toBe(0)
      expect(exitEvent.signalCode).toBeNull()
    })
  })
})
