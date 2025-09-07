/**
 * Mutation Hooks Factory - Advanced mutation patterns beyond basic CRUD
 *
 * This factory creates specialized mutation hooks for:
 * - Batch operations (create, update, delete)
 * - Import/export operations
 * - Progress tracking
 * - Queue management
 * - Transaction support
 */

import { useMutation, useQueryClient, type UseMutationOptions, type UseMutationResult } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useApiClient } from '../api/use-api-client'
import { useState, useCallback, useRef } from 'react'
import { createQueryKeys, type QueryKeyFactory } from './query-key-factory'

/**
 * Configuration for mutation hooks
 */
export interface MutationHookConfig<TEntity> {
  /**
   * Display name for the entity
   */
  entityName: string

  /**
   * Plural display name
   */
  entityNamePlural?: string

  /**
   * Path to the API client methods
   */
  clientPath: string

  /**
   * Custom query keys
   */
  queryKeys?: QueryKeyFactory

  /**
   * Hook options
   */
  options?: {
    /**
     * Enable optimistic updates for batch operations
     */
    optimistic?: boolean

    /**
     * Show progress for batch operations
     */
    showProgress?: boolean

    /**
     * Batch size for operations
     */
    batchSize?: number

    /**
     * Retry failed items in batch
     */
    retryFailedItems?: boolean

    /**
     * Custom success message formatter
     */
    successMessage?: (action: string, count: number) => string

    /**
     * Custom error message formatter
     */
    errorMessage?: (action: string, error: Error, count?: number) => string

    /**
     * Disable toast notifications
     */
    silent?: boolean
  }
}

/**
 * Batch operation result
 */
export interface BatchResult<T> {
  successful: T[]
  failed: Array<{ item: any; error: Error }>
  total: number
  successCount: number
  failureCount: number
}

/**
 * Batch operation type
 */
export type BatchOperation<T> = {
  operation: 'create' | 'update' | 'delete'
  data: T | T[] | { id: number | string; data: Partial<T> }
}

/**
 * Import/Export configuration (alias for backward compatibility)
 */
export type ImportExportConfig = ImportExportOptions

/**
 * Import/Export options
 */
export interface ImportExportOptions {
  format?: 'json' | 'csv' | 'excel'
  fields?: string[]
  includeRelations?: boolean
  validateBeforeImport?: boolean
}

/**
 * Progress state for batch operations
 */
export interface ProgressState {
  current: number
  total: number
  percentage: number
  status: 'idle' | 'processing' | 'completed' | 'failed'
  message?: string
}

/**
 * Mutation hooks return type
 */
export interface MutationHooks<TEntity> {
  // Batch operations
  useBatchCreate: (options?: UseMutationOptions<BatchResult<TEntity>, Error, TEntity[]>) => UseMutationResult<
    BatchResult<TEntity>,
    Error,
    TEntity[]
  > & {
    progress: ProgressState
    abort: () => void
  }

  useBatchUpdate: (
    options?: UseMutationOptions<BatchResult<TEntity>, Error, Array<{ id: number | string; data: Partial<TEntity> }>>
  ) => UseMutationResult<BatchResult<TEntity>, Error, Array<{ id: number | string; data: Partial<TEntity> }>> & {
    progress: ProgressState
    abort: () => void
  }

  useBatchDelete: (options?: UseMutationOptions<BatchResult<void>, Error, (number | string)[]>) => UseMutationResult<
    BatchResult<void>,
    Error,
    (number | string)[]
  > & {
    progress: ProgressState
    abort: () => void
  }

  // Import/Export operations
  useImport: (
    options?: UseMutationOptions<BatchResult<TEntity>, Error, { file: File; options?: ImportExportOptions }>
  ) => UseMutationResult<BatchResult<TEntity>, Error, { file: File; options?: ImportExportOptions }> & {
    progress: ProgressState
    validateFile: (file: File) => Promise<{ valid: boolean; errors?: string[] }>
  }

  useExport: (
    options?: UseMutationOptions<Blob, Error, { params?: any; options?: ImportExportOptions }>
  ) => UseMutationResult<Blob, Error, { params?: any; options?: ImportExportOptions }> & {
    download: (blob: Blob, filename?: string) => void
  }

  // Reorder operation
  useReorder: (
    options?: UseMutationOptions<TEntity[], Error, { items: TEntity[]; field?: string }>
  ) => UseMutationResult<TEntity[], Error, { items: TEntity[]; field?: string }>

  // Duplicate operation
  useDuplicate: (
    options?: UseMutationOptions<TEntity, Error, { id: number | string; data?: Partial<TEntity> }>
  ) => UseMutationResult<TEntity, Error, { id: number | string; data?: Partial<TEntity> }>

  // Archive/Restore operations
  useArchive: (
    options?: UseMutationOptions<TEntity, Error, number | string>
  ) => UseMutationResult<TEntity, Error, number | string>

  useRestore: (
    options?: UseMutationOptions<TEntity, Error, number | string>
  ) => UseMutationResult<TEntity, Error, number | string>

  // Bulk field update
  useBulkFieldUpdate: <K extends keyof TEntity>(
    options?: UseMutationOptions<BatchResult<TEntity>, Error, { ids: (number | string)[]; field: K; value: TEntity[K] }>
  ) => UseMutationResult<BatchResult<TEntity>, Error, { ids: (number | string)[]; field: K; value: TEntity[K] }>
}

/**
 * Create mutation hooks for advanced operations
 */
export function createMutationHooks<TEntity extends { id: number | string }>(
  config: MutationHookConfig<TEntity>
): MutationHooks<TEntity> {
  const { entityName, entityNamePlural = `${entityName}s`, clientPath, options = {} } = config

  // Create query keys
  const KEYS = config.queryKeys || createQueryKeys(clientPath)

  // Default options
  const batchSize = options.batchSize || 50

  // Success message formatter
  const formatSuccess =
    options.successMessage ||
    ((action: string, count: number) => {
      const entity = count === 1 ? entityName : entityNamePlural
      return `${count} ${entity} ${action} successfully`
    })

  // Error message formatter
  const formatError =
    options.errorMessage ||
    ((action: string, error: Error, count?: number) => {
      const entity = count === 1 ? entityName : entityNamePlural
      return error.message || `Failed to ${action} ${count ? `${count} ${entity}` : entityNamePlural.toLowerCase()}`
    })

  // Show toast helper
  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    if (!options.silent) {
      toast[type](message)
    }
  }

  /**
   * Create progress state hook
   */
  const useProgressState = () => {
    const [progress, setProgress] = useState<ProgressState>({
      current: 0,
      total: 0,
      percentage: 0,
      status: 'idle'
    })

    const updateProgress = useCallback(
      (current: number, total: number, status?: ProgressState['status'], message?: string) => {
        setProgress({
          current,
          total,
          percentage: total > 0 ? Math.round((current / total) * 100) : 0,
          status: status || 'processing',
          message
        })
      },
      []
    )

    const resetProgress = useCallback(() => {
      setProgress({
        current: 0,
        total: 0,
        percentage: 0,
        status: 'idle'
      })
    }, [])

    return { progress, updateProgress, resetProgress }
  }

  /**
   * Process items in batches
   */
  const processBatch = async <T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    onProgress?: (current: number, total: number) => void,
    abortSignal?: AbortSignal
  ): Promise<BatchResult<R>> => {
    const results: BatchResult<R> = {
      successful: [],
      failed: [],
      total: items.length,
      successCount: 0,
      failureCount: 0
    }

    for (let i = 0; i < items.length; i += batchSize) {
      if (abortSignal?.aborted) {
        break
      }

      const batch = items.slice(i, Math.min(i + batchSize, items.length))

      try {
        const batchResults = await processor(batch)
        results.successful.push(...batchResults)
        results.successCount += batchResults.length
      } catch (error) {
        // If batch fails, try individually if retryFailedItems is enabled
        if (options.retryFailedItems) {
          for (const item of batch) {
            try {
              const [result] = await processor([item])
              results.successful.push(result)
              results.successCount++
            } catch (itemError) {
              results.failed.push({ item, error: itemError as Error })
              results.failureCount++
            }
          }
        } else {
          batch.forEach((item) => {
            results.failed.push({ item, error: error as Error })
            results.failureCount++
          })
        }
      }

      onProgress?.(Math.min(i + batchSize, items.length), items.length)
    }

    return results
  }

  /**
   * Batch create hook
   */
  const useBatchCreate = (mutationOptions?: UseMutationOptions<BatchResult<TEntity>, Error, TEntity[]>) => {
    const client = useApiClient()
    const queryClient = useQueryClient()
    const { progress, updateProgress, resetProgress } = useProgressState()
    const abortControllerRef = useRef<AbortController | null>(null)

    const mutation = useMutation({
      mutationFn: async (items: TEntity[]) => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[clientPath]

        resetProgress()
        updateProgress(0, items.length, 'processing', `Creating ${items.length} ${entityNamePlural.toLowerCase()}...`)

        abortControllerRef.current = new AbortController()

        if (api?.batchCreate) {
          // Use batch API if available
          try {
            const response = await api.batchCreate(items)
            updateProgress(items.length, items.length, 'completed')
            return {
              successful: response.data || response,
              failed: [],
              total: items.length,
              successCount: items.length,
              failureCount: 0
            }
          } catch (error) {
            updateProgress(0, items.length, 'failed')
            throw error
          }
        } else if (api?.create) {
          // Fallback to individual creates
          const result = await processBatch(
            items,
            async (batch) => {
              const promises = batch.map((item) => api.create(item))
              const responses = await Promise.all(promises)
              return responses.map((r) => r.data || r)
            },
            updateProgress,
            abortControllerRef.current?.signal
          )

          updateProgress(result.successCount, result.total, result.failureCount === 0 ? 'completed' : 'failed')

          return result
        } else {
          throw new Error(`API client missing batchCreate/create method for ${clientPath}`)
        }
      },
      onSuccess: (result, variables, context) => {
        queryClient.invalidateQueries({ queryKey: KEYS.all })

        if (result.failureCount === 0) {
          showToast('success', formatSuccess('created', result.successCount))
        } else if (result.successCount > 0) {
          showToast('info', `Created ${result.successCount} of ${result.total} ${entityNamePlural.toLowerCase()}`)
        } else {
          showToast('error', formatError('create', new Error('All items failed'), result.total))
        }

        mutationOptions?.onSuccess?.(result, variables, context)
      },
      onError: (error, variables, context) => {
        resetProgress()
        showToast('error', formatError('create', error))
        mutationOptions?.onError?.(error, variables, context)
      },
      ...mutationOptions
    })

    return {
      ...mutation,
      progress,
      abort: () => {
        abortControllerRef.current?.abort()
        resetProgress()
      }
    }
  }

  /**
   * Batch update hook
   */
  const useBatchUpdate = (
    mutationOptions?: UseMutationOptions<
      BatchResult<TEntity>,
      Error,
      Array<{ id: number | string; data: Partial<TEntity> }>
    >
  ) => {
    const client = useApiClient()
    const queryClient = useQueryClient()
    const { progress, updateProgress, resetProgress } = useProgressState()
    const abortControllerRef = useRef<AbortController | null>(null)

    const mutation = useMutation({
      mutationFn: async (updates: Array<{ id: number | string; data: Partial<TEntity> }>) => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[clientPath]

        resetProgress()
        updateProgress(
          0,
          updates.length,
          'processing',
          `Updating ${updates.length} ${entityNamePlural.toLowerCase()}...`
        )

        abortControllerRef.current = new AbortController()

        if (api?.batchUpdate) {
          // Use batch API if available
          try {
            const response = await api.batchUpdate(updates)
            updateProgress(updates.length, updates.length, 'completed')
            return {
              successful: response.data || response,
              failed: [],
              total: updates.length,
              successCount: updates.length,
              failureCount: 0
            }
          } catch (error) {
            updateProgress(0, updates.length, 'failed')
            throw error
          }
        } else if (api?.update) {
          // Fallback to individual updates
          const result = await processBatch(
            updates,
            async (batch) => {
              const promises = batch.map(({ id, data }) => api.update(id, data))
              const responses = await Promise.all(promises)
              return responses.map((r) => r.data || r)
            },
            updateProgress,
            abortControllerRef.current?.signal
          )

          updateProgress(result.successCount, result.total, result.failureCount === 0 ? 'completed' : 'failed')

          return result
        } else {
          throw new Error(`API client missing batchUpdate/update method for ${clientPath}`)
        }
      },
      onSuccess: (result, variables, context) => {
        queryClient.invalidateQueries({ queryKey: KEYS.all })

        if (result.failureCount === 0) {
          showToast('success', formatSuccess('updated', result.successCount))
        } else if (result.successCount > 0) {
          showToast('info', `Updated ${result.successCount} of ${result.total} ${entityNamePlural.toLowerCase()}`)
        } else {
          showToast('error', formatError('update', new Error('All items failed'), result.total))
        }

        mutationOptions?.onSuccess?.(result, variables, context)
      },
      onError: (error, variables, context) => {
        resetProgress()
        showToast('error', formatError('update', error))
        mutationOptions?.onError?.(error, variables, context)
      },
      ...mutationOptions
    })

    return {
      ...mutation,
      progress,
      abort: () => {
        abortControllerRef.current?.abort()
        resetProgress()
      }
    }
  }

  /**
   * Batch delete hook
   */
  const useBatchDelete = (mutationOptions?: UseMutationOptions<BatchResult<void>, Error, (number | string)[]>) => {
    const client = useApiClient()
    const queryClient = useQueryClient()
    const { progress, updateProgress, resetProgress } = useProgressState()
    const abortControllerRef = useRef<AbortController | null>(null)

    const mutation = useMutation({
      mutationFn: async (ids: (number | string)[]) => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[clientPath]

        resetProgress()
        updateProgress(0, ids.length, 'processing', `Deleting ${ids.length} ${entityNamePlural.toLowerCase()}...`)

        abortControllerRef.current = new AbortController()

        if (api?.batchDelete) {
          // Use batch API if available
          try {
            await api.batchDelete(ids)
            updateProgress(ids.length, ids.length, 'completed')
            return {
              successful: ids.map(() => undefined as any),
              failed: [],
              total: ids.length,
              successCount: ids.length,
              failureCount: 0
            }
          } catch (error) {
            updateProgress(0, ids.length, 'failed')
            throw error
          }
        } else if (api?.delete) {
          // Fallback to individual deletes
          const result = await processBatch(
            ids,
            async (batch) => {
              const promises = batch.map((id) => api.delete(id))
              await Promise.all(promises)
              return batch.map(() => undefined as any)
            },
            updateProgress,
            abortControllerRef.current?.signal
          )

          updateProgress(result.successCount, result.total, result.failureCount === 0 ? 'completed' : 'failed')

          return result
        } else {
          throw new Error(`API client missing batchDelete/delete method for ${clientPath}`)
        }
      },
      onSuccess: (result, variables, context) => {
        queryClient.invalidateQueries({ queryKey: KEYS.all })

        if (result.failureCount === 0) {
          showToast('success', formatSuccess('deleted', result.successCount))
        } else if (result.successCount > 0) {
          showToast('info', `Deleted ${result.successCount} of ${result.total} ${entityNamePlural.toLowerCase()}`)
        } else {
          showToast('error', formatError('delete', new Error('All items failed'), result.total))
        }

        mutationOptions?.onSuccess?.(result, variables, context)
      },
      onError: (error, variables, context) => {
        resetProgress()
        showToast('error', formatError('delete', error))
        mutationOptions?.onError?.(error, variables, context)
      },
      ...mutationOptions
    })

    return {
      ...mutation,
      progress,
      abort: () => {
        abortControllerRef.current?.abort()
        resetProgress()
      }
    }
  }

  /**
   * Import hook
   */
  const useImport = (
    mutationOptions?: UseMutationOptions<BatchResult<TEntity>, Error, { file: File; options?: ImportExportOptions }>
  ) => {
    const client = useApiClient()
    const queryClient = useQueryClient()
    const { progress, updateProgress, resetProgress } = useProgressState()

    const validateFile = async (file: File): Promise<{ valid: boolean; errors?: string[] }> => {
      // Basic file validation
      const errors: string[] = []

      if (file.size === 0) {
        errors.push('File is empty')
      }

      const extension = file.name.split('.').pop()?.toLowerCase()
      const validExtensions = ['json', 'csv', 'xlsx', 'xls']
      if (!extension || !validExtensions.includes(extension)) {
        errors.push(`Invalid file format. Supported formats: ${validExtensions.join(', ')}`)
      }

      return { valid: errors.length === 0, errors }
    }

    const mutation = useMutation({
      mutationFn: async ({ file, options: importOptions }) => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[clientPath]

        resetProgress()
        updateProgress(0, 100, 'processing', 'Importing data...')

        if (api?.import) {
          const formData = new FormData()
          formData.append('file', file)
          if (importOptions) {
            formData.append('options', JSON.stringify(importOptions))
          }

          const response = await api.import(formData)
          updateProgress(100, 100, 'completed')
          return response.data || response
        } else {
          throw new Error(`API client missing import method for ${clientPath}`)
        }
      },
      onSuccess: (result, variables, context) => {
        queryClient.invalidateQueries({ queryKey: KEYS.all })
        showToast('success', formatSuccess('imported', result.successCount))
        mutationOptions?.onSuccess?.(result, variables, context)
      },
      onError: (error, variables, context) => {
        resetProgress()
        showToast('error', formatError('import', error))
        mutationOptions?.onError?.(error, variables, context)
      },
      ...mutationOptions
    })

    return {
      ...mutation,
      progress,
      validateFile
    }
  }

  /**
   * Export hook
   */
  const useExport = (
    mutationOptions?: UseMutationOptions<Blob, Error, { params?: any; options?: ImportExportOptions }>
  ) => {
    const client = useApiClient()

    const download = (blob: Blob, filename?: string) => {
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename || `${entityNamePlural.toLowerCase()}-export-${Date.now()}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }

    const mutation = useMutation({
      mutationFn: async ({ params, options: exportOptions }) => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[clientPath]

        if (api?.export) {
          const response = await api.export({ ...params, ...exportOptions })
          return response.data || response
        } else {
          throw new Error(`API client missing export method for ${clientPath}`)
        }
      },
      onSuccess: (data, variables, context) => {
        showToast('success', 'Export completed successfully')
        mutationOptions?.onSuccess?.(data, variables, context)
      },
      onError: (error, variables, context) => {
        showToast('error', formatError('export', error))
        mutationOptions?.onError?.(error, variables, context)
      },
      ...mutationOptions
    })

    return {
      ...mutation,
      download
    }
  }

  /**
   * Other mutation hooks (simpler implementations)
   */
  const useReorder = (mutationOptions?: UseMutationOptions<TEntity[], Error, { items: TEntity[]; field?: string }>) => {
    const client = useApiClient()
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: async ({ items, field = 'orderIndex' }) => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[clientPath]

        if (api?.reorder) {
          const response = await api.reorder(
            items.map((item) => item.id),
            field
          )
          return response.data || response
        } else {
          throw new Error(`API client missing reorder method for ${clientPath}`)
        }
      },
      onSuccess: (data, variables, context) => {
        queryClient.invalidateQueries({ queryKey: KEYS.all })
        showToast('success', 'Reordered successfully')
        mutationOptions?.onSuccess?.(data, variables, context)
      },
      onError: (error, variables, context) => {
        showToast('error', formatError('reorder', error))
        mutationOptions?.onError?.(error, variables, context)
      },
      ...mutationOptions
    })
  }

  const useDuplicate = (
    mutationOptions?: UseMutationOptions<TEntity, Error, { id: number | string; data?: Partial<TEntity> }>
  ) => {
    const client = useApiClient()
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: async ({ id, data }) => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[clientPath]

        if (api?.duplicate) {
          const response = await api.duplicate(id, data)
          return response.data || response
        } else if (api?.get && api?.create) {
          // Fallback: get original and create new
          const original = await api.get(id)
          const { id: _, ...withoutId } = original.data || original
          const response = await api.create({ ...withoutId, ...data })
          return response.data || response
        } else {
          throw new Error(`API client missing duplicate method for ${clientPath}`)
        }
      },
      onSuccess: (data, variables, context) => {
        queryClient.invalidateQueries({ queryKey: KEYS.all })
        showToast('success', formatSuccess('duplicated', 1))
        mutationOptions?.onSuccess?.(data, variables, context)
      },
      onError: (error, variables, context) => {
        showToast('error', formatError('duplicate', error))
        mutationOptions?.onError?.(error, variables, context)
      },
      ...mutationOptions
    })
  }

  const useArchive = (mutationOptions?: UseMutationOptions<TEntity, Error, number | string>) => {
    const client = useApiClient()
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: async (id: number | string) => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[clientPath]

        if (api?.archive) {
          const response = await api.archive(id)
          return response.data || response
        } else if (api?.update) {
          // Fallback: update with archived flag
          const response = await api.update(id, { archived: true })
          return response.data || response
        } else {
          throw new Error(`API client missing archive method for ${clientPath}`)
        }
      },
      onSuccess: (data, variables, context) => {
        queryClient.invalidateQueries({ queryKey: KEYS.all })
        showToast('success', formatSuccess('archived', 1))
        mutationOptions?.onSuccess?.(data, variables, context)
      },
      onError: (error, variables, context) => {
        showToast('error', formatError('archive', error))
        mutationOptions?.onError?.(error, variables, context)
      },
      ...mutationOptions
    })
  }

  const useRestore = (mutationOptions?: UseMutationOptions<TEntity, Error, number | string>) => {
    const client = useApiClient()
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: async (id: number | string) => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[clientPath]

        if (api?.restore) {
          const response = await api.restore(id)
          return response.data || response
        } else if (api?.update) {
          // Fallback: update with archived flag
          const response = await api.update(id, { archived: false })
          return response.data || response
        } else {
          throw new Error(`API client missing restore method for ${clientPath}`)
        }
      },
      onSuccess: (data, variables, context) => {
        queryClient.invalidateQueries({ queryKey: KEYS.all })
        showToast('success', formatSuccess('restored', 1))
        mutationOptions?.onSuccess?.(data, variables, context)
      },
      onError: (error, variables, context) => {
        showToast('error', formatError('restore', error))
        mutationOptions?.onError?.(error, variables, context)
      },
      ...mutationOptions
    })
  }

  const useBulkFieldUpdate = <K extends keyof TEntity>(
    mutationOptions?: UseMutationOptions<
      BatchResult<TEntity>,
      Error,
      { ids: (number | string)[]; field: K; value: TEntity[K] }
    >
  ) => {
    const client = useApiClient()
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: async ({ ids, field, value }) => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[clientPath]

        if (api?.bulkFieldUpdate) {
          const response = await api.bulkFieldUpdate(ids, field, value)
          return response.data || response
        } else if (api?.update) {
          // Fallback to individual updates
          const result = await processBatch(ids, async (batch) => {
            const promises = batch.map((id) => api.update(id, { [field]: value }))
            const responses = await Promise.all(promises)
            return responses.map((r) => r.data || r)
          })
          return result
        } else {
          throw new Error(`API client missing bulkFieldUpdate method for ${clientPath}`)
        }
      },
      onSuccess: (result, variables, context) => {
        queryClient.invalidateQueries({ queryKey: KEYS.all })

        if (result.failureCount === 0) {
          showToast('success', formatSuccess('updated', result.successCount))
        } else {
          showToast('info', `Updated ${result.successCount} of ${result.total} ${entityNamePlural.toLowerCase()}`)
        }

        mutationOptions?.onSuccess?.(result, variables, context)
      },
      onError: (error, variables, context) => {
        showToast('error', formatError('update', error))
        mutationOptions?.onError?.(error, variables, context)
      },
      ...mutationOptions
    })
  }

  return {
    useBatchCreate,
    useBatchUpdate,
    useBatchDelete,
    useImport,
    useExport,
    useReorder,
    useDuplicate,
    useArchive,
    useRestore,
    useBulkFieldUpdate
  }
}
