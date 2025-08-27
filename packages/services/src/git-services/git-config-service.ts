import { ErrorFactory, withErrorContext } from '@promptliano/shared'
import { createGitServiceFactory, createGitUtils, type GitServiceDependencies } from '../core/service-factory-base'

export interface GitConfigServiceDeps extends GitServiceDependencies {}

/**
 * Create Git config service with functional factory pattern
 */
export function createGitConfigService(dependencies?: GitConfigServiceDeps) {
  return createGitServiceFactory({
    entityName: 'GitConfig',
    serviceName: 'Config',
    dependencies
  }, (deps) => {
    const gitUtils = createGitUtils(deps.projectService, deps.errorHandler)

    const service = {
      /**
       * Get git configuration
       */
      async getConfig(
        projectId: number,
        key?: string,
        options?: { global?: boolean }
      ): Promise<string | Record<string, string>> {
        return deps.errorHandler.withGitErrorHandling(async () => {
          const { git } = await gitUtils.getGitInstance(projectId)

          if (key) {
            const configOptions: string[] = ['config']
            if (options?.global) {
              configOptions.push('--global')
            }
            configOptions.push(key)

            const value = await git.raw(configOptions)
            return value.trim()
          } else {
            const configOptions: string[] = ['config', '--list']
            if (options?.global) {
              configOptions.push('--global')
            }

            const configList = await git.raw(configOptions)
            const config: Record<string, string> = {}

            configList.split('\n').forEach((line: string) => {
              const [key, value] = line.split('=', 2)
              if (key && value) {
                config[key] = value
              }
            })

            return config
          }
        }, 'get config')
      },

      /**
       * Set git configuration
       */
      async setConfig(projectId: number, key: string, value: string, options?: { global?: boolean }): Promise<void> {
        return deps.errorHandler.withGitErrorHandling(async () => {
          const { git } = await gitUtils.getGitInstance(projectId)

          const configOptions: string[] = ['config']
          if (options?.global) {
            configOptions.push('--global')
          }
          configOptions.push(key, value)

          await git.raw(configOptions)
        }, 'set config')
      },

      /**
       * Unset git configuration
       */
      async unsetConfig(projectId: number, key: string, options?: { global?: boolean }): Promise<void> {
        return deps.errorHandler.withGitErrorHandling(async () => {
          const { git } = await gitUtils.getGitInstance(projectId)

          const configOptions: string[] = ['config', '--unset']
          if (options?.global) {
            configOptions.push('--global')
          }
          configOptions.push(key)

          await git.raw(configOptions)
        }, 'unset config')
      },

      /**
       * Get user name from config
       */
      async getUserName(projectId: number, global: boolean = false): Promise<string | null> {
        try {
          const name = await service.getConfig(projectId, 'user.name', { global })
          return typeof name === 'string' ? name : null
        } catch (error) {
          return null
        }
      },

      /**
       * Get user email from config
       */
      async getUserEmail(projectId: number, global: boolean = false): Promise<string | null> {
        try {
          const email = await service.getConfig(projectId, 'user.email', { global })
          return typeof email === 'string' ? email : null
        } catch (error) {
          return null
        }
      },

      /**
       * Set user name in config
       */
      async setUserName(projectId: number, name: string, global: boolean = false): Promise<void> {
        await service.setConfig(projectId, 'user.name', name, { global })
      },

      /**
       * Set user email in config
       */
      async setUserEmail(projectId: number, email: string, global: boolean = false): Promise<void> {
        await service.setConfig(projectId, 'user.email', email, { global })
      },

      /**
       * Get default branch name from config
       */
      async getDefaultBranch(projectId: number): Promise<string> {
        try {
          const branch = await service.getConfig(projectId, 'init.defaultBranch')
          return typeof branch === 'string' && branch ? branch : 'main'
        } catch (error) {
          return 'main'
        }
      },

      /**
       * Set default branch name in config
       */
      async setDefaultBranch(projectId: number, branch: string, global: boolean = false): Promise<void> {
        await service.setConfig(projectId, 'init.defaultBranch', branch, { global })
      }
    }
    
    return service
  })
}

// Export type for consumers
export type GitConfigService = ReturnType<typeof createGitConfigService>

// Export singleton instance for backward compatibility
export const gitConfigService = createGitConfigService()

// Export individual functions for tree-shaking
export const {
  getConfig,
  setConfig,
  unsetConfig,
  getUserName,
  getUserEmail,
  setUserName,
  setUserEmail,
  getDefaultBranch,
  setDefaultBranch
} = gitConfigService
