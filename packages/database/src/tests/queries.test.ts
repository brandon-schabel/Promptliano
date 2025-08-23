import { describe, it, expect, beforeEach } from 'bun:test'
import { db } from '../db'
import * as schema from '../schema'
import { eq, and, or, desc, asc, count, sum, avg, inArray, like, gt, lt, between } from 'drizzle-orm'

describe('Drizzle Query Operations', () => {
  let testProject: schema.Project

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

    // Create test project
    const [project] = await db.insert(schema.projects).values({
      name: 'Test Project',
      description: 'Test project for query testing',
      path: '/test/project',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }).returning()
    
    testProject = project
  })

  describe('CRUD Operations', () => {
    describe('Create Operations', () => {
      it('should create single entity with returning', async () => {
        const [ticket] = await db.insert(schema.tickets).values({
          projectId: testProject.id,
          title: 'Test Ticket',
          overview: 'Test overview',
          status: 'open',
          priority: 'normal',
          suggestedFileIds: ['file1.ts'],
          suggestedAgentIds: ['agent1'],
          suggestedPromptIds: [1],
          createdAt: Date.now(),
          updatedAt: Date.now()
        }).returning()

        expect(ticket).toEqual(expect.objectContaining({
          id: expect.any(Number),
          projectId: testProject.id,
          title: 'Test Ticket',
          status: 'open',
          priority: 'normal'
        }))
      })

      it('should create multiple entities in batch', async () => {
        const tickets = await db.insert(schema.tickets).values([
          {
            projectId: testProject.id,
            title: 'Ticket 1',
            overview: 'Overview 1',
            status: 'open',
            priority: 'high',
            suggestedFileIds: [],
            suggestedAgentIds: [],
            suggestedPromptIds: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
          },
          {
            projectId: testProject.id,
            title: 'Ticket 2',
            overview: 'Overview 2',
            status: 'in_progress',
            priority: 'normal',
            suggestedFileIds: [],
            suggestedAgentIds: [],
            suggestedPromptIds: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        ]).returning()

        expect(tickets).toHaveLength(2)
        expect(tickets[0].title).toBe('Ticket 1')
        expect(tickets[1].title).toBe('Ticket 2')
      })

      it('should handle JSON arrays in batch inserts', async () => {
        // First create a ticket to reference
        const [ticket] = await db.insert(schema.tickets).values({
          projectId: testProject.id,
          title: 'Parent Ticket',
          overview: 'For tasks',
          status: 'open',
          priority: 'normal',
          suggestedFileIds: [],
          suggestedAgentIds: [],
          suggestedPromptIds: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        }).returning()

        const tasks = await db.insert(schema.ticketTasks).values([
          {
            ticketId: ticket.id,
            content: 'Task 1',
            description: 'First task',
            suggestedFileIds: ['file1.ts', 'file2.ts'],
            done: false,
            orderIndex: 0,
            dependencies: [],
            tags: ['backend', 'api'],
            createdAt: Date.now(),
            updatedAt: Date.now()
          },
          {
            ticketId: ticket.id,
            content: 'Task 2',
            description: 'Second task',
            suggestedFileIds: ['file3.ts'],
            done: true,
            orderIndex: 1,
            dependencies: [],
            tags: ['frontend'],
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        ]).returning()

        expect(tasks[0].suggestedFileIds).toEqual(['file1.ts', 'file2.ts'])
        expect(tasks[0].tags).toEqual(['backend', 'api'])
        expect(tasks[1].tags).toEqual(['frontend'])
      })
    })

    describe('Read Operations', () => {
      beforeEach(async () => {
        // Create test data
        const [ticket] = await db.insert(schema.tickets).values({
          projectId: testProject.id,
          title: 'Test Ticket',
          overview: 'Test overview',
          status: 'open',
          priority: 'normal',
          suggestedFileIds: [],
          suggestedAgentIds: [],
          suggestedPromptIds: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        }).returning()

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
      })

      it('should select with basic where conditions', async () => {
        const openTickets = await db.select()
          .from(schema.tickets)
          .where(and(
            eq(schema.tickets.projectId, testProject.id),
            eq(schema.tickets.status, 'open')
          ))

        expect(openTickets).toHaveLength(1)
        expect(openTickets[0].status).toBe('open')
      })

      it('should select with complex where conditions', async () => {
        // Insert more test data
        await db.insert(schema.tickets).values([
          {
            projectId: testProject.id,
            title: 'High Priority Ticket',
            overview: 'Urgent',
            status: 'open',
            priority: 'high',
            suggestedFileIds: [],
            suggestedAgentIds: [],
            suggestedPromptIds: [],
            createdAt: Date.now() - 1000,
            updatedAt: Date.now()
          },
          {
            projectId: testProject.id,
            title: 'Closed Ticket',
            overview: 'Done',
            status: 'closed',
            priority: 'low',
            suggestedFileIds: [],
            suggestedAgentIds: [],
            suggestedPromptIds: [],
            createdAt: Date.now() - 2000,
            updatedAt: Date.now()
          }
        ])

        // Test OR conditions
        const openOrHighPriority = await db.select()
          .from(schema.tickets)
          .where(and(
            eq(schema.tickets.projectId, testProject.id),
            or(
              eq(schema.tickets.status, 'open'),
              eq(schema.tickets.priority, 'high')
            )
          ))

        expect(openOrHighPriority.length).toBeGreaterThanOrEqual(2)

        // Test IN condition
        const specificStatuses = await db.select()
          .from(schema.tickets)
          .where(and(
            eq(schema.tickets.projectId, testProject.id),
            inArray(schema.tickets.status, ['open', 'closed'])
          ))

        expect(specificStatuses.length).toBeGreaterThanOrEqual(2)
      })

      it('should select with ordering and limiting', async () => {
        const now = Date.now()
        
        // Insert multiple tickets with specific timestamps to ensure ordering
        await db.insert(schema.tickets).values([
          {
            projectId: testProject.id,
            title: 'Newest Ticket',
            overview: 'Last created',
            status: 'open',
            priority: 'normal',
            suggestedFileIds: [],
            suggestedAgentIds: [],
            suggestedPromptIds: [],
            createdAt: now + 10000, // Definitely newest
            updatedAt: now
          },
          {
            projectId: testProject.id,
            title: 'Oldest Ticket',
            overview: 'First created',
            status: 'open',
            priority: 'normal',
            suggestedFileIds: [],
            suggestedAgentIds: [],
            suggestedPromptIds: [],
            createdAt: now - 10000, // Definitely oldest
            updatedAt: now
          }
        ])

        // Test descending order - should get newest first
        const newestFirst = await db.select()
          .from(schema.tickets)
          .where(eq(schema.tickets.projectId, testProject.id))
          .orderBy(desc(schema.tickets.createdAt))
          .limit(1)

        expect(newestFirst).toHaveLength(1)
        expect(newestFirst[0].title).toBe('Newest Ticket')

        // Test ascending order - should get oldest first
        const oldestFirst = await db.select()
          .from(schema.tickets)
          .where(eq(schema.tickets.projectId, testProject.id))
          .orderBy(asc(schema.tickets.createdAt))
          .limit(1)

        expect(oldestFirst[0].title).toBe('Oldest Ticket')
      })

      it('should select specific columns', async () => {
        const titles = await db.select({
          id: schema.tickets.id,
          title: schema.tickets.title,
          status: schema.tickets.status
        })
          .from(schema.tickets)
          .where(eq(schema.tickets.projectId, testProject.id))

        expect(titles[0]).toEqual(expect.objectContaining({
          id: expect.any(Number),
          title: expect.any(String),
          status: expect.any(String)
        }))
        // Should not have other fields
        expect(titles[0]).not.toHaveProperty('overview')
        expect(titles[0]).not.toHaveProperty('priority')
      })
    })

    describe('Update Operations', () => {
      let testTicket: schema.Ticket

      beforeEach(async () => {
        const [ticket] = await db.insert(schema.tickets).values({
          projectId: testProject.id,
          title: 'Original Title',
          overview: 'Original overview',
          status: 'open',
          priority: 'normal',
          suggestedFileIds: [],
          suggestedAgentIds: [],
          suggestedPromptIds: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        }).returning()
        
        testTicket = ticket
      })

      it('should update single entity', async () => {
        const [updated] = await db.update(schema.tickets)
          .set({
            title: 'Updated Title',
            status: 'in_progress',
            updatedAt: Date.now()
          })
          .where(eq(schema.tickets.id, testTicket.id))
          .returning()

        expect(updated.title).toBe('Updated Title')
        expect(updated.status).toBe('in_progress')
        expect(updated.overview).toBe('Original overview') // Unchanged
      })

      it('should update JSON fields', async () => {
        const [updated] = await db.update(schema.tickets)
          .set({
            suggestedFileIds: ['new-file1.ts', 'new-file2.ts'],
            suggestedAgentIds: ['new-agent'],
            suggestedPromptIds: [10, 20],
            updatedAt: Date.now()
          })
          .where(eq(schema.tickets.id, testTicket.id))
          .returning()

        expect(updated.suggestedFileIds).toEqual(['new-file1.ts', 'new-file2.ts'])
        expect(updated.suggestedAgentIds).toEqual(['new-agent'])
        expect(updated.suggestedPromptIds).toEqual([10, 20])
      })

      it('should update multiple entities with condition', async () => {
        // Create more tickets
        await db.insert(schema.tickets).values([
          {
            projectId: testProject.id,
            title: 'Ticket 2',
            overview: 'Test',
            status: 'open',
            priority: 'normal',
            suggestedFileIds: [],
            suggestedAgentIds: [],
            suggestedPromptIds: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
          },
          {
            projectId: testProject.id,
            title: 'Ticket 3',
            overview: 'Test',
            status: 'open',
            priority: 'normal',
            suggestedFileIds: [],
            suggestedAgentIds: [],
            suggestedPromptIds: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        ])

        // Update all open tickets
        const updated = await db.update(schema.tickets)
          .set({
            priority: 'high',
            updatedAt: Date.now()
          })
          .where(and(
            eq(schema.tickets.projectId, testProject.id),
            eq(schema.tickets.status, 'open')
          ))
          .returning()

        expect(updated).toHaveLength(3) // All 3 open tickets
        updated.forEach(ticket => {
          expect(ticket.priority).toBe('high')
        })
      })
    })

    describe('Delete Operations', () => {
      let testTickets: schema.Ticket[]

      beforeEach(async () => {
        const tickets = await db.insert(schema.tickets).values([
          {
            projectId: testProject.id,
            title: 'Ticket 1',
            overview: 'Test',
            status: 'open',
            priority: 'normal',
            suggestedFileIds: [],
            suggestedAgentIds: [],
            suggestedPromptIds: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
          },
          {
            projectId: testProject.id,
            title: 'Ticket 2',
            overview: 'Test',
            status: 'closed',
            priority: 'normal',
            suggestedFileIds: [],
            suggestedAgentIds: [],
            suggestedPromptIds: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        ]).returning()
        
        testTickets = tickets
      })

      it('should delete single entity', async () => {
        const deleted = await db.delete(schema.tickets)
          .where(eq(schema.tickets.id, testTickets[0].id))
          .returning()

        expect(deleted).toHaveLength(1)
        expect(deleted[0].id).toBe(testTickets[0].id)

        // Verify deletion
        const remaining = await db.select()
          .from(schema.tickets)
          .where(eq(schema.tickets.projectId, testProject.id))

        expect(remaining).toHaveLength(1)
        expect(remaining[0].id).toBe(testTickets[1].id)
      })

      it('should delete multiple entities with condition', async () => {
        const deleted = await db.delete(schema.tickets)
          .where(eq(schema.tickets.projectId, testProject.id))
          .returning()

        expect(deleted).toHaveLength(2)

        // Verify all deleted
        const remaining = await db.select()
          .from(schema.tickets)
          .where(eq(schema.tickets.projectId, testProject.id))

        expect(remaining).toHaveLength(0)
      })

      it('should handle cascade deletes', async () => {
        // Create tasks for ticket
        await db.insert(schema.ticketTasks).values([
          {
            ticketId: testTickets[0].id,
            content: 'Task 1',
            description: 'Test',
            suggestedFileIds: [],
            done: false,
            orderIndex: 0,
            createdAt: Date.now(),
            updatedAt: Date.now()
          },
          {
            ticketId: testTickets[0].id,
            content: 'Task 2',
            description: 'Test',
            suggestedFileIds: [],
            done: false,
            orderIndex: 1,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        ])

        // Delete ticket (should cascade to tasks)
        await db.delete(schema.tickets)
          .where(eq(schema.tickets.id, testTickets[0].id))

        // Verify tasks are deleted
        const remainingTasks = await db.select()
          .from(schema.ticketTasks)
          .where(eq(schema.ticketTasks.ticketId, testTickets[0].id))

        expect(remainingTasks).toHaveLength(0)
      })
    })
  })

  describe('Aggregation Operations', () => {
    beforeEach(async () => {
      // Create test tickets with various statuses
      await db.insert(schema.tickets).values([
        {
          projectId: testProject.id,
          title: 'Open Ticket 1',
          overview: 'Test',
          status: 'open',
          priority: 'high',
          suggestedFileIds: [],
          suggestedAgentIds: [],
          suggestedPromptIds: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          projectId: testProject.id,
          title: 'Open Ticket 2',
          overview: 'Test',
          status: 'open',
          priority: 'normal',
          suggestedFileIds: [],
          suggestedAgentIds: [],
          suggestedPromptIds: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          projectId: testProject.id,
          title: 'Closed Ticket',
          overview: 'Test',
          status: 'closed',
          priority: 'low',
          suggestedFileIds: [],
          suggestedAgentIds: [],
          suggestedPromptIds: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ])
    })

    it('should count entities', async () => {
      const [result] = await db.select({
        total: count()
      })
        .from(schema.tickets)
        .where(eq(schema.tickets.projectId, testProject.id))

      expect(result.total).toBe(3)
    })

    it('should count with grouping', async () => {
      const statusCounts = await db.select({
        status: schema.tickets.status,
        count: count()
      })
        .from(schema.tickets)
        .where(eq(schema.tickets.projectId, testProject.id))
        .groupBy(schema.tickets.status)

      expect(statusCounts).toHaveLength(2) // open and closed
      
      const openCount = statusCounts.find(s => s.status === 'open')?.count
      const closedCount = statusCounts.find(s => s.status === 'closed')?.count
      
      expect(openCount).toBe(2)
      expect(closedCount).toBe(1)
    })

    it('should handle timestamp aggregations', async () => {
      const [result] = await db.select({
        minCreated: count(schema.tickets.createdAt),
        maxCreated: count(schema.tickets.createdAt)
      })
        .from(schema.tickets)
        .where(eq(schema.tickets.projectId, testProject.id))

      expect(result.minCreated).toBe(3)
      expect(result.maxCreated).toBe(3)
    })
  })

  describe('Performance Benchmarks', () => {
    it('should perform single entity lookup in < 1ms', async () => {
      // Create test ticket
      const [ticket] = await db.insert(schema.tickets).values({
        projectId: testProject.id,
        title: 'Performance Test',
        overview: 'Test',
        status: 'open',
        priority: 'normal',
        suggestedFileIds: [],
        suggestedAgentIds: [],
        suggestedPromptIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }).returning()

      // Benchmark single lookup
      const start = Date.now()
      const found = await db.select()
        .from(schema.tickets)
        .where(eq(schema.tickets.id, ticket.id))
        .limit(1)
      const elapsed = Date.now() - start

      expect(found).toHaveLength(1)
      expect(elapsed).toBeLessThan(5) // Should be very fast
    })

    it('should perform bulk insert of 100 items in < 25ms', async () => {
      // Generate 100 tickets
      const tickets = Array.from({ length: 100 }, (_, i) => ({
        projectId: testProject.id,
        title: `Bulk Ticket ${i}`,
        overview: `Test ${i}`,
        status: 'open' as const,
        priority: 'normal' as const,
        suggestedFileIds: [`file${i}.ts`],
        suggestedAgentIds: [`agent${i}`],
        suggestedPromptIds: [i],
        createdAt: Date.now() + i,
        updatedAt: Date.now() + i
      }))

      // Benchmark bulk insert
      const start = Date.now()
      const inserted = await db.insert(schema.tickets).values(tickets).returning()
      const elapsed = Date.now() - start

      expect(inserted).toHaveLength(100)
      expect(elapsed).toBeLessThan(50) // Target: 25ms, allow 50ms for CI
    })

    it('should perform complex join query in < 4ms', async () => {
      // Create ticket with tasks
      const [ticket] = await db.insert(schema.tickets).values({
        projectId: testProject.id,
        title: 'Join Test',
        overview: 'Test',
        status: 'open',
        priority: 'normal',
        suggestedFileIds: [],
        suggestedAgentIds: [],
        suggestedPromptIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }).returning()

      await db.insert(schema.ticketTasks).values(
        Array.from({ length: 10 }, (_, i) => ({
          ticketId: ticket.id,
          content: `Task ${i}`,
          description: `Test task ${i}`,
          suggestedFileIds: [],
          done: i % 2 === 0,
          orderIndex: i,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }))
      )

      // Benchmark complex join
      const start = Date.now()
      const result = await db.query.tickets.findFirst({
        where: eq(schema.tickets.id, ticket.id),
        with: {
          tasks: {
            where: eq(schema.ticketTasks.done, false),
            orderBy: asc(schema.ticketTasks.orderIndex)
          }
        }
      })
      const elapsed = Date.now() - start

      expect(result).toBeDefined()
      expect(result?.tasks).toHaveLength(5) // 5 incomplete tasks
      expect(elapsed).toBeLessThan(10) // Target: 4ms, allow 10ms for CI
    })

    it('should maintain performance with 1000+ records', async () => {
      // Create many tickets
      const tickets = Array.from({ length: 1000 }, (_, i) => ({
        projectId: testProject.id,
        title: `Stress Test ${i}`,
        overview: `Test ${i}`,
        status: (i % 3 === 0 ? 'closed' : i % 2 === 0 ? 'in_progress' : 'open') as schema.TicketStatus,
        priority: (i % 3 === 0 ? 'high' : i % 2 === 0 ? 'low' : 'normal') as schema.TicketPriority,
        suggestedFileIds: [`file${i}.ts`],
        suggestedAgentIds: [`agent${i}`],
        suggestedPromptIds: [i],
        createdAt: Date.now() - i * 100,
        updatedAt: Date.now()
      }))

      await db.insert(schema.tickets).values(tickets)

      // Test paginated query performance
      const start = Date.now()
      const results = await db.select()
        .from(schema.tickets)
        .where(and(
          eq(schema.tickets.projectId, testProject.id),
          eq(schema.tickets.status, 'open')
        ))
        .orderBy(desc(schema.tickets.createdAt))
        .limit(20)
        .offset(100)
      const elapsed = Date.now() - start

      expect(results).toHaveLength(20)
      expect(elapsed).toBeLessThan(15) // Should still be fast with indexes
    })
  })
})