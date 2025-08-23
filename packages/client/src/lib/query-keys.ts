/**
 * Unified Query Keys for Promptliano
 * Central export point for all query key management
 * 
 * This file provides:
 * - Centralized query key management
 * - Migration helpers from legacy patterns
 * - Type-safe access to all entity query keys
 * - Smart invalidation utilities
 */

import { useQueryClient } from '@tanstack/react-query'
import {
  createUnifiedQueryKeys,
  createSmartInvalidator,
  initializeUnifiedQuerySystem,
  getEntityQueryKeys,
  migrateAllQueryKeys,
  createCompatibilityLayer,
  type EntityNamespace,
  type InvalidationStrategy,
  QUERY_KEY_REGISTRY
} from '../hooks/factories/query-key-factory'

// ============================================================================
// Unified Query Key System
// ============================================================================

/**
 * Global unified query keys instance
 * Initialized once and reused throughout the application
 */
let unifiedQueryKeys: ReturnType<typeof createUnifiedQueryKeys> | null = null

/**
 * Get the unified query keys (lazy initialization)
 */
export function getUnifiedQueryKeys() {
  if (!unifiedQueryKeys) {
    unifiedQueryKeys = initializeUnifiedQuerySystem()
  }
  return unifiedQueryKeys
}

/**
 * Individual entity query key getters for convenient access
 */
export const ProjectKeys = () => getEntityQueryKeys('projects')
export const TicketKeys = () => getEntityQueryKeys('tickets')
export const TaskKeys = () => getEntityQueryKeys('tasks')
export const ChatKeys = () => getEntityQueryKeys('chats')
export const PromptKeys = () => getEntityQueryKeys('prompts')
export const AgentKeys = () => getEntityQueryKeys('agents')
export const CommandKeys = () => getEntityQueryKeys('commands')
export const HookKeys = () => getEntityQueryKeys('hooks')
export const QueueKeys = () => getEntityQueryKeys('queues')
export const FileKeys = () => getEntityQueryKeys('files')
export const KeyKeys = () => getEntityQueryKeys('keys')
export const ProviderKeys = () => getEntityQueryKeys('providers')
export const GitKeys = () => getEntityQueryKeys('git')
export const McpKeys = () => getEntityQueryKeys('mcp')
export const FlowKeys = () => getEntityQueryKeys('flows')

// ============================================================================
// React Hook for Smart Invalidation
// ============================================================================

/**
 * React hook that provides smart query invalidation capabilities
 */
export function useSmartInvalidation() {
  const queryClient = useQueryClient()
  const smartInvalidator = createSmartInvalidator(queryClient)
  
  return {
    /**
     * Invalidate queries for a specific entity with smart dependency mapping
     */
    invalidateEntity: (
      entityNamespace: EntityNamespace,
      options?: {
        id?: number | string
        strategy?: InvalidationStrategy
        cascade?: boolean
      }
    ) => smartInvalidator.invalidateEntity(entityNamespace, options),
    
    /**
     * Invalidate multiple entities at once
     */
    invalidateMultiple: (
      entities: { namespace: EntityNamespace; id?: number | string }[],
      strategy?: InvalidationStrategy
    ) => smartInvalidator.invalidateMultiple(entities, strategy),
    
    /**
     * Invalidate all project-scoped queries
     */
    invalidateProject: (projectId: number | string) => 
      smartInvalidator.invalidateProject(projectId),
    
    /**
     * Legacy compatibility: Individual entity invalidation functions
     */
    projects: {
      invalidateAll: () => smartInvalidator.invalidateEntity('projects'),
      invalidateDetail: (id: number | string) => 
        smartInvalidator.invalidateEntity('projects', { id, strategy: 'minimal' }),
      invalidateWithDependents: (id: number | string) =>
        smartInvalidator.invalidateEntity('projects', { id, strategy: 'cascade' })
    },
    
    tickets: {
      invalidateAll: () => smartInvalidator.invalidateEntity('tickets'),
      invalidateDetail: (id: number | string) => 
        smartInvalidator.invalidateEntity('tickets', { id, strategy: 'minimal' }),
      invalidateProject: (projectId: number | string) => {
        const ticketKeys = TicketKeys()
        queryClient.invalidateQueries({ queryKey: ticketKeys.project(projectId) })
      }
    },
    
    prompts: {
      invalidateAll: () => smartInvalidator.invalidateEntity('prompts'),
      invalidateDetail: (id: number | string) => 
        smartInvalidator.invalidateEntity('prompts', { id, strategy: 'minimal' }),
      invalidateProject: (projectId: number | string) => {
        const promptKeys = PromptKeys()
        queryClient.invalidateQueries({ queryKey: promptKeys.project(projectId) })
      }
    },
    
    chats: {
      invalidateAll: () => smartInvalidator.invalidateEntity('chats'),
      invalidateDetail: (id: number | string) => 
        smartInvalidator.invalidateEntity('chats', { id, strategy: 'minimal' }),
      invalidateMessages: (chatId: number | string) => {
        const chatKeys = ChatKeys()
        queryClient.invalidateQueries({ queryKey: chatKeys.related(chatId, 'messages' as any) })
      }
    },
    
    queues: {
      invalidateAll: () => smartInvalidator.invalidateEntity('queues'),
      invalidateDetail: (id: number | string) => 
        smartInvalidator.invalidateEntity('queues', { id, strategy: 'minimal' })
    }
  }
}

// ============================================================================
// Migration Helpers
// ============================================================================

/**
 * Hook to help migrate from legacy query key patterns
 */
export function useMigrateLegacyKeys() {
  const queryClient = useQueryClient()
  
  return {
    /**
     * Migrate all legacy query keys to unified format
     */
    migrateAll: () => {
      const migrations = {
        // Legacy key mappings
        'chats': 'chats' as EntityNamespace,
        'projects': 'projects' as EntityNamespace,
        'prompts': 'prompts' as EntityNamespace,
        'tickets': 'tickets' as EntityNamespace,
        'keys': 'keys' as EntityNamespace,
        'agents': 'agents' as EntityNamespace,
        'commands': 'commands' as EntityNamespace,
        'hooks': 'hooks' as EntityNamespace,
        'queues': 'queues' as EntityNamespace
      }
      
      migrateAllQueryKeys(queryClient, migrations)
    },
    
    /**
     * Create compatibility layers for specific entities
     */
    createCompatibilityFor: (entityNamespace: EntityNamespace) => 
      createCompatibilityLayer(entityNamespace),
    
    /**
     * Check if migration is needed
     */
    needsMigration: () => {
      const queries = queryClient.getQueryCache().getAll()
      return queries.some(query => {
        const key = query.queryKey
        return key.length > 0 && 
               typeof key[0] === 'string' && 
               Object.keys(QUERY_KEY_REGISTRY).includes(key[0]) &&
               (key.length < 2 || !String(key[1]).startsWith('v'))
      })
    }
  }
}

// ============================================================================
// Performance Utilities
// ============================================================================

/**
 * Hook for performance monitoring of query key operations
 */
export function useQueryKeyPerformance() {
  const queryClient = useQueryClient()
  
  return {
    /**
     * Get cache statistics
     */
    getCacheStats: () => {
      const cache = queryClient.getQueryCache()
      const queries = cache.getAll()
      
      const stats = {
        totalQueries: queries.length,
        entitiesCached: {} as Record<EntityNamespace, number>,
        cacheHitRate: 0,
        stalQueries: 0,
        errorQueries: 0
      }
      
      queries.forEach(query => {
        const namespace = query.queryKey[0] as EntityNamespace
        if (Object.keys(QUERY_KEY_REGISTRY).includes(namespace)) {
          stats.entitiesCached[namespace] = (stats.entitiesCached[namespace] || 0) + 1
        }
        
        if (query.isStale()) stats.stalQueries++
        if (query.state.status === 'error') stats.errorQueries++
      })
      
      return stats
    },
    
    /**
     * Clear stale queries
     */
    clearStaleQueries: () => {
      queryClient.invalidateQueries({ type: 'all', stale: true })
    },
    
    /**
     * Optimize cache by removing unused queries
     */
    optimizeCache: () => {
      queryClient.getQueryCache().clear()
      // Re-initialize the unified system
      initializeUnifiedQuerySystem()
    }
  }
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize the unified query key system
 * Call this in your app's root component or initialization
 */
export function initializeQueryKeys() {
  return initializeUnifiedQuerySystem()
}

// Auto-initialize on import (for convenience)
if (typeof window !== 'undefined') {
  // Only initialize in browser environment
  getUnifiedQueryKeys()
}