/**
 * Query Key System Integration Examples
 * 
 * This file demonstrates how to use the unified query key system
 * for various common patterns in Promptliano.
 */

import { useQueryClient } from '@tanstack/react-query'
import { 
  getUnifiedQueryKeys, 
  useSmartInvalidation,
  ProjectKeys,
  TicketKeys,
  PromptKeys
} from '../../lib/query-keys'

// ============================================================================
// Basic Usage Examples
// ============================================================================

/**
 * Example 1: Using unified query keys in a hook
 */
export function useProjectsWithUnifiedKeys() {
  const projectKeys = ProjectKeys()
  
  // Standard list query
  const listKey = projectKeys.list()
  console.log('List key:', listKey) // ['projects', 'v1', 'list']
  
  // List with parameters
  const filteredKey = projectKeys.list({ status: 'active', limit: 10 })
  console.log('Filtered key:', filteredKey) // ['projects', 'v1', 'list', { status: 'active', limit: 10 }]
  
  // Detail query
  const detailKey = projectKeys.detail(123)
  console.log('Detail key:', detailKey) // ['projects', 'v1', 'detail', 123]
  
  return { listKey, filteredKey, detailKey }
}

/**
 * Example 2: Smart invalidation with entity relationships
 */
export function useProjectMutationWithSmartInvalidation() {
  const { invalidateEntity, invalidateProject } = useSmartInvalidation()
  
  const updateProject = (projectId: number, data: any) => {
    // Simulate API call
    return fetch(`/api/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }).then(async response => {
      if (response.ok) {
        // Smart invalidation will automatically invalidate:
        // - The project itself
        // - All tickets belonging to this project
        // - All tasks under those tickets
        // - All prompts associated with this project
        // - All files in this project
        invalidateProject(projectId)
      }
    })
  }
  
  const deleteProject = (projectId: number) => {
    return fetch(`/api/projects/${projectId}`, {
      method: 'DELETE'
    }).then(async response => {
      if (response.ok) {
        // Cascade invalidation will clean up all related entities
        invalidateEntity('projects', { 
          id: projectId, 
          strategy: 'cascade' 
        })
      }
    })
  }
  
  return { updateProject, deleteProject }
}

// ============================================================================
// Migration Examples
// ============================================================================

/**
 * Example 3: Migrating from legacy query keys
 */
export function legacyToUnifiedMigrationExample() {
  // OLD WAY (existing in api-hooks.ts)
  const LEGACY_CHAT_KEYS = {
    all: ['chats'] as const,
    list: () => ['chats', 'list'] as const,
    detail: (chatId: number) => ['chats', 'detail', chatId] as const,
    messages: (chatId: number) => ['chats', 'messages', chatId] as const
  }
  
  // NEW WAY (unified system)
  const unifiedKeys = getUnifiedQueryKeys()
  const chatKeys = unifiedKeys.chats
  
  // Equivalent operations:
  console.log('Legacy all:', LEGACY_CHAT_KEYS.all)
  console.log('Unified all:', chatKeys.all)
  
  console.log('Legacy list:', LEGACY_CHAT_KEYS.list())
  console.log('Unified list:', chatKeys.list())
  
  console.log('Legacy detail:', LEGACY_CHAT_KEYS.detail(123))
  console.log('Unified detail:', chatKeys.detail(123))
  
  // New capabilities not available in legacy:
  console.log('Search chats:', chatKeys.search('user query'))
  console.log('Chat statistics:', chatKeys.stats())
  console.log('Optimistic update:', chatKeys.optimistic(123))
}

/**
 * Example 4: Backwards compatibility layer
 */
export function useBackwardsCompatibleHook() {
  const queryClient = useQueryClient()
  
  // This hook works with both legacy and unified keys
  const invalidateChats = () => {
    // Legacy way
    queryClient.invalidateQueries({ queryKey: ['chats'] })
    
    // Unified way (more powerful)
    const chatKeys = getUnifiedQueryKeys().chats
    queryClient.invalidateQueries({ queryKey: chatKeys.all })
  }
  
  return { invalidateChats }
}

// ============================================================================
// Advanced Patterns
// ============================================================================

/**
 * Example 5: Complex project-based invalidation
 */
export function useComplexProjectInvalidation() {
  const { invalidateEntity, invalidateMultiple } = useSmartInvalidation()
  
  const syncProject = async (projectId: number) => {
    // When syncing a project, many things might change:
    // - Project metadata
    // - Files added/removed/updated
    // - Tickets might be affected by file changes
    // - Prompts might need updating
    
    await fetch(`/api/projects/${projectId}/sync`, { method: 'POST' })
    
    // Smart invalidation handles all the dependencies
    invalidateMultiple([
      { namespace: 'projects', id: projectId },
      { namespace: 'files', id: projectId }, // project-scoped
      { namespace: 'tickets', id: projectId }, // project-scoped
      { namespace: 'prompts', id: projectId }  // project-scoped
    ], 'targeted')
  }
  
  return { syncProject }
}

/**
 * Example 6: Hierarchical query invalidation
 */
export function useHierarchicalInvalidation() {
  const { invalidateEntity } = useSmartInvalidation()
  const queryClient = useQueryClient()
  
  const createTicket = async (projectId: number, ticketData: any) => {
    const response = await fetch('/api/tickets', {
      method: 'POST',
      body: JSON.stringify({ ...ticketData, projectId })
    })
    
    if (response.ok) {
      const newTicket = await response.json()
      
      // Method 1: Smart invalidation (recommended)
      invalidateEntity('tickets', { strategy: 'targeted' })
      
      // Method 2: Manual hierarchical invalidation
      const ticketKeys = TicketKeys()
      queryClient.invalidateQueries({ queryKey: ticketKeys.all })
      queryClient.invalidateQueries({ queryKey: ticketKeys.project(projectId) })
      
      // Method 3: Using relationship-aware keys
      queryClient.invalidateQueries({ queryKey: ticketKeys.parent(projectId, 'projects') })
    }
  }
  
  return { createTicket }
}

/**
 * Example 7: Search and filtering with unified keys
 */
export function useAdvancedSearchAndFiltering() {
  const promptKeys = PromptKeys()
  
  const searchQueries = {
    // Search prompts by text
    searchByText: (query: string) => promptKeys.search(query),
    
    // Filter prompts by criteria
    filterActive: () => promptKeys.filter({ status: 'active' }),
    filterByProject: (projectId: number) => promptKeys.project(projectId),
    
    // Combined search with filters
    searchInProject: (projectId: number, query: string) => 
      promptKeys.search(query, { projectId, scope: 'project' }),
    
    // Paginated results
    paginatedSearch: (query: string, page: number, limit: number) =>
      promptKeys.page(page, limit, { search: query }),
    
    // Infinite scroll
    infinitePrompts: (filters?: any) => promptKeys.infinite(filters)
  }
  
  return searchQueries
}

/**
 * Example 8: Performance optimization with memoization
 */
export function useOptimizedQueryKeys() {
  const queryClient = useQueryClient()
  
  // Cache frequently used query keys
  const memoizedKeys = {
    projectList: ProjectKeys().list(),
    recentTickets: TicketKeys().list({ 
      sort: 'updated', 
      order: 'desc', 
      limit: 10 
    }),
    userPrompts: PromptKeys().filter({ 
      userId: 'current-user',
      status: 'active' 
    })
  }
  
  const prefetchRelatedData = async (projectId: number) => {
    // Prefetch related data efficiently
    const projectKeys = ProjectKeys()
    const ticketKeys = TicketKeys()
    const promptKeys = PromptKeys()
    
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: projectKeys.detail(projectId),
        queryFn: () => fetch(`/api/projects/${projectId}`).then(r => r.json())
      }),
      queryClient.prefetchQuery({
        queryKey: ticketKeys.project(projectId),
        queryFn: () => fetch(`/api/projects/${projectId}/tickets`).then(r => r.json())
      }),
      queryClient.prefetchQuery({
        queryKey: promptKeys.project(projectId),
        queryFn: () => fetch(`/api/projects/${projectId}/prompts`).then(r => r.json())
      })
    ])
  }
  
  return { memoizedKeys, prefetchRelatedData }
}

// ============================================================================
// Real-World Integration Examples
// ============================================================================

/**
 * Example 9: Complete CRUD hook with unified keys
 */
export function useProjectCRUD() {
  const queryClient = useQueryClient()
  const { invalidateEntity, invalidateProject } = useSmartInvalidation()
  const projectKeys = ProjectKeys()
  
  const operations = {
    // Create project
    create: async (data: any) => {
      const response = await fetch('/api/projects', {
        method: 'POST',
        body: JSON.stringify(data)
      })
      
      if (response.ok) {
        // Invalidate project list to show new project
        queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
      }
      
      return response.json()
    },
    
    // Update project
    update: async (id: number, data: any) => {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      })
      
      if (response.ok) {
        // Smart invalidation handles all dependencies
        invalidateProject(id)
      }
      
      return response.json()
    },
    
    // Delete project
    delete: async (id: number) => {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        // Cascade invalidation cleans up everything
        invalidateEntity('projects', { id, strategy: 'cascade' })
      }
      
      return response
    },
    
    // Optimistic update
    optimisticUpdate: (id: number, optimisticData: any) => {
      queryClient.setQueryData(projectKeys.detail(id), optimisticData)
      queryClient.setQueryData(projectKeys.optimistic(id), optimisticData)
    }
  }
  
  return operations
}

/**
 * Example 10: Cross-entity operations with relationship awareness
 */
export function useCrossEntityOperations() {
  const { invalidateMultiple, invalidateProject } = useSmartInvalidation()
  
  const moveTicketToProject = async (
    ticketId: number, 
    fromProjectId: number, 
    toProjectId: number
  ) => {
    const response = await fetch(`/api/tickets/${ticketId}`, {
      method: 'PUT',
      body: JSON.stringify({ projectId: toProjectId })
    })
    
    if (response.ok) {
      // Invalidate both projects and their related entities
      invalidateMultiple([
        { namespace: 'projects', id: fromProjectId },
        { namespace: 'projects', id: toProjectId },
        { namespace: 'tickets', id: ticketId }
      ], 'cascade')
    }
    
    return response.json()
  }
  
  const bulkUpdateTicketStatus = async (
    projectId: number, 
    ticketIds: number[], 
    status: string
  ) => {
    const response = await fetch('/api/tickets/bulk-update', {
      method: 'POST',
      body: JSON.stringify({ ticketIds, status })
    })
    
    if (response.ok) {
      // Invalidate the entire project scope since multiple tickets changed
      invalidateProject(projectId)
    }
    
    return response.json()
  }
  
  return { moveTicketToProject, bulkUpdateTicketStatus }
}

// ============================================================================
// Performance Monitoring Example
// ============================================================================

/**
 * Example 11: Query key performance monitoring
 */
export function useQueryKeyPerformanceMonitoring() {
  const queryClient = useQueryClient()
  
  const getPerformanceStats = () => {
    const cache = queryClient.getQueryCache()
    const queries = cache.getAll()
    
    const stats = {
      totalQueries: queries.length,
      entitiesByNamespace: {} as Record<string, number>,
      staleQueries: 0,
      errorQueries: 0,
      memoryUsage: 0
    }
    
    queries.forEach(query => {
      const namespace = query.queryKey[0] as string
      stats.entitiesByNamespace[namespace] = (stats.entitiesByNamespace[namespace] || 0) + 1
      
      if (query.isStale()) stats.staleQueries++
      if (query.state.status === 'error') stats.errorQueries++
      
      // Estimate memory usage (rough approximation)
      stats.memoryUsage += JSON.stringify(query.state.data || {}).length
    })
    
    return stats
  }
  
  const optimizeCache = () => {
    // Remove stale queries older than 5 minutes
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    
    queryClient.getQueryCache().getAll().forEach(query => {
      if (query.state.dataUpdatedAt < fiveMinutesAgo && query.isStale()) {
        queryClient.removeQueries({ queryKey: query.queryKey })
      }
    })
  }
  
  return { getPerformanceStats, optimizeCache }
}

// Export all examples for easy import
export const QueryKeyExamples = {
  basic: useProjectsWithUnifiedKeys,
  smartInvalidation: useProjectMutationWithSmartInvalidation,
  migration: legacyToUnifiedMigrationExample,
  compatibility: useBackwardsCompatibleHook,
  complexInvalidation: useComplexProjectInvalidation,
  hierarchical: useHierarchicalInvalidation,
  searchFiltering: useAdvancedSearchAndFiltering,
  optimization: useOptimizedQueryKeys,
  crud: useProjectCRUD,
  crossEntity: useCrossEntityOperations,
  monitoring: useQueryKeyPerformanceMonitoring
}