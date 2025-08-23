/**
 * Optimistic Updates Integration Tests
 * Tests the 80% perceived performance improvement through optimistic updates
 * 
 * Validates:
 * - Immediate UI updates before server confirmation
 * - Proper rollback on errors
 * - Conflict resolution strategies
 * - Cross-entity relationship updates
 */

import { describe, beforeAll, afterAll, beforeEach, afterEach, test, expect, mock, spyOn } from 'bun:test'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { toast } from 'sonner'

import { createTestEnvironment, TestEnvironment } from '../utils/test-environment'
import { createMockApiClient, MockApiClient } from '../utils/mock-api-client'
import { createTestQueryClient } from '../utils/test-query-client'
import { createTestData } from '../utils/test-data'

import {
  useProjects,
  useProject,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useTickets,
  useCreateTicket,
  useUpdateTicket,
  useDeleteTicket,
  useChats,
  useCreateChat
} from '../../generated'

import type { 
  Project, 
  CreateProjectBody, 
  UpdateProjectBody,
  Ticket,
  CreateTicketBody,
  UpdateTicketBody
} from '@promptliano/schemas'

describe('Optimistic Updates Integration', () => {
  let testEnv: TestEnvironment
  let mockApiClient: MockApiClient
  let queryClient: QueryClient

  beforeAll(async () => {
    testEnv = await createTestEnvironment({ enableOptimistic: true })
    mockApiClient = createMockApiClient()
    queryClient = createTestQueryClient()
  })

  afterAll(async () => {
    await testEnv.cleanup()
  })

  beforeEach(() => {
    queryClient.clear()
    mockApiClient.reset()
    mock.restore()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )

  describe('Create Operations - Optimistic Updates', () => {
    test('should show optimistic create immediately then update with real data', async () => {
      const testProjects = createTestData.projects(2)
      const newProject = createTestData.createProjectBody()
      const createdProject = { ...newProject, id: 999, created: Date.now(), updated: Date.now() }

      mockApiClient.projects.setMockData('list', testProjects)
      mockApiClient.projects.setMockDelay('create', 1000) // Slow API to observe optimistic state
      mockApiClient.projects.setMockData('create', createdProject)

      // Load initial list
      const { result: listResult } = renderHook(() => useProjects(), { wrapper })
      await waitFor(() => {
        expect(listResult.current.isSuccess).toBe(true)
      })

      expect(listResult.current.data).toHaveLength(2)

      // Start create mutation
      const { result: createResult } = renderHook(() => useCreateProject(), { wrapper })
      
      let optimisticState: Project[] | undefined
      let finalState: Project[] | undefined

      await act(async () => {
        createResult.current.mutate(newProject)
        
        // Capture optimistic state immediately after mutation
        setTimeout(() => {
          optimisticState = queryClient.getQueryData(['projects', 'list']) as Project[]
        }, 50)
      })

      // Verify optimistic state - should have 3 items with temporary ID
      await waitFor(() => {
        optimisticState = queryClient.getQueryData(['projects', 'list']) as Project[]
        expect(optimisticState).toHaveLength(3)
        
        // Find optimistic entity (negative ID)
        const optimisticEntity = optimisticState?.find(p => p.id < 0)
        expect(optimisticEntity).toBeDefined()
        expect(optimisticEntity?.name).toBe(newProject.name)
        expect(optimisticEntity?.description).toBe(newProject.description)
      })

      // Wait for mutation to complete
      await waitFor(() => {
        expect(createResult.current.isSuccess).toBe(true)
      }, { timeout: 2000 })

      // Verify final state - optimistic entity replaced with real one
      await waitFor(() => {
        finalState = queryClient.getQueryData(['projects', 'list']) as Project[]
        expect(finalState).toHaveLength(3)
        expect(finalState?.find(p => p.id < 0)).toBeUndefined() // No more temporary entities
        expect(finalState?.find(p => p.id === 999)).toBeDefined() // Real entity exists
        expect(finalState?.find(p => p.id === 999)?.name).toBe(newProject.name)
      })

      // Verify performance improvement - UI was updated immediately
      expect(optimisticState).toHaveLength(3) // Immediate feedback
      expect(finalState).toHaveLength(3) // Consistent final state
    })

    test('should rollback optimistic create on API error', async () => {
      const testProjects = createTestData.projects(2)
      const newProject = createTestData.createProjectBody()

      mockApiClient.projects.setMockData('list', testProjects)
      mockApiClient.projects.setMockError('create', new Error('Server error'))

      const { result: listResult } = renderHook(() => useProjects(), { wrapper })
      await waitFor(() => {
        expect(listResult.current.isSuccess).toBe(true)
      })

      const toastErrorSpy = spyOn(toast, 'error').mockImplementation(() => {})

      const { result: createResult } = renderHook(() => useCreateProject(), { wrapper })

      let optimisticState: Project[] | undefined
      let rolledBackState: Project[] | undefined

      await act(async () => {
        createResult.current.mutate(newProject)
        
        // Capture optimistic state
        setTimeout(() => {
          optimisticState = queryClient.getQueryData(['projects', 'list']) as Project[]
        }, 50)
      })

      // Verify optimistic addition
      await waitFor(() => {
        optimisticState = queryClient.getQueryData(['projects', 'list']) as Project[]
        expect(optimisticState).toHaveLength(3)
      })

      // Wait for error and rollback
      await waitFor(() => {
        expect(createResult.current.isError).toBe(true)
      })

      // Verify rollback
      await waitFor(() => {
        rolledBackState = queryClient.getQueryData(['projects', 'list']) as Project[]
        expect(rolledBackState).toHaveLength(2) // Back to original state
        expect(rolledBackState?.every(p => p.id > 0)).toBe(true) // No temporary entities
      })

      expect(toastErrorSpy).toHaveBeenCalledWith('Server error')
    })
  })

  describe('Update Operations - Optimistic Updates', () => {
    test('should show optimistic update immediately then confirm with server data', async () => {
      const testProjects = createTestData.projects(1)
      const updateData: UpdateProjectBody = { name: 'Optimistically Updated Name' }
      const serverUpdatedProject = { 
        ...testProjects[0], 
        ...updateData, 
        updated: Date.now() + 1000 // Server adds timestamp
      }

      mockApiClient.projects.setMockData('list', testProjects)
      mockApiClient.projects.setMockData('getById', testProjects[0])
      mockApiClient.projects.setMockDelay('update', 800)
      mockApiClient.projects.setMockData('update', serverUpdatedProject)

      // Load initial data
      const { result: listResult } = renderHook(() => useProjects(), { wrapper })
      const { result: detailResult } = renderHook(() => useProject(testProjects[0].id), { wrapper })
      
      await waitFor(() => {
        expect(listResult.current.isSuccess).toBe(true)
        expect(detailResult.current.isSuccess).toBe(true)
      })

      // Start update
      const { result: updateResult } = renderHook(() => useUpdateProject(), { wrapper })

      let optimisticListState: Project[] | undefined
      let optimisticDetailState: Project | undefined

      await act(async () => {
        updateResult.current.mutate({
          id: testProjects[0].id,
          data: updateData
        })

        // Capture optimistic states
        setTimeout(() => {
          optimisticListState = queryClient.getQueryData(['projects', 'list']) as Project[]
          optimisticDetailState = queryClient.getQueryData(['projects', 'detail', testProjects[0].id]) as Project
        }, 50)
      })

      // Verify optimistic updates in both list and detail
      await waitFor(() => {
        optimisticListState = queryClient.getQueryData(['projects', 'list']) as Project[]
        optimisticDetailState = queryClient.getQueryData(['projects', 'detail', testProjects[0].id]) as Project
        
        expect(optimisticListState?.[0]?.name).toBe(updateData.name)
        expect(optimisticDetailState?.name).toBe(updateData.name)
      })

      // Wait for server confirmation
      await waitFor(() => {
        expect(updateResult.current.isSuccess).toBe(true)
      }, { timeout: 1200 })

      // Verify server data replaced optimistic data
      const finalListState = queryClient.getQueryData(['projects', 'list']) as Project[]
      const finalDetailState = queryClient.getQueryData(['projects', 'detail', testProjects[0].id]) as Project

      expect(finalListState[0].name).toBe(updateData.name)
      expect(finalListState[0].updated).toBe(serverUpdatedProject.updated) // Server timestamp
      expect(finalDetailState.updated).toBe(serverUpdatedProject.updated)
    })

    test('should rollback optimistic update on conflict or error', async () => {
      const testProject = createTestData.projects(1)[0]
      const updateData: UpdateProjectBody = { name: 'Failed Update' }

      mockApiClient.projects.setMockData('list', [testProject])
      mockApiClient.projects.setMockData('getById', testProject)
      mockApiClient.projects.setMockError('update', new Error('Conflict: Project was modified by another user'))

      // Load initial data
      const { result: listResult } = renderHook(() => useProjects(), { wrapper })
      const { result: detailResult } = renderHook(() => useProject(testProject.id), { wrapper })

      await waitFor(() => {
        expect(listResult.current.isSuccess).toBe(true)
        expect(detailResult.current.isSuccess).toBe(true)
      })

      const toastErrorSpy = spyOn(toast, 'error').mockImplementation(() => {})
      const { result: updateResult } = renderHook(() => useUpdateProject(), { wrapper })

      await act(async () => {
        updateResult.current.mutate({
          id: testProject.id,
          data: updateData
        })
      })

      // Wait for error
      await waitFor(() => {
        expect(updateResult.current.isError).toBe(true)
      })

      // Verify rollback to original state
      const rolledBackList = queryClient.getQueryData(['projects', 'list']) as Project[]
      const rolledBackDetail = queryClient.getQueryData(['projects', 'detail', testProject.id]) as Project

      expect(rolledBackList[0].name).toBe(testProject.name) // Original name restored
      expect(rolledBackDetail.name).toBe(testProject.name)
      expect(toastErrorSpy).toHaveBeenCalledWith('Conflict: Project was modified by another user')
    })
  })

  describe('Delete Operations - Optimistic Updates', () => {
    test('should optimistically remove from UI then confirm deletion', async () => {
      const testProjects = createTestData.projects(3)
      const projectToDelete = testProjects[1]

      mockApiClient.projects.setMockData('list', testProjects)
      mockApiClient.projects.setMockDelay('delete', 500)
      mockApiClient.projects.setMockData('delete', true)

      // Load initial data
      const { result: listResult } = renderHook(() => useProjects(), { wrapper })
      await waitFor(() => {
        expect(listResult.current.isSuccess).toBe(true)
      })

      expect(listResult.current.data).toHaveLength(3)

      const { result: deleteResult } = renderHook(() => useDeleteProject(), { wrapper })

      let optimisticState: Project[] | undefined

      await act(async () => {
        deleteResult.current.mutate(projectToDelete.id)

        // Capture optimistic state
        setTimeout(() => {
          optimisticState = queryClient.getQueryData(['projects', 'list']) as Project[]
        }, 50)
      })

      // Verify immediate removal
      await waitFor(() => {
        optimisticState = queryClient.getQueryData(['projects', 'list']) as Project[]
        expect(optimisticState).toHaveLength(2)
        expect(optimisticState?.find(p => p.id === projectToDelete.id)).toBeUndefined()
      })

      // Wait for server confirmation
      await waitFor(() => {
        expect(deleteResult.current.isSuccess).toBe(true)
      }, { timeout: 700 })

      // Verify final state maintains deletion
      const finalState = queryClient.getQueryData(['projects', 'list']) as Project[]
      expect(finalState).toHaveLength(2)
      expect(finalState.find(p => p.id === projectToDelete.id)).toBeUndefined()

      // Verify detail query removed
      const detailState = queryClient.getQueryData(['projects', 'detail', projectToDelete.id])
      expect(detailState).toBeUndefined()
    })

    test('should restore deleted item on server error', async () => {
      const testProjects = createTestData.projects(2)
      const projectToDelete = testProjects[0]

      mockApiClient.projects.setMockData('list', testProjects)
      mockApiClient.projects.setMockError('delete', new Error('Cannot delete: Project has active tickets'))

      const { result: listResult } = renderHook(() => useProjects(), { wrapper })
      await waitFor(() => {
        expect(listResult.current.isSuccess).toBe(true)
      })

      const toastErrorSpy = spyOn(toast, 'error').mockImplementation(() => {})
      const { result: deleteResult } = renderHook(() => useDeleteProject(), { wrapper })

      await act(async () => {
        deleteResult.current.mutate(projectToDelete.id)
      })

      // Wait for error
      await waitFor(() => {
        expect(deleteResult.current.isError).toBe(true)
      })

      // Verify restoration
      const restoredState = queryClient.getQueryData(['projects', 'list']) as Project[]
      expect(restoredState).toHaveLength(2) // Back to original count
      expect(restoredState.find(p => p.id === projectToDelete.id)).toBeDefined() // Item restored

      expect(toastErrorSpy).toHaveBeenCalledWith('Cannot delete: Project has active tickets')
    })
  })

  describe('Cross-Entity Optimistic Updates', () => {
    test('should update related entities optimistically', async () => {
      const testProject = createTestData.projects(1)[0]
      const testTickets = createTestData.ticketsForProject(testProject.id, 2)
      const newTicket = createTestData.createTicketBody(testProject.id)
      const createdTicket = { ...newTicket, id: 999, created: Date.now(), updated: Date.now() }

      mockApiClient.projects.setMockData('getById', testProject)
      mockApiClient.tickets.setMockData('list', testTickets)
      mockApiClient.tickets.setMockDelay('create', 600)
      mockApiClient.tickets.setMockData('create', createdTicket)

      // Load initial data
      const { result: projectResult } = renderHook(() => useProject(testProject.id), { wrapper })
      const { result: ticketsResult } = renderHook(
        () => useTickets({ projectId: testProject.id }),
        { wrapper }
      )

      await waitFor(() => {
        expect(projectResult.current.isSuccess).toBe(true)
        expect(ticketsResult.current.isSuccess).toBe(true)
      })

      expect(ticketsResult.current.data).toHaveLength(2)

      // Create new ticket
      const { result: createTicketResult } = renderHook(() => useCreateTicket(), { wrapper })

      await act(async () => {
        createTicketResult.current.mutate(newTicket)
      })

      // Verify optimistic update
      await waitFor(() => {
        const updatedTickets = queryClient.getQueryData(['tickets', 'list', { projectId: testProject.id }]) as Ticket[]
        expect(updatedTickets).toHaveLength(3)
        
        const optimisticTicket = updatedTickets.find(t => t.id < 0)
        expect(optimisticTicket).toBeDefined()
        expect(optimisticTicket?.projectId).toBe(testProject.id)
        expect(optimisticTicket?.title).toBe(newTicket.title)
      })

      // Wait for completion
      await waitFor(() => {
        expect(createTicketResult.current.isSuccess).toBe(true)
      }, { timeout: 800 })

      // Verify final state
      const finalTickets = queryClient.getQueryData(['tickets', 'list', { projectId: testProject.id }]) as Ticket[]
      expect(finalTickets).toHaveLength(3)
      expect(finalTickets.find(t => t.id === 999)).toBeDefined()
    })

    test('should handle complex relationship updates with rollback', async () => {
      const testProject = createTestData.projects(1)[0]
      const testTickets = createTestData.ticketsForProject(testProject.id, 1)
      const ticketUpdate: UpdateTicketBody = { 
        status: 'completed',
        title: 'Updated ticket title'
      }

      mockApiClient.projects.setMockData('getById', testProject)
      mockApiClient.tickets.setMockData('list', testTickets)
      mockApiClient.tickets.setMockData('getById', testTickets[0])
      mockApiClient.tickets.setMockError('update', new Error('Validation error'))

      // Load data
      const { result: ticketsResult } = renderHook(
        () => useTickets({ projectId: testProject.id }),
        { wrapper }
      )
      const { result: ticketResult } = renderHook(() => useUpdateTicket(), { wrapper })

      await waitFor(() => {
        expect(ticketsResult.current.isSuccess).toBe(true)
      })

      const toastErrorSpy = spyOn(toast, 'error').mockImplementation(() => {})

      // Attempt update
      await act(async () => {
        ticketResult.current.mutate({
          id: testTickets[0].id,
          data: ticketUpdate
        })
      })

      // Wait for error
      await waitFor(() => {
        expect(ticketResult.current.isError).toBe(true)
      })

      // Verify rollback in both list and detail
      const rolledBackTickets = queryClient.getQueryData(['tickets', 'list', { projectId: testProject.id }]) as Ticket[]
      const rolledBackTicket = queryClient.getQueryData(['tickets', 'detail', testTickets[0].id]) as Ticket

      expect(rolledBackTickets[0].status).toBe(testTickets[0].status) // Original status
      expect(rolledBackTickets[0].title).toBe(testTickets[0].title)   // Original title
      expect(rolledBackTicket?.status).toBe(testTickets[0].status)
      expect(rolledBackTicket?.title).toBe(testTickets[0].title)

      expect(toastErrorSpy).toHaveBeenCalledWith('Validation error')
    })
  })

  describe('Performance Metrics', () => {
    test('should demonstrate 80% perceived performance improvement', async () => {
      const testProjects = createTestData.projects(1)
      const newProject = createTestData.createProjectBody()

      mockApiClient.projects.setMockData('list', testProjects)
      mockApiClient.projects.setMockDelay('create', 2000) // 2 second server delay
      mockApiClient.projects.setMockData('create', { ...newProject, id: 999 })

      const { result: listResult } = renderHook(() => useProjects(), { wrapper })
      await waitFor(() => {
        expect(listResult.current.isSuccess).toBe(true)
      })

      const { result: createResult } = renderHook(() => useCreateProject(), { wrapper })

      const startTime = Date.now()
      let uiUpdateTime = 0
      let serverConfirmTime = 0

      await act(async () => {
        createResult.current.mutate(newProject)
        
        // Measure when UI is updated (optimistically)
        setTimeout(() => {
          const currentData = queryClient.getQueryData(['projects', 'list']) as Project[]
          if (currentData && currentData.length === 2) {
            uiUpdateTime = Date.now() - startTime
          }
        }, 50)
      })

      // Wait for server confirmation
      await waitFor(() => {
        expect(createResult.current.isSuccess).toBe(true)
        serverConfirmTime = Date.now() - startTime
      }, { timeout: 2500 })

      // Verify performance improvement
      expect(uiUpdateTime).toBeLessThan(200) // UI updated almost immediately
      expect(serverConfirmTime).toBeGreaterThan(1900) // Server took full time
      
      // Calculate improvement: UI responds ~90-95% faster than server
      const improvement = ((serverConfirmTime - uiUpdateTime) / serverConfirmTime) * 100
      expect(improvement).toBeGreaterThan(80) // At least 80% improvement
      expect(improvement).toBeLessThan(99) // Reasonable upper bound
    })

    test('should maintain data consistency despite optimistic updates', async () => {
      const testProjects = createTestData.projects(2)
      const updates = [
        { id: testProjects[0].id, data: { name: 'Update 1' } },
        { id: testProjects[1].id, data: { name: 'Update 2' } }
      ]
      const serverResponses = [
        { ...testProjects[0], name: 'Update 1', updated: Date.now() + 1000 },
        { ...testProjects[1], name: 'Update 2', updated: Date.now() + 2000 }
      ]

      mockApiClient.projects.setMockData('list', testProjects)
      mockApiClient.projects.setMockData('update', serverResponses[0])

      const { result: listResult } = renderHook(() => useProjects(), { wrapper })
      await waitFor(() => {
        expect(listResult.current.isSuccess).toBe(true)
      })

      const { result: updateResult } = renderHook(() => useUpdateProject(), { wrapper })

      // Perform multiple rapid updates
      await act(async () => {
        updateResult.current.mutate(updates[0])
        
        // Second update with different server response
        setTimeout(() => {
          mockApiClient.projects.setMockData('update', serverResponses[1])
          updateResult.current.mutate(updates[1])
        }, 100)
      })

      // Wait for all updates to complete
      await waitFor(() => {
        expect(updateResult.current.isSuccess).toBe(true)
      }, { timeout: 1000 })

      // Verify final consistency
      const finalState = queryClient.getQueryData(['projects', 'list']) as Project[]
      expect(finalState).toHaveLength(2)
      
      // All updates should be reflected with server data
      const updated1 = finalState.find(p => p.id === testProjects[0].id)
      const updated2 = finalState.find(p => p.id === testProjects[1].id)
      
      expect(updated1?.name).toBe('Update 1')
      expect(updated2?.name).toBe('Update 2')
      
      // Server timestamps should be preserved
      expect(updated1?.updated).toBe(serverResponses[0].updated)
      expect(updated2?.updated).toBe(serverResponses[1].updated)
    })
  })
})