import {
  TypeSafeApiClient,
  type GetProjectResponse,
  type GetProjectsResponse,
  type GetProjectsByIdPromptsResponse
} from '@promptliano/api-client'
import type { Project, Ticket, TicketTask, Queue, Prompt } from '@promptliano/schemas'
import type { FlowExtensionConfig } from '../config'
import { ExtensionLogger } from '../logger'
import type { FlowDataResponse, FlowProjectSnapshot, FlowQueueSnapshot, FlowTicketSnapshot, ProjectFlowResult } from './models'

const MAX_PROJECT_CONCURRENCY = 4
const SORT_FALLBACK = Number.MAX_SAFE_INTEGER

export class FlowClient {
  private client: TypeSafeApiClient
  private config: FlowExtensionConfig

  constructor(initialConfig: FlowExtensionConfig, private readonly logger: ExtensionLogger) {
    this.config = initialConfig
    this.client = this.createClient(initialConfig)
  }

  updateConfig(config: FlowExtensionConfig) {
    this.config = config
    this.client = this.createClient(config)
  }

  async fetchProjectSnapshots(): Promise<ProjectFlowResult[]> {
    try {
      const projects = await this.loadProjects()
      if (projects.length === 0) {
        return []
      }

      const desiredIds = new Set(this.config.projectIds)
      const projectsToLoad: Project[] = desiredIds.size > 0 ? projects.filter((project) => desiredIds.has(project.id)) : projects
      const missingResults: ProjectFlowResult[] = []

      if (desiredIds.size > 0) {
        const discoveredIds = new Set(projectsToLoad.map((project) => project.id))
        const missing = [...desiredIds].filter((id) => !discoveredIds.has(id))
        for (const projectId of missing) {
          const project = await this.loadSingleProject(projectId)
          if (project) {
            projectsToLoad.push(project)
          } else {
            missingResults.push({
              kind: 'error',
              project: {
                id: projectId,
                name: `Project ${projectId}`,
                description: null,
                path: '',
                createdAt: Date.now(),
                updatedAt: Date.now()
              } as Project,
              message: 'Project not found or inaccessible'
            })
          }
        }
      }

      const sortedProjects = this.sortProjects(projectsToLoad)
      if (sortedProjects.length === 0) {
        return missingResults
      }

      const resultsByIndex: ProjectFlowResult[] = new Array(sortedProjects.length)
      let nextIndex = 0

      const worker = async (): Promise<void> => {
        while (true) {
          const index = nextIndex
          if (index >= sortedProjects.length) {
            return
          }
          nextIndex += 1
          const project = sortedProjects[index]
          resultsByIndex[index] = await this.fetchSnapshotForProject(project)
        }
      }

      const workerCount = Math.min(MAX_PROJECT_CONCURRENCY, sortedProjects.length)
      await Promise.all(Array.from({ length: workerCount }, () => worker()))

      const orderedResults = resultsByIndex.filter((result): result is ProjectFlowResult => result !== undefined)
      return [...missingResults, ...orderedResults]
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected failure loading projects'
      this.logger.error('Unable to load Promptliano projects', error)
      throw new Error(message)
    }
  }

  async markTicketComplete(ticketId: number): Promise<void> {
    if (!Number.isFinite(ticketId)) {
      throw new Error('Invalid ticket identifier')
    }

    try {
      await this.client.createTicketsByTicketIdComplete(ticketId)
      this.logger.info(`Marked ticket ${ticketId} as complete`)
    } catch (error) {
      this.logger.error(`Failed to complete ticket ${ticketId}`, error)
      throw error instanceof Error ? error : new Error('Unable to complete ticket')
    }
  }

  async markTaskComplete(ticketId: number, taskId: number): Promise<void> {
    if (!Number.isFinite(ticketId) || !Number.isFinite(taskId)) {
      throw new Error('Invalid identifiers for ticket or task')
    }

    try {
      await this.client.updateTicketsByTicketIdTasksByTaskId(ticketId, taskId, {
        done: true
      })
      this.logger.info(`Marked task ${taskId} on ticket ${ticketId} as complete`)
    } catch (error) {
      this.logger.error(`Failed to complete task ${taskId} on ticket ${ticketId}`, error)
      throw error instanceof Error ? error : new Error('Unable to complete task')
    }
  }

  private createClient(config: FlowExtensionConfig): TypeSafeApiClient {
    const headers = config.apiToken ? { Authorization: `Bearer ${config.apiToken}` } : undefined
    return new TypeSafeApiClient({ baseUrl: config.apiBaseUrl, headers })
  }

  private async loadProjects(): Promise<Project[]> {
    const response = await this.client.getProjects()
    return this.unwrapListResponse<Project>(response)
  }

  private async loadSingleProject(projectId: number): Promise<Project | null> {
    try {
      const response: GetProjectResponse = await this.client.getProject(projectId)
      const project = this.unwrapSingleResponse<Project>(response)
      return project ?? null
    } catch (error) {
      this.logger.warn(`Failed to resolve project ${projectId}: ${error instanceof Error ? error.message : String(error)}`)
      return null
    }
  }

  private sortProjects(projects: Project[]): Project[] {
    return [...projects].sort((a, b) => a.name.localeCompare(b.name))
  }

  private async loadProjectPrompts(projectId: number): Promise<Prompt[]> {
    try {
      const response: GetProjectsByIdPromptsResponse = await this.client.getProjectsByIdPrompts(projectId)
      const data = (response as any)?.data
      if (Array.isArray(data)) {
        return data as Prompt[]
      }
      this.logger.warn(`Unexpected prompt response shape for project ${projectId}`)
    } catch (error) {
      this.logger.error(`Failed to load prompts for project ${projectId}`, error)
    }
    return []
  }

  private unwrapListResponse<T>(response: GetProjectsResponse | unknown): T[] {
    if (response && typeof response === 'object') {
      const data = (response as any).data
      if (Array.isArray(data)) {
        return data as T[]
      }
    }
    this.logger.warn('Unexpected list response shape encountered while loading projects')
    return []
  }

  private unwrapSingleResponse<T>(response: GetProjectResponse | unknown): T | null {
    if (response && typeof response === 'object') {
      if ((response as any).data) {
        return (response as any).data as T
      }
    }
    return null
  }

  private async fetchSnapshotForProject(project: Project): Promise<ProjectFlowResult> {
    try {
      const [flow, prompts] = await Promise.all([
        this.client.getProjectsByIdFlow(project.id),
        this.loadProjectPrompts(project.id)
      ])
      const snapshot = this.buildSnapshot(project, flow, prompts)
      return { kind: 'success', snapshot }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load flow data'
      this.logger.error(`Flow request failed for project ${project.id}`, error)
      return { kind: 'error', project, message }
    }
  }

  private buildSnapshot(project: Project, flow: FlowDataResponse, prompts: Prompt[]): FlowProjectSnapshot {
    const includeCompleted = this.config.showCompleted
    const ticketMap = new Map<number, FlowTicketSnapshot>()

    const normalizeTask = (task: TicketTask): TicketTask => {
      if (task.done && task.status !== 'completed') {
        return { ...task, status: 'completed' }
      }
      if (!task.done && task.status === 'completed') {
        return { ...task, done: true }
      }
      return task
    }

    const asSortableNumber = (value: number | null | undefined, fallback = SORT_FALLBACK): number => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value
      }
      return fallback
    }

    const addTicket = (ticket: Ticket | null | undefined) => {
      if (!ticket) return
      if (!includeCompleted && ticket.status === 'closed') return
      const existing = ticketMap.get(ticket.id)
      if (existing) {
        existing.ticket = { ...existing.ticket, ...ticket }
        return
      }
      ticketMap.set(ticket.id, { ticket, tasks: [] })
    }

    const addTask = (task: TicketTask | null | undefined) => {
      if (!task) return
      const normalized = normalizeTask(task)
      if (!includeCompleted && (normalized.status === 'completed' || normalized.status === 'cancelled')) return
      const parent = ticketMap.get(normalized.ticketId)
      if (parent && !parent.tasks.some((existing) => existing.id === normalized.id)) {
        parent.tasks.push(normalized)
      }
    }

    const queues: FlowQueueSnapshot[] = []

    const flowQueues = this.extractQueueEntries(flow)
    for (const entry of flowQueues) {
      if (entry.queue && entry.queue.isActive === false) {
        continue
      }

      const filteredTickets = entry.tickets.filter((ticket) => includeCompleted || ticket.status !== 'closed')
      const normalizedTasks = entry.tasks.map(normalizeTask)
      const filteredTasks = normalizedTasks.filter(
        (task) => includeCompleted || (task.status !== 'completed' && task.status !== 'cancelled')
      )

      filteredTickets.forEach(addTicket)
      filteredTasks.forEach(addTask)

      queues.push({
        queue: entry.queue,
        tickets: filteredTickets,
        tasks: filteredTasks
      })
    }

    const unqueuedTickets = this.extractUnqueuedTickets(flow)
    const unqueuedTasks = this.extractUnqueuedTasks(flow).map(normalizeTask)

    unqueuedTickets.forEach(addTicket)
    unqueuedTasks.forEach(addTask)

    const tickets = [...ticketMap.values()].map((snapshot) => ({
      ticket: snapshot.ticket,
      tasks: [...snapshot.tasks].sort((a, b) => asSortableNumber(a.orderIndex) - asSortableNumber(b.orderIndex))
    }))

    tickets.sort((a, b) => b.ticket.updatedAt - a.ticket.updatedAt)

    const sortQueueTickets = (a: Ticket, b: Ticket) => asSortableNumber(a.queuePosition) - asSortableNumber(b.queuePosition)
    const sortQueueTasks = (a: TicketTask, b: TicketTask) => {
      const aValue = asSortableNumber(a.queuePosition, asSortableNumber(a.orderIndex))
      const bValue = asSortableNumber(b.queuePosition, asSortableNumber(b.orderIndex))
      return aValue - bValue
    }

    return {
      project,
      tickets,
      queues: queues.map((entry) => ({
        queue: entry.queue,
        tickets: [...entry.tickets].sort(sortQueueTickets),
        tasks: [...entry.tasks].sort(sortQueueTasks)
      })),
      prompts
    }
  }

  private extractQueueEntries(flow: FlowDataResponse): FlowQueueSnapshot[] {
    const entries: FlowQueueSnapshot[] = []
    const source = (flow as any)?.queues
    if (!source || typeof source !== 'object') {
      return entries
    }

    for (const value of Object.values(source)) {
      if (!value || typeof value !== 'object') continue
      const queue = (value as any).queue as Queue | undefined
      if (!queue) continue
      const tickets = Array.isArray((value as any).tickets) ? ((value as any).tickets as Ticket[]) : []
      const tasks = Array.isArray((value as any).tasks) ? ((value as any).tasks as TicketTask[]) : []
      entries.push({ queue, tickets, tasks })
    }

    return entries
  }

  private extractUnqueuedTickets(flow: FlowDataResponse): Ticket[] {
    const source = (flow as any)?.unqueued
    if (!source || typeof source !== 'object') return []
    const tickets = (source as any).tickets
    return Array.isArray(tickets) ? (tickets as Ticket[]) : []
  }

  private extractUnqueuedTasks(flow: FlowDataResponse): TicketTask[] {
    const source = (flow as any)?.unqueued
    if (!source || typeof source !== 'object') return []
    const tasks = (source as any).tasks
    return Array.isArray(tasks) ? (tasks as TicketTask[]) : []
  }
}
