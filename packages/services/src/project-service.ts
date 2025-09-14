/**
 * Project Service - Functional Factory Pattern
 * Replaces 1458-line ProjectService with ~200 lines using repository integration
 *
 * Key improvements:
 * - Uses Drizzle repository instead of manual file operations
 * - Consistent error handling with ErrorFactory
 * - Functional composition instead of direct exports
 * - Dependency injection support
 * - 85% code reduction
 */

import { createCrudService, extendService, withErrorContext, createServiceLogger } from './core/base-service'
import { ErrorFactory } from '@promptliano/shared'
import { projectRepository } from '@promptliano/database'
import {
  type Project,
  type CreateProject as CreateProjectBody,
  type UpdateProject as UpdateProjectBody,
  type File as ProjectFile,
  ProjectSchema,
  CreateProjectSchema
} from '@promptliano/database'
import { z } from 'zod'
import { generateStructuredData } from './gen-ai-services'

// Import file service for delegation
import { fileService, type FileSyncData } from './file-service'

// Re-export FileSyncData type for consumers
export type { FileSyncData } from './file-service'


// Repository returns correct Project type from database - no adapters needed

// Dependencies interface for dependency injection
export interface ProjectServiceDeps {
  repository?: typeof projectRepository
  logger?: ReturnType<typeof createServiceLogger>
  fileService?: any // To be defined when FileService is migrated
  gitService?: any // For git operations
}

/**
 * Create Project Service with functional factory pattern
 */
export function createProjectService(deps: ProjectServiceDeps = {}) {
  const {
    repository = projectRepository,
    logger = createServiceLogger('ProjectService'),
    fileService: injectedFileService = fileService
  } = deps

  // Base CRUD operations using the service factory
  const baseService = createCrudService<Project, CreateProjectBody, UpdateProjectBody>({
    entityName: 'Project',
    repository,
    // Skip schema validation - repository handles it
    logger
  })

  // Extended domain operations
  const extensions = {
    /**
     * Custom route handler: GET /api/projects/{projectId}/queues
     * Used by generated project routes (handlerName: 'getQueues')
     */
    async getQueues(params: { projectId: number }) {
      return withErrorContext(
        async () => {
          const { projectId } = params
          // Ensure project exists
          await baseService.getById(projectId)
          // Delegate to queue service
          const { queueService } = await import('./queue-service')
          return await queueService.getByProject(projectId)
        },
        { entity: 'Project', action: 'getQueues' }
      )
    },
    /**
     * Create project with path uniqueness validation
     */
    async create(data: CreateProjectBody): Promise<Project> {
      return withErrorContext(
        async () => {
          // Check for duplicate path
          const existing = await repository.getByPath(data.path)
          if (existing) {
            throw ErrorFactory.alreadyExists('Project', 'path', data.path)
          }

          // Use the base service create method
          return await baseService.create(data)
        },
        { entity: 'Project', action: 'create' }
      )
    },

    /**
     * Get project by path (common lookup)
     */
    async getByPath(path: string): Promise<Project | null> {
      return withErrorContext(
        async () => {
          return await repository.getByPath(path)
        },
        { entity: 'Project', action: 'getByPath' }
      )
    },

    /**
     * List projects with pagination
     */
    async listPaginated(options: { limit?: number; offset?: number } = {}): Promise<{
      data: Project[]
      total: number
    }> {
      return withErrorContext(
        async () => {
          const page = Math.floor((options?.offset || 0) / (options?.limit || 10)) + 1
          const result = await repository.paginate(page, options?.limit || 10)
          return {
            data: result.data,
            total: result.total
          }
        },
        { entity: 'Project', action: 'listPaginated' }
      )
    },

    /**
     * Get project with all related data (tickets, files, etc.)
     */
    async getWithRelations(id: number) {
      return withErrorContext(
        async () => {
          // Verify project exists first
          await baseService.getById(id)

          return await repository.getWithAllRelations(id)
        },
        { entity: 'Project', action: 'getWithRelations', id }
      )
    },

    /**
     * Get project overview - comprehensive project context
     */
    async getOverview(projectId: number): Promise<string> {
      return withErrorContext(
        async () => {
          const project = await baseService.getById(projectId)
          const relations = await repository.getWithAllRelations(projectId)

          if (!relations) {
            throw ErrorFactory.notFound('Project relations', projectId)
          }

          // Build overview sections
          const lines: string[] = []

          lines.push('=== PROJECT OVERVIEW ===')
          lines.push(`Project: ${project.name} (ID: ${project.id})`)
          lines.push(`Path: ${project.path}`)
          lines.push(`Last Updated: ${new Date(project.updatedAt).toLocaleString()}`)
          lines.push('')

          // Add tickets section
          const openTickets = relations.tickets?.filter((t: any) => t.status !== 'closed') || []
          lines.push(`=== RECENT TICKETS (${openTickets.length} open) ===`)
          if (openTickets.length > 0) {
            openTickets.slice(0, 5).forEach((ticket: any) => {
              const priority = ticket.priority ? `[${ticket.priority.toUpperCase()}]` : ''
              lines.push(`#${ticket.id}: ${ticket.title} ${priority}`)
            })
            if (openTickets.length > 5) {
              lines.push(`... and ${openTickets.length - 5} more open tickets`)
            }
          } else {
            lines.push('No open tickets')
          }
          lines.push('')

          // Add task queues section
          lines.push(`=== TASK QUEUES (${relations.queues?.length || 0} total) ===`)
          if (relations.queues?.length) {
            relations.queues.forEach((queue: any) => {
              const queuedItems = queue.items?.filter((item: any) => item.status === 'queued').length || 0
              const inProgressItems = queue.items?.filter((item: any) => item.status === 'in_progress').length || 0
              const completedItems = queue.items?.filter((item: any) => item.status === 'completed').length || 0

              const statusIcon = queue.isActive ? '✓' : '⏸'
              lines.push(
                `${statusIcon} ${queue.name}: ${queuedItems} queued, ${inProgressItems} in progress, ${completedItems} completed`
              )
            })
          } else {
            lines.push('No task queues configured')
            lines.push('Use flow_manager (queues_create) to create queues for AI task processing')
          }

          return lines.join('\n')
        },
        { entity: 'Project', action: 'getOverview', id: projectId }
      )
    },

    /**
     * List projects with optional filtering
     */
    async list(
      options: {
        sortBy?: 'name' | 'updatedAt' | 'createdAt'
        order?: 'asc' | 'desc'
        limit?: number
      } = {}
    ): Promise<Project[]> {
      return withErrorContext(
        async () => {
          const projects = await repository.getAll()

          // Apply sorting (supports 'updatedAt' explicitly as well)
          if (options.sortBy) {
            projects.sort((a, b) => {
              // Use the correct database field names
              const sortField = options.sortBy!
              const aVal = (a as any)[sortField]
              const bVal = (b as any)[sortField]
              const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
              return options.order === 'desc' ? -comparison : comparison
            })
          }

          // Apply limit
          if (options.limit) {
            return projects.slice(0, options.limit)
          }

          return projects
        },
        { entity: 'Project', action: 'list' }
      )
    },

    /**
     * Delete project with cascade (removes all related data)
     */
    async deleteCascade(id: number): Promise<boolean> {
      return withErrorContext(
        async () => {
          // Verify project exists
          await baseService.getById(id)

          // Delete with cascade (handled by database constraints)
          const success = await repository.delete(id)

          if (success) {
            logger.info(`Deleted project with cascade`, { id })
          }

          return success
        },
        { entity: 'Project', action: 'deleteCascade', id }
      )
    },

    /**
     * Search projects by name or path
     */
    async search(query: string): Promise<Project[]> {
      return withErrorContext(
        async () => {
          const projects = await repository.getAll()
          const lowercaseQuery = query.toLowerCase()

          return projects.filter(
            (project) =>
              project.name.toLowerCase().includes(lowercaseQuery) ||
              project.path.toLowerCase().includes(lowercaseQuery) ||
              (project.description && project.description.toLowerCase().includes(lowercaseQuery))
          )
        },
        { entity: 'Project', action: 'search' }
      )
    },

    /**
     * Get project statistics
     */
    async getStats(id: number) {
      return withErrorContext(
        async () => {
          const relations = await repository.getWithAllRelations(id)

          if (!relations) {
            throw ErrorFactory.notFound('Project', id)
          }

          return {
            ticketCount: relations.tickets?.length || 0,
            openTickets: relations.tickets?.filter((t: any) => t.status !== 'closed').length || 0,
            totalTasks:
              relations.tickets?.reduce((sum: number, ticket: any) => sum + (ticket.tasks?.length || 0), 0) || 0,
            completedTasks:
              relations.tickets?.reduce(
                (sum: number, ticket: any) =>
                  sum + (ticket.tasks?.filter((task: any) => task.status === 'completed').length || 0),
                0
              ) || 0,
            queueCount: relations.queues?.length || 0,
            activeQueues: relations.queues?.filter((q: any) => q.isActive).length || 0,
            chatCount: relations.chats?.length || 0,
            promptCount: relations.prompts?.length || 0
          }
        },
        { entity: 'Project', action: 'getStats', id }
      )
    },

    /**
     * Get all files for this project
     */
    async getProjectFiles(projectId: number, options?: { limit?: number; offset?: number }): Promise<ProjectFile[]> {
      return withErrorContext(
        async () => {
          // Verify project exists
          await baseService.getById(projectId)
          return await injectedFileService.getByProject(projectId, options)
        },
        { entity: 'Project', action: 'getProjectFiles', id: projectId }
      )
    },

    /**
     * Update file content (project-scoped)
     */
    async updateFileContent(projectId: number, fileId: string, content: string): Promise<ProjectFile> {
      return withErrorContext(
        async () => {
          // Verify project exists
          await baseService.getById(projectId)
          return await injectedFileService.updateContent(projectId, fileId, content)
        },
        { entity: 'Project', action: 'updateFileContent', id: projectId }
      )
    },


    /**
     * Suggest relevant files based on a user prompt using indexed search + relevance scoring
     */
    async suggestFiles(projectId: number, prompt: string, limit: number = 10): Promise<ProjectFile[]> {
      return withErrorContext(
        async () => {
          // Verify project exists
          await baseService.getById(projectId)

          const userQuery = (prompt || '').trim()
          if (!userQuery) {
            return []
          }

          // Use semantic search
          try {
            const { createFileSearchService } = await import('./file-services/file-search-service')
            const searchService = createFileSearchService()
            const { results } = await searchService.search(projectId, {
              query: userQuery,
              searchType: 'semantic',
              scoringMethod: 'relevance',
              limit
            })
            return results.map((r) => r.file).slice(0, limit)
          } catch (e) {
            logger.warn('Semantic search failed for suggestFiles', e as any)
            return []
          }
        },
        { entity: 'Project', action: 'suggestFiles', id: projectId }
      )
    }
  }

  return extendService(baseService, { ...extensions })
}

// Export type for consumers
export type ProjectService = ReturnType<typeof createProjectService>

// Export singleton for backward compatibility
export const projectService = createProjectService()

// Export individual functions for tree-shaking and backward compatibility
export const {
  create: createProject,
  getById: getProjectById,
  findById: findProjectById,
  getAll: getAllProjects,
  update: updateProject,
  delete: deleteProject,
  exists: projectExists,
  count: countProjects,
  getByPath: getProjectByPath,
  getWithRelations: getProjectWithRelations,
  getOverview: getProjectOverview,
  list: listProjects,
  deleteCascade: deleteProjectCascade,
  search: searchProjects,
  getStats: getProjectStats,
  // File operations (project-scoped)
  getProjectFiles,
  updateFileContent,
  suggestFiles
} = projectService

/**
 * Bulk create project files in batches with transaction support
 * Used by file sync service for efficient bulk operations
 */
export const bulkCreateProjectFiles = async (projectId: number, files: FileSyncData[]): Promise<ProjectFile[]> => {
  return withErrorContext(
    async () => {
      if (files.length === 0) {
        return []
      }

      // Verify project exists first
      await projectService.getById(projectId)

      // Prepare file data with proper IDs and timestamps
      const now = Date.now()
      const filesData = files.map((fileData: FileSyncData) => ({
        id: `${projectId}_${fileData.path}`, // Composite ID for files
        projectId,
        name: fileData.name,
        path: fileData.path,
        size: fileData.size,
        content: fileData.content,
        checksum: fileData.checksum,
        imports: fileData.imports,
        exports: fileData.exports,
        createdAt: now,
        updatedAt: now
      }))

      // Use batch creation from file service
      return await fileService.batch.createFiles(projectId, files)
    },
    { entity: 'Project', action: 'bulkCreateFiles', id: projectId }
  )
}

/**
 * Bulk update project files in batches with transaction support
 * Used by file sync service for efficient bulk operations
 */
export const bulkUpdateProjectFiles = async (
  projectId: number,
  updates: Array<{ fileId: string; data: FileSyncData }>
): Promise<ProjectFile[]> => {
  return withErrorContext(
    async () => {
      if (updates.length === 0) {
        return []
      }

      // Verify project exists first
      await projectService.getById(projectId)

      // File IDs are already strings in the new schema, so no conversion needed

      // Use batch updates from file service
      return await fileService.batch.updateFiles(projectId, updates)
    },
    { entity: 'Project', action: 'bulkUpdateFiles', id: projectId }
  )
}

/**
 * Bulk delete project files in batches with transaction support
 * Used by file sync service for efficient bulk operations
 */
export const bulkDeleteProjectFiles = async (
  projectId: number,
  fileIds: string[]
): Promise<{ deletedCount: number }> => {
  return withErrorContext(
    async () => {
      if (fileIds.length === 0) {
        return { deletedCount: 0 }
      }

      // Verify project exists first
      await projectService.getById(projectId)

      // File IDs are already strings in the new schema

      // Use batch deletion from file service
      const deletedCount = await fileService.batch.deleteFiles(projectId, fileIds)

      return { deletedCount }
    },
    { entity: 'Project', action: 'bulkDeleteFiles', id: projectId }
  )
}

// Add missing function for file tree
export const getProjectFileTree = async (
  projectId: number,
  options?: {
    maxDepth?: number
    includeHidden?: boolean
    fileTypes?: string[]
    maxFilesPerDir?: number
    limit?: number
    offset?: number
    excludePatterns?: string[]
    includeContent?: boolean
  }
): Promise<any> => {
  const {
    maxDepth = 10,
    includeHidden = false,
    fileTypes,
    maxFilesPerDir = 500,
    limit,
    offset = 0,
    excludePatterns,
    includeContent = false
  } = options || {}

  // Helper: determine if any segment in path is hidden (starts with '.')
  const isHiddenPath = (p: string) => p.split('/').some((seg) => seg.startsWith('.'))

  // Helper: get extension without leading dot
  const getExt = (p: string) => {
    const idx = p.lastIndexOf('.')
    return idx >= 0 ? p.slice(idx + 1) : ''
  }

  const allFiles = await getProjectFiles(projectId)

  // Filter files based on options
  const matchesExclude = (p: string) => {
    if (!excludePatterns || excludePatterns.length === 0) return false
    return excludePatterns.some((pat) => {
      // Simple substring match; if pattern looks like a regex (/.../), try to use it
      if (pat.startsWith('/') && pat.endsWith('/')) {
        try {
          const re = new RegExp(pat.slice(1, -1))
          return re.test(p)
        } catch {
          return p.includes(pat)
        }
      }
      return p.includes(pat)
    })
  }

  const filteredFiles = allFiles
    .filter((f: ProjectFile) => {
      if (!includeHidden && isHiddenPath(f.path)) return false
      if (fileTypes && fileTypes.length > 0) {
        const ext = getExt(f.path)
        if (!fileTypes.includes(ext)) return false
      }
      if (matchesExclude(f.path)) return false
      return true
    })
    .sort((a: ProjectFile, b: ProjectFile) => a.path.localeCompare(b.path))

  type DirNode = {
    name: string
    path: string
    type: 'directory'
    children: Array<DirNode | FileNode>
    truncated?: boolean
    depth: number
    // Internal helpers (not returned)
    __dirs?: Map<string, DirNode>
    __fileCount?: number
  }
  type FileNode = {
    name: string
    path: string
    id: string
    type: 'file'
  }

  const root: DirNode = {
    name: 'Project Root',
    path: '',
    type: 'directory',
    children: [],
    depth: 0,
    __dirs: new Map(),
    __fileCount: 0
  }

  // Ensure directory child exists and return it
  const getOrCreateDir = (parent: DirNode, dirName: string, fullPath: string): DirNode => {
    if (!parent.__dirs) parent.__dirs = new Map()
    let node = parent.__dirs.get(dirName)
    if (!node) {
      node = {
        name: dirName,
        path: fullPath,
        type: 'directory',
        children: [],
        depth: parent.depth + 1,
        __dirs: new Map(),
        __fileCount: 0
      }
      parent.__dirs.set(dirName, node)
      parent.children.push(node)
    }
    return node
  }

  let returnedFiles = 0
  const totalFiles = filteredFiles.length
  const startIndex = Math.max(0, offset)
  const endIndex = typeof limit === 'number' ? Math.min(totalFiles, startIndex + Math.max(0, limit)) : totalFiles

  for (let idx = 0; idx < filteredFiles.length; idx++) {
    if (idx < startIndex) continue
    if (idx >= endIndex) break
    const f = filteredFiles[idx]
    if (!f) continue

    const parts = f.path.split('/').filter(Boolean)
    const fileName = parts.pop() || f.path
    let current = root
    let currentPath = ''

    // Traverse/create directories up to maxDepth - 1 (so files appear at <= maxDepth)
    for (let i = 0; i < parts.length; i++) {
      if (current.depth >= maxDepth - 1) {
        // We would exceed depth if we descend further; mark truncated and stop
        current.truncated = true
        current = null as any
        break
      }
      const part = parts[i]
      if (!part) continue // Skip empty parts

      currentPath = currentPath ? `${currentPath}/${part}` : part
      current = getOrCreateDir(current, part, currentPath)
    }

    if (!current) continue // truncated by depth

    // Enforce max files per directory on the immediate directory
    const fileCount = current.__fileCount || 0
    if (fileCount >= maxFilesPerDir) {
      current.truncated = true
      continue
    }

    current.__fileCount = fileCount + 1
    const fileNode: FileNode = {
      name: fileName,
      path: f.path,
      id: String((f as any).id || `${projectId}_${f.path}`),
      type: 'file'
    }
    if (includeContent) {
      ;(fileNode as any).content = (f as any).content ?? null
      ;(fileNode as any).size = (f as any).size ?? undefined
    }
    current.children.push(fileNode)
    returnedFiles += 1
  }

  // Clean internal properties before returning
  const prune = (node: DirNode | FileNode): any => {
    if (node.type === 'file') return node
    const dir = node as DirNode
    const children = dir.children.map((c) => prune(c as any))
    const cleaned: any = {
      name: dir.name,
      path: dir.path,
      type: 'directory',
      depth: dir.depth,
      children
    }
    if (dir.truncated) cleaned.truncated = true
    return cleaned
  }

  const tree = prune(root)
  const meta = {
    totalFiles,
    returnedFiles,
    offset: startIndex,
    limit: typeof limit === 'number' ? limit : undefined,
    filters: {
      includeHidden,
      fileTypes,
      excludePatterns,
      maxDepth,
      maxFilesPerDir
    }
  }

  return { tree, meta }
}

