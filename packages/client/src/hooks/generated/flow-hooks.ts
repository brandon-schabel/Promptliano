/**
 * Generated Flow Hooks - Factory Pattern Implementation
 * Migrated from use-flow-api.ts with 5s polling intervals preserved
 * 
 * Replaces 441 lines of manual hook code with factory-based patterns
 * Maintains all existing functionality including polling and invalidation
 */

import { useApiClient } from '../api/use-api-client'
import { createCrudHooks } from '../factories/crud-hook-factory'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { TicketSchema, TaskSchema } from '@promptliano/database'

// Extract proper TypeScript types from schemas
type Ticket = typeof TicketSchema._type
type TicketTask = typeof TaskSchema._type
import { toast } from 'sonner'
// Removed problematic imports - using defaults instead
// import { commonErrorHandler } from '../api/common-mutation-error-handler'
// import { QUEUE_REFETCH_INTERVAL } from '@/lib/constants'

const commonErrorHandler = (error: any) => {
  console.error('Flow operation error:', error)
  toast.error(error?.message || 'Operation failed')
}

const QUEUE_REFETCH_INTERVAL = 5000 // 5 seconds

// ============================================================================
// Types (preserved from original)
// ============================================================================

export interface FlowItem {
  id: string
  type: 'ticket' | 'task'
  title: string
  description?: string
  ticket?: Ticket
  task?: TicketTask
  queueId?: number | null
  queuePosition?: number | null
  queueStatus?: string | null
  queuePriority?: number
  created: number
  updated: number
}

export interface FlowData {
  unqueued: {
    tickets: Ticket[]
    tasks: TicketTask[]
  }
  queues: Record<
    number,
    {
      queue: any // TaskQueue type
      tickets: Ticket[]
      tasks: TicketTask[]
    }
  >
}

// ============================================================================
// Query Keys (enhanced from original)
// ============================================================================

export const FLOW_ENHANCED_KEYS = {
  all: ['flow'] as const,
  // Required QueryKeyFactory methods
  lists: () => [...FLOW_ENHANCED_KEYS.all, 'list'] as const,
  list: () => [...FLOW_ENHANCED_KEYS.all, 'list'] as const,
  details: () => [...FLOW_ENHANCED_KEYS.all, 'detail'] as const,
  detail: (id: number) => [...FLOW_ENHANCED_KEYS.details(), id] as const,
  // Flow-specific query keys
  data: (projectId: number) => [...FLOW_ENHANCED_KEYS.all, 'data', projectId] as const,
  items: (projectId: number) => [...FLOW_ENHANCED_KEYS.all, 'items', projectId] as const,
  unqueued: (projectId: number) => [...FLOW_ENHANCED_KEYS.all, 'unqueued', projectId] as const,
  queue: (queueId: number) => [...FLOW_ENHANCED_KEYS.all, 'queue', queueId] as const
}

// ============================================================================
// Factory Configuration
// ============================================================================

const FLOW_CONFIG = {
  entityName: 'Flow',
  queryKeys: FLOW_ENHANCED_KEYS,
  apiClient: {
    // Flow doesn't have standard CRUD operations, we'll use custom hooks
    list: () => Promise.resolve([]),
    getById: () => Promise.resolve(null as any),
    create: () => Promise.resolve(null as any),
    update: () => Promise.resolve(null as any),
    delete: () => Promise.resolve(undefined)
  },
  staleTime: 1000, // Keep data fresh for 1 second to prevent flicker
  polling: {
    custom: {
      flowData: {
        enabled: true,
        interval: QUEUE_REFETCH_INTERVAL, // 5000ms
        refetchInBackground: true
      },
      flowItems: {
        enabled: true,
        interval: QUEUE_REFETCH_INTERVAL,
        refetchInBackground: true
      },
      unqueued: {
        enabled: true,
        interval: QUEUE_REFETCH_INTERVAL,
        refetchInBackground: true
      }
    }
  },
  invalidation: {
    onCreate: 'all' as const,
    onUpdate: 'all' as const,
    onDelete: 'all' as const
  }
}

// Create base flow hooks (for utilities)
const flowHooks = createCrudHooks(FLOW_CONFIG)

// ============================================================================
// Custom Query Hooks (migrated from original with polling preserved)
// ============================================================================

/**
 * Get complete flow data for a project with 5s polling
 */
export function useGetFlowData(projectId: number, enabled = true) {
  const client = useApiClient()
  
  return useQuery({
    queryKey: FLOW_ENHANCED_KEYS.data(projectId),
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      const data = await client.flow.getFlowData(projectId)
      return ((data as any)?.data || data) as FlowData
    },
    enabled: !!client && enabled && !!projectId,
    refetchInterval: QUEUE_REFETCH_INTERVAL, // 5s polling preserved
    staleTime: 1000,
    refetchIntervalInBackground: true
  })
}

/**
 * Get flow items as a flat list with 5s polling
 */
export function useGetFlowItems(projectId: number, enabled = true) {
  const client = useApiClient()
  
  return useQuery({
    queryKey: FLOW_ENHANCED_KEYS.items(projectId),
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      const items = await client.flow.getFlowItems(projectId)
      return ((items as any)?.data || items) as FlowItem[]
    },
    enabled: !!client && enabled && !!projectId,
    refetchInterval: QUEUE_REFETCH_INTERVAL, // 5s polling preserved
    refetchIntervalInBackground: true
  })
}

/**
 * Get unqueued items for a project with 5s polling
 */
export function useGetUnqueuedItems(projectId: number, enabled = true) {
  const client = useApiClient()
  
  return useQuery({
    queryKey: FLOW_ENHANCED_KEYS.unqueued(projectId),
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      const items = await client.flow.getUnqueuedItems(projectId)
      return ((items as any)?.data || items) as { tickets: Ticket[]; tasks: TicketTask[] }
    },
    enabled: !!client && enabled && !!projectId,
    refetchInterval: QUEUE_REFETCH_INTERVAL, // 5s polling preserved
    refetchIntervalInBackground: true
  })
}

// ============================================================================
// Mutation Hooks (migrated from original with factory-based invalidation)
// ============================================================================

/**
 * Enqueue a ticket to a queue
 */
export function useEnqueueTicket() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  const { invalidateAll } = useInvalidateFlow()

  return useMutation({
    mutationFn: async ({
      ticketId,
      queueId,
      priority = 0,
      includeTasks = false
    }: {
      ticketId: number
      queueId: number
      priority?: number
      includeTasks?: boolean
    }) => {
      if (!client) throw new Error('API client not initialized')
      const result = await client.flow.enqueueTicket(ticketId, { queueId, priority, includeTasks })
      return result as unknown as Ticket
    },
    onSuccess: (ticket) => {
      // Use factory-based invalidation
      invalidateAll()
      // Also invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['queues'] })
      toast.success('Ticket enqueued successfully')
    },
    onError: commonErrorHandler
  })
}

/**
 * Enqueue a task to a queue
 */
export function useEnqueueTask() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  const { invalidateAll } = useInvalidateFlow()

  return useMutation({
    mutationFn: async ({ taskId, queueId, priority = 0 }: { taskId: number; queueId: number; priority?: number }) => {
      if (!client) throw new Error('API client not initialized')
      const result = await client.flow.enqueueTask(taskId, { queueId, priority })
      return result as unknown as TicketTask
    },
    onSuccess: () => {
      invalidateAll()
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['queues'] })
      toast.success('Task enqueued successfully')
    },
    onError: commonErrorHandler
  })
}

/**
 * Dequeue a ticket (remove from queue)
 */
export function useDequeueTicket() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  const { invalidateAll } = useInvalidateFlow()

  return useMutation({
    mutationFn: async (params: number | { ticketId: number; includeTasks?: boolean }) => {
      const ticketId = typeof params === 'number' ? params : params.ticketId
      const includeTasks = typeof params === 'object' ? params.includeTasks : false

      if (!client) throw new Error('API client not initialized')
      const result = await client.flow.dequeueTicket(ticketId, { includeTasks })
      return result as unknown as Ticket
    },
    onSuccess: (ticket) => {
      invalidateAll()
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['queues'] })
      toast.success('Ticket dequeued successfully')
    },
    onError: commonErrorHandler
  })
}

/**
 * Dequeue a task (remove from queue)
 */
export function useDequeueTask() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  const { invalidateAll } = useInvalidateFlow()

  return useMutation({
    mutationFn: async (taskId: number) => {
      if (!client) throw new Error('API client not initialized')
      const result = await client.flow.dequeueTask(taskId)
      return result as unknown as TicketTask
    },
    onSuccess: (task) => {
      invalidateAll()
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['queues'] })
      toast.success('Task dequeued successfully')
    },
    onError: commonErrorHandler
  })
}

/**
 * Move an item between queues or to unqueued
 */
export function useMoveItem() {
  const client = useApiClient()
  const { invalidateAll } = useInvalidateFlow()

  return useMutation({
    mutationFn: async ({
      itemType,
      itemId,
      targetQueueId,
      priority = 0,
      includeTasks = false
    }: {
      itemType: 'ticket' | 'task'
      itemId: number
      targetQueueId: number | null
      priority?: number
      includeTasks?: boolean
    }) => {
      if (!client) throw new Error('API client not initialized')
      const result = await client.flow.moveItem({ itemType, itemId, targetQueueId, priority, includeTasks })
      return result as FlowItem
    },
    onSuccess: () => {
      invalidateAll()
      toast.success('Item moved successfully')
    },
    onError: commonErrorHandler
  })
}

/**
 * Bulk move items
 */
export function useBulkMoveItems() {
  const client = useApiClient()
  const { invalidateAll } = useInvalidateFlow()

  return useMutation({
    mutationFn: async ({
      items,
      targetQueueId,
      priority = 0
    }: {
      items: Array<{ itemType: 'ticket' | 'task'; itemId: number }>
      targetQueueId: number | null
      priority?: number
    }) => {
      if (!client) throw new Error('API client not initialized')
      const result = await client.flow.bulkMoveItems({ items, targetQueueId, priority })
      return result as { success: boolean; movedCount: number }
    },
    onSuccess: (result) => {
      invalidateAll()
      toast.success(`${result.movedCount} items moved successfully`)
    },
    onError: commonErrorHandler
  })
}

/**
 * Complete a queue item (mark as done)
 */
export function useCompleteQueueItem() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  const { invalidateAll } = useInvalidateFlow()

  return useMutation({
    mutationFn: async ({
      itemType,
      itemId,
      ticketId
    }: {
      itemType: 'ticket' | 'task'
      itemId: number
      ticketId?: number
    }) => {
      if (!client) throw new Error('API client not initialized')
      const result = await client.queues.completeQueueItem(itemType, itemId, ticketId)
      return result
    },
    onSuccess: () => {
      // Invalidate all flow queries to refresh the board
      invalidateAll()

      // Also invalidate ticket and queue queries
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['queues'] })
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] })
      queryClient.invalidateQueries({ queryKey: ['queues-with-stats'] })
      
      toast.success('Item completed successfully')
    },
    onError: commonErrorHandler
  })
}

// ============================================================================
// Processing Hooks (migrated from original)
// ============================================================================

/**
 * Start processing an item
 */
export function useStartProcessing() {
  const client = useApiClient()
  const { invalidateAll } = useInvalidateFlow()

  return useMutation({
    mutationFn: async ({
      itemType,
      itemId,
      agentId
    }: {
      itemType: 'ticket' | 'task'
      itemId: number
      agentId: string
    }) => {
      if (!client) throw new Error('API client not initialized')
      const result = await client.flow.startProcessingItem({ itemType, itemId, agentId })
      return result as { success: boolean }
    },
    onSuccess: () => {
      invalidateAll()
      toast.success('Processing started')
    },
    onError: commonErrorHandler
  })
}

/**
 * Complete processing an item
 */
export function useCompleteProcessing() {
  const client = useApiClient()
  const { invalidateAll } = useInvalidateFlow()

  return useMutation({
    mutationFn: async ({
      itemType,
      itemId,
      processingTime
    }: {
      itemType: 'ticket' | 'task'
      itemId: number
      processingTime?: number
    }) => {
      if (!client) throw new Error('API client not initialized')
      const result = await client.flow.completeProcessingItem({ itemType, itemId, processingTime })
      return result as { success: boolean }
    },
    onSuccess: () => {
      invalidateAll()
      toast.success('Processing completed')
    },
    onError: commonErrorHandler
  })
}

/**
 * Fail processing an item
 */
export function useFailProcessing() {
  const client = useApiClient()
  const { invalidateAll } = useInvalidateFlow()

  return useMutation({
    mutationFn: async ({
      itemType,
      itemId,
      errorMessage
    }: {
      itemType: 'ticket' | 'task'
      itemId: number
      errorMessage: string
    }) => {
      if (!client) throw new Error('API client not initialized')
      const result = await client.flow.failProcessingItem({ itemType, itemId, errorMessage })
      return result as { success: boolean }
    },
    onSuccess: () => {
      invalidateAll()
      toast.error('Processing failed')
    },
    onError: commonErrorHandler
  })
}

// ============================================================================
// Factory-Based Invalidation Utilities
// ============================================================================

export function useInvalidateFlow() {
  return flowHooks.useInvalidate()
}

// ============================================================================
// Type Exports
// ============================================================================

// Types already declared above, no need to re-export
// export type {
//   FlowItem,
//   FlowData
// }

// Export query keys for external use
export { FLOW_ENHANCED_KEYS as FLOW_KEYS }