/**
 * Repository Tests - Validate new Drizzle-based storage system
 * Tests replacement of legacy storage classes with repositories
 */

import { describe, test, expect, beforeEach } from 'bun:test'
import { storageService, TypedStorageService } from '../repositories/storage-service'
import { db, rawDb } from '../db'

describe('Drizzle Repository Migration Tests', () => {
  
  beforeEach(async () => {
    // Clean up test data
    await rawDb.exec('DELETE FROM ticket_tasks')
    await rawDb.exec('DELETE FROM tickets')
    await rawDb.exec('DELETE FROM chat_messages')
    await rawDb.exec('DELETE FROM chats')
    await rawDb.exec('DELETE FROM prompts')
    await rawDb.exec('DELETE FROM queues')
    await rawDb.exec('DELETE FROM projects')
  })

  describe('Project Repository', () => {
    test('should create and retrieve project', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'A test project',
        path: '/test/path'
      }

      const created = await storageService.projects.create(projectData)
      
      expect(created.id).toBeDefined()
      expect(created.name).toBe('Test Project')
      expect(created.path).toBe('/test/path')
      expect(created.createdAt).toBeDefined()
      expect(created.updatedAt).toBeDefined()

      const retrieved = await storageService.projects.getById(created.id)
      expect(retrieved).toEqual(created)
    })

    test('should update project', async () => {
      const project = await storageService.projects.create({
        name: 'Original',
        path: '/original'
      })

      // Add small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 1))

      const updated = await storageService.projects.update(project.id, {
        name: 'Updated Name',
        description: 'New description'
      })

      expect(updated.name).toBe('Updated Name')
      expect(updated.description).toBe('New description')
      expect(updated.path).toBe('/original') // unchanged
      expect(updated.updatedAt).toBeGreaterThan(project.updatedAt)
    })

    test('should delete project', async () => {
      const project = await storageService.projects.create({
        name: 'To Delete',
        path: '/delete/me'
      })

      const deleted = await storageService.projects.delete(project.id)
      expect(deleted).toBe(true)

      const retrieved = await storageService.projects.getById(project.id)
      expect(retrieved).toBe(null)
    })
  })

  describe('Ticket Repository', () => {
    let testProject: any

    beforeEach(async () => {
      testProject = await storageService.projects.create({
        name: 'Ticket Test Project',
        path: '/ticket/test'
      })
    })

    test('should create ticket with queue fields', async () => {
      const ticketData = {
        projectId: testProject.id,
        title: 'Test Ticket',
        overview: 'Test overview',
        status: 'open' as const,
        priority: 'high' as const,
        suggestedFileIds: ['file1.js', 'file2.js'],
        suggestedAgentIds: ['agent1', 'agent2'],
        suggestedPromptIds: [1, 2, 3]
      }

      const ticket = await storageService.tickets.create(ticketData)
      
      expect(ticket.id).toBeDefined()
      expect(ticket.title).toBe('Test Ticket')
      expect(ticket.status).toBe('open')
      expect(ticket.priority).toBe('high')
      expect(ticket.suggestedFileIds).toEqual(['file1.js', 'file2.js'])
      expect(ticket.suggestedAgentIds).toEqual(['agent1', 'agent2'])
      expect(ticket.suggestedPromptIds).toEqual([1, 2, 3])
    })

    test('should get tickets by project', async () => {
      await storageService.tickets.create({
        projectId: testProject.id,
        title: 'Ticket 1'
      })
      await storageService.tickets.create({
        projectId: testProject.id,
        title: 'Ticket 2'
      })

      const tickets = await storageService.tickets.getByProject(testProject.id)
      expect(tickets).toHaveLength(2)
      expect(tickets.map(t => t.title).sort()).toEqual(['Ticket 1', 'Ticket 2'])
    })

    test('should filter tickets by status', async () => {
      await storageService.tickets.create({
        projectId: testProject.id,
        title: 'Open Ticket',
        status: 'open'
      })
      await storageService.tickets.create({
        projectId: testProject.id,
        title: 'Closed Ticket',
        status: 'closed'
      })

      const openTickets = await storageService.tickets.getByStatus(testProject.id, 'open')
      const closedTickets = await storageService.tickets.getByStatus(testProject.id, 'closed')

      expect(openTickets).toHaveLength(1)
      expect(openTickets[0].title).toBe('Open Ticket')
      expect(closedTickets).toHaveLength(1)
      expect(closedTickets[0].title).toBe('Closed Ticket')
    })
  })

  describe('Task Repository', () => {
    let testTicket: any

    beforeEach(async () => {
      const project = await storageService.projects.create({
        name: 'Task Test Project',
        path: '/task/test'
      })
      testTicket = await storageService.tickets.create({
        projectId: project.id,
        title: 'Test Ticket for Tasks'
      })
    })

    test('should create and manage tasks', async () => {
      const taskData = {
        ticketId: testTicket.id,
        content: 'Test task content',
        description: 'Task description',
        done: false,
        estimatedHours: 2.5,
        tags: ['backend', 'api']
      }

      const task = await storageService.tasks.create(taskData)
      
      expect(task.id).toBeDefined()
      expect(task.content).toBe('Test task content')
      expect(task.done).toBe(false)
      expect(task.estimatedHours).toBe(2.5)
      expect(task.tags).toEqual(['backend', 'api'])
      expect(task.orderIndex).toBe(0) // Auto-assigned first position
    })

    test('should toggle task completion', async () => {
      const task = await storageService.tasks.create({
        ticketId: testTicket.id,
        content: 'Task to complete',
        done: false
      })

      const completed = await storageService.tasks.toggleCompletion(task.id)
      expect(completed.done).toBe(true)

      const reopened = await storageService.tasks.toggleCompletion(task.id)
      expect(reopened.done).toBe(false)
    })

    test('should reorder tasks', async () => {
      const task1 = await storageService.tasks.create({
        ticketId: testTicket.id,
        content: 'First task'
      })
      const task2 = await storageService.tasks.create({
        ticketId: testTicket.id,
        content: 'Second task'
      })
      const task3 = await storageService.tasks.create({
        ticketId: testTicket.id,
        content: 'Third task'
      })

      // Reorder: swap first and second
      await storageService.tasks.reorder(testTicket.id, [
        { taskId: task2.id, orderIndex: 0 },
        { taskId: task1.id, orderIndex: 1 },
        { taskId: task3.id, orderIndex: 2 }
      ])

      const reorderedTasks = await storageService.tasks.getByTicket(testTicket.id)
      expect(reorderedTasks[0].content).toBe('Second task')
      expect(reorderedTasks[1].content).toBe('First task')
      expect(reorderedTasks[2].content).toBe('Third task')
    })

    test('should get task statistics', async () => {
      await storageService.tasks.create({
        ticketId: testTicket.id,
        content: 'Task 1',
        done: true,
        estimatedHours: 2
      })
      await storageService.tasks.create({
        ticketId: testTicket.id,
        content: 'Task 2',
        done: false,
        estimatedHours: 3
      })
      await storageService.tasks.create({
        ticketId: testTicket.id,
        content: 'Task 3',
        done: true,
        estimatedHours: 1
      })

      const stats = await storageService.tasks.getTicketStats(testTicket.id)
      
      expect(stats.totalTasks).toBe(3)
      expect(stats.completedTasks).toBe(2)
      expect(stats.pendingTasks).toBe(1)
      expect(stats.totalHours).toBe(6)
      expect(stats.completionPercentage).toBe(67) // 2/3 * 100 rounded
    })
  })

  describe('Chat Repository', () => {
    let testProject: any

    beforeEach(async () => {
      testProject = await storageService.projects.create({
        name: 'Chat Test Project',
        path: '/chat/test'
      })
    })

    test('should create chat with messages', async () => {
      const chat = await storageService.chats.create({
        projectId: testProject.id,
        title: 'Test Chat'
      })

      await storageService.chats.addMessage({
        chatId: chat.id,
        role: 'user',
        content: 'Hello, assistant!'
      })

      await storageService.chats.addMessage({
        chatId: chat.id,
        role: 'assistant',
        content: 'Hello! How can I help you?'
      })

      const chatWithMessages = await storageService.chats.getWithMessages(chat.id)
      
      expect(chatWithMessages).toBeTruthy()
      expect(chatWithMessages!.messages).toHaveLength(2)
      expect(chatWithMessages!.messages[0].role).toBe('user')
      expect(chatWithMessages!.messages[1].role).toBe('assistant')
    })
  })

  describe('TypedStorageService Integration', () => {
    test('should create ticket with tasks in transaction', async () => {
      const project = await storageService.projects.create({
        name: 'Integration Test',
        path: '/integration'
      })

      const typedStorage = new TypedStorageService()
      const result = await typedStorage.createTicketWithTasks(
        {
          projectId: project.id,
          title: 'Ticket with Tasks'
        },
        [
          { content: 'Task 1', done: false },
          { content: 'Task 2', done: false },
          { content: 'Task 3', done: true }
        ]
      )

      expect(result.ticket.title).toBe('Ticket with Tasks')
      expect(result.tasks).toHaveLength(3)
      expect(result.tasks.every(task => task.ticketId === result.ticket.id)).toBe(true)
    })
  })

  describe('Performance Benchmarks', () => {
    test('should perform bulk operations efficiently', async () => {
      const project = await storageService.projects.create({
        name: 'Performance Test',
        path: '/perf'
      })

      // Create multiple tickets at once
      const startTime = Date.now()
      
      const ticketData = Array.from({ length: 100 }, (_, i) => ({
        projectId: project.id,
        title: `Bulk Ticket ${i + 1}`,
        status: 'open' as const
      }))

      const tickets = await storageService.tickets.createMany(ticketData)
      const bulkCreateTime = Date.now() - startTime

      expect(tickets).toHaveLength(100)
      expect(bulkCreateTime).toBeLessThan(1000) // Should be under 1 second
      
      console.log(`✅ Bulk created 100 tickets in ${bulkCreateTime}ms`)

      // Query performance test
      const queryStart = Date.now()
      const retrievedTickets = await storageService.tickets.getByProject(project.id)
      const queryTime = Date.now() - queryStart

      expect(retrievedTickets).toHaveLength(100)
      expect(queryTime).toBeLessThan(100) // Should be under 100ms
      
      console.log(`✅ Queried 100 tickets in ${queryTime}ms`)
    })
  })

  describe('Storage Service Health', () => {
    test('should provide storage statistics', async () => {
      // Create some test data
      const project = await storageService.projects.create({
        name: 'Stats Test',
        path: '/stats'
      })
      
      const ticket = await storageService.tickets.create({
        projectId: project.id,
        title: 'Stats Ticket'
      })
      
      await storageService.tasks.create({
        ticketId: ticket.id,
        content: 'Stats Task'
      })

      const stats = await storageService.getStorageStats()
      
      expect(stats.projects).toBeGreaterThanOrEqual(1)
      expect(stats.tickets).toBeGreaterThanOrEqual(1)
      expect(stats.tasks).toBeGreaterThanOrEqual(1)
      expect(stats.total).toBe(
        stats.projects + stats.tickets + stats.tasks + 
        stats.chats + stats.prompts + stats.queues
      )
    })

    test('should pass health check', async () => {
      const health = await storageService.healthCheck()
      expect(health.status).toBe('healthy')
      expect(health.timestamp).toBeDefined()
    })
  })
})