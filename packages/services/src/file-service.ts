/**
 * File Service - Functional Factory Pattern
 * Modernized file management with repository integration
 * 
 * Key improvements:
 * - Uses Drizzle repository for file operations
 * - Functional composition pattern
 * - Consistent error handling with ErrorFactory
 * - Dependency injection support
 * - File system abstraction
 * - Project file synchronization
 * - Batch operations for performance
 */

import { createCrudService, extendService, withErrorContext, createServiceLogger } from './core/base-service'
import { ErrorFactory } from '@promptliano/shared'
import { fileRepository } from '@promptliano/database'
import { 
  type File as ProjectFile, 
  type InsertFile as CreateProjectFileBody,
  selectFileSchema as ProjectFileSchema
} from '@promptliano/database'

import { resolvePath } from '@promptliano/shared'
import path from 'node:path'
import fs from 'node:fs/promises'

// Update type for file updates
type UpdateProjectFileBody = Partial<Omit<CreateProjectFileBody, 'id' | 'createdAt' | 'updatedAt'>>

// Dependencies interface for dependency injection
export interface FileServiceDeps {
  repository?: typeof fileRepository
  logger?: ReturnType<typeof createServiceLogger>
  fs?: typeof fs // For testing with mock filesystem
  projectService?: any // For project validation
}

// File system abstraction for testing
export interface FileSystemAdapter {
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  exists(path: string): Promise<boolean>
  stat(path: string): Promise<{ size: number; mtime: Date }>
  readdir(path: string): Promise<string[]>
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>
}

// File synchronization data
export interface FileSyncData {
  path: string
  name: string
  content: string
  size: number
  checksum: string
  imports?: any[] | null
  exports?: any[] | null
}

/**
 * Create File Service with functional factory pattern
 */
export function createFileService(deps: FileServiceDeps = {}) {
  const {
    repository = fileRepository,
    logger = createServiceLogger('FileService'),
    fs: fileSystem = fs
  } = deps

  // File entities use string IDs, so we can't use the standard CRUD service
  // Instead, we'll create our own base operations that work with string IDs
  const baseService = {
    async list(): Promise<ProjectFile[]> {
      return withErrorContext(
        async () => {
          return await repository.getAll()
        },
        { entity: 'File', action: 'list' }
      )
    },

    async getAll(): Promise<ProjectFile[]> {
      return this.list()
    },

    async create(data: CreateProjectFileBody): Promise<ProjectFile> {
      return withErrorContext(
        async () => {
          // Remove createdAt/updatedAt as repository will handle them
          const { createdAt, updatedAt, ...createData } = data
          return await repository.create(createData)
        },
        { entity: 'File', action: 'create' }
      )
    },

    async getById(id: string | number): Promise<ProjectFile | null> {
      return withErrorContext(
        async () => {
          return await repository.getById(String(id))
        },
        { entity: 'File', action: 'getById', id }
      )
    },

    async update(id: string | number, data: UpdateProjectFileBody): Promise<ProjectFile> {
      return withErrorContext(
        async () => {
          return await repository.update(String(id), data)
        },
        { entity: 'File', action: 'update', id }
      )
    },

    async delete(id: string | number): Promise<boolean> {
      return withErrorContext(
        async () => {
          return await repository.delete(String(id))
        },
        { entity: 'File', action: 'delete', id }
      )
    }
  }

  // Helper function for checksum calculation
  const calculateChecksum = (content: string): string => {
    // Simple checksum using content length and hash
    const crypto = require('crypto')
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16)
  }

  // Extended domain operations
  const extensions = {
    /**
     * Get files by project with optional filtering
     */
    async getByProject(projectId: number, options?: {
      limit?: number
      offset?: number
      extension?: string
      path?: string
    }): Promise<ProjectFile[]> {
      return withErrorContext(
        async () => {
          return await repository.getByProject(projectId, options)
        },
        { entity: 'File', action: 'getByProject' }
      )
    },

    /**
     * Get files by paths for a project
     */
    async getByPaths(projectId: number, paths: string[]): Promise<ProjectFile[]> {
      return withErrorContext(
        async () => {
          if (!paths || paths.length === 0) {
            return []
          }
          return await repository.getByPaths(projectId, paths)
        },
        { entity: 'File', action: 'getByPaths' }
      )
    },

    /**
     * Validate that file paths exist in a project
     */
    async validatePaths(projectId: number, paths: string[]): Promise<{
      valid: string[]
      invalid: string[]
    }> {
      return withErrorContext(
        async () => {
          if (!paths || paths.length === 0) {
            return { valid: [], invalid: [] }
          }

          const existingFiles = await this.getByPaths(projectId, paths)
          const existingPaths = new Set(existingFiles.map(f => f.path))

          const valid = paths.filter(p => existingPaths.has(p))
          const invalid = paths.filter(p => !existingPaths.has(p))

          return { valid, invalid }
        },
        { entity: 'File', action: 'validatePaths' }
      )
    },

    /**
     * Sync project files from filesystem
     */
    async syncProject(projectId: number, projectPath: string, options?: {
      excludes?: string[]
      maxFileSize?: number
      extensions?: string[]
    }): Promise<{
      created: number
      updated: number
      deleted: number
      skipped: number
    }> {
      return withErrorContext(
        async () => {
          const resolvedPath = resolvePath(projectPath)
          const stats = { created: 0, updated: 0, deleted: 0, skipped: 0 }

          // Get current files in database
          const existingFiles = await this.getByProject(projectId)
          const existingFileMap = new Map(existingFiles.map(f => [f.path, f]))

          // Scan filesystem for files
          const fileSystemFiles = await this.scanDirectory(resolvedPath, {
            excludes: options?.excludes || [],
            maxFileSize: options?.maxFileSize || 1024 * 1024 * 10, // 10MB default
            extensions: options?.extensions
          })

          // Process filesystem files
          const filesToCreate: FileSyncData[] = []
          const filesToUpdate: Array<{ fileId: string; data: FileSyncData }> = []

          for (const fsFile of fileSystemFiles) {
            const relativePath = path.relative(resolvedPath, fsFile.fullPath)
            const existing = existingFileMap.get(relativePath)

            if (existing) {
              // Check if file needs updating (different checksum)
              if (existing.checksum !== fsFile.checksum) {
                filesToUpdate.push({
                  fileId: existing.id,
                  data: {
                    path: relativePath,
                    name: fsFile.name,
                    content: fsFile.content,
                    size: fsFile.size,
                    checksum: fsFile.checksum,
                    imports: fsFile.imports,
                    exports: fsFile.exports
                  }
                })
              }
              existingFileMap.delete(relativePath) // Mark as processed
            } else {
              // New file to create
              filesToCreate.push({
                path: relativePath,
                name: fsFile.name,
                content: fsFile.content,
                size: fsFile.size,
                checksum: fsFile.checksum,
                imports: fsFile.imports,
                exports: fsFile.exports
              })
            }
          }

          // Create new files
          if (filesToCreate.length > 0) {
            await this.batch.createFiles(projectId, filesToCreate)
            stats.created = filesToCreate.length
          }

          // Update existing files
          if (filesToUpdate.length > 0) {
            await this.batch.updateFiles(projectId, filesToUpdate)
            stats.updated = filesToUpdate.length
          }

          // Delete files that no longer exist on filesystem
          const filesToDelete = Array.from(existingFileMap.keys())
          if (filesToDelete.length > 0) {
            const fileIds = filesToDelete.map(path => existingFileMap.get(path)!.id)
            await this.batch.deleteFiles(projectId, fileIds)
            stats.deleted = filesToDelete.length
          }

          logger.info(`Project sync completed for ${projectId}:`, stats)
          return stats
        },
        { entity: 'File', action: 'syncProject' }
      )
    },

    /**
     * Scan directory for files with metadata
     */
    async scanDirectory(directoryPath: string, options: {
      excludes: string[]
      maxFileSize: number
      extensions?: string[]
    }): Promise<Array<{
      fullPath: string
      name: string
      content: string
      size: number
      checksum: string
      imports?: any[]
      exports?: any[]
    }>> {
      return withErrorContext(
        async () => {
          const files: any[] = []
          
          async function scanRecursive(currentPath: string) {
            try {
              const entries = await fileSystem.readdir(currentPath, { withFileTypes: true })
              
              for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name)
                
                // Skip excluded patterns
                if (options.excludes.some(pattern => fullPath.includes(pattern))) {
                  continue
                }
                
                if (entry.isDirectory()) {
                  await scanRecursive(fullPath)
                } else if (entry.isFile()) {
                  const stat = await fileSystem.stat(fullPath)
                  
                  // Skip files that are too large
                  if (stat.size > options.maxFileSize) {
                    continue
                  }
                  
                  const extension = path.extname(fullPath)
                  
                  // Filter by extensions if specified
                  if (options.extensions && !options.extensions.includes(extension)) {
                    continue
                  }
                  
                  try {
                    const content = await fileSystem.readFile(fullPath, 'utf8')
                    const checksum = calculateChecksum(content)
                    
                    files.push({
                      fullPath,
                      name: path.basename(fullPath),
                      content,
                      size: stat.size,
                      checksum,
                      imports: null, // Could be populated by parser
                      exports: null  // Could be populated by parser
                    })
                  } catch (readError) {
                    logger.warn(`Could not read file ${fullPath}:`, readError)
                  }
                }
              }
            } catch (dirError) {
              logger.warn(`Could not scan directory ${currentPath}:`, dirError)
            }
          }
          
          await scanRecursive(directoryPath)
          return files
        },
        { entity: 'File', action: 'scanDirectory' }
      )
    },

    /**
     * Update file content and metadata
     */
    async updateContent(projectId: number, fileId: string, content: string): Promise<ProjectFile> {
      return withErrorContext(
        async () => {
          const size = Buffer.byteLength(content, 'utf8')
          const checksum = calculateChecksum(content)
          
          return await baseService.update(fileId, {
            content,
            size,
            checksum
          } as UpdateProjectFileBody)
        },
        { entity: 'File', action: 'updateContent', id: fileId }
      )
    },

    /**
     * Batch operations for performance
     */
    batch: {
      /**
       * Create multiple files at once
       */
      createFiles: async (projectId: number, filesToCreate: FileSyncData[]): Promise<ProjectFile[]> => {
        return withErrorContext(
          async () => {
            if (filesToCreate.length === 0) return []
            
            const filesData = filesToCreate.map(fileData => ({
              id: fileData.path, // Use path as ID for files
              projectId,
              name: fileData.name,
              path: fileData.path,
              size: fileData.size,
              content: fileData.content,
              checksum: fileData.checksum,
              imports: fileData.imports,
              exports: fileData.exports
            }))
            
            // Create files individually since repository doesn't have createMany
            const results = await Promise.allSettled(
              filesData.map(fileData => repository.create(fileData))
            )
            
            const successful = results
              .filter((r): r is PromiseFulfilledResult<ProjectFile> => r.status === 'fulfilled')
              .map(r => r.value)
            
            logger.info(`Batch created ${successful.length}/${filesData.length} files`)
            return successful
          },
          { entity: 'File', action: 'batchCreate' }
        )
      },

      /**
       * Update multiple files at once
       */
      updateFiles: async (projectId: number, updates: Array<{ fileId: string; data: FileSyncData }>): Promise<ProjectFile[]> => {
        return withErrorContext(
          async () => {
            if (updates.length === 0) return []
            
            const results = await Promise.allSettled(
              updates.map(({ fileId, data }) => 
                baseService.update(fileId, {
                  content: data.content,
                  size: data.size,
                  checksum: data.checksum,
                  imports: data.imports,
                  exports: data.exports
                } as UpdateProjectFileBody)
              )
            )
            
            const successful = results
              .filter((r): r is PromiseFulfilledResult<ProjectFile> => r.status === 'fulfilled')
              .map(r => r.value)
            
            logger.info(`Batch updated ${successful.length}/${updates.length} files`)
            return successful
          },
          { entity: 'File', action: 'batchUpdate' }
        )
      },

      /**
       * Delete multiple files at once
       */
      deleteFiles: async (projectId: number, fileIds: string[]): Promise<number> => {
        return withErrorContext(
          async () => {
            if (fileIds.length === 0) return 0
            
            const results = await Promise.allSettled(
              fileIds.map(id => baseService.delete(id))
            )
            
            const successful = results.filter(r => r.status === 'fulfilled').length
            logger.info(`Batch deleted ${successful}/${fileIds.length} files`)
            
            return successful
          },
          { entity: 'File', action: 'batchDelete' }
        )
      }
    }
  }

  return extendService(baseService, extensions)
}

// Export type for consumers
export type FileService = ReturnType<typeof createFileService>

// Export singleton for backward compatibility
export const fileService = createFileService()

// Export individual functions for tree-shaking
export const {
  create: createFile,
  getById: getFileById,
  update: updateFile,
  delete: deleteFile,
  getByProject: getFilesByProject,
  syncProject: syncProjectFiles,
  updateContent: updateFileContent
} = fileService