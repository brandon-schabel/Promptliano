/**
 * API Test Helpers
 * 
 * Utilities for creating and managing test data through the actual API
 * instead of using mocks.
 */

import { APIRequestContext } from '@playwright/test'

const API_BASE_URL = process.env.API_URL || 'http://localhost:53147/api'

export class ApiTestHelpers {
  constructor(private request: APIRequestContext) {}

  /**
   * Create a test project with all necessary data
   */
  async createTestProject(options: {
    name?: string
    path?: string
    description?: string
  } = {}) {
    const timestamp = Date.now()
    const projectData = {
      name: options.name || `Test Project ${timestamp}`,
      path: options.path || `/tmp/test-project-${timestamp}`,
      description: options.description || 'Automated test project'
    }

    const response = await this.request.post(`${API_BASE_URL}/projects`, {
      data: projectData
    })

    if (!response.ok()) {
      throw new Error(`Failed to create project: ${response.status()} ${response.statusText()}`)
    }

    const result = await response.json()
    return result.data
  }

  /**
   * Create queues for a project
   */
  async createQueues(projectId: number, queues: Array<{
    name: string
    description?: string
    maxParallelItems?: number
  }>) {
    const createdQueues = []
    
    for (const queue of queues) {
      const response = await this.request.post(`${API_BASE_URL}/queues`, {
        data: {
          name: queue.name,
          description: queue.description || `Queue for ${queue.name}`,
          maxParallelItems: queue.maxParallelItems || 3,
          projectId
        }
      })

      if (response.ok()) {
        const result = await response.json()
        createdQueues.push(result.data)
      }
    }

    return createdQueues
  }

  /**
   * Create tickets for a project
   */
  async createTickets(projectId: number, tickets: Array<{
    title: string
    overview?: string
    priority?: 'low' | 'normal' | 'high'
    status?: 'open' | 'in_progress' | 'closed'
    queueId?: number
  }>) {
    const createdTickets = []
    
    for (const ticket of tickets) {
      const response = await this.request.post(`${API_BASE_URL}/tickets`, {
        data: {
          title: ticket.title,
          overview: ticket.overview || 'Test ticket',
          priority: ticket.priority || 'normal',
          status: ticket.status || 'open',
          projectId,
          queueId: ticket.queueId || null
        }
      })

      if (response.ok()) {
        const result = await response.json()
        createdTickets.push(result.data)
      }
    }

    return createdTickets
  }

  /**
   * Create tasks for a ticket
   */
  async createTasks(ticketId: number, tasks: Array<{
    content: string
    description?: string
    done?: boolean
  }>) {
    const createdTasks = []
    
    for (const task of tasks) {
      const response = await this.request.post(`${API_BASE_URL}/tickets/${ticketId}/tasks`, {
        data: {
          content: task.content,
          description: task.description || '',
          done: task.done || false,
          ticketId
        }
      })

      if (response.ok()) {
        const result = await response.json()
        createdTasks.push(result.data)
      }
    }

    return createdTasks
  }

  /**
   * Create prompts for a project
   */
  async createPrompts(projectId: number, prompts: Array<{
    title: string
    content: string
    category?: string
  }>) {
    const createdPrompts = []
    
    for (const prompt of prompts) {
      const response = await this.request.post(`${API_BASE_URL}/prompts`, {
        data: {
          title: prompt.title,
          content: prompt.content,
          projectId
        }
      })

      if (response.ok()) {
        const result = await response.json()
        createdPrompts.push(result.data)
      }
    }

    return createdPrompts
  }

  /**
   * Create files for a project
   */
  async createFiles(projectId: number, files: Array<{
    path: string
    content?: string
    isRelevant?: boolean
  }>) {
    const createdFiles = []
    
    for (const file of files) {
      const response = await this.request.post(`${API_BASE_URL}/files`, {
        data: {
          path: file.path,
          content: file.content || '',
          isRelevant: file.isRelevant !== false,
          projectId
        }
      })

      if (response.ok()) {
        const result = await response.json()
        createdFiles.push(result.data)
      }
    }

    return createdFiles
  }

  /**
   * Delete a project and all its data
   */
  async deleteProject(projectId: number) {
    const response = await this.request.delete(`${API_BASE_URL}/projects/${projectId}`)
    return response.ok()
  }

  /**
   * Create a complete test scenario with project, queues, tickets, and tasks
   */
  async createCompleteTestScenario(options: {
    projectName?: string
    queues?: Array<{ name: string; description?: string }>
    ticketsPerQueue?: number
    tasksPerTicket?: number
    unqueuedTickets?: number
  } = {}) {
    // Create project
    const project = await this.createTestProject({
      name: options.projectName
    })

    // Default queues if not provided
    const queueDefinitions = options.queues || [
      { name: 'Features', description: 'New feature development' },
      { name: 'Bugs', description: 'Bug fixes and issues' },
      { name: 'Improvements', description: 'Code improvements and refactoring' }
    ]

    // Create queues
    const queues = await this.createQueues(project.id, queueDefinitions)

    // Create tickets for each queue
    const tickets = []
    const ticketsPerQueue = options.ticketsPerQueue || 2
    
    for (const queue of queues) {
      for (let i = 0; i < ticketsPerQueue; i++) {
        const ticket = await this.createTickets(project.id, [{
          title: `${queue.name} Ticket ${i + 1}`,
          overview: `Test ticket for ${queue.name} queue`,
          priority: ['low', 'normal', 'high'][i % 3] as any,
          queueId: queue.id
        }])
        tickets.push(...ticket)
      }
    }

    // Create unqueued tickets
    const unqueuedCount = options.unqueuedTickets || 2
    for (let i = 0; i < unqueuedCount; i++) {
      const ticket = await this.createTickets(project.id, [{
        title: `Unqueued Ticket ${i + 1}`,
        overview: 'Ticket waiting for queue assignment',
        priority: 'normal'
      }])
      tickets.push(...ticket)
    }

    // Create tasks for each ticket
    const tasksPerTicket = options.tasksPerTicket || 3
    for (const ticket of tickets) {
      const tasks = []
      for (let i = 0; i < tasksPerTicket; i++) {
        tasks.push({
          content: `Task ${i + 1} for ${ticket.title}`,
          description: `Description for task ${i + 1}`,
          done: i === 0 // Mark first task as done
        })
      }
      await this.createTasks(ticket.id, tasks)
    }

    return {
      project,
      queues,
      tickets
    }
  }
}

/**
 * Create an API test helper instance
 */
export function createApiTestHelper(request: APIRequestContext) {
  return new ApiTestHelpers(request)
}