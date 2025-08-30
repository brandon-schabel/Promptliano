import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { z } from 'zod'
import ErrorFactory, { withErrorContext } from '@promptliano/shared/src/error/error-factory'
import { createFileService, createFileCache, type FileServiceConfig } from './file-service-factory'

export const DetectedAgentFileSchema = z.object({
  type: z.string(),
  name: z.string(),
  path: z.string(),
  scope: z.enum(['global', 'project']),
  exists: z.boolean(),
  writable: z.boolean(),
  content: z.string().optional(),
  metadata: z.record(z.any()).optional()
})

export type DetectedAgentFile = z.infer<typeof DetectedAgentFileSchema>

export interface AgentFilePattern {
  type: string
  name: string
  patterns: {
    global?: string[]
    project: string[]
  }
  extractMetadata?: (content: string) => Record<string, any>
}

export interface AgentFileDetectionServiceDeps {
  config?: FileServiceConfig
  cache?: ReturnType<typeof createFileCache>
  fileSystem?: {
    stat: typeof fs.stat
    readFile: typeof fs.readFile
    writeFile: typeof fs.writeFile
    mkdir: typeof fs.mkdir
    access: typeof fs.access
  }
}

export function createAgentFileDetectionService(deps: AgentFileDetectionServiceDeps = {}) {
  const service = createFileService('AgentFileDetectionService', deps.config)
  const cache = deps.cache || createFileCache({ ttl: 2 * 60 * 1000, maxSize: 100 }) // 2 minute cache
  const fileSystem = deps.fileSystem || fs

  // Agent file patterns
  const patterns: AgentFilePattern[] = [
    {
      type: 'claude',
      name: 'Claude',
      patterns: {
        global: [
          path.join(os.homedir(), '.claude', 'CLAUDE.md'), 
          path.join(os.homedir(), 'CLAUDE.md')
        ],
        project: ['CLAUDE.md', '.claude/CLAUDE.md']
      }
    },
    {
      type: 'copilot',
      name: 'GitHub Copilot',
      patterns: {
        project: ['.github/copilot-instructions.md', 'copilot-instructions.md']
      }
    },
    {
      type: 'cursor',
      name: 'Cursor',
      patterns: {
        project: ['.cursorrules', '.cursor/rules.md']
      }
    },
    {
      type: 'aider',
      name: 'Aider',
      patterns: {
        global: [path.join(os.homedir(), '.aider.conf.yml')],
        project: ['.aider', '.aider.conf.yml', '.aider/aider.conf.yml']
      },
      extractMetadata: (content: string) => {
        const metadata: Record<string, any> = {}
        const modelMatch = content.match(/model:\s*(.+)/)
        if (modelMatch && modelMatch[1]) metadata.model = modelMatch[1].trim()
        return metadata
      }
    },
    {
      type: 'codebase',
      name: 'Codebase Instructions',
      patterns: {
        project: [
          'codebase-instructions.md', 
          '.ai/instructions.md', 
          'AI_INSTRUCTIONS.md', 
          'docs/ai-instructions.md'
        ]
      }
    },
    {
      type: 'windsurf',
      name: 'Windsurf',
      patterns: {
        project: ['.windsurf/rules.md', '.windsurfrules']
      }
    },
    {
      type: 'continue',
      name: 'Continue',
      patterns: {
        global: [path.join(os.homedir(), '.continue', 'config.json')],
        project: ['.continue/config.json']
      },
      extractMetadata: (content: string) => {
        try {
          const config = JSON.parse(content)
          return {
            models: config.models?.map((m: any) => m.title || m.model) || []
          }
        } catch {
          return {}
        }
      }
    }
  ]

  async function detectAllFiles(projectPath?: string): Promise<DetectedAgentFile[]> {
    return service.withErrorContext<DetectedAgentFile[]>(
      async (): Promise<DetectedAgentFile[]> => {
        const cacheKey = `all-files:${projectPath || 'no-project'}`
        const cached = cache.get(cacheKey)
        if (cached && Array.isArray(cached)) return cached

        const detectedFiles: DetectedAgentFile[] = []

        // Use streaming processor for better performance with many patterns
        const allPatterns = patterns.flatMap(pattern => [
          ...(pattern.patterns.global || []).map(globalPath => ({
            pattern,
            filePath: globalPath,
            scope: 'global' as const
          })),
          ...(projectPath ? pattern.patterns.project.map(projectPattern => ({
            pattern,
            filePath: path.join(projectPath, projectPattern),
            scope: 'project' as const
          })) : [])
        ])

        const processor = service.createStreamProcessor(
          async (item: { pattern: AgentFilePattern; filePath: string; scope: 'global' | 'project' }) => {
            return checkFile(item.filePath, item.pattern, item.scope)
          }
        )

        for await (const result of processor.processStream(allPatterns)) {
          if ('item' in result && result.item) {
            detectedFiles.push(result.item)
          }
        }

        cache.set(cacheKey, detectedFiles)
        return detectedFiles
      },
      { action: 'detect-all-files' }
    )
  }

  async function detectProjectFiles(projectPath: string): Promise<DetectedAgentFile[]> {
    return service.withErrorContext<DetectedAgentFile[]>(
      async (): Promise<DetectedAgentFile[]> => {
        const cacheKey = `project-files:${projectPath}`
        const cached = cache.get(cacheKey)
        if (cached && Array.isArray(cached)) return cached

        const detectedFiles: DetectedAgentFile[] = []

        const projectPatterns = patterns.flatMap(pattern =>
          pattern.patterns.project.map(projectPattern => ({
            pattern,
            filePath: path.join(projectPath, projectPattern),
            scope: 'project' as const
          }))
        )

        const processor = service.createStreamProcessor(
          async (item: { pattern: AgentFilePattern; filePath: string; scope: 'project' }) => {
            return checkFile(item.filePath, item.pattern, item.scope)
          }
        )

        for await (const result of processor.processStream(projectPatterns)) {
          if ('item' in result && result.item) {
            detectedFiles.push(result.item)
          }
        }

        cache.set(cacheKey, detectedFiles)
        return detectedFiles
      },
      { action: 'detect-project-files', id: projectPath }
    )
  }

  async function detectGlobalFiles(): Promise<DetectedAgentFile[]> {
    return service.withErrorContext<DetectedAgentFile[]>(
      async (): Promise<DetectedAgentFile[]> => {
        const cacheKey = 'global-files'
        const cached = cache.get(cacheKey)
        if (cached && Array.isArray(cached)) return cached

        const detectedFiles: DetectedAgentFile[] = []

        const globalPatterns = patterns
          .filter(pattern => pattern.patterns.global)
          .flatMap(pattern =>
            pattern.patterns.global!.map(globalPath => ({
              pattern,
              filePath: globalPath,
              scope: 'global' as const
            }))
          )

        const processor = service.createStreamProcessor(
          async (item: { pattern: AgentFilePattern; filePath: string; scope: 'global' }) => {
            return checkFile(item.filePath, item.pattern, item.scope)
          }
        )

        for await (const result of processor.processStream(globalPatterns)) {
          if ('item' in result && result.item) {
            detectedFiles.push(result.item)
          }
        }

        cache.set(cacheKey, detectedFiles)
        return detectedFiles
      },
      { action: 'detect-global-files' }
    )
  }

  async function checkFile(
    filePath: string,
    pattern: AgentFilePattern,
    scope: 'global' | 'project'
  ): Promise<DetectedAgentFile | null> {
    return service.withErrorContext(
      async () => {
        try {
          const stats = await fileSystem.stat(filePath)

          if (!stats.isFile()) return null

          // Check if file is writable
          let writable = false
          try {
            await fileSystem.access(filePath, fs.constants.W_OK)
            writable = true
          } catch {
            writable = false
          }

          // Read content for metadata extraction
          let content: string | undefined
          let metadata: Record<string, any> | undefined

          try {
            content = await fileSystem.readFile(filePath, 'utf-8')
            if (pattern.extractMetadata && content) {
              metadata = pattern.extractMetadata(content)
            }
          } catch {
            // File exists but can't be read
          }

          return {
            type: pattern.type,
            name: pattern.name,
            path: filePath,
            scope,
            exists: true,
            writable,
            content,
            metadata
          }
        } catch {
          // File doesn't exist or can't be accessed
          return {
            type: pattern.type,
            name: pattern.name,
            path: filePath,
            scope,
            exists: false,
            writable: false
          }
        }
      },
      { action: 'check-file', id: filePath }
    )
  }

  async function createAgentFile(
    filePath: string, 
    initialContent: string = ''
  ): Promise<{ success: boolean; message: string }> {
    return service.withErrorContext(
      async () => {
        const dir = path.dirname(filePath)

        // Ensure directory exists
        try {
          await fileSystem.mkdir(dir, { recursive: true })
        } catch (error) {
          throw ErrorFactory.fileSystemError(
            'create directory',
            dir,
            error instanceof Error ? error.message : 'Unknown error'
          )
        }

        // Check if file already exists
        try {
          await fileSystem.access(filePath)
          throw ErrorFactory.duplicate('Agent file', 'path', filePath)
        } catch (error) {
          // If it's not our duplicate error, file doesn't exist - good to create
          if (error instanceof Error && (error as any).code === 'DUPLICATE_ENTITY') throw error
        }

        // Create the file
        try {
          await fileSystem.writeFile(filePath, initialContent, 'utf-8')
        } catch (error) {
          throw ErrorFactory.fileSystemError(
            'create file',
            filePath,
            error instanceof Error ? error.message : 'Unknown error'
          )
        }

        // Clear cache
        cache.invalidate()

        return {
          success: true,
          message: 'Successfully created agent file'
        }
      },
      { action: 'create-agent-file', id: filePath }
    ).catch(error => ({
      success: false,
      message: `Failed to create agent file: ${error instanceof Error ? error.message : 'Unknown error'}`
    }))
  }

  function getSuggestedFiles(
    projectPath: string,
    existingFiles: DetectedAgentFile[]
  ): (AgentFilePattern & { suggestedPath: string })[] {
    const existingTypes = new Set(existingFiles.map(f => f.type))

    return patterns
      .filter(pattern => !existingTypes.has(pattern.type))
      .map(pattern => ({
        ...pattern,
        suggestedPath: path.join(projectPath, pattern.patterns.project[0] || '')
      }))
  }

  function getFileTypeInfo(type: string): AgentFilePattern | undefined {
    return patterns.find(p => p.type === type)
  }

  // Batch operations for multiple projects
  async function batchDetectFiles(
    projects: Array<{ id: string; path: string }>
  ): Promise<Map<string, DetectedAgentFile[]>> {
    return service.withErrorContext(
      async () => {
        const results = new Map<string, DetectedAgentFile[]>()

        const processor = service.createParallelProcessor(
          async (batch: Array<{ id: string; path: string }>) => {
            return Promise.allSettled(
              batch.map(async project => {
                const files = await detectProjectFiles(project.path)
                return { projectId: project.id, files }
              })
            )
          }
        )

        const batchResult = await processor.processBatch(projects)

        for (const settled of batchResult.successful) {
          if (settled.status === 'fulfilled') {
            results.set(settled.value.projectId, settled.value.files)
          }
        }

        return results
      },
      { action: 'batch-detect-files' }
    )
  }

  // File monitoring capabilities
  async function *monitorAgentFiles(
    projectPath: string,
    pollInterval: number = 5000
  ): AsyncIterator<{
    timestamp: number
    changes: Array<{
      type: 'added' | 'removed' | 'modified'
      file: DetectedAgentFile
    }>
  }> {
    let lastSnapshot = await detectProjectFiles(projectPath)

    while (true) {
      await new Promise(resolve => setTimeout(resolve, pollInterval))

      try {
        // Clear cache to force fresh detection
        cache.invalidate()
        const currentSnapshot = await detectProjectFiles(projectPath)

        const changes: Array<{
          type: 'added' | 'removed' | 'modified'
          file: DetectedAgentFile
        }> = []

        // Find added/modified files
        for (const currentFile of currentSnapshot) {
          const lastFile = lastSnapshot.find(f => f.path === currentFile.path)
          
          if (!lastFile) {
            changes.push({ type: 'added', file: currentFile })
          } else if (
            lastFile.exists !== currentFile.exists ||
            lastFile.content !== currentFile.content
          ) {
            changes.push({ type: 'modified', file: currentFile })
          }
        }

        // Find removed files
        for (const lastFile of lastSnapshot) {
          const currentFile = currentSnapshot.find(f => f.path === lastFile.path)
          if (!currentFile) {
            changes.push({ type: 'removed', file: lastFile })
          }
        }

        if (changes.length > 0) {
          yield {
            timestamp: Date.now(),
            changes
          }
        }

        lastSnapshot = currentSnapshot
      } catch (error) {
        console.error('Error monitoring agent files:', error)
      }
    }
  }

  return {
    // Core functionality
    detectAllFiles,
    detectProjectFiles,
    detectGlobalFiles,
    createAgentFile,
    getSuggestedFiles,
    getFileTypeInfo,

    // Batch operations
    batchDetectFiles,
    monitorAgentFiles,

    // Service metadata
    serviceName: service.serviceName,
    config: service.config,

    // Cleanup
    destroy: () => {
      cache.destroy()
      service.destroy()
    }
  }
}

// Export types
export type AgentFileDetectionService = ReturnType<typeof createAgentFileDetectionService>

// Export singleton for backward compatibility
export const agentFileDetectionService = createAgentFileDetectionService()

// Export individual functions for tree-shaking
export const {
  detectAllFiles,
  detectProjectFiles,
  detectGlobalFiles,
  createAgentFile,
  getSuggestedFiles,
  getFileTypeInfo
} = agentFileDetectionService