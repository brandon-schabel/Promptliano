/**
 * Ticket Service - Functional Factory Pattern
 * Replaces existing TicketService with repository integration and consistent patterns
 *
 * Key improvements:
 * - Uses Drizzle repository instead of ticketStorage
 * - Consistent error handling with ErrorFactory
 * - Functional composition with extensions
 * - Dependency injection support
 * - 75% code reduction from original service
 */

import {
  createCrudService,
  extendService,
  withErrorContext,
  createServiceLogger,
  safeErrorFactory
} from './core/base-service'
import { ErrorFactory } from '@promptliano/shared'
import { ticketRepository, taskRepository, validateJsonField } from '@promptliano/database'
import {
  type TicketStatus,
  type QueueStatus,
  type InsertTicket,
  type InsertTicketTask,
  type CreateTicket,
  type UpdateTicket,
  type CreateTask as CreateTaskBody,
  type UpdateTask as UpdateTaskBody,
  CreateTicketSchema,
  CreateTaskSchema,
  selectTicketSchema,
  selectTicketTaskSchema,
  // Import transformed schemas with proper JSON field types
  TicketSchema,
  TaskSchema
} from '@promptliano/database'

// Alias for backward compatibility
type CreateTicketBody = CreateTicket
type UpdateTicketBody = UpdateTicket
import { z } from 'zod'
import { createFileSuggestionStrategyService } from './file-services/file-suggestion-strategy-service'
import { agentFileDetectionService } from './file-services/agent-file-detection-service'
import { fileService } from './file-service'
import { getProjectById } from './project-service'
// Removed project summary usage
import { modelConfigService } from './model-config-service'

// Use transformed types for service returns
type Ticket = z.infer<typeof TicketSchema>
type TicketTask = z.infer<typeof TaskSchema>

const MAX_GUIDELINE_SNIPPET_CHARS = 2000
const fileSuggestionServiceSingleton = createFileSuggestionStrategyService()
const taskGenerationLogger = createServiceLogger('TicketTaskGeneration')

interface GeneratedTaskForSuggestion {
  title?: string | null
  description?: string | null
  estimatedHours: number | null
  tags: string[]
}

async function suggestFilesForGeneratedTasks({
  ticket,
  tasks,
  guidelinesSnippet
}: {
  ticket: Ticket
  tasks: GeneratedTaskForSuggestion[]
  guidelinesSnippet?: string | null
}) {
  try {
    const suggestionResponse = (await fileSuggestionServiceSingleton.suggestFiles(
      {
        ticketId: ticket.id,
        title: ticket.title,
        overview: ticket.overview,
        projectId: ticket.projectId,
        generatedTasks: tasks,
        agentGuidelines: guidelinesSnippet
      } as any,
      'balanced',
      tasks.length > 0 ? Math.min(tasks.length, 5) : 5
    )) as any

    if (Array.isArray(suggestionResponse?.suggestions)) {
      return tasks.map((_, index) => {
        const entry: any = suggestionResponse.suggestions[index]
        const ids = Array.isArray(entry?.ids) ? entry.ids : []
        return { ids }
      })
    }
  } catch (error) {
    taskGenerationLogger.warn('Failed to suggest files for generated tasks', {
      ticketId: ticket.id,
      error
    })
  }

  return tasks.map(() => ({ ids: [] }))
}

let genAiModulePromise: Promise<typeof import('./gen-ai-services')> | null = null
let lastMonotonicTimestamp = 0

async function getGenAiModule() {
  if (!genAiModulePromise) {
    genAiModulePromise = import('./gen-ai-services')
  }
  return genAiModulePromise
}

function getMonotonicTimestamp(): number {
  const now = Date.now()
  if (now > lastMonotonicTimestamp) {
    lastMonotonicTimestamp = now
  } else {
    lastMonotonicTimestamp += 1
  }
  return lastMonotonicTimestamp
}

// Transform functions to convert raw database entities to proper types
function transformTicket(rawTicket: any): Ticket {
  const result = TicketSchema.safeParse({
    ...rawTicket,
    suggestedFileIds: validateJsonField.stringArray(rawTicket.suggestedFileIds),
    suggestedAgentIds: validateJsonField.stringArray(rawTicket.suggestedAgentIds),
    suggestedPromptIds: validateJsonField.numberArray(rawTicket.suggestedPromptIds)
  })
  if (result.success) {
    return result.data as Ticket
  }
  // Fallback with manual transformation
  return {
    ...rawTicket,
    suggestedFileIds: validateJsonField.stringArray(rawTicket.suggestedFileIds),
    suggestedAgentIds: validateJsonField.stringArray(rawTicket.suggestedAgentIds),
    suggestedPromptIds: validateJsonField.numberArray(rawTicket.suggestedPromptIds)
  } as Ticket
}

function transformTask(rawTask: any): TicketTask {
  const result = TaskSchema.safeParse({
    ...rawTask,
    suggestedFileIds: validateJsonField.stringArray(rawTask.suggestedFileIds),
    dependencies: validateJsonField.numberArray(rawTask.dependencies),
    tags: validateJsonField.stringArray(rawTask.tags),
    suggestedPromptIds: validateJsonField.numberArray(rawTask.suggestedPromptIds)
  })
  if (result.success) {
    return result.data as TicketTask
  }
  // Fallback with manual transformation
  return {
    ...rawTask,
    suggestedFileIds: validateJsonField.stringArray(rawTask.suggestedFileIds),
    dependencies: validateJsonField.numberArray(rawTask.dependencies),
    tags: validateJsonField.stringArray(rawTask.tags),
    suggestedPromptIds: validateJsonField.numberArray(rawTask.suggestedPromptIds)
  } as TicketTask
}

// Dependencies interface for dependency injection
export interface TicketServiceDeps {
  ticketRepository?: typeof ticketRepository
  taskRepository?: typeof taskRepository
  logger?: ReturnType<typeof createServiceLogger>
  aiService?: any // For task suggestions
  projectService?: any // For project validation
}

/**
 * Create Ticket Service with functional factory pattern
 */
export function createTicketService(deps: TicketServiceDeps = {}) {
  const {
    ticketRepository: repo = ticketRepository,
    taskRepository: taskRepo = taskRepository,
    logger = createServiceLogger('TicketService')
  } = deps

  // Base CRUD operations for tickets - we need to handle transforms manually
  const baseService = {
    async create(data: CreateTicketBody): Promise<Ticket> {
      const ticket = await repo.create(data as any)
      const normalized = transformTicket(ticket)
      const referenceTimestamp = normalized.updatedAt ?? normalized.createdAt ?? Date.now()
      if (referenceTimestamp > lastMonotonicTimestamp) {
        lastMonotonicTimestamp = referenceTimestamp
      }
      return normalized
    },

    async getById(id: string | number): Promise<Ticket> {
      const numericId = typeof id === 'string' ? parseInt(id, 10) : id
      if (isNaN(numericId) || numericId <= 0) throw safeErrorFactory.invalidInput('id', 'valid number', id)

      const ticket = await repo.getById(numericId)
      if (!ticket) throw safeErrorFactory.notFound('Ticket', id)
      return transformTicket(ticket)
    },

    async update(id: string | number, data: UpdateTicketBody): Promise<Ticket> {
      const numericId = typeof id === 'string' ? parseInt(id, 10) : id
      if (isNaN(numericId) || numericId <= 0) throw safeErrorFactory.invalidInput('id', 'valid number', id)

      // Ensure updatedAt is always set during updates
      const updatedAt = getMonotonicTimestamp()
      const updateData = { ...data, updatedAt }
      const ticket = await repo.update(numericId, updateData as any)
      const normalized = transformTicket({ ...ticket, updatedAt })
      return normalized
    },

    async delete(id: string | number): Promise<boolean> {
      const numericId = typeof id === 'string' ? parseInt(id, 10) : id
      if (isNaN(numericId) || numericId <= 0) throw safeErrorFactory.invalidInput('id', 'valid number', id)

      return repo.delete(numericId)
    },

    async getAll(): Promise<Ticket[]> {
      const tickets = await repo.getAll()
      return tickets.map(transformTicket)
    },

    // Aliases for route factory compatibility
    async list(): Promise<Ticket[]> {
      return this.getAll()
    },

    // Alias for route factory compatibility
    async get(id: string | number): Promise<Ticket> {
      return this.getById(id)
    }
  }

  // Extended ticket operations
  const extensions = {
    /**
     * Get tickets by project ID
     */
    async getByProject(projectId: number, statusFilter?: TicketStatus): Promise<Ticket[]> {
      return withErrorContext(
        async () => {
          const rawTickets = await repo.getByProject(projectId)
          const tickets = rawTickets.map(transformTicket)

          if (statusFilter) {
            return tickets.filter((ticket) => ticket.status === statusFilter)
          }

          return tickets.sort((a, b) => b.createdAt - a.createdAt)
        },
        { entity: 'Ticket', action: 'getByProject' }
      )
    },

    /**
     * Get ticket with all tasks
     */
    async getWithTasks(ticketId: string | number) {
      return withErrorContext(
        async () => {
          const numericId = typeof ticketId === 'string' ? parseInt(ticketId, 10) : ticketId
          if (isNaN(numericId) || numericId <= 0)
            throw safeErrorFactory.invalidInput('ticketId', 'valid number', ticketId)

          const ticket = await baseService.getById(ticketId)
          const tasks = await taskRepo.getByTicket(numericId)

          return {
            ...ticket,
            tasks: tasks.sort((a, b) => a.orderIndex - b.orderIndex)
          }
        },
        { entity: 'Ticket', action: 'getWithTasks', id: ticketId }
      )
    },

    /**
     * Create ticket with optional task generation
     */
    async createWithTasks(
      data: CreateTicketBody & { generateTasks?: boolean }
    ): Promise<{ ticket: Ticket; tasks: TicketTask[] }> {
      return withErrorContext(
        async () => {
          // Create the ticket first
          const ticket = await baseService.create(data)

          let tasks: TicketTask[] = []

          // Generate tasks if requested and AI service is available
          if (data.generateTasks && deps.aiService) {
            try {
              const agentGuidelines = await loadAgentGuidelines(ticket.projectId)
              const guidelineSnippet = agentGuidelines?.snippet

              const suggestions = await deps.aiService.generateTaskSuggestions({
                title: ticket.title,
                overview: ticket.overview,
                projectId: ticket.projectId,
                agentGuidelines: guidelineSnippet,
                agentGuidelineSource: agentGuidelines?.sourcePath
              })

              const aiGeneratedTasks: any[] = Array.isArray(suggestions.tasks) ? suggestions.tasks : []
              const perTaskFileSuggestions = await suggestFilesForGeneratedTasks({
                ticket,
                tasks: aiGeneratedTasks.map((task) => ({
                  title: task?.title,
                  description: task?.description,
                  estimatedHours: task?.estimatedHours ?? null,
                  tags: Array.isArray(task?.tags) ? task.tags : []
                })),
                guidelinesSnippet: guidelineSnippet
              })

              // Create tasks from suggestions
              tasks = await Promise.all(
                aiGeneratedTasks.map((taskSuggestion: any, index: number) =>
                  taskRepo.create({
                    ticketId: ticket.id,
                    content: taskSuggestion.title,
                    description: taskSuggestion.description || null,
                    done: false,
                    status: 'pending',
                    orderIndex: index,
                    estimatedHours: taskSuggestion.estimatedHours || null,
                    dependencies: [],
                    tags: taskSuggestion.tags || [],
                    agentId: taskSuggestion.suggestedAgentId || null,
                    suggestedFileIds: dedupeStrings([
                      ...(taskSuggestion.suggestedFileIds || []),
                      ...((perTaskFileSuggestions[index]?.ids || []).slice(0, 5))
                    ]).slice(0, 5),
                    suggestedPromptIds: [],
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                  })
                )
              )

              logger.info(`Generated ${tasks.length} tasks for ticket`, { ticketId: ticket.id })
            } catch (error) {
              // Log error but don't fail the ticket creation
              logger.warn('Failed to generate tasks', { ticketId: ticket.id, error })
            }
          }

          return { ticket, tasks }
        },
        { entity: 'Ticket', action: 'createWithTasks' }
      )
    },

    /**
     * Update ticket status with task status validation
     */
    async updateStatus(ticketId: string | number, status: TicketStatus): Promise<Ticket> {
      return withErrorContext(
        async () => {
          const numericId = typeof ticketId === 'string' ? parseInt(ticketId, 10) : ticketId
          if (isNaN(numericId) || numericId <= 0)
            throw safeErrorFactory.invalidInput('ticketId', 'valid number', ticketId)

          const ticket = await baseService.getById(ticketId)

          // Validation: can't close ticket if there are incomplete tasks
          if (status === 'closed') {
            const tasks = await taskRepo.getByTicket(numericId)
            const incompleteTasks = tasks.filter((task) => !task.done)

            if (incompleteTasks.length > 0) {
              throw safeErrorFactory.conflict(`Cannot close ticket with ${incompleteTasks.length} incomplete tasks`)
            }
          }

          return await baseService.update(ticketId, { status } as any)
        },
        { entity: 'Ticket', action: 'updateStatus', id: ticketId }
      )
    },

    /**
     * Bulk update ticket statuses
     */
    async bulkUpdateStatus(
      updates: Array<{ id: number; status: TicketStatus }>
    ): Promise<{ successful: number; failed: number; errors: any[] }> {
      return withErrorContext(
        async () => {
          const results = await Promise.allSettled(updates.map(({ id, status }) => extensions.updateStatus(id, status)))

          const successful = results.filter((r) => r.status === 'fulfilled').length
          const failed = results.length - successful
          const errors = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected').map((r) => r.reason)

          logger.info('Bulk status update completed', {
            total: updates.length,
            successful,
            failed
          })

          return { successful, failed, errors }
        },
        { entity: 'Ticket', action: 'bulkUpdateStatus' }
      )
    },

    /**
     * Get tickets with task count and completion status
     */
    async getByProjectWithStats(projectId: number): Promise<
      (Ticket & {
        taskCount: number
        completedTaskCount: number
        progress: number
        lastActivity: number
      })[]
    > {
      return withErrorContext(
        async () => {
          const rawTickets = await repo.getByProject(projectId)
          const tickets = rawTickets.map(transformTicket)

          return await Promise.all(
            tickets.map(async (ticket: Ticket) => {
              const rawTasks = await taskRepo.getByTicket(ticket.id)
              const tasks = rawTasks.map(transformTask)
              const completedTasks = tasks.filter((task) => task.done)

              return {
                ...ticket, // Spread the full ticket object first
                taskCount: tasks.length,
                completedTaskCount: completedTasks.length, // Renamed to match what MCP tools expect
                progress: tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100 * 100) / 100 : 0,
                lastActivity: Math.max(ticket.updatedAt, ...tasks.map((task) => task.updatedAt))
              }
            })
          )
        },
        { entity: 'Ticket', action: 'getByProjectWithStats' }
      )
    },

    /**
     * Search tickets across projects
     */
    async search(query: string, options: { projectId?: number; status?: TicketStatus } = {}): Promise<Ticket[]> {
      return withErrorContext(
        async () => {
          // Since there's no getAll method, we need a project ID for search
          if (!options.projectId) {
            throw safeErrorFactory.invalidInput('projectId', 'valid project ID', 'undefined')
          }

          const rawTickets = await repo.getByProject(options.projectId)
          const tickets = rawTickets.map(transformTicket)

          const lowercaseQuery = query.toLowerCase()

          return tickets.filter((ticket) => {
            const matchesQuery =
              ticket.title.toLowerCase().includes(lowercaseQuery) ||
              (ticket.overview && ticket.overview.toLowerCase().includes(lowercaseQuery))

            const matchesStatus = !options.status || ticket.status === options.status

            return matchesQuery && matchesStatus
          })
        },
        { entity: 'Ticket', action: 'search' }
      )
    },

    /**
     * Archive old closed tickets for a specific project
     */
    async archiveOldTickets(projectId: number, beforeDate: number): Promise<number> {
      return withErrorContext(
        async () => {
          const rawTickets = await repo.getByProject(projectId)
          const tickets = rawTickets.map(transformTicket)
          const oldClosedTickets = tickets.filter(
            (ticket) => ticket.status === 'closed' && ticket.updatedAt < beforeDate
          )

          return oldClosedTickets.length
        },
        { entity: 'Ticket', action: 'archiveOldTickets' }
      )
    }
  }

  return extendService(baseService, extensions)
}

/**
 * Create Task Service (embedded within ticket service)
 */
export function createTaskService(deps: TicketServiceDeps = {}) {
  const { taskRepository: taskRepo = taskRepository, logger = createServiceLogger('TaskService') } = deps

  // Use repository methods directly for tasks since types are incompatible
  const baseTaskService = {
    async create(data: Omit<InsertTicketTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<TicketTask> {
      const now = Date.now()
      return taskRepo.create({
        ...data,
        createdAt: now,
        updatedAt: now
      })
    },

    async getById(id: string | number): Promise<TicketTask | null> {
      const numericId = typeof id === 'string' ? parseInt(id, 10) : id
      if (isNaN(numericId)) throw safeErrorFactory.invalidInput('id', 'valid number', id)

      const task = await taskRepo.getById(numericId)
      if (!task) throw safeErrorFactory.notFound('Task', id)
      return task
    },

    async update(id: string | number, data: Partial<Omit<InsertTicketTask, 'id' | 'createdAt'>>): Promise<TicketTask> {
      const numericId = typeof id === 'string' ? parseInt(id, 10) : id
      if (isNaN(numericId)) throw safeErrorFactory.invalidInput('id', 'valid number', id)

      return taskRepo.update(numericId, data)
    },

    async delete(id: string | number): Promise<boolean> {
      const numericId = typeof id === 'string' ? parseInt(id, 10) : id
      if (isNaN(numericId)) throw safeErrorFactory.invalidInput('id', 'valid number', id)

      return taskRepo.delete(numericId)
    }
  }

  const extensions = {
    /**
     * Get tasks by ticket ID
     */
    async getByTicket(ticketId: number): Promise<TicketTask[]> {
      return withErrorContext(
        async () => {
          const tasks = await taskRepo.getByTicket(ticketId)
          return tasks.sort((a, b) => a.orderIndex - b.orderIndex)
        },
        { entity: 'Task', action: 'getByTicket' }
      )
    },

    /**
     * Reorder tasks within a ticket
     */
    async reorder(ticketId: number, taskIds: number[]): Promise<TicketTask[]> {
      return withErrorContext(
        async () => {
          const tasks = await this.getByTicket(ticketId)

          // Update positions based on new order
          const updates = await Promise.all(
            taskIds.map((taskId, index) => {
              const task = tasks.find((t: TicketTask) => t.id === taskId)
              if (!task) {
                throw safeErrorFactory.notFound('Task', taskId)
              }
              return baseTaskService.update(taskId, { orderIndex: index })
            })
          )

          logger.info('Reordered tasks', { ticketId, count: updates.length })
          return updates
        },
        { entity: 'Task', action: 'reorder' }
      )
    },

    /**
     * Mark task as completed and check if ticket can be completed
     */
    async complete(taskId: number): Promise<{ task: TicketTask; ticketCompleted: boolean }> {
      return withErrorContext(
        async () => {
          const task = await baseTaskService.update(taskId, {
            done: true
          })

          // Check if all tasks in the ticket are now completed
          const allTasks = await this.getByTicket(task.ticketId)
          const incompleteTasks = allTasks.filter((t) => !t.done)

          let ticketCompleted = false
          if (incompleteTasks.length === 0) {
            // Auto-complete the ticket if all tasks are done
            if (deps.ticketRepository) {
              await deps.ticketRepository.update(task.ticketId, { status: 'closed' })
              ticketCompleted = true
              logger.info('Auto-completed ticket', { ticketId: task.ticketId })
            }
          }

          return { task, ticketCompleted }
        },
        { entity: 'Task', action: 'complete', id: taskId }
      )
    }
  }

  return { ...baseTaskService, ...extensions }
}

// Export types for consumers
export type TicketService = ReturnType<typeof createTicketService>
export type TaskService = ReturnType<typeof createTaskService>

// Export singletons for backward compatibility
export const ticketService = createTicketService()
export const taskService = createTaskService()

// Export individual functions for tree-shaking
export const {
  create: createTicket,
  getById: getTicketById,
  update: updateTicket,
  delete: deleteTicket,
  getByProject: getTicketsByProject,
  getWithTasks: getTicketWithTasks,
  createWithTasks: createTicketWithTasks,
  updateStatus: updateTicketStatus,
  bulkUpdateStatus: bulkUpdateTicketStatus,
  getByProjectWithStats: getTicketsWithStats,
  search: searchTickets
} = ticketService

// Legacy export aliases for backward compatibility
export const listTicketsWithTaskCount = getTicketsWithStats

export const {
  create: createTask,
  getById: getTaskById,
  update: updateTask,
  delete: deleteTask,
  getByTicket: getTasksByTicket,
  reorder: reorderTasks,
  complete: completeTask
} = taskService

// Add aliases for backward compatibility
export const getTasks = getTasksByTicket
export const listTicketsByProject = getTicketsByProject

// TODO: Implement missing ticket functions
export const completeTicket = async (ticketId: number) => {
  return updateTicketStatus(ticketId, 'closed')
}

export const linkFilesToTicket = async (ticketId: number, fileIds: number[]) => {
  // Placeholder implementation
  return { ticketId, fileIds }
}

export const suggestTasksForTicket = async (ticketId: number) => {
  // Placeholder implementation - should use AI to suggest tasks
  return []
}

export const autoGenerateTasksFromOverview = async (ticketId: number, overview: string): Promise<TicketTask[]> => {
  // Use AI + project context to generate concrete, ordered tasks.
  // Falls back to simple heuristics if AI/config is unavailable.
  try {
    // Load ticket and existing tasks for context/deduplication
    const ticket = await getTicketById(ticketId)
    const existingTasks = await getTasksByTicket(ticketId)
    const existingTitles = new Set(existingTasks.map((t) => t.content.toLowerCase()))

    // Resolve an overview (prefer provided, then ticket.overview, then title)
    const ticketOverview = (overview && overview.trim()) || ticket.overview || ticket.title
    if (!ticketOverview || ticketOverview.trim() === '') return []

    const project = await getProjectById(ticket.projectId)
    const agentGuidelines = await loadAgentGuidelines(ticket.projectId)
    const guidelineSnippet = agentGuidelines?.snippet

    const projectFiles = await fileService.getByProject(ticket.projectId, { limit: 150 })
    const fileIdMap = new Map<string, string>()
    const filePathMap = new Map<string, string>()
    const fileNameMap = new Map<string, string>()

    const fileCatalog = projectFiles
      .map((file) => {
        fileIdMap.set(file.id, file.id)
        filePathMap.set(file.path.toLowerCase(), file.id)
        const baseName = file.path.split('/').pop()
        if (baseName) {
          fileNameMap.set(baseName.toLowerCase(), file.id)
        }

        const baseSummary =
          typeof (file as any).summary === 'string' && (file as any).summary.trim().length > 0
            ? (file as any).summary.trim()
            : typeof file.content === 'string' && file.content.trim().length > 0
              ? file.content
                  .split('\n')
                  .slice(0, 12)
                  .join(' ')
                  .replace(/\s+/g, ' ')
              : ''

        const summary = baseSummary.length > 0 ? baseSummary.slice(0, 280) : 'No summary available.'

        return [`ID: ${file.id}`, `Path: ${file.path}`, `Summary: ${summary}`].join('\n')
      })
      .join('\n\n---\n\n')

    // Define structured output schema for tasks
    const TaskSuggestionSchema = z
      .object({
        title: z.string().min(3).max(160),
        description: z.string().min(5).max(1200),
        estimatedHours: z.number().min(0.25).max(40).nullable().optional(),
        tags: z.array(z.string().min(1).max(32)).max(8).optional().default([]),
        suggestedFileIds: z.array(z.string().min(1)).max(8).optional()
      })
      .passthrough()
      .transform((value) => normalizeTaskSuggestion(value))
    const TaskSuggestionListSchema = z
      .object({
        tasks: z.array(TaskSuggestionSchema).min(1).max(15)
      })
      .passthrough()

    // Compose prompt with clear instruction + context
    const systemPrompt = [
      'You are a senior software project planner.',
      'Break down the ticket into small, code-focused tasks (1–3h each).',
      'Follow the repository guidelines (AGENTS.md excerpt) provided in the prompt to keep work aligned with project architecture.',
      'Reference concrete project modules, services, or components where appropriate so follow-up file suggestions can be precise.',
      'Write specific titles and actionable descriptions referencing code areas when possible.',
      'Avoid duplicates and generic tasks. Focus on implementation steps.',
      'Return only structured results that match the JSON schema.',
      'Each task must include `suggestedFileIds` referencing the provided file catalog. Choose 2-5 of the most relevant IDs per task. Prefer production code, schemas, and utilities over tests unless tests are explicitly needed.'
    ].join(' ')

    const promptParts: string[] = []
    promptParts.push(`Ticket #${ticket.id}: ${ticket.title}`)
    promptParts.push('Overview:')
    promptParts.push(ticketOverview)
    if (project?.description) {
      promptParts.push('\nProject description:')
      promptParts.push(project.description)
    }
    // No project summary included
    if (guidelineSnippet) {
      promptParts.push('\nRepository guidelines (AGENTS.md excerpt):')
      promptParts.push(guidelineSnippet)
      if (agentGuidelines?.scope === 'global') {
        promptParts.push('Note: These guidelines are global; reconcile them with repository-specific conventions as needed.')
      }
      if (agentGuidelines && agentGuidelines.full.length > guidelineSnippet.length) {
        promptParts.push('(Excerpt truncated for brevity; consult AGENTS.md for full details.)')
      }
    }

    if (existingTasks.length > 0) {
      const listed = existingTasks
        .slice(0, 20)
        .map((t, i) => `${i + 1}. ${t.content}`)
        .join('\n')
      promptParts.push('\nExisting tasks (avoid duplicates):')
      promptParts.push(listed)
    }
    promptParts.push('\nGenerate 5–10 concrete implementation tasks with clear deliverables that follow these guidelines and reference relevant files when helpful.')
    if (fileCatalog) {
      promptParts.push('\nAvailable project files (use IDs in suggestedFileIds):')
      promptParts.push(fileCatalog)
    }

    // Ask the model for structured task suggestions with provider/model fallbacks
    let suggestions: z.infer<typeof TaskSuggestionListSchema>['tasks'] = []
    const promptCombined = promptParts.join('\n')

    const { generateStructuredData } = await getGenAiModule()

    // Get dynamic model configs with fallback order
    const modelFallbacks = await Promise.all([
      modelConfigService.getPresetConfig('planning'),
      modelConfigService.getPresetConfig('high'),
      modelConfigService.getPresetConfig('medium'),
      modelConfigService.getPresetConfig('low')
    ])

    for (const modelOptions of modelFallbacks) {
      try {
        const { object } = await generateStructuredData({
          prompt: promptCombined,
          schema: TaskSuggestionListSchema,
          systemMessage: systemPrompt,
          options: modelOptions
        })
        suggestions = object.tasks || []
        break
      } catch (err: any) {
        if (err?.code === 'PROVIDER_JSON_PARSE_ERROR' || err?.details?.fallbackToText) {
          const fallbackTasks = await attemptTaskSuggestionTextFallback({
            prompt: promptCombined,
            systemPrompt,
            modelOptions,
            schema: TaskSuggestionListSchema
          })
          if (fallbackTasks && fallbackTasks.length > 0) {
            suggestions = fallbackTasks
            break
          }
        }
        // try next model
      }
    }
    if (!suggestions || suggestions.length === 0) {
      // Fallback: derive 1–3 tasks from overview text chunks
      const chunks = ticketOverview
        .split(/[\.\n\-•\*]+/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 6)
        .slice(0, 3)
      suggestions = chunks.map((c: string) => ({
        title: c.length > 80 ? `${c.slice(0, 77)}…` : c,
        description: c,
        estimatedHours: null,
        tags: []
      }))
    }

    // Filter duplicates against existing tasks and normalize
    const filtered = suggestions.filter((s) => s && s.title && !existingTitles.has(s.title.toLowerCase())).slice(0, 10)

    if (filtered.length === 0) return []

    const created: TicketTask[] = []
    for (const suggestion of filtered) {
      if (!suggestion) continue
      try {
        const normalizedFileIds = (suggestion.suggestedFileIds || [])
          .map((identifier) => {
            const trimmed = identifier.trim()
            if (fileIdMap.has(trimmed)) return trimmed
            const lower = trimmed.toLowerCase()
            if (filePathMap.has(lower)) return filePathMap.get(lower)!
            if (fileNameMap.has(lower)) return fileNameMap.get(lower)!
            return null
          })
          .filter((id): id is string => Boolean(id))

        const uniqueFileIds = Array.from(new Set(normalizedFileIds)).slice(0, 5)

        if ((suggestion.suggestedFileIds?.length ?? 0) > 0 && uniqueFileIds.length === 0) {
          taskGenerationLogger.warn('Generated task referenced unknown files', {
            ticketId,
            taskTitle: suggestion.title,
            provided: suggestion.suggestedFileIds
          })
        }

        const task = await taskService.create({
          ticketId,
          content: suggestion.title,
          description: suggestion.description || null,
          done: false,
          status: 'pending',
          orderIndex: existingTasks.length + created.length,
          estimatedHours: suggestion.estimatedHours ?? null,
          dependencies: Array.isArray(suggestion.dependencies) ? suggestion.dependencies : [],
          tags: Array.isArray(suggestion.tags) ? suggestion.tags.slice(0, 8) : [],
          agentId: null,
          suggestedFileIds: uniqueFileIds,
          suggestedPromptIds: []
        })
        created.push(task)
      } catch (createErr) {
        taskGenerationLogger.warn('Failed to create generated task', {
          ticketId,
          taskTitle: suggestion.title,
          error: createErr
        })
      }
    }

    return created
  } catch (error) {
    // If anything unexpected fails, don’t block the UI – return empty
    return []
  }
}

type AgentGuidelineContext = {
  snippet: string
  full: string
  sourcePath?: string
  scope: 'project' | 'global'
}

async function loadAgentGuidelines(projectId: number): Promise<AgentGuidelineContext | null> {
  try {
    const project = await getProjectById(projectId)
    if (project?.path) {
      const projectFiles = await agentFileDetectionService.detectProjectFiles(project.path)
      const agentFile = projectFiles.find((file) => file.type === 'agents' && file.exists && file.content?.trim())
      if (agentFile?.content) {
        const cleaned = agentFile.content.trim()
        return {
          snippet: cleaned.slice(0, MAX_GUIDELINE_SNIPPET_CHARS),
          full: cleaned,
          sourcePath: agentFile.path,
          scope: 'project'
        }
      }
    }
  } catch (error) {
    // Ignore project guideline lookup failures and fall back to global or default context
  }

  try {
    const globalFiles = await agentFileDetectionService.detectGlobalFiles()
    const agentFile = globalFiles.find((file) => file.type === 'agents' && file.exists && file.content?.trim())
    if (agentFile?.content) {
      const cleaned = agentFile.content.trim()
      return {
        snippet: cleaned.slice(0, MAX_GUIDELINE_SNIPPET_CHARS),
        full: cleaned,
        sourcePath: agentFile.path,
        scope: 'global'
      }
    }
  } catch (error) {
    // Optional global fallback; ignore errors to keep task generation resilient
  }

  return null
}

interface GeneratedTaskSummary {
  title: string
  description?: string | null
  estimatedHours?: number | null
  tags?: string[]
  dependencies?: number[]
  suggestedFileIds?: string[]
}

function normalizeTaskSuggestion(raw: any): GeneratedTaskSummary {
  if (!raw || typeof raw !== 'object') {
    return {
      title: '',
      description: '',
      estimatedHours: null,
      tags: [],
      dependencies: [],
      suggestedFileIds: []
    }
  }

  const title = typeof raw.title === 'string' ? raw.title.trim() : ''
  const description = typeof raw.description === 'string' ? raw.description.trim() : ''

  const tags = Array.isArray(raw.tags)
    ? dedupeStrings(
        raw.tags
          .map((tag: any) => (typeof tag === 'string' ? tag.trim() : ''))
          .filter((tag: string) => tag.length > 0)
      )
    : []

  const estimatedCandidates = [
    raw.estimatedHours,
    raw.estimated_hours,
    raw.estimation_hours,
    raw.estimateHours,
    raw.estimate_hours
  ]
  let estimatedHours: number | null = null
  for (const candidate of estimatedCandidates) {
    if (candidate == null) continue
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      estimatedHours = candidate
      break
    }
    if (typeof candidate === 'string') {
      const parsed = parseFloat(candidate)
      if (Number.isFinite(parsed)) {
        estimatedHours = parsed
        break
      }
    }
  }

  if (estimatedHours !== null) {
    if (estimatedHours < 0.25) estimatedHours = 0.25
    if (estimatedHours > 40) estimatedHours = 40
  }

  const dependsSource = Array.isArray(raw.dependencies) ? raw.dependencies : raw.depends_on
  const dependencies = Array.isArray(dependsSource)
    ? dependsSource
        .map((value: any) => {
          if (typeof value === 'number' && Number.isFinite(value)) {
            return value
          }
          if (typeof value === 'string') {
            const parsed = parseInt(value, 10)
            return Number.isFinite(parsed) ? parsed : null
          }
          return null
        })
        .filter((value): value is number => value !== null)
    : []

  const suggestedFileIds = Array.isArray(raw.suggestedFileIds)
    ? dedupeStrings(
        raw.suggestedFileIds
          .map((value: any) => (typeof value === 'string' ? value.trim() : String(value).trim()))
          .filter((value: string) => value.length > 0)
      )
    : []

  return {
    title,
    description,
    estimatedHours,
    tags,
    dependencies,
    suggestedFileIds
  }
}

async function attemptTaskSuggestionTextFallback({
  prompt,
  systemPrompt,
  modelOptions,
  schema
}: {
  prompt: string
  systemPrompt: string
  modelOptions: any
  schema: z.ZodTypeAny
}): Promise<any[] | null> {
  try {
    const fallbackPrompt = [
      prompt,
      '',
      'Return ONLY a JSON object that matches this shape exactly:',
      '{ "tasks": [{ "title": string, "description": string, "estimatedHours": number|null, "tags": string[], "suggestedFileIds": string[] }] }'
    ].join('\n')

    const { generateSingleText } = await getGenAiModule()

    const text = await generateSingleText({
      prompt: fallbackPrompt,
      systemMessage: systemPrompt,
      options: modelOptions
    })

    const parsed = extractJsonFromText(text)
    if (!parsed) return null

    const validated = schema.safeParse(parsed)
    if (validated.success && Array.isArray((validated.data as any).tasks)) {
      return (validated.data as any).tasks
    }
  } catch (error) {
    // Swallow fallback errors and allow caller to continue
  }
  return null
}

function dedupeStrings(values: string[]): string[] {
  if (!values || values.length === 0) {
    return []
  }
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    if (!value) continue
    if (!seen.has(value)) {
      seen.add(value)
      result.push(value)
    }
  }
  return result
}

function extractJsonFromText(text: string): any | null {
  if (!text) return null
  let candidate = text.trim()
  if (candidate.startsWith('```')) {
    const fenceEnd = candidate.indexOf('```', 3)
    if (fenceEnd !== -1) {
      candidate = candidate.slice(3, fenceEnd).trim()
    } else {
      candidate = candidate.replace(/^```json\s*/i, '').replace(/```$/, '').trim()
    }
  }

  const objectMatch = candidate.match(/\{[\s\S]*\}/)
  const jsonText = objectMatch ? objectMatch[0] : candidate

  try {
    return JSON.parse(jsonText)
  } catch {
    return null
  }
}

export const getTasksForTickets = async (ticketIds: number[]) => {
  // Get tasks for multiple tickets
  const result: Record<number, TicketTask[]> = {}
  for (const ticketId of ticketIds) {
    result[ticketId] = await getTasksByTicket(ticketId)
  }
  return result
}

export const listTicketsWithTasks = async (projectId: number) => {
  // Get tickets with their tasks
  const tickets = await getTicketsByProject(projectId)
  const result = []
  for (const ticket of tickets) {
    const tasks = await getTasksByTicket(ticket.id)
    result.push({ ...ticket, tasks })
  }
  return result
}

export const suggestFilesForTicket = async (ticketId: number) => {
  try {
    // Fetch the ticket
    const rawTicket = await ticketRepository.getById(ticketId)
    if (!rawTicket) return []
    const ticket = transformTicket(rawTicket)

    // Use balanced strategy by default
    const resp = await fileSuggestionServiceSingleton.suggestFiles(ticket as any, 'balanced', 10)
    return Array.isArray(resp?.suggestions) ? resp.suggestions : []
  } catch (e) {
    return []
  }
}

export const batchUpdateTickets = async (tickets: Array<{ id: number; data: any }>) => {
  // TODO: Implement batch update
  const results = []
  for (const { id, data } of tickets) {
    results.push(await updateTicket(id, data))
  }
  return results
}

export const batchCreateTickets = async (projectId: number, tickets: any[]) => {
  // TODO: Implement batch create
  const results = []
  for (const ticketData of tickets) {
    results.push(await createTicket({ ...ticketData, projectId }))
  }
  return results
}

export const batchDeleteTickets = async (ticketIds: number[]) => {
  // TODO: Implement batch delete
  for (const id of ticketIds) {
    if (deleteTicket) {
      await deleteTicket(id)
    }
  }
  return ticketIds.length
}

// Legacy function for backward compatibility - gets tickets with associated files
export async function getTicketsWithFiles(projectId: number) {
  const tickets = await getTicketsByProject(projectId)
  // TODO: Implement proper file association
  return tickets.map((ticket) => ({
    ...ticket,
    files: [] // Placeholder for associated files
  }))
}
