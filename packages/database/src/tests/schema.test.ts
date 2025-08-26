import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { db } from '../db'
import * as schema from '../schema'
import { sql, eq, and, desc, asc, count, sum, avg } from 'drizzle-orm'

describe('Drizzle Schema Definition', () => {
  beforeEach(async () => {
    // Clean database before each test
    await db.delete(schema.tickets)
    await db.delete(schema.ticketTasks)
    await db.delete(schema.projects)
    await db.delete(schema.chats)
    await db.delete(schema.chatMessages)
    await db.delete(schema.prompts)
    await db.delete(schema.queues)
    await db.delete(schema.queueItems)
    await db.delete(schema.claudeAgents)
    await db.delete(schema.claudeCommands)
    await db.delete(schema.claudeHooks)
    await db.delete(schema.providerKeys)
    await db.delete(schema.files)
    await db.delete(schema.selectedFiles)
    await db.delete(schema.activeTabs)
  })

  describe('Table Structure Validation', () => {
    it('should have projects table with correct schema', async () => {
      const project = {
        name: 'Test Project',
        description: 'Test Description',
        path: '/test/path',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      const [inserted] = await db.insert(schema.projects).values(project).returning()

      expect(inserted).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          name: 'Test Project',
          description: 'Test Description',
          path: '/test/path',
          createdAt: expect.any(Number),
          updatedAt: expect.any(Number)
        })
      )
    })

    it('should have tickets table with all required fields including queue integration', async () => {
      // First create a project
      const [project] = await db
        .insert(schema.projects)
        .values({
          name: 'Test Project',
          description: 'Test',
          path: '/test',
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
        .returning()

      const ticket = {
        projectId: project.id,
        title: 'Test Ticket',
        overview: 'Test Overview',
        status: 'open' as const,
        priority: 'normal' as const,
        suggestedFileIds: ['file1.ts', 'file2.ts'],
        suggestedAgentIds: ['agent1', 'agent2'],
        suggestedPromptIds: [1, 2],
        queueId: null,
        queuePosition: null,
        queueStatus: null,
        queuePriority: null,
        queuedAt: null,
        queueStartedAt: null,
        queueCompletedAt: null,
        queueAgentId: null,
        queueErrorMessage: null,
        estimatedProcessingTime: null,
        actualProcessingTime: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      const [inserted] = await db.insert(schema.tickets).values(ticket).returning()

      expect(inserted).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          projectId: project.id,
          title: 'Test Ticket',
          overview: 'Test Overview',
          status: 'open',
          priority: 'normal',
          suggestedFileIds: ['file1.ts', 'file2.ts'],
          suggestedAgentIds: ['agent1', 'agent2'],
          suggestedPromptIds: [1, 2]
        })
      )
    })

    it('should have ticket_tasks table with enhanced fields', async () => {
      // Create project and ticket first
      const [project] = await db
        .insert(schema.projects)
        .values({
          name: 'Test Project',
          description: 'Test',
          path: '/test',
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
        .returning()

      const [ticket] = await db
        .insert(schema.tickets)
        .values({
          projectId: project.id,
          title: 'Test Ticket',
          overview: 'Test',
          status: 'open',
          priority: 'normal',
          suggestedFileIds: [],
          suggestedAgentIds: [],
          suggestedPromptIds: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
        .returning()

      const task = {
        ticketId: ticket.id,
        content: 'Test Task',
        description: 'Detailed task description',
        suggestedFileIds: ['task.ts'],
        done: false,
        orderIndex: 0,
        estimatedHours: 2.5,
        dependencies: [],
        tags: ['backend', 'api'],
        agentId: 'test-agent',
        suggestedPromptIds: [1],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      const [inserted] = await db.insert(schema.ticketTasks).values(task).returning()

      expect(inserted).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          ticketId: ticket.id,
          content: 'Test Task',
          description: 'Detailed task description',
          estimatedHours: 2.5,
          tags: ['backend', 'api'],
          agentId: 'test-agent'
        })
      )
    })

    it('should have chats and chat_messages tables with proper relationship', async () => {
      // Create project first
      const [project] = await db
        .insert(schema.projects)
        .values({
          name: 'Test Project',
          description: 'Test',
          path: '/test',
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
        .returning()

      // Create chat
      const [chat] = await db
        .insert(schema.chats)
        .values({
          projectId: project.id,
          title: 'Test Chat',
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
        .returning()

      // Create message
      const [message] = await db
        .insert(schema.chatMessages)
        .values({
          chatId: chat.id,
          role: 'user',
          content: 'Test message',
          createdAt: Date.now()
        })
        .returning()

      expect(chat).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          projectId: project.id,
          title: 'Test Chat'
        })
      )

      expect(message).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          chatId: chat.id,
          role: 'user',
          content: 'Test message'
        })
      )
    })

    it('should have prompts table with proper structure', async () => {
      // Create project first
      const [project] = await db
        .insert(schema.projects)
        .values({
          name: 'Test Project',
          description: 'Test',
          path: '/test',
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
        .returning()

      const [prompt] = await db
        .insert(schema.prompts)
        .values({
          projectId: project.id,
          title: 'Test Prompt',
          content: 'Test prompt content',
          description: 'Test description',
          tags: ['test', 'ai'],
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
        .returning()

      expect(prompt).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          projectId: project.id,
          title: 'Test Prompt',
          content: 'Test prompt content',
          tags: ['test', 'ai']
        })
      )
    })

    it('should have queues and queue_items tables for queue management', async () => {
      // Create project first
      const [project] = await db
        .insert(schema.projects)
        .values({
          name: 'Test Project',
          description: 'Test',
          path: '/test',
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
        .returning()

      // Create queue
      const [queue] = await db
        .insert(schema.queues)
        .values({
          projectId: project.id,
          name: 'Test Queue',
          description: 'Test queue description',
          maxParallelItems: 1,
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
        .returning()

      // Create queue item
      const [queueItem] = await db
        .insert(schema.queueItems)
        .values({
          queueId: queue.id,
          itemType: 'ticket',
          itemId: 1,
          priority: 5,
          status: 'queued',
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
        .returning()

      expect(queue).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          projectId: project.id,
          name: 'Test Queue',
          maxParallelItems: 1
        })
      )

      expect(queueItem).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          queueId: queue.id,
          itemType: 'ticket',
          itemId: 1,
          priority: 5,
          status: 'queued'
        })
      )
    })
  })

  describe('Type Inference Validation', () => {
    it('should infer correct TypeScript types from schema', () => {
      // These type assertions will fail compilation if types are wrong
      const ticket: schema.Ticket = {
        id: 1,
        projectId: 1,
        title: 'Test',
        overview: 'Test',
        status: 'open',
        priority: 'normal',
        suggestedFileIds: [],
        suggestedAgentIds: [],
        suggestedPromptIds: [],
        queueId: null,
        queuePosition: null,
        queueStatus: null,
        queuePriority: null,
        queuedAt: null,
        queueStartedAt: null,
        queueCompletedAt: null,
        queueAgentId: null,
        queueErrorMessage: null,
        estimatedProcessingTime: null,
        actualProcessingTime: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      const insertTicket: schema.InsertTicket = {
        projectId: 1,
        title: 'Test',
        overview: 'Test',
        status: 'open',
        priority: 'normal',
        suggestedFileIds: [],
        suggestedAgentIds: [],
        suggestedPromptIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      expect(ticket.id).toBe(1)
      expect(insertTicket.projectId).toBe(1)
    })

    it('should enforce enum constraints at compile time', () => {
      // This should compile fine
      const validStatus: schema.TicketStatus = 'open'
      const validPriority: schema.TicketPriority = 'high'
      const validRole: schema.MessageRole = 'assistant'

      expect(validStatus).toBe('open')
      expect(validPriority).toBe('high')
      expect(validRole).toBe('assistant')
    })
  })

  describe('Relationship Validation', () => {
    it('should support ticket-task relationship queries', async () => {
      // Create project
      const [project] = await db
        .insert(schema.projects)
        .values({
          name: 'Test Project',
          description: 'Test',
          path: '/test',
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
        .returning()

      // Create ticket
      const [ticket] = await db
        .insert(schema.tickets)
        .values({
          projectId: project.id,
          title: 'Test Ticket',
          overview: 'Test',
          status: 'open',
          priority: 'normal',
          suggestedFileIds: [],
          suggestedAgentIds: [],
          suggestedPromptIds: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
        .returning()

      // Create tasks
      await db.insert(schema.ticketTasks).values([
        {
          ticketId: ticket.id,
          content: 'Task 1',
          description: 'First task',
          suggestedFileIds: [],
          done: false,
          orderIndex: 0,
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          ticketId: ticket.id,
          content: 'Task 2',
          description: 'Second task',
          suggestedFileIds: [],
          done: true,
          orderIndex: 1,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ])

      // Query with relationship (this should work with Drizzle relational queries)
      const ticketWithTasks = await db.query.tickets.findFirst({
        where: eq(schema.tickets.id, ticket.id),
        with: {
          tasks: true
        }
      })

      expect(ticketWithTasks).toBeDefined()
      expect(ticketWithTasks?.tasks).toHaveLength(2)
      expect(ticketWithTasks?.tasks?.[0].content).toBe('Task 1')
      expect(ticketWithTasks?.tasks?.[1].content).toBe('Task 2')
    })

    it('should support chat-messages relationship queries', async () => {
      // Create project
      const [project] = await db
        .insert(schema.projects)
        .values({
          name: 'Test Project',
          description: 'Test',
          path: '/test',
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
        .returning()

      // Create chat
      const [chat] = await db
        .insert(schema.chats)
        .values({
          projectId: project.id,
          title: 'Test Chat',
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
        .returning()

      // Create messages
      await db.insert(schema.chatMessages).values([
        {
          chatId: chat.id,
          role: 'user',
          content: 'Hello',
          createdAt: Date.now()
        },
        {
          chatId: chat.id,
          role: 'assistant',
          content: 'Hi there!',
          createdAt: Date.now()
        }
      ])

      // Query with relationship
      const chatWithMessages = await db.query.chats.findFirst({
        where: eq(schema.chats.id, chat.id),
        with: {
          messages: {
            orderBy: asc(schema.chatMessages.createdAt)
          }
        }
      })

      expect(chatWithMessages).toBeDefined()
      expect(chatWithMessages?.messages).toHaveLength(2)
      expect(chatWithMessages?.messages?.[0].role).toBe('user')
      expect(chatWithMessages?.messages?.[1].role).toBe('assistant')
    })

    it('should support project with all related entities', async () => {
      // Create project
      const [project] = await db
        .insert(schema.projects)
        .values({
          name: 'Test Project',
          description: 'Test',
          path: '/test',
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
        .returning()

      // Create related entities
      const [ticket] = await db
        .insert(schema.tickets)
        .values({
          projectId: project.id,
          title: 'Test Ticket',
          overview: 'Test',
          status: 'open',
          priority: 'normal',
          suggestedFileIds: [],
          suggestedAgentIds: [],
          suggestedPromptIds: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
        .returning()

      const [chat] = await db
        .insert(schema.chats)
        .values({
          projectId: project.id,
          title: 'Test Chat',
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
        .returning()

      const [prompt] = await db
        .insert(schema.prompts)
        .values({
          projectId: project.id,
          title: 'Test Prompt',
          content: 'Test content',
          description: 'Test',
          tags: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
        .returning()

      // Query everything at once
      const projectWithEverything = await db.query.projects.findFirst({
        where: eq(schema.projects.id, project.id),
        with: {
          tickets: {
            with: {
              tasks: true
            }
          },
          chats: {
            with: {
              messages: true
            }
          },
          prompts: true,
          queues: true
        }
      })

      expect(projectWithEverything).toBeDefined()
      expect(projectWithEverything?.tickets).toHaveLength(1)
      expect(projectWithEverything?.chats).toHaveLength(1)
      expect(projectWithEverything?.prompts).toHaveLength(1)
    })
  })

  describe('Index Performance Validation', () => {
    it('should have indexes for common query patterns', async () => {
      // These tests validate that indexes exist by checking query performance
      // In a real implementation, we'd measure actual performance

      // Create test data
      const [project] = await db
        .insert(schema.projects)
        .values({
          name: 'Test Project',
          description: 'Test',
          path: '/test',
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
        .returning()

      // Insert multiple tickets to test index performance
      const tickets = Array.from({ length: 100 }, (_, i) => ({
        projectId: project.id,
        title: `Ticket ${i}`,
        overview: 'Test',
        status: (i % 3 === 0 ? 'closed' : i % 2 === 0 ? 'in_progress' : 'open') as schema.TicketStatus,
        priority: (i % 3 === 0 ? 'high' : i % 2 === 0 ? 'low' : 'normal') as schema.TicketPriority,
        suggestedFileIds: [],
        suggestedAgentIds: [],
        suggestedPromptIds: [],
        createdAt: Date.now() - i * 1000,
        updatedAt: Date.now()
      }))

      await db.insert(schema.tickets).values(tickets)

      // Test indexed queries (these should be fast)
      const start = Date.now()

      const byProject = await db.select().from(schema.tickets).where(eq(schema.tickets.projectId, project.id)).limit(10)

      const byStatus = await db
        .select()
        .from(schema.tickets)
        .where(and(eq(schema.tickets.projectId, project.id), eq(schema.tickets.status, 'open')))
        .limit(10)

      const queryTime = Date.now() - start

      expect(byProject).toHaveLength(10)
      expect(byStatus.length).toBeGreaterThan(0)
      expect(queryTime).toBeLessThan(50) // Should be very fast with indexes
    })
  })

  describe('JSON Field Handling', () => {
    it('should handle JSON arrays correctly', async () => {
      const [project] = await db
        .insert(schema.projects)
        .values({
          name: 'Test Project',
          description: 'Test',
          path: '/test',
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
        .returning()

      const [ticket] = await db
        .insert(schema.tickets)
        .values({
          projectId: project.id,
          title: 'Test Ticket',
          overview: 'Test',
          status: 'open',
          priority: 'normal',
          suggestedFileIds: ['file1.ts', 'file2.ts', 'file3.ts'],
          suggestedAgentIds: ['agent1', 'agent2'],
          suggestedPromptIds: [1, 2, 3],
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
        .returning()

      expect(ticket.suggestedFileIds).toEqual(['file1.ts', 'file2.ts', 'file3.ts'])
      expect(ticket.suggestedAgentIds).toEqual(['agent1', 'agent2'])
      expect(ticket.suggestedPromptIds).toEqual([1, 2, 3])
    })

    it('should handle empty arrays correctly', async () => {
      const [project] = await db
        .insert(schema.projects)
        .values({
          name: 'Test Project',
          description: 'Test',
          path: '/test',
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
        .returning()

      const [ticket] = await db
        .insert(schema.tickets)
        .values({
          projectId: project.id,
          title: 'Test Ticket',
          overview: 'Test',
          status: 'open',
          priority: 'normal',
          suggestedFileIds: [],
          suggestedAgentIds: [],
          suggestedPromptIds: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
        .returning()

      expect(ticket.suggestedFileIds).toEqual([])
      expect(ticket.suggestedAgentIds).toEqual([])
      expect(ticket.suggestedPromptIds).toEqual([])
    })
  })
})
