/**
 * Intelligent Cache Invalidation Engine
 * 
 * Provides relationship-aware cache invalidation that understands entity
 * dependencies and automatically invalidates related data when entities change.
 */

import { QueryClient } from '@tanstack/react-query'

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface EntityRelationship {
  entity: string
  related: string[]
  bidirectional?: boolean
  fields?: string[]
  invalidationStrategy?: 'immediate' | 'delayed' | 'smart'
}

export interface InvalidationRule {
  entity: string
  operation: 'create' | 'update' | 'delete' | '*'
  targets: InvalidationTarget[]
  condition?: (data: any) => boolean
  delay?: number
}

export interface InvalidationTarget {
  queryKey: string[]
  strategy: 'invalidate' | 'remove' | 'update' | 'refresh'
  exact?: boolean
  condition?: (queryData: any) => boolean
}

export interface InvalidationEvent {
  entity: string
  operation: string
  entityId?: number | string
  data?: any
  timestamp: number
  triggeredRules: string[]
  targetsInvalidated: number
}

export interface InvalidationStats {
  totalInvalidations: number
  ruleInvalidations: Record<string, number>
  entityInvalidations: Record<string, number>
  averageTargetsPerInvalidation: number
  lastInvalidation?: InvalidationEvent
}

// ============================================================================
// Entity Relationship Definitions
// ============================================================================

const ENTITY_RELATIONSHIPS: EntityRelationship[] = [
  // Project relationships
  {
    entity: 'projects',
    related: ['tickets', 'prompts', 'agents', 'queues', 'project_files'],
    bidirectional: false,
    invalidationStrategy: 'immediate'
  },
  
  // Ticket relationships
  {
    entity: 'tickets',
    related: ['projects', 'tasks', 'queue_items'],
    bidirectional: true,
    fields: ['projectId', 'status'],
    invalidationStrategy: 'smart'
  },
  
  // Chat relationships
  {
    entity: 'chats',
    related: ['chat_messages', 'projects'],
    bidirectional: false,
    invalidationStrategy: 'immediate'
  },
  
  // Queue relationships
  {
    entity: 'queues',
    related: ['projects', 'queue_items', 'queue_stats'],
    bidirectional: true,
    fields: ['projectId'],
    invalidationStrategy: 'immediate'
  },
  
  // Prompt relationships
  {
    entity: 'prompts',
    related: ['projects'],
    bidirectional: true,
    fields: ['projectId'],
    invalidationStrategy: 'smart'
  },
  
  // Agent relationships
  {
    entity: 'agents',
    related: ['projects'],
    bidirectional: true,
    fields: ['projectId'],
    invalidationStrategy: 'smart'
  },
  
  // Task relationships
  {
    entity: 'tasks',
    related: ['tickets'],
    bidirectional: true,
    fields: ['ticketId'],
    invalidationStrategy: 'immediate'
  }
]

// ============================================================================
// Invalidation Rules
// ============================================================================

const INVALIDATION_RULES: InvalidationRule[] = [
  // Project updates invalidate all related data
  {
    entity: 'projects',
    operation: 'update',
    targets: [
      { queryKey: ['projects'], strategy: 'invalidate', exact: false },
      { queryKey: ['tickets'], strategy: 'invalidate', exact: false },
      { queryKey: ['prompts'], strategy: 'invalidate', exact: false },
      { queryKey: ['agents'], strategy: 'invalidate', exact: false },
      { queryKey: ['queues'], strategy: 'invalidate', exact: false }
    ]
  },
  
  // Project deletion removes all related queries
  {
    entity: 'projects',
    operation: 'delete',
    targets: [
      { queryKey: ['projects'], strategy: 'invalidate', exact: false },
      { queryKey: ['tickets'], strategy: 'remove', exact: false },
      { queryKey: ['prompts'], strategy: 'remove', exact: false },
      { queryKey: ['agents'], strategy: 'remove', exact: false },
      { queryKey: ['queues'], strategy: 'remove', exact: false }
    ]
  },
  
  // Ticket status changes affect project and queue stats
  {
    entity: 'tickets',
    operation: 'update',
    condition: (data) => data && ('status' in data || 'projectId' in data),
    targets: [
      { queryKey: ['tickets'], strategy: 'invalidate', exact: false },
      { queryKey: ['projects'], strategy: 'invalidate', exact: false },
      { queryKey: ['queues'], strategy: 'invalidate', exact: false },
      { queryKey: ['queue_stats'], strategy: 'invalidate', exact: false }
    ]
  },
  
  // Ticket creation affects lists and stats
  {
    entity: 'tickets',
    operation: 'create',
    targets: [
      { queryKey: ['tickets', 'list'], strategy: 'invalidate', exact: false },
      { queryKey: ['projects'], strategy: 'invalidate', exact: false },
      { queryKey: ['queue_stats'], strategy: 'invalidate', exact: false }
    ]
  },
  
  // Chat message creation only invalidates message lists
  {
    entity: 'chat_messages',
    operation: 'create',
    targets: [
      { queryKey: ['chat_messages'], strategy: 'invalidate', exact: false },
      { queryKey: ['chats'], strategy: 'refresh', exact: false }
    ]
  },
  
  // Queue item changes affect queue stats
  {
    entity: 'queue_items',
    operation: '*',
    targets: [
      { queryKey: ['queue_items'], strategy: 'invalidate', exact: false },
      { queryKey: ['queue_stats'], strategy: 'invalidate', exact: false },
      { queryKey: ['queues'], strategy: 'refresh', exact: false }
    ]
  },
  
  // Agent/Prompt changes only affect their own queries and projects
  {
    entity: 'prompts',
    operation: '*',
    targets: [
      { queryKey: ['prompts'], strategy: 'invalidate', exact: false },
      { queryKey: ['projects'], strategy: 'refresh', exact: false }
    ]
  },
  
  {
    entity: 'agents',
    operation: '*',
    targets: [
      { queryKey: ['agents'], strategy: 'invalidate', exact: false },
      { queryKey: ['projects'], strategy: 'refresh', exact: false }
    ]
  }
]

// ============================================================================
// Cache Invalidation Engine
// ============================================================================

export class InvalidationEngine {
  private stats: InvalidationStats = {
    totalInvalidations: 0,
    ruleInvalidations: {},
    entityInvalidations: {},
    averageTargetsPerInvalidation: 0
  }
  
  private eventHistory: InvalidationEvent[] = []
  private readonly maxHistorySize = 100

  // ============================================================================
  // Main Invalidation Methods
  // ============================================================================

  /**
   * Invalidate cache based on entity changes with relationship awareness
   */
  invalidateWithRelationships(
    queryClient: QueryClient,
    entity: string,
    operation: 'create' | 'update' | 'delete' = 'update',
    entityId?: number | string,
    data?: any
  ): InvalidationEvent {
    const startTime = Date.now()
    const triggeredRules: string[] = []
    let targetsInvalidated = 0

    // Find applicable rules
    const applicableRules = this.findApplicableRules(entity, operation, data)
    
    // Execute each rule
    for (const rule of applicableRules) {
      const ruleId = `${rule.entity}:${rule.operation}`
      triggeredRules.push(ruleId)
      
      for (const target of rule.targets) {
        if (target.condition && !target.condition(data)) {
          continue
        }

        this.executeInvalidationTarget(queryClient, target, entityId)
        targetsInvalidated++
      }
      
      // Update rule stats
      this.stats.ruleInvalidations[ruleId] = (this.stats.ruleInvalidations[ruleId] || 0) + 1
    }

    // Handle relationship-based invalidation
    const relationshipTargets = this.getRelationshipTargets(entity, operation, entityId)
    for (const target of relationshipTargets) {
      this.executeInvalidationTarget(queryClient, target, entityId)
      targetsInvalidated++
    }

    // Create invalidation event
    const event: InvalidationEvent = {
      entity,
      operation,
      entityId,
      data,
      timestamp: startTime,
      triggeredRules,
      targetsInvalidated
    }

    // Update stats
    this.updateStats(entity, targetsInvalidated, event)

    return event
  }

  /**
   * Smart invalidation that analyzes query dependencies
   */
  smartInvalidate(
    queryClient: QueryClient,
    entity: string,
    entityId?: number | string,
    options: {
      includeRelated?: boolean
      maxDepth?: number
      onlyStale?: boolean
    } = {}
  ) {
    const { includeRelated = true, maxDepth = 2, onlyStale = false } = options

    // Get all queries related to this entity
    const entityQueries = this.findRelatedQueries(queryClient, entity, entityId)
    
    // Filter by staleness if requested
    const queriesToInvalidate = onlyStale 
      ? entityQueries.filter(query => query.isStale())
      : entityQueries

    // Invalidate queries
    queriesToInvalidate.forEach(query => {
      queryClient.invalidateQueries({ queryKey: query.queryKey })
    })

    // Handle related entities if requested
    if (includeRelated && maxDepth > 0) {
      const relationships = this.getEntityRelationships(entity)
      
      for (const related of relationships) {
        this.smartInvalidate(queryClient, related, entityId, {
          includeRelated: false,
          maxDepth: maxDepth - 1,
          onlyStale
        })
      }
    }

    return queriesToInvalidate.length
  }

  /**
   * Batch invalidation for multiple entities
   */
  batchInvalidate(
    queryClient: QueryClient,
    operations: Array<{
      entity: string
      operation?: 'create' | 'update' | 'delete'
      entityId?: number | string
      data?: any
    }>
  ) {
    const events: InvalidationEvent[] = []
    
    // Group operations by entity to optimize
    const groupedOps = operations.reduce((acc, op) => {
      if (!acc[op.entity]) acc[op.entity] = []
      acc[op.entity].push(op)
      return acc
    }, {} as Record<string, typeof operations>)

    // Execute invalidations
    for (const [entity, ops] of Object.entries(groupedOps)) {
      for (const op of ops) {
        const event = this.invalidateWithRelationships(
          queryClient,
          op.entity,
          op.operation || 'update',
          op.entityId,
          op.data
        )
        events.push(event)
      }
    }

    return events
  }

  // ============================================================================
  // Rule Processing
  // ============================================================================

  private findApplicableRules(
    entity: string,
    operation: string,
    data?: any
  ): InvalidationRule[] {
    return INVALIDATION_RULES.filter(rule => {
      // Check entity match
      if (rule.entity !== entity) return false
      
      // Check operation match
      if (rule.operation !== '*' && rule.operation !== operation) return false
      
      // Check condition if present
      if (rule.condition && !rule.condition(data)) return false
      
      return true
    })
  }

  private executeInvalidationTarget(
    queryClient: QueryClient,
    target: InvalidationTarget,
    entityId?: number | string
  ) {
    // Build query key with entity ID if provided
    let queryKey = [...target.queryKey]
    if (entityId && !target.exact) {
      // For non-exact matches, we might want to include the entity ID
      if (queryKey[1] === 'detail') {
        queryKey = [queryKey[0], queryKey[1], entityId.toString()]
      }
    }

    switch (target.strategy) {
      case 'invalidate':
        queryClient.invalidateQueries({ 
          queryKey, 
          exact: target.exact || false 
        })
        break
        
      case 'remove':
        queryClient.removeQueries({ 
          queryKey, 
          exact: target.exact || false 
        })
        break
        
      case 'refresh':
        queryClient.refetchQueries({ 
          queryKey, 
          exact: target.exact || false 
        })
        break
        
      case 'update':
        // This would require more sophisticated logic to update data
        // For now, we'll treat it as invalidate
        queryClient.invalidateQueries({ 
          queryKey, 
          exact: target.exact || false 
        })
        break
    }
  }

  // ============================================================================
  // Relationship Handling
  // ============================================================================

  private getEntityRelationships(entity: string): string[] {
    const relationship = ENTITY_RELATIONSHIPS.find(rel => rel.entity === entity)
    return relationship ? relationship.related : []
  }

  private getRelationshipTargets(
    entity: string,
    operation: string,
    entityId?: number | string
  ): InvalidationTarget[] {
    const relationships = this.getEntityRelationships(entity)
    const targets: InvalidationTarget[] = []

    for (const related of relationships) {
      // Determine invalidation strategy based on relationship
      const relationship = ENTITY_RELATIONSHIPS.find(rel => rel.entity === entity)
      const strategy = relationship?.invalidationStrategy || 'invalidate'

      if (strategy === 'immediate') {
        targets.push({
          queryKey: [related],
          strategy: 'invalidate',
          exact: false
        })
      } else if (strategy === 'smart') {
        // Only invalidate if there are field dependencies
        targets.push({
          queryKey: [related, 'list'],
          strategy: 'invalidate',
          exact: false
        })
      }
    }

    return targets
  }

  private findRelatedQueries(
    queryClient: QueryClient,
    entity: string,
    entityId?: number | string
  ) {
    const cache = queryClient.getQueryCache()
    return cache.getAll().filter(query => {
      const queryKey = query.queryKey
      if (!Array.isArray(queryKey) || queryKey.length === 0) return false
      
      // Direct entity match
      if (queryKey[0] === entity) return true
      
      // Related entity match
      const relationships = this.getEntityRelationships(entity)
      return relationships.includes(queryKey[0] as string)
    })
  }

  // ============================================================================
  // Statistics and Analytics
  // ============================================================================

  private updateStats(entity: string, targetsInvalidated: number, event: InvalidationEvent) {
    this.stats.totalInvalidations++
    this.stats.entityInvalidations[entity] = (this.stats.entityInvalidations[entity] || 0) + 1
    
    // Update average
    const total = this.stats.totalInvalidations
    const currentAvg = this.stats.averageTargetsPerInvalidation
    this.stats.averageTargetsPerInvalidation = 
      (currentAvg * (total - 1) + targetsInvalidated) / total
    
    this.stats.lastInvalidation = event
    
    // Add to history
    this.eventHistory.push(event)
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift()
    }
  }

  getStats(): InvalidationStats {
    return { ...this.stats }
  }

  getEventHistory(): InvalidationEvent[] {
    return [...this.eventHistory]
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get cache efficiency metrics
   */
  getCacheEfficiency(queryClient: QueryClient) {
    const cache = queryClient.getQueryCache()
    const queries = cache.getAll()
    
    return {
      totalQueries: queries.length,
      staleQueries: queries.filter(q => q.isStale()).length,
      errorQueries: queries.filter(q => q.state.status === 'error').length,
      successQueries: queries.filter(q => q.state.status === 'success').length,
      stalenessRatio: queries.filter(q => q.isStale()).length / queries.length
    }
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalInvalidations: 0,
      ruleInvalidations: {},
      entityInvalidations: {},
      averageTargetsPerInvalidation: 0
    }
    this.eventHistory = []
  }
}

// ============================================================================
// Global Invalidation Engine Instance
// ============================================================================

export const globalInvalidationEngine = new InvalidationEngine()

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Enhanced version of the invalidateWithRelationships function
 */
export function invalidateWithRelationships(
  queryClient: QueryClient,
  entity: string,
  operation: 'create' | 'update' | 'delete' = 'update',
  entityId?: number | string,
  data?: any
) {
  return globalInvalidationEngine.invalidateWithRelationships(
    queryClient,
    entity,
    operation,
    entityId,
    data
  )
}

/**
 * Smart invalidation for performance-critical scenarios
 */
export function smartInvalidate(
  queryClient: QueryClient,
  entity: string,
  entityId?: number | string,
  options?: {
    includeRelated?: boolean
    maxDepth?: number
    onlyStale?: boolean
  }
) {
  return globalInvalidationEngine.smartInvalidate(queryClient, entity, entityId, options)
}

/**
 * Batch invalidation for multiple operations
 */
export function batchInvalidate(
  queryClient: QueryClient,
  operations: Array<{
    entity: string
    operation?: 'create' | 'update' | 'delete'
    entityId?: number | string
    data?: any
  }>
) {
  return globalInvalidationEngine.batchInvalidate(queryClient, operations)
}

// ============================================================================
// Export Types
// ============================================================================

// Types already declared above, no need to re-export
// export type {
//   EntityRelationship,
//   InvalidationRule,
//   InvalidationTarget,
//   InvalidationEvent,
//   InvalidationStats
// }