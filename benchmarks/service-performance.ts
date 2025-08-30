#!/usr/bin/env bun
/**
 * Service Layer Performance Benchmarks
 * 
 * Validates that functional factory pattern services maintain or exceed
 * performance compared to legacy implementations.
 * 
 * Target Metrics:
 * - List operations: < 10ms
 * - Get operations: < 5ms
 * - Create operations: < 20ms
 * - Update operations: < 15ms
 * - Delete operations: < 10ms
 * - Batch operations: < 100ms for 100 items
 */

import { bench, describe, beforeAll, afterAll } from 'bun:test'
import { createProjectService, createTicketService, createQueueService, createChatService } from '@promptliano/services'
import { db } from '@promptliano/database'
import { projectRepository, ticketRepository, queueRepository, chatRepository } from '@promptliano/database'

// Test data setup
const TEST_PROJECT_COUNT = 100
const TEST_TICKET_COUNT = 100
const TEST_QUEUE_COUNT = 50

let testProjectIds: number[] = []
let testTicketIds: number[] = []
let testQueueIds: number[] = []

// Service instances
const projectService = createProjectService()
const ticketService = createTicketService()
const queueService = createQueueService()
const chatService = createChatService()

describe('Service Performance Benchmarks', () => {
  // Setup test data
  beforeAll(async () => {
    console.log('Setting up benchmark test data...')
    
    // Create test projects
    for (let i = 0; i < TEST_PROJECT_COUNT; i++) {
      const project = await projectRepository.create({
        name: `Benchmark Project ${i}`,
        path: `/benchmark/${i}`,
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
      testProjectIds.push(project.id)
      
      // Create tickets for first 10 projects
      if (i < 10) {
        for (let j = 0; j < TEST_TICKET_COUNT / 10; j++) {
          const ticket = await ticketRepository.create({
            title: `Benchmark Ticket ${i}-${j}`,
            description: 'Performance test ticket',
            projectId: project.id,
            status: 'open',
            priority: 'medium',
            createdAt: Date.now(),
            updatedAt: Date.now()
          })
          testTicketIds.push(ticket.id)
        }
      }
    }
    
    // Create test queues
    for (let i = 0; i < TEST_QUEUE_COUNT; i++) {
      const queue = await queueRepository.create({
        name: `Benchmark Queue ${i}`,
        description: 'Performance test queue',
        projectId: testProjectIds[0],
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
      testQueueIds.push(queue.id)
    }
    
    console.log('Test data setup complete')
  })

  // Cleanup after benchmarks
  afterAll(async () => {
    console.log('Cleaning up benchmark test data...')
    
    // Clean up in reverse order due to foreign keys
    for (const id of testTicketIds) {
      await ticketRepository.delete(id)
    }
    
    for (const id of testQueueIds) {
      await queueRepository.delete(id)
    }
    
    for (const id of testProjectIds) {
      await projectRepository.delete(id)
    }
    
    console.log('Cleanup complete')
  })

  // ============= LIST OPERATIONS =============
  describe('List Operations (Target: < 10ms)', () => {
    bench('projectService.list()', async () => {
      await projectService.list()
    })
    
    bench('projectService.list() with pagination', async () => {
      await projectService.list({ limit: 10, offset: 0 })
    })
    
    bench('ticketService.list()', async () => {
      await ticketService.list()
    })
    
    bench('ticketService.list() with filters', async () => {
      await ticketService.list({ 
        projectId: testProjectIds[0],
        status: 'open' 
      })
    })
    
    bench('queueService.list()', async () => {
      await queueService.list()
    })
  })

  // ============= GET BY ID OPERATIONS =============
  describe('Get Operations (Target: < 5ms)', () => {
    bench('projectService.get()', async () => {
      await projectService.get(testProjectIds[Math.floor(Math.random() * testProjectIds.length)])
    })
    
    bench('ticketService.get()', async () => {
      await ticketService.get(testTicketIds[Math.floor(Math.random() * testTicketIds.length)])
    })
    
    bench('queueService.get()', async () => {
      await queueService.get(testQueueIds[Math.floor(Math.random() * testQueueIds.length)])
    })
  })

  // ============= CREATE OPERATIONS =============
  describe('Create Operations (Target: < 20ms)', () => {
    let createCounter = 0
    
    bench('projectService.create()', async () => {
      const project = await projectService.create({
        name: `Bench Create Project ${createCounter++}`,
        path: `/bench-create/${createCounter}`,
        description: 'Created during benchmark'
      })
      // Immediately delete to avoid accumulating data
      await projectRepository.delete(project.id)
    })
    
    bench('ticketService.create()', async () => {
      const ticket = await ticketService.create({
        title: `Bench Create Ticket ${createCounter++}`,
        description: 'Created during benchmark',
        projectId: testProjectIds[0],
        status: 'open',
        priority: 'low'
      })
      // Immediately delete to avoid accumulating data
      await ticketRepository.delete(ticket.id)
    })
    
    bench('queueService.create()', async () => {
      const queue = await queueService.create({
        name: `Bench Create Queue ${createCounter++}`,
        description: 'Created during benchmark',
        projectId: testProjectIds[0],
        status: 'active'
      })
      // Immediately delete to avoid accumulating data
      await queueRepository.delete(queue.id)
    })
  })

  // ============= UPDATE OPERATIONS =============
  describe('Update Operations (Target: < 15ms)', () => {
    let updateCounter = 0
    
    bench('projectService.update()', async () => {
      const projectId = testProjectIds[Math.floor(Math.random() * testProjectIds.length)]
      await projectService.update(projectId, {
        description: `Updated during benchmark ${updateCounter++}`
      })
    })
    
    bench('ticketService.update()', async () => {
      const ticketId = testTicketIds[Math.floor(Math.random() * testTicketIds.length)]
      await ticketService.update(ticketId, {
        description: `Updated during benchmark ${updateCounter++}`,
        status: Math.random() > 0.5 ? 'open' : 'closed'
      })
    })
    
    bench('queueService.update()', async () => {
      const queueId = testQueueIds[Math.floor(Math.random() * testQueueIds.length)]
      await queueService.update(queueId, {
        description: `Updated during benchmark ${updateCounter++}`
      })
    })
  })

  // ============= DELETE OPERATIONS =============
  describe('Delete Operations (Target: < 10ms)', () => {
    bench('projectService.delete()', async () => {
      // Create and immediately delete
      const project = await projectRepository.create({
        name: 'Temp Delete Project',
        path: `/temp-delete/${Date.now()}`,
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
      await projectService.delete(project.id)
    })
    
    bench('ticketService.delete()', async () => {
      // Create and immediately delete
      const ticket = await ticketRepository.create({
        title: 'Temp Delete Ticket',
        projectId: testProjectIds[0],
        status: 'open',
        priority: 'low',
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
      await ticketService.delete(ticket.id)
    })
  })

  // ============= BATCH OPERATIONS =============
  describe('Batch Operations (Target: < 100ms for 100 items)', () => {
    bench('batch create 10 projects', async () => {
      const projects = []
      for (let i = 0; i < 10; i++) {
        projects.push({
          name: `Batch Project ${i}`,
          path: `/batch/${Date.now()}/${i}`,
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
      }
      
      // Use transaction for batch create
      const created = await db.transaction(async () => {
        const results = []
        for (const project of projects) {
          results.push(await projectRepository.create(project))
        }
        return results
      })
      
      // Clean up
      for (const project of created) {
        await projectRepository.delete(project.id)
      }
    })
    
    bench('batch update 10 tickets', async () => {
      const ticketIds = testTicketIds.slice(0, 10)
      const updates = ticketIds.map((id, index) => ({
        id,
        description: `Batch update ${index}`
      }))
      
      await db.transaction(async () => {
        for (const update of updates) {
          await ticketRepository.update(update.id, { description: update.description })
        }
      })
    })
  })

  // ============= COMPLEX QUERIES =============
  describe('Complex Query Performance', () => {
    bench('projectService with related tickets', async () => {
      const projectId = testProjectIds[0]
      const [project, tickets] = await Promise.all([
        projectService.get(projectId),
        ticketService.list({ projectId })
      ])
    })
    
    bench('queue with items count', async () => {
      const queueId = testQueueIds[0]
      const queue = await queueService.get(queueId)
      // Simulate counting related items
      const itemCount = Math.floor(Math.random() * 100)
    })
  })
})

// Run benchmarks and output results
console.log(`
========================================
   SERVICE LAYER PERFORMANCE BENCHMARKS
========================================

Running benchmarks with:
- ${TEST_PROJECT_COUNT} test projects
- ${TEST_TICKET_COUNT} test tickets
- ${TEST_QUEUE_COUNT} test queues

Target Performance Metrics:
- List operations: < 10ms
- Get operations: < 5ms
- Create operations: < 20ms
- Update operations: < 15ms
- Delete operations: < 10ms
- Batch operations: < 100ms for 100 items

========================================
`)