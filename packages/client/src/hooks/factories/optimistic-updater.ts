/**
 * Optimistic Updater Factory
 * Creates optimistic update patterns for instant UI feedback
 */

import { type QueryClient } from '@tanstack/react-query'
import type { ApiError } from '@promptliano/shared'

// ============================================================================
// Types
// ============================================================================

export interface OptimisticContext<T = unknown> {
  previousData: T
  queryKey: readonly unknown[]
  timestamp: number
}

export interface OptimisticUpdaterConfig<TEntity, TCreate = any, TUpdate = any> {
  queryClient: QueryClient
  queryKeys: {
    all: readonly string[]
    list: (params?: any) => readonly unknown[]
    detail: (id: number) => readonly unknown[]
  }
  generateTempId?: () => string | number
  mergeStrategy?: 'prepend' | 'append' | 'smart'
}

// ============================================================================
// Main Factory
// ============================================================================

export function createOptimisticUpdater<
  TEntity extends { id: number | string },
  TCreate = Omit<TEntity, 'id'>,
  TUpdate = Partial<Omit<TEntity, 'id'>>
>(config: OptimisticUpdaterConfig<TEntity, TCreate, TUpdate>) {
  const {
    queryClient,
    queryKeys,
    generateTempId = () => -Date.now(),
    mergeStrategy = 'prepend'
  } = config

  // ============================================================================
  // Create Operations
  // ============================================================================

  async function optimisticCreate(
    newData: TCreate,
    additionalFields?: Partial<TEntity>
  ): Promise<OptimisticContext<TEntity[]>> {
    // Cancel any outgoing refetches
    await queryClient.cancelQueries({ queryKey: queryKeys.all })

    // Get all list queries
    const listQueries = queryClient.getQueriesData<TEntity[]>({
      queryKey: queryKeys.all,
      exact: false
    })

    // Save previous data
    const previousData = listQueries.map(([key, data]) => ({ key, data }))

    // Create optimistic entity
    const tempId = generateTempId()
    const optimisticEntity: TEntity = {
      ...newData,
      ...additionalFields,
      id: tempId,
      created: Date.now(),
      updated: Date.now()
    } as TEntity

    // Update all list caches
    listQueries.forEach(([queryKey, oldData]) => {
      if (oldData) {
        const newData = mergeStrategy === 'prepend'
          ? [optimisticEntity, ...oldData]
          : mergeStrategy === 'append'
          ? [...oldData, optimisticEntity]
          : smartMerge(oldData, optimisticEntity)

        queryClient.setQueryData(queryKey, newData)
      }
    })

    return {
      previousData: previousData as any,
      queryKey: queryKeys.all,
      timestamp: Date.now()
    }
  }

  // ============================================================================
  // Update Operations
  // ============================================================================

  async function optimisticUpdate(
    id: number | string,
    updates: TUpdate,
    additionalFields?: Partial<TEntity>
  ): Promise<OptimisticContext<any>> {
    // Cancel queries for this entity
    await queryClient.cancelQueries({ queryKey: queryKeys.detail(id as number) })
    await queryClient.cancelQueries({ queryKey: queryKeys.all })

    // Save all affected data
    const detailData = queryClient.getQueryData<TEntity>(queryKeys.detail(id as number))
    const listQueries = queryClient.getQueriesData<TEntity[]>({
      queryKey: queryKeys.all,
      exact: false
    })

    const previousData = {
      detail: detailData,
      lists: listQueries.map(([key, data]) => ({ key, data }))
    }

    // Create updated entity
    const updatedEntity = detailData
      ? {
          ...detailData,
          ...updates,
          ...additionalFields,
          updated: Date.now()
        } as TEntity
      : null

    if (updatedEntity) {
      // Update detail cache
      queryClient.setQueryData(queryKeys.detail(id as number), updatedEntity)

      // Update all list caches
      listQueries.forEach(([queryKey, oldData]) => {
        if (oldData) {
          const newData = oldData.map(item =>
            item.id === id ? updatedEntity : item
          )
          queryClient.setQueryData(queryKey, newData)
        }
      })
    }

    return {
      previousData,
      queryKey: queryKeys.detail(id as number),
      timestamp: Date.now()
    }
  }

  // ============================================================================
  // Delete Operations
  // ============================================================================

  async function optimisticDelete(
    id: number | string,
    strategy: 'remove' | 'mark' | 'hide' = 'remove'
  ): Promise<OptimisticContext<any>> {
    // Cancel queries
    await queryClient.cancelQueries({ queryKey: queryKeys.all })

    // Save previous data
    const detailData = queryClient.getQueryData<TEntity>(queryKeys.detail(id as number))
    const listQueries = queryClient.getQueriesData<TEntity[]>({
      queryKey: queryKeys.all,
      exact: false
    })

    const previousData = {
      detail: detailData,
      lists: listQueries.map(([key, data]) => ({ key, data }))
    }

    // Apply deletion strategy
    if (strategy === 'remove') {
      // Remove from all lists
      listQueries.forEach(([queryKey, oldData]) => {
        if (oldData) {
          const newData = oldData.filter(item => item.id !== id)
          queryClient.setQueryData(queryKey, newData)
        }
      })
      // Remove detail query
      queryClient.removeQueries({ queryKey: queryKeys.detail(id as number) })
    } else if (strategy === 'mark') {
      // Mark as deleted in all caches
      const markedEntity = detailData
        ? { ...detailData, deleted: true, deletedAt: Date.now() } as TEntity
        : null

      if (markedEntity) {
        queryClient.setQueryData(queryKeys.detail(id as number), markedEntity)

        listQueries.forEach(([queryKey, oldData]) => {
          if (oldData) {
            const newData = oldData.map(item =>
              item.id === id ? markedEntity : item
            )
            queryClient.setQueryData(queryKey, newData)
          }
        })
      }
    } else if (strategy === 'hide') {
      // Just hide from lists but keep in detail cache
      listQueries.forEach(([queryKey, oldData]) => {
        if (oldData) {
          const newData = oldData.filter(item => item.id !== id)
          queryClient.setQueryData(queryKey, newData)
        }
      })
    }

    return {
      previousData,
      queryKey: queryKeys.all,
      timestamp: Date.now()
    }
  }

  // ============================================================================
  // Batch Operations
  // ============================================================================

  async function optimisticBatchUpdate(
    updates: Array<{ id: number | string; data: TUpdate }>
  ): Promise<OptimisticContext<any>> {
    await queryClient.cancelQueries({ queryKey: queryKeys.all })

    const listQueries = queryClient.getQueriesData<TEntity[]>({
      queryKey: queryKeys.all,
      exact: false
    })

    const previousData = listQueries.map(([key, data]) => ({ key, data }))

    // Create update map for efficiency
    const updateMap = new Map(
      updates.map(({ id, data }) => [id, data])
    )

    // Update all list caches
    listQueries.forEach(([queryKey, oldData]) => {
      if (oldData) {
        const newData = oldData.map(item => {
          const update = updateMap.get(item.id)
          return update
            ? { ...item, ...update, updated: Date.now() } as TEntity
            : item
        })
        queryClient.setQueryData(queryKey, newData)
      }
    })

    // Update individual detail caches
    updates.forEach(({ id, data }) => {
      const detailData = queryClient.getQueryData<TEntity>(queryKeys.detail(id as number))
      if (detailData) {
        queryClient.setQueryData(
          queryKeys.detail(id as number),
          { ...detailData, ...data, updated: Date.now() }
        )
      }
    })

    return {
      previousData: previousData as any,
      queryKey: queryKeys.all,
      timestamp: Date.now()
    }
  }

  // ============================================================================
  // Reorder Operations
  // ============================================================================

  async function optimisticReorder(
    items: TEntity[],
    orderField: keyof TEntity = 'order' as keyof TEntity
  ): Promise<OptimisticContext<TEntity[]>> {
    await queryClient.cancelQueries({ queryKey: queryKeys.all })

    const listQueries = queryClient.getQueriesData<TEntity[]>({
      queryKey: queryKeys.all,
      exact: false
    })

    const previousData = listQueries.map(([key, data]) => ({ key, data }))

    // Create reorder map
    const orderMap = new Map(
      items.map((item, index) => [item.id, index])
    )

    // Update all list caches
    listQueries.forEach(([queryKey, oldData]) => {
      if (oldData) {
        const newData = [...oldData].sort((a, b) => {
          const orderA = orderMap.get(a.id) ?? Infinity
          const orderB = orderMap.get(b.id) ?? Infinity
          return orderA - orderB
        })
        queryClient.setQueryData(queryKey, newData)
      }
    })

    return {
      previousData: previousData as any,
      queryKey: queryKeys.all,
      timestamp: Date.now()
    }
  }

  // ============================================================================
  // Rollback Operations
  // ============================================================================

  function rollback(context: OptimisticContext<any>) {
    if (!context) return

    // Handle different context types
    if ('detail' in context.previousData && 'lists' in context.previousData) {
      // Update context
      if (context.previousData.detail !== undefined) {
        const id = (context.previousData.detail as TEntity)?.id
        if (id) {
          queryClient.setQueryData(
            queryKeys.detail(id as number),
            context.previousData.detail
          )
        }
      }

      context.previousData.lists.forEach(({ key, data }: any) => {
        if (data !== undefined) {
          queryClient.setQueryData(key, data)
        }
      })
    } else if (Array.isArray(context.previousData)) {
      // List context
      context.previousData.forEach(({ key, data }: any) => {
        if (data !== undefined) {
          queryClient.setQueryData(key, data)
        }
      })
    } else {
      // Simple context
      queryClient.setQueryData(context.queryKey, context.previousData)
    }
  }

  // ============================================================================
  // Utility Functions
  // ============================================================================

  function smartMerge(oldData: TEntity[], newEntity: TEntity): TEntity[] {
    // Smart merge based on created timestamp or other criteria
    const insertIndex = oldData.findIndex(item => {
      if ('created' in item && 'created' in newEntity) {
        return (item as any).created < (newEntity as any).created
      }
      return false
    })

    if (insertIndex === -1) {
      return [newEntity, ...oldData]
    }

    const result = [...oldData]
    result.splice(insertIndex, 0, newEntity)
    return result
  }

  return {
    optimisticCreate,
    optimisticUpdate,
    optimisticDelete,
    optimisticBatchUpdate,
    optimisticReorder,
    rollback,
    
    // Expose individual operations for custom use
    cancelQueries: (key?: readonly unknown[]) => 
      queryClient.cancelQueries({ queryKey: key || queryKeys.all }),
    invalidateQueries: (key?: readonly unknown[]) =>
      queryClient.invalidateQueries({ queryKey: key || queryKeys.all }),
    setQueryData: <T>(key: readonly unknown[], data: T) =>
      queryClient.setQueryData(key, data),
    getQueryData: <T>(key: readonly unknown[]) =>
      queryClient.getQueryData<T>(key)
  }
}

// ============================================================================
// Standalone Optimistic Helpers
// ============================================================================

export function createOptimisticCreate<T extends { id: number | string }>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  createFn: (data: Partial<T>) => T
) {
  return async (data: Partial<T>): Promise<{ previousData: T[]; optimisticData: T }> => {
    await queryClient.cancelQueries({ queryKey })
    
    const previousData = queryClient.getQueryData<T[]>(queryKey) || []
    const optimisticData = createFn(data)
    
    queryClient.setQueryData(queryKey, [optimisticData, ...previousData])
    
    return { previousData, optimisticData }
  }
}

export function createOptimisticUpdate<T extends { id: number | string }>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  updateFn: (old: T, updates: Partial<T>) => T
) {
  return async (id: number | string, updates: Partial<T>): Promise<{ previousData: T[]; updatedData: T | null }> => {
    await queryClient.cancelQueries({ queryKey })
    
    const previousData = queryClient.getQueryData<T[]>(queryKey) || []
    const itemToUpdate = previousData.find(item => item.id === id)
    
    if (!itemToUpdate) {
      return { previousData, updatedData: null }
    }
    
    const updatedData = updateFn(itemToUpdate, updates)
    const newData = previousData.map(item => item.id === id ? updatedData : item)
    
    queryClient.setQueryData(queryKey, newData)
    
    return { previousData, updatedData }
  }
}

export function createOptimisticDelete<T extends { id: number | string }>(
  queryClient: QueryClient,
  queryKey: readonly unknown[]
) {
  return async (id: number | string): Promise<{ previousData: T[] }> => {
    await queryClient.cancelQueries({ queryKey })
    
    const previousData = queryClient.getQueryData<T[]>(queryKey) || []
    const newData = previousData.filter(item => item.id !== id)
    
    queryClient.setQueryData(queryKey, newData)
    
    return { previousData }
  }
}

export function createOptimisticReorder<T extends { id: number | string; order?: number }>(
  queryClient: QueryClient,
  queryKey: readonly unknown[]
) {
  return async (items: T[]): Promise<{ previousData: T[] }> => {
    await queryClient.cancelQueries({ queryKey })
    
    const previousData = queryClient.getQueryData<T[]>(queryKey) || []
    
    // Create order map
    const orderMap = new Map(items.map((item, index) => [item.id, index]))
    
    // Sort based on new order
    const newData = [...previousData].sort((a, b) => {
      const orderA = orderMap.get(a.id) ?? Infinity
      const orderB = orderMap.get(b.id) ?? Infinity
      return orderA - orderB
    })
    
    queryClient.setQueryData(queryKey, newData)
    
    return { previousData }
  }
}