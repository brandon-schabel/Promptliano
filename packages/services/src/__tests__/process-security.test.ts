/**
 * Comprehensive Unit Tests for Process Security Manager
 * 
 * Tests all security validation, rate limiting, and audit functionality
 */

import { describe, beforeEach, afterEach, test, expect, mock } from 'bun:test'
import { ProcessSecurityManager } from '../process/security'
import type { ProcessConfig, SecurityContext } from '../process/security'
import { ErrorFactory } from '@promptliano/shared'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises'

describe('ProcessSecurityManager', () => {
  let securityManager: ProcessSecurityManager
  let tempDir: string
  let packageJsonPath: string

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = await mkdtemp(join(tmpdir(), 'process-security-test-'))
    securityManager = new ProcessSecurityManager(tempDir)
    
    // Create a test package.json
    packageJsonPath = join(tempDir, 'package.json')
    await writeFile(packageJsonPath, JSON.stringify({
      name: 'test-package',
      scripts: {
        'test': 'echo "test"',
        'build': 'bun build',
        'start': 'node index.js',
        'dangerous': 'rm -rf /',
        'injection': 'echo $(whoami)'
      }
    }, null, 2))
  })

  afterEach(async () => {
    // Clean up temporary directory
    await rm(tempDir, { recursive: true, force: true })
  })

  describe('Command Validation', () => {
    test('should allow valid commands for user role', async () => {
      const config: ProcessConfig = {
        command: ['bun', 'run', 'test'],
        projectId: 1,
        cwd: tempDir
      }

      const context: SecurityContext = {
        userId: 'user1',
        userRole: 'user',
        projectId: 1
      }

      await expect(securityManager.validateProcessConfig(config, context))
        .resolves
        .toBeUndefined()
    })

    test('should block unauthorized commands for user role', async () => {
      const config: ProcessConfig = {
        command: ['git', 'status'],
        projectId: 1,
        cwd: tempDir
      }

      const context: SecurityContext = {
        userId: 'user1',
        userRole: 'user',
        projectId: 1
      }

      await expect(securityManager.validateProcessConfig(config, context))
        .rejects
        .toThrow(/Command "git" not allowed/)
    })

    test('should allow more commands for admin role', async () => {
      const config: ProcessConfig = {
        command: ['git', 'status'],
        projectId: 1,
        cwd: tempDir
      }

      const context: SecurityContext = {
        userId: 'admin1',
        userRole: 'admin',
        projectId: 1
      }

      await expect(securityManager.validateProcessConfig(config, context))
        .resolves
        .toBeUndefined()
    })

    test('should block dangerous arguments', async () => {
      const dangerousArgs = [
        ['bun', 'run', '../../../etc/passwd'],
        ['npm', 'run', 'test', '--', '$(whoami)'],
        ['bun', 'run', 'build', '&&', 'rm', '-rf', '/'],
        ['npm', 'run', '`malicious`']
      ]

      for (const command of dangerousArgs) {
        const config: ProcessConfig = {
          command,
          projectId: 1,
          cwd: tempDir
        }

        const context: SecurityContext = {
          userId: 'user1',
          userRole: 'user',
          projectId: 1
        }

        await expect(securityManager.validateProcessConfig(config, context))
          .rejects
          .toThrow()
      }
    })

    test('should enforce argument count limits', async () => {
      // Create command with too many arguments for user role (limit: 20)
      const manyArgs = new Array(25).fill('arg')
      const config: ProcessConfig = {
        command: ['bun', 'run', 'test', ...manyArgs],
        projectId: 1,
        cwd: tempDir
      }

      const context: SecurityContext = {
        userId: 'user1',
        userRole: 'user',
        projectId: 1
      }

      await expect(securityManager.validateProcessConfig(config, context))
        .rejects
        .toThrow(/Too many arguments/)
    })

    test('should block overly long arguments', async () => {
      const longArg = 'a'.repeat(1001)
      const config: ProcessConfig = {
        command: ['bun', 'run', 'test', longArg],
        projectId: 1,
        cwd: tempDir
      }

      const context: SecurityContext = {
        userId: 'user1',
        userRole: 'user',
        projectId: 1
      }

      await expect(securityManager.validateProcessConfig(config, context))
        .rejects
        .toThrow(/Argument too long/)
    })
  })

  describe('Script Validation', () => {
    test('should validate npm/bun/yarn run commands against package.json', async () => {
      const config: ProcessConfig = {
        command: ['bun', 'run', 'test'],
        projectId: 1,
        cwd: tempDir
      }

      const context: SecurityContext = {
        userId: 'user1',
        userRole: 'user',
        projectId: 1
      }

      await expect(securityManager.validateProcessConfig(config, context))
        .resolves
        .toBeUndefined()
    })

    test('should block non-existent scripts', async () => {
      const config: ProcessConfig = {
        command: ['bun', 'run', 'nonexistent'],
        projectId: 1,
        cwd: tempDir
      }

      const context: SecurityContext = {
        userId: 'user1',
        userRole: 'user',
        projectId: 1
      }

      await expect(securityManager.validateProcessConfig(config, context))
        .rejects
        .toThrow(/Script "nonexistent" not found/)
    })

    test('should block scripts with dangerous patterns', async () => {
      const config: ProcessConfig = {
        command: ['bun', 'run', 'dangerous'], // Contains 'rm -rf /'
        projectId: 1,
        cwd: tempDir
      }

      const context: SecurityContext = {
        userId: 'user1',
        userRole: 'user',
        projectId: 1
      }

      await expect(securityManager.validateProcessConfig(config, context))
        .rejects
        .toThrow(/Dangerous pattern in script/)
    })

    test('should block scripts with command injection', async () => {
      const config: ProcessConfig = {
        command: ['bun', 'run', 'injection'], // Contains '$(whoami)'
        projectId: 1,
        cwd: tempDir
      }

      const context: SecurityContext = {
        userId: 'user1',
        userRole: 'user',
        projectId: 1
      }

      await expect(securityManager.validateProcessConfig(config, context))
        .rejects
        .toThrow(/Dangerous pattern in script/)
    })
  })

  describe('Path and Sandbox Validation', () => {
    test('should allow paths within sandbox', async () => {
      const subdir = join(tempDir, 'subproject')
      await mkdir(subdir)
      
      const config: ProcessConfig = {
        command: ['bun', 'run', 'test'],
        projectId: 1,
        cwd: subdir
      }

      const context: SecurityContext = {
        userId: 'user1',
        userRole: 'user',
        projectId: 1
      }

      await expect(securityManager.validateProcessConfig(config, context))
        .resolves
        .toBeUndefined()
      
      expect(config.cwd).toContain(subdir)
    })

    test('should block paths outside sandbox', async () => {
      const config: ProcessConfig = {
        command: ['bun', 'run', 'test'],
        projectId: 1,
        cwd: '/etc'
      }

      const context: SecurityContext = {
        userId: 'user1',
        userRole: 'user',
        projectId: 1
      }

      await expect(securityManager.validateProcessConfig(config, context))
        .rejects
        .toThrow(/Working directory outside sandbox/)
    })

    test('should block path traversal attempts', async () => {
      const config: ProcessConfig = {
        command: ['bun', 'run', 'test'],
        projectId: 1,
        cwd: join(tempDir, '../../../etc')
      }

      const context: SecurityContext = {
        userId: 'user1',
        userRole: 'user',
        projectId: 1
      }

      await expect(securityManager.validateProcessConfig(config, context))
        .rejects
        .toThrow(/Working directory outside sandbox/)
    })

    test('should block non-existent directories', async () => {
      const config: ProcessConfig = {
        command: ['bun', 'run', 'test'],
        projectId: 1,
        cwd: join(tempDir, 'nonexistent')
      }

      const context: SecurityContext = {
        userId: 'user1',
        userRole: 'user',
        projectId: 1
      }

      await expect(securityManager.validateProcessConfig(config, context))
        .rejects
        .toThrow(/Invalid working directory/)
    })
  })

  describe('Environment Variable Validation', () => {
    test('should allow safe environment variables', async () => {
      const config: ProcessConfig = {
        command: ['bun', 'run', 'test'],
        projectId: 1,
        cwd: tempDir,
        env: {
          NODE_ENV: 'test',
          BUN_ENV: 'development',
          DEBUG: '1',
          PORT: '3000'
        }
      }

      const context: SecurityContext = {
        userId: 'user1',
        userRole: 'user',
        projectId: 1
      }

      await expect(securityManager.validateProcessConfig(config, context))
        .resolves
        .toBeUndefined()
    })

    test('should block dangerous environment variables', async () => {
      const dangerousEnvs = [
        { AWS_SECRET_ACCESS_KEY: 'secret' },
        { DATABASE_PASSWORD: 'password' },
        { ADMIN_TOKEN: 'token' },
        { GOOGLE_API_KEY: 'key' }
      ]

      for (const env of dangerousEnvs) {
        const config: ProcessConfig = {
          command: ['bun', 'run', 'test'],
          projectId: 1,
          cwd: tempDir,
          env
        }

        const context: SecurityContext = {
          userId: 'user1',
          userRole: 'user',
          projectId: 1
        }

        await expect(securityManager.validateProcessConfig(config, context))
          .rejects
          .toThrow(/not allowed/)
      }
    })

    test('should block too many environment variables', async () => {
      // Create more env vars than the user limit (50)
      const manyEnv: Record<string, string> = {}
      for (let i = 0; i < 60; i++) {
        manyEnv[`NODE_VAR_${i}`] = `value${i}`
      }

      const config: ProcessConfig = {
        command: ['bun', 'run', 'test'],
        projectId: 1,
        cwd: tempDir,
        env: manyEnv
      }

      const context: SecurityContext = {
        userId: 'user1',
        userRole: 'user',
        projectId: 1
      }

      await expect(securityManager.validateProcessConfig(config, context))
        .rejects
        .toThrow(/Too many environment variables/)
    })

    test('should block env vars with dangerous values', async () => {
      const config: ProcessConfig = {
        command: ['bun', 'run', 'test'],
        projectId: 1,
        cwd: tempDir,
        env: {
          NODE_ENV: '$(whoami)' // Command injection
        }
      }

      const context: SecurityContext = {
        userId: 'user1',
        userRole: 'user',
        projectId: 1
      }

      await expect(securityManager.validateProcessConfig(config, context))
        .rejects
        .toThrow(/Dangerous pattern in environment variable/)
    })
  })

  describe('Resource Limits', () => {
    test('should apply default resource limits for user role', async () => {
      const config: ProcessConfig = {
        command: ['bun', 'run', 'test'],
        projectId: 1,
        cwd: tempDir
      }

      const context: SecurityContext = {
        userId: 'user1',
        userRole: 'user',
        projectId: 1
      }

      await securityManager.validateProcessConfig(config, context)

      expect(config.limits?.maxMemory).toBe(512 * 1024 * 1024) // 512MB
      expect(config.limits?.maxCpu).toBe(2)
      expect(config.timeout).toBe(300_000) // 5 minutes
    })

    test('should apply higher limits for admin role', async () => {
      const config: ProcessConfig = {
        command: ['bun', 'run', 'test'],
        projectId: 1,
        cwd: tempDir
      }

      const context: SecurityContext = {
        userId: 'admin1',
        userRole: 'admin',
        projectId: 1
      }

      await securityManager.validateProcessConfig(config, context)

      expect(config.limits?.maxMemory).toBe(1024 * 1024 * 1024) // 1GB
      expect(config.limits?.maxCpu).toBe(4)
      expect(config.timeout).toBe(600_000) // 10 minutes
    })

    test('should enforce maxBuffer limits', async () => {
      const config: ProcessConfig = {
        command: ['bun', 'run', 'test'],
        projectId: 1,
        cwd: tempDir,
        maxBuffer: 20 * 1024 * 1024 // 20MB (over 10MB limit)
      }

      const context: SecurityContext = {
        userId: 'user1',
        userRole: 'user',
        projectId: 1
      }

      await expect(securityManager.validateProcessConfig(config, context))
        .rejects
        .toThrow(/maxBuffer too large/)
    })
  })

  describe('Rate Limiting', () => {
    test('should allow requests within rate limit', async () => {
      const config: ProcessConfig = {
        command: ['bun', 'run', 'test'],
        projectId: 1,
        cwd: tempDir
      }

      const context: SecurityContext = {
        userId: 'user1',
        userRole: 'user',
        projectId: 1
      }

      // Should allow up to 10 requests per minute
      for (let i = 0; i < 10; i++) {
        await expect(securityManager.validateProcessConfig(config, context))
          .resolves
          .toBeUndefined()
      }
    })

    test('should block requests exceeding rate limit', async () => {
      const config: ProcessConfig = {
        command: ['bun', 'run', 'test'],
        projectId: 1,
        cwd: tempDir
      }

      const context: SecurityContext = {
        userId: 'user1',
        userRole: 'user',
        projectId: 1
      }

      // Exhaust rate limit
      for (let i = 0; i < 10; i++) {
        await securityManager.validateProcessConfig(config, context)
      }

      // 11th request should be blocked
      await expect(securityManager.validateProcessConfig(config, context))
        .rejects
        .toThrow(/Too many process requests/)
    })

    test('should have separate rate limits for different users', async () => {
      const config: ProcessConfig = {
        command: ['bun', 'run', 'test'],
        projectId: 1,
        cwd: tempDir
      }

      const context1: SecurityContext = {
        userId: 'user1',
        userRole: 'user',
        projectId: 1
      }

      const context2: SecurityContext = {
        userId: 'user2',
        userRole: 'user',
        projectId: 1
      }

      // Exhaust rate limit for user1
      for (let i = 0; i < 10; i++) {
        await securityManager.validateProcessConfig(config, context1)
      }

      // user1 should be blocked
      await expect(securityManager.validateProcessConfig(config, context1))
        .rejects
        .toThrow(/Too many process requests from user user1/)

      // user2 should still work
      await expect(securityManager.validateProcessConfig(config, context2))
        .resolves
        .toBeUndefined()
    })
  })

  describe('Secure Environment Creation', () => {
    test('should create secure environment with allowed variables', () => {
      const userEnv = {
        NODE_ENV: 'test',
        BUN_ENV: 'development',
        CUSTOM_VAR: 'value', // Not allowed
        AWS_KEY: 'secret',   // Blocked
        DEBUG: '1',          // Allowed
        PATH: '/custom/path' // Allowed
      }

      const secure = securityManager.createSecureEnvironment(userEnv, 'user')

      expect(secure.NODE_ENV).toBe('test')
      expect(secure.BUN_ENV).toBe('development')
      expect(secure.DEBUG).toBe('1')
      expect(secure.PATH).toBe('/custom/path')
      expect(secure.CUSTOM_VAR).toBeUndefined()
      expect(secure.AWS_KEY).toBeUndefined()

      // Should have required defaults
      expect(secure.HOME).toBeDefined()
      expect(secure.USER).toBeDefined()
    })
  })

  describe('Process Tracking', () => {
    test('should track and limit concurrent processes per project', async () => {
      const context: SecurityContext = {
        userId: 'user1',
        userRole: 'user',
        projectId: 1
      }

      // Start maximum processes (5 per project)
      for (let i = 0; i < 5; i++) {
        securityManager.trackProcessStart(context)
      }

      const config: ProcessConfig = {
        command: ['bun', 'run', 'test'],
        projectId: 1,
        cwd: tempDir
      }

      // 6th process should be blocked
      await expect(securityManager.validateProcessConfig(config, context))
        .rejects
        .toThrow(/too many running processes/)

      // End one process
      securityManager.trackProcessEnd(context)

      // Now should be allowed again
      await expect(securityManager.validateProcessConfig(config, context))
        .resolves
        .toBeUndefined()
    })

    test('should track concurrent processes per user', async () => {
      const context: SecurityContext = {
        userId: 'user1',
        userRole: 'user',
        projectId: 1
      }

      // Start maximum processes (10 per user)
      for (let i = 0; i < 10; i++) {
        securityManager.trackProcessStart({
          ...context,
          projectId: i + 1 // Different projects
        })
      }

      const config: ProcessConfig = {
        command: ['bun', 'run', 'test'],
        projectId: 11,
        cwd: tempDir
      }

      // 11th process should be blocked
      await expect(securityManager.validateProcessConfig(config, {
        ...context,
        projectId: 11
      })).rejects.toThrow(/too many running processes/)
    })
  })

  describe('Audit Logging', () => {
    test('should audit successful process execution', async () => {
      const mockLogger = {
        info: mock(),
        warn: mock(),
        debug: mock(),
        error: mock()
      }

      // @ts-ignore - Mock the logger
      securityManager['logger'] = mockLogger

      const config: ProcessConfig = {
        command: ['bun', 'run', 'test'],
        projectId: 1,
        cwd: tempDir
      }

      const context: SecurityContext = {
        userId: 'user1',
        userRole: 'user',
        projectId: 1,
        clientIp: '127.0.0.1',
        userAgent: 'test-client'
      }

      await securityManager.auditProcessExecution(config, context, 'allowed')

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Process execution audit',
        expect.objectContaining({
          userId: 'user1',
          userRole: 'user',
          projectId: 1,
          clientIp: '127.0.0.1',
          outcome: 'allowed',
          action: 'PROCESS_EXECUTION',
          command: 'bun'
        })
      )
    })

    test('should audit blocked process execution', async () => {
      const mockLogger = {
        info: mock(),
        warn: mock(),
        debug: mock(),
        error: mock()
      }

      // @ts-ignore - Mock the logger
      securityManager['logger'] = mockLogger

      const config: ProcessConfig = {
        command: ['git', 'status'], // Not allowed for user
        projectId: 1,
        cwd: tempDir
      }

      const context: SecurityContext = {
        userId: 'user1',
        userRole: 'user',
        projectId: 1
      }

      await securityManager.auditProcessExecution(
        config, 
        context, 
        'blocked', 
        'Unauthorized command'
      )

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Process execution audit',
        expect.objectContaining({
          outcome: 'blocked',
          reason: 'Unauthorized command',
          command: 'git'
        })
      )
    })
  })
})