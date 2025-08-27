/**
 * Optimistic Hooks Factory - Advanced optimistic update patterns
 * 
 * This factory creates hooks for:
 * - Optimistic updates with automatic rollback
 * - Conflict resolution for concurrent updates
 * - Temporary ID generation and mapping
 * - State snapshots and restoration
 * - Offline queue management
 */

import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
  type UseMutationResult,
  type QueryKey
} from '@tanstack/react-query'
import { useState, useRef, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { useApiClient } from '../api/use-api-client'
import { createQueryKeys, type QueryKeyFactory } from './query-key-factory'

/**
 * Optimistic update strategy
 */
export enum OptimisticStrategy {
  // Update immediately, rollback on error
  IMMEDIATE = 'immediate',
  // Update after delay, cancel if error occurs quickly
  DELAYED = 'delayed',
  // Update with conflict detection
  CONFLICT_AWARE = 'conflict-aware',
  // Queue updates for batch processing
  QUEUED = 'queued'
}

/**
 * Conflict resolution strategy
 */
export enum ConflictResolution {
  // Last write wins
  LAST_WRITE = 'last-write',
  // First write wins
  FIRST_WRITE = 'first-write',
  // Merge changes
  MERGE = 'merge',
  // Ask user
  MANUAL = 'manual'
}

/**
 * Optimistic configuration
 */
export interface OptimisticConfig<TEntity, TCreate, TUpdate> {
  /**
   * Display name for the entity
   */
  entityName: string
  
  /**
   * API client path
   */
  clientPath: string
  
  /**
   * Custom query keys
   */
  queryKeys?: QueryKeyFactory
  
  /**
   * Optimistic strategy
   */
  strategy?: OptimisticStrategy
  
  /**
   * Conflict resolution
   */
  conflictResolution?: ConflictResolution
  
  /**
   * Generate temporary ID
   */
  generateTempId?: () => string | number
  
  /**
   * Transform create data for optimistic update
   */
  transformCreate?: (data: TCreate) => TEntity
  
  /**
   * Transform update data for optimistic update
   */
  transformUpdate?: (existing: TEntity, update: TUpdate) => TEntity
  
  /**
   * Delay before applying optimistic update (ms)
   */
  delay?: number
  
  /**
   * Enable offline queue
   */
  offlineQueue?: boolean
  
  /**
   * Custom rollback handler
   */
  onRollback?: (error: Error, context: any) => void
  
  /**
   * Custom conflict handler
   */
  onConflict?: (local: TEntity, remote: TEntity) => TEntity
}

/**
 * State snapshot for rollback
 */
interface StateSnapshot<T> {
  timestamp: number
  queryKey: QueryKey
  data: T
  operation: 'create' | 'update' | 'delete'
}

/**
 * Offline queue item
 */
interface QueueItem<T = any> {
  id: string
  operation: 'create' | 'update' | 'delete'
  data: T
  timestamp: number
  retries: number
  maxRetries: number
}

/**
 * Optimistic hooks return type
 */
export interface OptimisticHooks<TEntity, TCreate, TUpdate> {
  // Optimistic create with rollback
  useOptimisticCreate: (
    options?: UseMutationOptions<TEntity, Error, TCreate>
  ) => UseMutationResult<TEntity, Error, TCreate> & {
    tempIds: Map<string, string>
    isPending: boolean
  }
  
  // Optimistic update with conflict detection
  useOptimisticUpdate: (
    options?: UseMutationOptions<TEntity, Error, { id: number | string; data: TUpdate }>
  ) => UseMutationResult<TEntity, Error, { id: number | string; data: TUpdate }> & {
    conflicts: Array<{ id: string; local: TEntity; remote: TEntity }>
    resolveConflict: (id: string, resolution: TEntity) => void
  }
  
  // Optimistic delete with undo
  useOptimisticDelete: (
    options?: UseMutationOptions<void, Error, number | string>
  ) => UseMutationResult<void, Error, number | string> & {
    undo: () => void
    canUndo: boolean
  }
  
  // Batch optimistic operations
  useOptimisticBatch: () => {
    batchCreate: (items: TCreate[]) => Promise<TEntity[]>
    batchUpdate: (updates: Array<{ id: number | string; data: TUpdate }>) => Promise<TEntity[]>
    batchDelete: (ids: (number | string)[]) => Promise<void>
    pending: number
    errors: Error[]
  }
  
  // Offline queue management
  useOfflineQueue: () => {
    queue: QueueItem[]
    addToQueue: (operation: QueueItem['operation'], data: any) => void
    processQueue: () => Promise<void>
    clearQueue: () => void
    retryFailed: () => Promise<void>
  }
  
  // State management
  useOptimisticState: () => {
    snapshots: StateSnapshot<any>[]
    createSnapshot: (queryKey: QueryKey, data: any, operation: StateSnapshot<any>['operation']) => void
    restoreSnapshot: (timestamp: number) => void
    clearSnapshots: () => void
  }
  
  // Conflict detection
  useConflictDetection: (id: number | string) => {
    hasConflict: boolean
    localVersion: TEntity | null
    remoteVersion: TEntity | null
    resolve: (resolution: ConflictResolution) => void
  }
}

/**
 * Create optimistic hooks for advanced update patterns
 */
export function createOptimisticHooks<
  TEntity extends { id: number | string; version?: number; updatedAt?: string },
  TCreate = Partial<TEntity>,
  TUpdate = Partial<TEntity>
>(config: OptimisticConfig<TEntity, TCreate, TUpdate>): OptimisticHooks<TEntity, TCreate, TUpdate> {
  const {
    entityName,
    clientPath,
    strategy = OptimisticStrategy.IMMEDIATE,
    conflictResolution = ConflictResolution.LAST_WRITE,
    generateTempId = () => `temp-${Date.now()}-${Math.random()}`,
    delay = 0,
    offlineQueue = false
  } = config

  // Create query keys
  const KEYS = config.queryKeys || createQueryKeys(clientPath)

  /**
   * Optimistic create with rollback support
   */
  const useOptimisticCreate = (
    options?: UseMutationOptions<TEntity, Error, TCreate>
  ) => {
    const queryClient = useQueryClient()
    const client = useApiClient()
    const [isPending, setIsPending] = useState(false)
    const tempIdsRef = useRef<Map<string, string>>(new Map())
    const snapshotsRef = useRef<StateSnapshot<any>[]>([])

    const mutation = useMutation({
      mutationFn: async (data: TCreate) => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[clientPath]
        if (!api?.create) throw new Error(`API client missing create method for ${clientPath}`)
        
        const response = await api.create(data)
        return response.data || response
      },
      onMutate: async (newData) => {
        setIsPending(true)
        
        // Cancel outgoing queries
        await queryClient.cancelQueries({ queryKey: KEYS.lists() })
        
        // Generate temporary ID
        const tempId = generateTempId()
        
        // Snapshot previous state
        const previousLists = queryClient.getQueriesData<TEntity[]>({ 
          queryKey: KEYS.lists() 
        })
        
        previousLists.forEach(([queryKey, data]) => {
          if (data) {
            snapshotsRef.current.push({
              timestamp: Date.now(),
              queryKey,
              data,
              operation: 'create'
            })
          }
        })
        
        // Apply optimistic update
        const optimisticEntity = config.transformCreate 
          ? config.transformCreate(newData)
          : {
              ...newData,
              id: tempId,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              version: 1
            } as TEntity
        
        // Apply delay if configured
        if (strategy === OptimisticStrategy.DELAYED && delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay))
        }
        
        // Update all list queries
        previousLists.forEach(([queryKey]) => {
          queryClient.setQueryData<TEntity[]>(queryKey, old => {
            if (!old) return [optimisticEntity]
            return [...old, optimisticEntity]
          })
        })
        
        // Store temp ID mapping
        tempIdsRef.current.set(tempId.toString(), tempId.toString())
        
        return { previousLists, tempId }
      },
      onError: (error, newData, context) => {
        setIsPending(false)
        
        // Rollback optimistic updates
        if (context?.previousLists) {
          context.previousLists.forEach(([queryKey, data]) => {
            queryClient.setQueryData(queryKey, data)
          })
        }
        
        // Clear temp ID
        if (context?.tempId) {
          tempIdsRef.current.delete(context.tempId.toString())
        }
        
        // Custom rollback handler
        config.onRollback?.(error, context)
        
        // Show error toast
        toast.error(`Failed to create ${entityName.toLowerCase()}`)
        
        // Call custom onError
        options?.onError?.(error, newData, context)
      },
      onSuccess: (data, variables, context) => {
        setIsPending(false)
        
        // Replace temp ID with real ID
        if (context?.tempId) {
          tempIdsRef.current.set(context.tempId.toString(), data.id.toString())
          
          // Update all queries with real ID
          queryClient.setQueriesData<TEntity[]>(
            { queryKey: KEYS.lists() },
            old => old?.map(item => 
              item.id === context.tempId ? data : item
            )
          )
        }
        
        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: KEYS.lists() })
        
        // Show success toast
        toast.success(`${entityName} created successfully`)
        
        // Call custom onSuccess
        options?.onSuccess?.(data, variables, context)
      },
      onSettled: () => {
        setIsPending(false)
      },
      ...options
    })

    return {
      ...mutation,
      tempIds: tempIdsRef.current,
      isPending
    }
  }

  /**
   * Optimistic update with conflict detection
   */
  const useOptimisticUpdate = (
    options?: UseMutationOptions<TEntity, Error, { id: number | string; data: TUpdate }>
  ) => {
    const queryClient = useQueryClient()
    const client = useApiClient()
    const [conflicts, setConflicts] = useState<Array<{ id: string; local: TEntity; remote: TEntity }>>([])

    const resolveConflict = useCallback((id: string, resolution: TEntity) => {
      queryClient.setQueryData(KEYS.detail(id), resolution)
      queryClient.invalidateQueries({ queryKey: KEYS.detail(id) })
      setConflicts(prev => prev.filter(c => c.id !== id))
    }, [queryClient, KEYS])

    return useMutation({
      mutationFn: async ({ id, data }) => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[clientPath]
        if (!api?.update) throw new Error(`API client missing update method for ${clientPath}`)
        
        const response = await api.update(id, data)
        return response.data || response
      },
      onMutate: async ({ id, data }) => {
        // Cancel queries
        await queryClient.cancelQueries({ queryKey: KEYS.detail(id) })
        await queryClient.cancelQueries({ queryKey: KEYS.lists() })
        
        // Snapshot current state
        const previousDetail = queryClient.getQueryData<TEntity>(KEYS.detail(id))
        const previousLists = queryClient.getQueriesData<TEntity[]>({ 
          queryKey: KEYS.lists() 
        })
        
        // Check for version conflict
        if (strategy === OptimisticStrategy.CONFLICT_AWARE && previousDetail?.version) {
          const currentVersion = previousDetail.version
          const updateVersion = (data as any).version
          
          if (updateVersion && updateVersion < currentVersion) {
            // Conflict detected
            const conflict = {
              id: id.toString(),
              local: previousDetail,
              remote: { ...previousDetail, ...data } as TEntity
            }
            setConflicts(prev => [...prev, conflict])
            
            // Apply conflict resolution strategy
            if (conflictResolution === ConflictResolution.FIRST_WRITE) {
              throw new Error('Version conflict: First write wins')
            }
          }
        }
        
        // Apply optimistic update
        const optimisticEntity = config.transformUpdate
          ? config.transformUpdate(previousDetail!, data)
          : {
              ...previousDetail,
              ...data,
              updatedAt: new Date().toISOString(),
              version: (previousDetail?.version || 0) + 1
            } as TEntity
        
        // Update detail query
        if (previousDetail) {
          queryClient.setQueryData(KEYS.detail(id), optimisticEntity)
        }
        
        // Update list queries
        previousLists.forEach(([queryKey, list]) => {
          if (list) {
            queryClient.setQueryData(
              queryKey,
              list.map(item => item.id === id ? optimisticEntity : item)
            )
          }
        })
        
        return { previousDetail, previousLists }
      },
      onError: (error, { id, data }, context) => {
        // Rollback
        if (context) {
          if (context.previousDetail) {
            queryClient.setQueryData(KEYS.detail(id), context.previousDetail)
          }
          context.previousLists?.forEach(([queryKey, data]) => {
            queryClient.setQueryData(queryKey, data)
          })
        }
        
        config.onRollback?.(error, context)
        toast.error(`Failed to update ${entityName.toLowerCase()}`)
        options?.onError?.(error, { id, data }, context)
      },
      onSuccess: (data, { id }, context) => {
        // Update with server response
        queryClient.setQueryData(KEYS.detail(id), data)
        
        // Check for server-side conflict
        if (data.version && context?.previousDetail?.version) {
          if (data.version <= context.previousDetail.version) {
            const conflict = {
              id: id.toString(),
              local: context.previousDetail,
              remote: data
            }
            setConflicts(prev => [...prev, conflict])
            
            // Handle based on strategy
            if (config.onConflict) {
              const resolved = config.onConflict(context.previousDetail, data)
              queryClient.setQueryData(KEYS.detail(id), resolved)
            }
          }
        }
        
        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: KEYS.detail(id) })
        queryClient.invalidateQueries({ queryKey: KEYS.lists() })
        
        toast.success(`${entityName} updated successfully`)
        options?.onSuccess?.(data, { id, data: {} as TUpdate }, context)
      },
      ...options
    })

    return {
      ...useMutation({} as any),
      conflicts,
      resolveConflict
    }
  }

  /**
   * Optimistic delete with undo capability
   */
  const useOptimisticDelete = (
    options?: UseMutationOptions<void, Error, number | string>
  ) => {
    const queryClient = useQueryClient()
    const client = useApiClient()
    const [canUndo, setCanUndo] = useState(false)
    const undoDataRef = useRef<{ id: number | string; data: TEntity; lists: any[] } | null>(null)
    const undoTimeoutRef = useRef<NodeJS.Timeout>()

    const undo = useCallback(() => {
      if (!undoDataRef.current) return
      
      const { id, data, lists } = undoDataRef.current
      
      // Restore detail
      queryClient.setQueryData(KEYS.detail(id), data)
      
      // Restore lists
      lists.forEach(([queryKey, list]) => {
        queryClient.setQueryData(queryKey, list)
      })
      
      setCanUndo(false)
      undoDataRef.current = null
      
      toast.success('Delete undone')
    }, [queryClient, KEYS])

    return useMutation({
      mutationFn: async (id: number | string) => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[clientPath]
        if (!api?.delete) throw new Error(`API client missing delete method for ${clientPath}`)
        
        await api.delete(id)
      },
      onMutate: async (id) => {
        // Cancel queries
        await queryClient.cancelQueries({ queryKey: KEYS.lists() })
        
        // Snapshot data for undo
        const deletedItem = queryClient.getQueryData<TEntity>(KEYS.detail(id))
        const previousLists = queryClient.getQueriesData<TEntity[]>({ 
          queryKey: KEYS.lists() 
        })
        
        if (deletedItem) {
          undoDataRef.current = {
            id,
            data: deletedItem,
            lists: previousLists as any
          }
          setCanUndo(true)
          
          // Auto-clear undo after 10 seconds
          undoTimeoutRef.current = setTimeout(() => {
            undoDataRef.current = null
            setCanUndo(false)
          }, 10000)
        }
        
        // Optimistically remove from lists
        previousLists.forEach(([queryKey, list]) => {
          if (list) {
            queryClient.setQueryData(
              queryKey,
              list.filter(item => item.id !== id)
            )
          }
        })
        
        // Remove detail query
        queryClient.removeQueries({ queryKey: KEYS.detail(id) })
        
        return { previousLists, deletedItem }
      },
      onError: (error, id, context) => {
        // Rollback
        if (context) {
          context.previousLists?.forEach(([queryKey, data]) => {
            queryClient.setQueryData(queryKey, data)
          })
          if (context.deletedItem) {
            queryClient.setQueryData(KEYS.detail(id), context.deletedItem)
          }
        }
        
        setCanUndo(false)
        undoDataRef.current = null
        
        toast.error(`Failed to delete ${entityName.toLowerCase()}`)
        options?.onError?.(error, id, context)
      },
      onSuccess: (data, id, context) => {
        // Clear undo timeout on success
        if (undoTimeoutRef.current) {
          clearTimeout(undoTimeoutRef.current)
        }
        
        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: KEYS.all })
        
        toast.success(`${entityName} deleted`, {
          action: canUndo ? {
            label: 'Undo',
            onClick: undo
          } : undefined
        })
        
        options?.onSuccess?.(data, id, context)
      },
      ...options
    })

    return {
      ...useMutation({} as any),
      undo,
      canUndo
    }
  }

  /**
   * Batch optimistic operations
   */
  const useOptimisticBatch = () => {
    const [pending, setPending] = useState(0)
    const [errors, setErrors] = useState<Error[]>([])
    const queryClient = useQueryClient()
    const client = useApiClient()

    const batchCreate = useCallback(async (items: TCreate[]) => {
      setPending(items.length)
      setErrors([])
      
      const results: TEntity[] = []
      const tempIds = new Map<string, string>()
      
      // Apply optimistic updates
      const optimisticItems = items.map(item => {
        const tempId = generateTempId()
        const optimistic = config.transformCreate
          ? config.transformCreate(item)
          : { ...item, id: tempId } as TEntity
        
        tempIds.set(tempId.toString(), tempId.toString())
        return optimistic
      })
      
      queryClient.setQueriesData<TEntity[]>(
        { queryKey: KEYS.lists() },
        old => old ? [...old, ...optimisticItems] : optimisticItems
      )
      
      // Process items
      for (const item of items) {
        try {
          if (!client) throw new Error('API client not initialized')
          const api = (client as any)[clientPath]
          const response = await api.create(item)
          results.push(response.data || response)
          setPending(prev => prev - 1)
        } catch (error) {
          setErrors(prev => [...prev, error as Error])
          setPending(prev => prev - 1)
        }
      }
      
      // Update with real data
      queryClient.invalidateQueries({ queryKey: KEYS.lists() })
      
      return results
    }, [client, clientPath, queryClient, KEYS])

    const batchUpdate = useCallback(async (updates: Array<{ id: number | string; data: TUpdate }>) => {
      setPending(updates.length)
      setErrors([])
      
      const results: TEntity[] = []
      
      // Apply optimistic updates
      updates.forEach(({ id, data }) => {
        const current = queryClient.getQueryData<TEntity>(KEYS.detail(id))
        if (current) {
          const optimistic = config.transformUpdate
            ? config.transformUpdate(current, data)
            : { ...current, ...data } as TEntity
          
          queryClient.setQueryData(KEYS.detail(id), optimistic)
        }
      })
      
      // Process updates
      for (const { id, data } of updates) {
        try {
          if (!client) throw new Error('API client not initialized')
          const api = (client as any)[clientPath]
          const response = await api.update(id, data)
          results.push(response.data || response)
          setPending(prev => prev - 1)
        } catch (error) {
          setErrors(prev => [...prev, error as Error])
          setPending(prev => prev - 1)
        }
      }
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: KEYS.lists() })
      
      return results
    }, [client, clientPath, queryClient, KEYS])

    const batchDelete = useCallback(async (ids: (number | string)[]) => {
      setPending(ids.length)
      setErrors([])
      
      // Optimistically remove
      queryClient.setQueriesData<TEntity[]>(
        { queryKey: KEYS.lists() },
        old => old?.filter(item => !ids.includes(item.id))
      )
      
      // Process deletions
      for (const id of ids) {
        try {
          if (!client) throw new Error('API client not initialized')
          const api = (client as any)[clientPath]
          await api.delete(id)
          setPending(prev => prev - 1)
        } catch (error) {
          setErrors(prev => [...prev, error as Error])
          setPending(prev => prev - 1)
        }
      }
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: KEYS.all })
    }, [client, clientPath, queryClient, KEYS])

    return {
      batchCreate,
      batchUpdate,
      batchDelete,
      pending,
      errors
    }
  }

  /**
   * Offline queue management
   */
  const useOfflineQueue = () => {
    const [queue, setQueue] = useState<QueueItem[]>([])
    const client = useApiClient()

    const addToQueue = useCallback((operation: QueueItem['operation'], data: any) => {
      const item: QueueItem = {
        id: generateTempId().toString(),
        operation,
        data,
        timestamp: Date.now(),
        retries: 0,
        maxRetries: 3
      }
      
      setQueue(prev => [...prev, item])
      
      // Persist to localStorage if configured
      if (offlineQueue) {
        const stored = localStorage.getItem(`${entityName}-queue`)
        const existing = stored ? JSON.parse(stored) : []
        localStorage.setItem(`${entityName}-queue`, JSON.stringify([...existing, item]))
      }
    }, [offlineQueue])

    const processQueue = useCallback(async () => {
      if (!client) return
      
      const api = (client as any)[clientPath]
      const processed: string[] = []
      const failed: QueueItem[] = []
      
      for (const item of queue) {
        try {
          switch (item.operation) {
            case 'create':
              await api.create(item.data)
              break
            case 'update':
              await api.update(item.data.id, item.data.data)
              break
            case 'delete':
              await api.delete(item.data)
              break
          }
          processed.push(item.id)
        } catch (error) {
          if (item.retries < item.maxRetries) {
            failed.push({ ...item, retries: item.retries + 1 })
          }
        }
      }
      
      setQueue(failed)
      
      // Update localStorage
      if (offlineQueue) {
        localStorage.setItem(`${entityName}-queue`, JSON.stringify(failed))
      }
      
      if (processed.length > 0) {
        toast.success(`Processed ${processed.length} queued operations`)
      }
    }, [queue, client, clientPath, offlineQueue])

    const clearQueue = useCallback(() => {
      setQueue([])
      if (offlineQueue) {
        localStorage.removeItem(`${entityName}-queue`)
      }
    }, [offlineQueue])

    const retryFailed = useCallback(async () => {
      const failedItems = queue.filter(item => item.retries > 0)
      setQueue(failedItems.map(item => ({ ...item, retries: 0 })))
      await processQueue()
    }, [queue, processQueue])

    return {
      queue,
      addToQueue,
      processQueue,
      clearQueue,
      retryFailed
    }
  }

  /**
   * State snapshot management
   */
  const useOptimisticState = () => {
    const [snapshots, setSnapshots] = useState<StateSnapshot<any>[]>([])
    const queryClient = useQueryClient()

    const createSnapshot = useCallback((queryKey: QueryKey, data: any, operation: StateSnapshot<any>['operation']) => {
      const snapshot: StateSnapshot<any> = {
        timestamp: Date.now(),
        queryKey,
        data,
        operation
      }
      
      setSnapshots(prev => [...prev, snapshot])
    }, [])

    const restoreSnapshot = useCallback((timestamp: number) => {
      const snapshot = snapshots.find(s => s.timestamp === timestamp)
      if (snapshot) {
        queryClient.setQueryData(snapshot.queryKey, snapshot.data)
        toast.info('State restored')
      }
    }, [snapshots, queryClient])

    const clearSnapshots = useCallback(() => {
      setSnapshots([])
    }, [])

    return {
      snapshots,
      createSnapshot,
      restoreSnapshot,
      clearSnapshots
    }
  }

  /**
   * Conflict detection hook
   */
  const useConflictDetection = (id: number | string) => {
    const queryClient = useQueryClient()
    const client = useApiClient()
    const [hasConflict, setHasConflict] = useState(false)
    const [localVersion, setLocalVersion] = useState<TEntity | null>(null)
    const [remoteVersion, setRemoteVersion] = useState<TEntity | null>(null)

    const checkForConflict = useCallback(async () => {
      if (!client) return
      
      const local = queryClient.getQueryData<TEntity>(KEYS.detail(id))
      if (!local || !local.version) return
      
      try {
        const api = (client as any)[clientPath]
        const response = await api.get(id)
        const remote = response.data || response
        
        if (remote.version && remote.version !== local.version) {
          setHasConflict(true)
          setLocalVersion(local)
          setRemoteVersion(remote)
        }
      } catch (error) {
        console.error('Failed to check for conflict:', error)
      }
    }, [client, clientPath, id, queryClient, KEYS])

    const resolve = useCallback((resolution: ConflictResolution) => {
      if (!localVersion || !remoteVersion) return
      
      let resolved: TEntity
      
      switch (resolution) {
        case ConflictResolution.LAST_WRITE:
          resolved = remoteVersion
          break
        case ConflictResolution.FIRST_WRITE:
          resolved = localVersion
          break
        case ConflictResolution.MERGE:
          resolved = config.onConflict 
            ? config.onConflict(localVersion, remoteVersion)
            : { ...localVersion, ...remoteVersion, version: Math.max(localVersion.version || 0, remoteVersion.version || 0) }
          break
        default:
          resolved = remoteVersion
      }
      
      queryClient.setQueryData(KEYS.detail(id), resolved)
      setHasConflict(false)
      setLocalVersion(null)
      setRemoteVersion(null)
    }, [localVersion, remoteVersion, queryClient, KEYS, id])

    return {
      hasConflict,
      localVersion,
      remoteVersion,
      resolve,
      checkForConflict
    }
  }

  return {
    useOptimisticCreate,
    useOptimisticUpdate,
    useOptimisticDelete,
    useOptimisticBatch,
    useOfflineQueue,
    useOptimisticState,
    useConflictDetection
  }
}