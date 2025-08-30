/**
 * Composite Hooks Factory - Cross-domain operations and aggregations
 * 
 * This factory creates hooks for:
 * - Cross-domain data fetching
 * - Aggregate operations across entities
 * - Related entity loading with cascade
 * - Parent-child relationships
 * - Many-to-many associations
 */

import {
  useQuery,
  useQueries,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseQueryResult,
  type UseMutationOptions,
  type UseMutationResult
} from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useApiClient } from '../api/use-api-client'
import { createQueryKeys, createCompositeQueryKeys, type QueryKeyFactory } from './query-key-factory'

/**
 * Relationship type
 */
export enum RelationType {
  ONE_TO_ONE = 'one-to-one',
  ONE_TO_MANY = 'one-to-many',
  MANY_TO_ONE = 'many-to-one',
  MANY_TO_MANY = 'many-to-many'
}

/**
 * Cascade operation
 */
export enum CascadeOperation {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  ALL = 'all'
}

/**
 * Entity relationship configuration
 */
export interface EntityRelationship {
  /**
   * Related entity name
   */
  entity: string
  
  /**
   * Relationship type
   */
  type: RelationType
  
  /**
   * Foreign key field
   */
  foreignKey?: string
  
  /**
   * Join table for many-to-many
   */
  joinTable?: string
  
  /**
   * Cascade operations
   */
  cascade?: CascadeOperation[]
  
  /**
   * Custom fetcher
   */
  fetcher?: (parentId: number | string) => Promise<any>
}

/**
 * Composite hook configuration
 */
export interface CompositeConfig {
  /**
   * Primary entity configuration
   */
  primary: {
    entityName: string
    clientPath: string
    queryKeys?: QueryKeyFactory
  }
  
  /**
   * Related entities
   */
  relationships?: Record<string, EntityRelationship>
  
  /**
   * Aggregation queries
   */
  aggregations?: {
    [key: string]: {
      entities: string[]
      compute: (data: Record<string, any[]>) => any
    }
  }
  
  /**
   * Cross-domain operations
   */
  crossDomain?: {
    enabled?: boolean
    domains?: string[]
  }
}

/**
 * Composite hooks return type
 */
export interface CompositeHooks<TPrimary> {
  // Load entity with all relationships
  useWithRelations: (
    id: number | string,
    relations?: string[],
    options?: UseQueryOptions<any>
  ) => {
    primary: UseQueryResult<TPrimary, Error>
    relations: Record<string, UseQueryResult<any, Error>>
    isLoading: boolean
    error: Error | null
  }
  
  // Cross-domain query
  useCrossDomain: (
    params?: any,
    domains?: string[]
  ) => {
    data: Record<string, any[]>
    isLoading: boolean
    errors: Record<string, Error>
  }
  
  // Aggregate data from multiple sources
  useAggregation: (
    aggregationKey: string,
    params?: any
  ) => UseQueryResult<any, Error>
  
  // Parent-child operations
  useParentChild: (
    parentId: number | string,
    childEntity: string
  ) => {
    parent: UseQueryResult<TPrimary, Error>
    children: UseQueryResult<any[], Error>
    addChild: UseMutationResult<any, Error, any>
    removeChild: UseMutationResult<void, Error, number | string>
    updateChild: UseMutationResult<any, Error, { id: number | string; data: any }>
  }
  
  // Many-to-many associations
  useManyToMany: <TRelated = any>(
    entityId: number | string,
    relatedEntity: string
  ) => {
    entity: UseQueryResult<TPrimary, Error>
    related: UseQueryResult<TRelated[], Error>
    associate: UseMutationResult<void, Error, number | string>
    dissociate: UseMutationResult<void, Error, number | string>
    syncAssociations: UseMutationResult<void, Error, (number | string)[]>
  }
  
  // Cascade operations
  useCascade: () => {
    cascadeCreate: (data: any, relations?: Record<string, any[]>) => Promise<any>
    cascadeUpdate: (id: number | string, data: any, relations?: Record<string, any>) => Promise<any>
    cascadeDelete: (id: number | string) => Promise<void>
  }
  
  // Bulk relationship operations
  useBulkRelations: () => {
    attachMany: (parentId: number | string, childIds: (number | string)[], relation: string) => Promise<void>
    detachMany: (parentId: number | string, childIds: (number | string)[], relation: string) => Promise<void>
    syncRelations: (parentId: number | string, relations: Record<string, (number | string)[]>) => Promise<void>
  }
  
  // Graph operations
  useGraph: (
    rootId: number | string,
    depth?: number
  ) => {
    graph: any
    isLoading: boolean
    expandNode: (nodeId: number | string) => void
    collapseNode: (nodeId: number | string) => void
  }
}

/**
 * Create composite hooks for cross-domain operations
 */
export function createCompositeHooks<TPrimary extends { id: number | string }>(
  config: CompositeConfig
): CompositeHooks<TPrimary> {
  const { primary, relationships = {}, aggregations = {}, crossDomain } = config
  
  // Create query keys
  const PRIMARY_KEYS = primary.queryKeys || createQueryKeys(primary.clientPath)
  const COMPOSITE_KEYS = createCompositeQueryKeys()

  /**
   * Load entity with all its relationships
   */
  const useWithRelations = (
    id: number | string,
    relations: string[] = Object.keys(relationships),
    options?: UseQueryOptions<any>
  ) => {
    const client = useApiClient()
    const queryClient = useQueryClient()

    // Fetch primary entity
    const primaryQuery = useQuery({
      queryKey: PRIMARY_KEYS.detail(id),
      queryFn: async () => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[primary.clientPath]
        const response = await api.get(id)
        return response.data || response
      },
      enabled: !!id && !!client,
      ...options
    })

    // Fetch related entities
    const relationQueries = useQueries({
      queries: relations.map(relationName => {
        const relationship = relationships[relationName]
        if (!relationship) {
          return {
            queryKey: ['unknown', relationName],
            queryFn: async () => null,
            enabled: false
          }
        }

        return {
          queryKey: [...PRIMARY_KEYS.detail(id), 'relation', relationName],
          queryFn: async () => {
            if (!client) throw new Error('API client not initialized')
            
            // Use custom fetcher if provided
            if (relationship.fetcher) {
              return await relationship.fetcher(id)
            }
            
            // Default fetching based on relationship type
            const relatedApi = (client as any)[relationship.entity]
            
            switch (relationship.type) {
              case RelationType.ONE_TO_ONE:
              case RelationType.MANY_TO_ONE:
                return await relatedApi.getByForeignKey(relationship.foreignKey || `${primary.entityName}_id`, id)
              
              case RelationType.ONE_TO_MANY:
                return await relatedApi.list({ [relationship.foreignKey || `${primary.entityName}_id`]: id })
              
              case RelationType.MANY_TO_MANY:
                return await relatedApi.getByAssociation(primary.entityName, id)
              
              default:
                throw new Error(`Unknown relationship type: ${relationship.type}`)
            }
          },
          enabled: !!primaryQuery.data && !!client,
          staleTime: 5 * 60 * 1000
        }
      })
    })

    // Build relations object
    const relationsMap = useMemo(() => {
      const map: Record<string, UseQueryResult<any, Error>> = {}
      relations.forEach((relationName, index) => {
        map[relationName] = relationQueries[index] as UseQueryResult<any, Error>
      })
      return map
    }, [relations, relationQueries])

    // Determine overall loading state
    const isLoading = primaryQuery.isLoading || relationQueries.some(q => q.isLoading)
    
    // Collect errors
    const error = primaryQuery.error || relationQueries.find(q => q.error)?.error || null

    return {
      primary: primaryQuery,
      relations: relationsMap,
      isLoading,
      error
    }
  }

  /**
   * Cross-domain query
   */
  const useCrossDomain = (
    params?: any,
    domains: string[] = crossDomain?.domains || []
  ) => {
    const client = useApiClient()
    
    const queries = useQueries({
      queries: domains.map(domain => ({
        queryKey: COMPOSITE_KEYS.union([primary.entityName, ...domains]),
        queryFn: async () => {
          if (!client) throw new Error('API client not initialized')
          const api = (client as any)[domain]
          const response = await api.list(params)
          return response.data || response
        },
        enabled: !!client
      }))
    })

    const data = useMemo(() => {
      const result: Record<string, any[]> = {}
      domains.forEach((domain, index) => {
        result[domain] = queries[index].data || []
      })
      return result
    }, [domains, queries])

    const errors = useMemo(() => {
      const result: Record<string, Error> = {}
      domains.forEach((domain, index) => {
        if (queries[index].error) {
          result[domain] = queries[index].error as Error
        }
      })
      return result
    }, [domains, queries])

    return {
      data,
      isLoading: queries.some(q => q.isLoading),
      errors
    }
  }

  /**
   * Aggregation hook
   */
  const useAggregation = (
    aggregationKey: string,
    params?: any
  ) => {
    const client = useApiClient()
    const aggregation = aggregations[aggregationKey]
    
    if (!aggregation) {
      throw new Error(`Unknown aggregation: ${aggregationKey}`)
    }

    return useQuery({
      queryKey: COMPOSITE_KEYS.aggregate(aggregation.entities, aggregationKey),
      queryFn: async () => {
        if (!client) throw new Error('API client not initialized')
        
        // Fetch data from all entities
        const dataPromises = aggregation.entities.map(async entity => {
          const api = (client as any)[entity]
          const response = await api.list(params)
          return { entity, data: response.data || response }
        })
        
        const results = await Promise.all(dataPromises)
        
        // Build data map
        const dataMap: Record<string, any[]> = {}
        results.forEach(({ entity, data }) => {
          dataMap[entity] = data
        })
        
        // Compute aggregation
        return aggregation.compute(dataMap)
      },
      enabled: !!client,
      staleTime: 5 * 60 * 1000
    })
  }

  /**
   * Parent-child operations
   */
  const useParentChild = (
    parentId: number | string,
    childEntity: string
  ) => {
    const client = useApiClient()
    const queryClient = useQueryClient()
    const relationship = relationships[childEntity]

    // Parent query
    const parentQuery = useQuery({
      queryKey: PRIMARY_KEYS.detail(parentId),
      queryFn: async () => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[primary.clientPath]
        const response = await api.get(parentId)
        return response.data || response
      },
      enabled: !!parentId && !!client
    })

    // Children query
    const childrenQuery = useQuery({
      queryKey: [...PRIMARY_KEYS.detail(parentId), 'children', childEntity],
      queryFn: async () => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[childEntity]
        const foreignKey = relationship?.foreignKey || `${primary.entityName}_id`
        const response = await api.list({ [foreignKey]: parentId })
        return response.data || response
      },
      enabled: !!parentId && !!client
    })

    // Add child mutation
    const addChild = useMutation({
      mutationFn: async (data: any) => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[childEntity]
        const foreignKey = relationship?.foreignKey || `${primary.entityName}_id`
        const response = await api.create({ ...data, [foreignKey]: parentId })
        return response.data || response
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ 
          queryKey: [...PRIMARY_KEYS.detail(parentId), 'children', childEntity] 
        })
        toast.success(`${childEntity} added successfully`)
      }
    })

    // Remove child mutation
    const removeChild = useMutation({
      mutationFn: async (childId: number | string) => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[childEntity]
        await api.delete(childId)
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ 
          queryKey: [...PRIMARY_KEYS.detail(parentId), 'children', childEntity] 
        })
        toast.success(`${childEntity} removed successfully`)
      }
    })

    // Update child mutation
    const updateChild = useMutation({
      mutationFn: async ({ id, data }: { id: number | string; data: any }) => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[childEntity]
        const response = await api.update(id, data)
        return response.data || response
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ 
          queryKey: [...PRIMARY_KEYS.detail(parentId), 'children', childEntity] 
        })
        toast.success(`${childEntity} updated successfully`)
      }
    })

    return {
      parent: parentQuery,
      children: childrenQuery,
      addChild,
      removeChild,
      updateChild
    }
  }

  /**
   * Many-to-many associations
   */
  const useManyToMany = <TRelated = any>(
    entityId: number | string,
    relatedEntity: string
  ) => {
    const client = useApiClient()
    const queryClient = useQueryClient()
    const relationship = relationships[relatedEntity]

    // Entity query
    const entityQuery = useQuery({
      queryKey: PRIMARY_KEYS.detail(entityId),
      queryFn: async () => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[primary.clientPath]
        const response = await api.get(entityId)
        return response.data || response
      },
      enabled: !!entityId && !!client
    })

    // Related entities query
    const relatedQuery = useQuery({
      queryKey: [...PRIMARY_KEYS.detail(entityId), 'associated', relatedEntity],
      queryFn: async () => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[relatedEntity]
        
        if (relationship?.fetcher) {
          return await relationship.fetcher(entityId)
        }
        
        // Default many-to-many fetching
        const response = await api.getByAssociation(primary.entityName, entityId)
        return response.data || response
      },
      enabled: !!entityId && !!client
    })

    // Associate mutation
    const associate = useMutation({
      mutationFn: async (relatedId: number | string) => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[primary.clientPath]
        await api.associate(entityId, relatedEntity, relatedId)
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ 
          queryKey: [...PRIMARY_KEYS.detail(entityId), 'associated', relatedEntity] 
        })
        toast.success('Association created')
      }
    })

    // Dissociate mutation
    const dissociate = useMutation({
      mutationFn: async (relatedId: number | string) => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[primary.clientPath]
        await api.dissociate(entityId, relatedEntity, relatedId)
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ 
          queryKey: [...PRIMARY_KEYS.detail(entityId), 'associated', relatedEntity] 
        })
        toast.success('Association removed')
      }
    })

    // Sync associations mutation
    const syncAssociations = useMutation({
      mutationFn: async (relatedIds: (number | string)[]) => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[primary.clientPath]
        await api.syncAssociations(entityId, relatedEntity, relatedIds)
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ 
          queryKey: [...PRIMARY_KEYS.detail(entityId), 'associated', relatedEntity] 
        })
        toast.success('Associations synchronized')
      }
    })

    return {
      entity: entityQuery,
      related: relatedQuery as UseQueryResult<TRelated[], Error>,
      associate,
      dissociate,
      syncAssociations
    }
  }

  /**
   * Cascade operations
   */
  const useCascade = () => {
    const client = useApiClient()
    const queryClient = useQueryClient()

    const cascadeCreate = useCallback(async (data: any, relations?: Record<string, any[]>) => {
      if (!client) throw new Error('API client not initialized')
      
      // Create primary entity
      const primaryApi = (client as any)[primary.clientPath]
      const primaryResponse = await primaryApi.create(data)
      const primaryEntity = primaryResponse.data || primaryResponse
      
      // Create related entities
      if (relations) {
        for (const [relationName, relatedData] of Object.entries(relations)) {
          const relationship = relationships[relationName]
          if (!relationship || !relationship.cascade?.includes(CascadeOperation.CREATE)) continue
          
          const relatedApi = (client as any)[relationship.entity]
          const foreignKey = relationship.foreignKey || `${primary.entityName}_id`
          
          for (const item of relatedData) {
            await relatedApi.create({ ...item, [foreignKey]: primaryEntity.id })
          }
        }
      }
      
      queryClient.invalidateQueries({ queryKey: PRIMARY_KEYS.all })
      return primaryEntity
    }, [client, primary, relationships, queryClient, PRIMARY_KEYS])

    const cascadeUpdate = useCallback(async (
      id: number | string, 
      data: any, 
      relations?: Record<string, any>
    ) => {
      if (!client) throw new Error('API client not initialized')
      
      // Update primary entity
      const primaryApi = (client as any)[primary.clientPath]
      const primaryResponse = await primaryApi.update(id, data)
      const primaryEntity = primaryResponse.data || primaryResponse
      
      // Update related entities
      if (relations) {
        for (const [relationName, relatedUpdates] of Object.entries(relations)) {
          const relationship = relationships[relationName]
          if (!relationship || !relationship.cascade?.includes(CascadeOperation.UPDATE)) continue
          
          const relatedApi = (client as any)[relationship.entity]
          
          if (Array.isArray(relatedUpdates)) {
            for (const update of relatedUpdates) {
              await relatedApi.update(update.id, update.data)
            }
          }
        }
      }
      
      queryClient.invalidateQueries({ queryKey: PRIMARY_KEYS.detail(id) })
      return primaryEntity
    }, [client, primary, relationships, queryClient, PRIMARY_KEYS])

    const cascadeDelete = useCallback(async (id: number | string) => {
      if (!client) throw new Error('API client not initialized')
      
      // Delete related entities first (if cascade delete is enabled)
      for (const [relationName, relationship] of Object.entries(relationships)) {
        if (!relationship.cascade?.includes(CascadeOperation.DELETE)) continue
        
        const relatedApi = (client as any)[relationship.entity]
        const foreignKey = relationship.foreignKey || `${primary.entityName}_id`
        
        // Get related entities
        const relatedResponse = await relatedApi.list({ [foreignKey]: id })
        const relatedEntities = relatedResponse.data || relatedResponse
        
        // Delete them
        for (const entity of relatedEntities) {
          await relatedApi.delete(entity.id)
        }
      }
      
      // Delete primary entity
      const primaryApi = (client as any)[primary.clientPath]
      await primaryApi.delete(id)
      
      queryClient.invalidateQueries({ queryKey: PRIMARY_KEYS.all })
    }, [client, primary, relationships, queryClient, PRIMARY_KEYS])

    return {
      cascadeCreate,
      cascadeUpdate,
      cascadeDelete
    }
  }

  /**
   * Bulk relationship operations
   */
  const useBulkRelations = () => {
    const client = useApiClient()
    const queryClient = useQueryClient()

    const attachMany = useCallback(async (
      parentId: number | string,
      childIds: (number | string)[],
      relation: string
    ) => {
      if (!client) throw new Error('API client not initialized')
      
      const relationship = relationships[relation]
      if (!relationship) throw new Error(`Unknown relationship: ${relation}`)
      
      const api = (client as any)[primary.clientPath]
      
      if (relationship.type === RelationType.MANY_TO_MANY) {
        // Many-to-many: create associations
        for (const childId of childIds) {
          await api.associate(parentId, relation, childId)
        }
      } else {
        // One-to-many: update foreign keys
        const childApi = (client as any)[relationship.entity]
        const foreignKey = relationship.foreignKey || `${primary.entityName}_id`
        
        for (const childId of childIds) {
          await childApi.update(childId, { [foreignKey]: parentId })
        }
      }
      
      queryClient.invalidateQueries({ 
        queryKey: [...PRIMARY_KEYS.detail(parentId), 'relation', relation] 
      })
      
      toast.success(`Attached ${childIds.length} ${relation}`)
    }, [client, primary, relationships, queryClient, PRIMARY_KEYS])

    const detachMany = useCallback(async (
      parentId: number | string,
      childIds: (number | string)[],
      relation: string
    ) => {
      if (!client) throw new Error('API client not initialized')
      
      const relationship = relationships[relation]
      if (!relationship) throw new Error(`Unknown relationship: ${relation}`)
      
      const api = (client as any)[primary.clientPath]
      
      if (relationship.type === RelationType.MANY_TO_MANY) {
        // Many-to-many: remove associations
        for (const childId of childIds) {
          await api.dissociate(parentId, relation, childId)
        }
      } else {
        // One-to-many: clear foreign keys
        const childApi = (client as any)[relationship.entity]
        const foreignKey = relationship.foreignKey || `${primary.entityName}_id`
        
        for (const childId of childIds) {
          await childApi.update(childId, { [foreignKey]: null })
        }
      }
      
      queryClient.invalidateQueries({ 
        queryKey: [...PRIMARY_KEYS.detail(parentId), 'relation', relation] 
      })
      
      toast.success(`Detached ${childIds.length} ${relation}`)
    }, [client, primary, relationships, queryClient, PRIMARY_KEYS])

    const syncRelations = useCallback(async (
      parentId: number | string,
      relations: Record<string, (number | string)[]>
    ) => {
      if (!client) throw new Error('API client not initialized')
      
      for (const [relationName, ids] of Object.entries(relations)) {
        const relationship = relationships[relationName]
        if (!relationship) continue
        
        const api = (client as any)[primary.clientPath]
        
        if (relationship.type === RelationType.MANY_TO_MANY) {
          await api.syncAssociations(parentId, relationName, ids)
        } else {
          // For one-to-many, update foreign keys
          const childApi = (client as any)[relationship.entity]
          const foreignKey = relationship.foreignKey || `${primary.entityName}_id`
          
          // Clear existing relationships
          const existingResponse = await childApi.list({ [foreignKey]: parentId })
          const existing = existingResponse.data || existingResponse
          
          for (const entity of existing) {
            if (!ids.includes(entity.id)) {
              await childApi.update(entity.id, { [foreignKey]: null })
            }
          }
          
          // Set new relationships
          for (const childId of ids) {
            await childApi.update(childId, { [foreignKey]: parentId })
          }
        }
      }
      
      queryClient.invalidateQueries({ queryKey: PRIMARY_KEYS.detail(parentId) })
      
      toast.success('Relations synchronized')
    }, [client, primary, relationships, queryClient, PRIMARY_KEYS])

    return {
      attachMany,
      detachMany,
      syncRelations
    }
  }

  /**
   * Graph operations for traversing relationships
   */
  const useGraph = (
    rootId: number | string,
    depth: number = 2
  ) => {
    const client = useApiClient()
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
    
    const { data: graph, isLoading } = useQuery({
      queryKey: [...PRIMARY_KEYS.detail(rootId), 'graph', depth],
      queryFn: async () => {
        if (!client) throw new Error('API client not initialized')
        
        const visited = new Set<string>()
        const graph: any = { nodes: [], edges: [] }
        
        const traverse = async (entityName: string, id: number | string, level: number) => {
          const key = `${entityName}-${id}`
          if (visited.has(key) || level > depth) return
          
          visited.add(key)
          
          // Fetch entity
          const api = (client as any)[entityName]
          const response = await api.get(id)
          const entity = response.data || response
          
          // Add node
          graph.nodes.push({
            id: key,
            entity: entityName,
            data: entity,
            level
          })
          
          // Traverse relationships
          if (level < depth) {
            const entityRelationships = entityName === primary.entityName 
              ? relationships 
              : {} // Would need to define relationships for other entities
            
            for (const [relationName, relationship] of Object.entries(entityRelationships)) {
              if (relationship.fetcher) {
                const related = await relationship.fetcher(id)
                
                if (Array.isArray(related)) {
                  for (const item of related) {
                    graph.edges.push({
                      source: key,
                      target: `${relationship.entity}-${item.id}`,
                      relation: relationName
                    })
                    await traverse(relationship.entity, item.id, level + 1)
                  }
                } else if (related) {
                  graph.edges.push({
                    source: key,
                    target: `${relationship.entity}-${related.id}`,
                    relation: relationName
                  })
                  await traverse(relationship.entity, related.id, level + 1)
                }
              }
            }
          }
        }
        
        await traverse(primary.entityName, rootId, 0)
        return graph
      },
      enabled: !!client && !!rootId
    })

    const expandNode = useCallback((nodeId: number | string) => {
      setExpandedNodes(prev => new Set([...prev, nodeId.toString()]))
    }, [])

    const collapseNode = useCallback((nodeId: number | string) => {
      setExpandedNodes(prev => {
        const next = new Set(prev)
        next.delete(nodeId.toString())
        return next
      })
    }, [])

    return {
      graph: graph || { nodes: [], edges: [] },
      isLoading,
      expandNode,
      collapseNode,
      expandedNodes
    }
  }

  return {
    useWithRelations,
    useCrossDomain,
    useAggregation,
    useParentChild,
    useManyToMany,
    useCascade,
    useBulkRelations,
    useGraph
  }
}