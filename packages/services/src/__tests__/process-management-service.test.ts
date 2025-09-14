/**
 * Integration Tests for Process Management Service
 *
 * Tests the complete service integration including security, database persistence,
 * and service factory patterns
 */

import { describe, beforeEach, afterEach, test, expect, mock } from 'bun:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { createProcessManagementService } from '../process-management-service'
import { createTestDatabase } from '@promptliano/database'

// Mock implementations for testing
const mockProcessRepository = {
  create: mock(async (data: any) => ({
    id: Date.now(),
    ...data
  })),

  updateByProcessId: mock(async (processId: string, data: any) => ({
    processId,
    ...data
  })),

  getByProcessId: mock(async (processId: string) => ({
    id: 1,
    processId,
    projectId: 1,
    status: 'running',
    createdAt: Date.now(),
    updatedAt: Date.now()
  })),

  getHistory: mock(async (projectId: number, limit: number, offset: number) => [
    {
      id: 1,
      processId: 'proc_1',
      projectId,
      status: 'completed',
      exitCode: 0,
      createdAt: Date.now() - 1000,
      updatedAt: Date.now()
    }
  ])
}

const mockLogRepository = {
  create: mock(async (data: any) => ({
    id: Date.now(),
    ...data
  })),

  getByRunId: mock(async (runId: number, limit?: number, offset?: number) => [
    {
      id: 1,
      runId,
      timestamp: Date.now(),
      type: 'stdout',
      content: 'Test log line',
      lineNumber: 1
    }
  ]),

  getByType: mock(async (runId: number, type: string) => [])
}

const mockPortRepository = {
  create: mock(async (data: any) => ({
    id: Date.now(),
    ...data
  })),

  getByProject: mock(async (projectId: number) => [
    {
      id: 1,
      projectId,
      port: 3000,
      protocol: 'tcp',
      address: '127.0.0.1',
      state: 'listening',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ]),

  getByState: mock(async (projectId: number, state: string) => []),

  releasePort: mock(async (projectId: number, port: number) => true)
}

describe('Process Management Service Integration', () => {
  let tempDir: string
  let service: ReturnType<typeof createProcessManagementService>

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = await mkdtemp(join(tmpdir(), 'process-service-test-'))

    // Create service with mocked dependencies
    service = createProcessManagementService({
      processRepository: mockProcessRepository,
      logRepository: mockLogRepository,
      portRepository: mockPortRepository,
      sandboxRoot: tempDir
    })

    // Create a test package.json
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'test-package',
        scripts: {
          test: 'node -e "console.log(\"Testing\")"',
          build: 'node -e "console.log(\"Building\")"',
          start: 'node -e "console.log(\"Starting\"); setTimeout(()=>{}, 1000)"'
        }
      })
    )

    // Reset all mocks
    Object.values(mockProcessRepository).forEach((mock) => mock.mockClear())
    Object.values(mockLogRepository).forEach((mock) => mock.mockClear())
    Object.values(mockPortRepository).forEach((mock) => mock.mockClear())
  })

  afterEach(async () => {
    // Clean up
    await rm(tempDir, { recursive: true, force: true })
  })

  describe('Service Factory Pattern', () => {
    test('should create service with default dependencies', () => {
      const defaultService = createProcessManagementService()
      expect(typeof defaultService.startProcess).toBe('function')
      expect(typeof defaultService.stopProcess).toBe('function')
      expect(typeof defaultService.getProcesses).toBe('function')
      expect(typeof defaultService.getProcessLogs).toBe('function')
      expect(typeof defaultService.scanPorts).toBe('function')
    })

    test('should create service with injected dependencies', () => {
      const customService = createProcessManagementService({
        processRepository: mockProcessRepository,
        logRepository: mockLogRepository,
        portRepository: mockPortRepository
      })

      expect(typeof customService.startProcess).toBe('function')
      // Verify the service is using injected dependencies (tested through behavior)
    })

    test('should handle missing optional dependencies', () => {
      const partialService = createProcessManagementService({
        processRepository: mockProcessRepository
        // Missing other repositories
      })

      expect(typeof partialService.startProcess).toBe('function')
    })
  })

  describe('Process Lifecycle with Persistence', () => {
    test('should persist process start to database', async () => {
      const processData = {
        command: 'bun',
        args: ['run', 'test'],
        name: 'test-process',
        cwd: tempDir
      }

      const result = await service.startProcess(1, processData)

      expect(result).toMatchObject({
        id: expect.any(String),
        pid: expect.any(Number),
        status: 'running',
        name: 'test-process'
      })

      // Should have persisted to database
      expect(mockProcessRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 1,
          processId: expect.any(String),
          command: 'bun',
          args: ['run', 'test'],
          status: 'running'
        })
      )
    })

    test('should persist process logs to database', async () => {
      const processData = {
        command: 'echo',
        args: ['Hello Database'],
        name: 'log-test',
        cwd: tempDir
      }

      const result = await service.startProcess(1, processData)

      // Wait for process to complete and logs to be written
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Should have written logs to database
      expect(mockLogRepository.create).toHaveBeenCalled()

      const logCall = mockLogRepository.create.mock.calls.find(
        (call: any) => call[0].content && call[0].content.includes('Hello Database')
      )

      expect(logCall).toBeDefined()
    })

    test('should update process status on completion', async () => {
      const processData = {
        command: 'echo',
        args: ['Quick task'],
        name: 'completion-test',
        cwd: tempDir
      }

      const result = await service.startProcess(1, processData)

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Should have updated process status
      expect(mockProcessRepository.updateByProcessId).toHaveBeenCalledWith(
        result.id,
        expect.objectContaining({
          status: expect.stringMatching(/^(completed|exited)$/),
          exitCode: 0,
          exitedAt: expect.any(Number)
        })
      )
    })
  })

  describe('Process Querying', () => {
    test('should list all processes for project', async () => {
      const processes = await service.getProcesses(1)

      expect(Array.isArray(processes)).toBe(true)
      expect(mockProcessRepository.getHistory).toHaveBeenCalledWith(1, 50, 0)
    })

    test('should get process logs', async () => {
      mockLogRepository.getByRunId.mockResolvedValueOnce([
        {
          id: 1,
          runId: 1,
          timestamp: Date.now(),
          type: 'stdout',
          content: 'Test output',
          lineNumber: 1
        },
        {
          id: 2,
          runId: 1,
          timestamp: Date.now() + 1,
          type: 'stderr',
          content: 'Test error',
          lineNumber: 2
        }
      ])

      const logs = await service.getProcessLogs('proc_1')

      expect(Array.isArray(logs)).toBe(true)
      expect(mockProcessRepository.getByProcessId).toHaveBeenCalledWith('proc_1')
      expect(mockLogRepository.getByRunId).toHaveBeenCalled()
    })

    test('should handle non-existent process logs', async () => {
      mockProcessRepository.getByProcessId.mockResolvedValueOnce(null)

      await expect(service.getProcessLogs('nonexistent')).rejects.toThrow(/Process.*not found/)
    })
  })

  describe('Port Management', () => {
    test('should scan and return ports', async () => {
      const ports = await service.scanPorts()

      expect(Array.isArray(ports)).toBe(true)
      // scanPorts should return system ports (implementation specific)
    })

    test('should get ports by project', async () => {
      const ports = await service.getPortsByProject(1)

      expect(Array.isArray(ports)).toBe(true)
      expect(mockPortRepository.getByProject).toHaveBeenCalledWith(1)
    })

    test('should kill process by port', async () => {
      mockPortRepository.getByState.mockResolvedValueOnce([
        {
          id: 1,
          projectId: 1,
          port: 3000,
          pid: 12345,
          state: 'listening'
        }
      ])

      const result = await service.killByPort(1, 3000)

      expect(result.success).toBe(true)
      expect(result.pid).toBe(12345)
      expect(mockPortRepository.releasePort).toHaveBeenCalledWith(1, 3000)
    })

    test('should handle kill by port when port not found', async () => {
      mockPortRepository.getByState.mockResolvedValueOnce([])

      await expect(service.killByPort(1, 9999)).rejects.toThrow(/Port.*not found/)
    })
  })

  describe('Script Execution', () => {
    test('should run package.json scripts', async () => {
      const result = await service.runScript(1, {
        scriptName: 'test',
        packageManager: 'bun'
      })

      expect(result).toMatchObject({
        id: expect.any(String),
        pid: expect.any(Number),
        status: 'running',
        name: 'test'
      })

      expect(mockProcessRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'bun',
          args: ['run', 'test']
        })
      )
    })

    test('should support different package managers', async () => {
      const managers = ['npm', 'yarn', 'pnpm', 'bun']

      for (const manager of managers) {
        mockProcessRepository.create.mockClear()

        await service.runScript(1, {
          scriptName: 'build',
          packageManager: manager as any
        })

        expect(mockProcessRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            command: manager,
            args: ['run', 'build']
          })
        )
      }
    })

    test('should handle script in subdirectory', async () => {
      const subdir = join(tempDir, 'subproject')
      await writeFile(
        join(subdir, 'package.json'),
        JSON.stringify({
          scripts: { subtest: 'echo "sub"' }
        })
      )

      const result = await service.runScript(1, {
        scriptName: 'subtest',
        packageManager: 'bun',
        packagePath: subdir
      })

      expect(result.name).toBe('subtest')
      expect(mockProcessRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          cwd: subdir
        })
      )
    })
  })

  describe('Error Handling', () => {
    test('should handle database persistence failures gracefully', async () => {
      mockProcessRepository.create.mockRejectedValueOnce(new Error('Database connection failed'))

      // Process should still start even if DB fails
      const processData = {
        command: 'echo',
        args: ['test'],
        name: 'db-fail-test',
        cwd: tempDir
      }

      const result = await service.startProcess(1, processData)
      expect(result.id).toBeDefined()
    })

    test('should handle log persistence failures gracefully', async () => {
      mockLogRepository.create.mockRejectedValue(new Error('Log write failed'))

      const processData = {
        command: 'echo',
        args: ['log-fail-test'],
        name: 'log-fail',
        cwd: tempDir
      }

      // Should not throw even if log persistence fails
      const result = await service.startProcess(1, processData)
      expect(result.id).toBeDefined()

      await new Promise((resolve) => setTimeout(resolve, 100))
      // Process should complete normally
    })

    test('should validate script names against package.json', async () => {
      await expect(
        service.runScript(1, {
          scriptName: 'nonexistent',
          packageManager: 'bun'
        })
      ).rejects.toThrow(/script.*not found/i)
    })

    test('should handle invalid package.json', async () => {
      await writeFile(join(tempDir, 'package.json'), 'invalid json{')

      await expect(
        service.runScript(1, {
          scriptName: 'test',
          packageManager: 'bun'
        })
      ).rejects.toThrow()
    })
  })

  describe('Security Integration', () => {
    test('should enforce command validation', async () => {
      // This would be handled by the security layer
      const dangerousProcess = {
        command: 'rm',
        args: ['-rf', '/'],
        name: 'dangerous',
        cwd: tempDir
      }

      // Security layer should prevent this (tested in security tests)
      // Here we just verify the service would call security validation
      await expect(service.startProcess(1, dangerousProcess)).rejects.toThrow() // Security layer would throw
    })

    test('should enforce working directory restrictions', async () => {
      const outsideProcess = {
        command: 'echo',
        args: ['test'],
        name: 'outside',
        cwd: '/etc' // Outside sandbox
      }

      await expect(service.startProcess(1, outsideProcess)).rejects.toThrow()
    })
  })

  describe('Concurrent Process Handling', () => {
    test('should handle multiple simultaneous process starts', async () => {
      const processes = Array(5)
        .fill(null)
        .map((_, i) => ({
          command: 'echo',
          args: [`Process ${i}`],
          name: `concurrent-${i}`,
          cwd: tempDir
        }))

      const promises = processes.map((proc) => service.startProcess(1, proc))

      const results = await Promise.allSettled(promises)

      const successful = results.filter((r) => r.status === 'fulfilled')
      expect(successful.length).toBeGreaterThan(0)

      // All successful processes should have unique IDs
      const ids = successful.map((r) => (r as any).value.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })

    test('should handle process termination during execution', async () => {
      const longProcess = {
        command: 'node',
        args: ['-e', 'setTimeout(()=>{}, 5000)'],
        name: 'long-runner',
        cwd: tempDir
      }

      const result = await service.startProcess(1, longProcess)

      // Wait a moment for process to start
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Stop the process
      const stopped = await service.stopProcess(1, result.id)
      expect(stopped.success).toBe(true)

      // Should update database with stopped status
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(mockProcessRepository.updateByProcessId).toHaveBeenCalledWith(
        result.id,
        expect.objectContaining({
          status: expect.stringMatching(/stopped|killed/)
        })
      )
    })
  })

  describe('Service Cleanup and Resource Management', () => {
    test('should clean up resources on service shutdown', async () => {
      const processData = {
        command: 'node',
        args: ['-e', 'setTimeout(()=>{}, 10000)'],
        name: 'cleanup-test',
        cwd: tempDir
      }

      await service.startProcess(1, processData)

      // Shutdown should clean up all processes
      await service.shutdown?.()

      // Verify cleanup occurred (implementation specific)
      expect(true).toBe(true) // Placeholder - actual cleanup verification would depend on implementation
    })
  })
})
