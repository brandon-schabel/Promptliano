import ErrorFactory, { withErrorContext } from '@promptliano/shared/src/error/error-factory'
import type { File } from '@promptliano/database'

// Utility types for file operations
export interface FileOperationOptions {
  streaming?: boolean
  parallel?: boolean
  maxConcurrency?: number
  chunkSize?: number
  progressCallback?: (progress: number) => void
  signal?: AbortSignal
}

export interface CacheConfig {
  ttl?: number
  maxSize?: number
  invalidate?: (key?: string) => void
}

export interface StreamingResult<T> {
  data: AsyncIterator<T>
  metadata: {
    totalItems: number
    processedItems: number
    errors: string[]
  }
}

export interface BatchResult<T> {
  successful: T[]
  failed: Array<{ item: any; error: string }>
  totalProcessed: number
  processingTime: number
}

// Base configuration for file services
export interface FileServiceConfig {
  cache?: CacheConfig
  streaming?: {
    enabled: boolean
    chunkSize: number
    maxConcurrency: number
  }
  parallel?: {
    enabled: boolean
    maxWorkers: number
    batchSize: number
  }
  memory?: {
    maxFileSize: number
    maxTotalMemory: number
    gcThreshold: number
  }
}

const DEFAULT_CONFIG: FileServiceConfig = {
  cache: {
    ttl: 5 * 60 * 1000, // 5 minutes
    maxSize: 1000
  },
  streaming: {
    enabled: true,
    chunkSize: 100,
    maxConcurrency: 5
  },
  parallel: {
    enabled: true,
    maxWorkers: 4,
    batchSize: 50
  },
  memory: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxTotalMemory: 100 * 1024 * 1024, // 100MB
    gcThreshold: 0.8 // 80%
  }
}

// Cache utilities
export function createFileCache<T>(config?: CacheConfig) {
  const cache = new Map<string, { value: T; timestamp: number; hits: number }>()
  const ttl = config?.ttl || 5 * 60 * 1000
  const maxSize = config?.maxSize || 1000

  const cleanup = () => {
    const now = Date.now()
    const entries = Array.from(cache.entries())
      .map(([key, data]) => ({ key, ...data }))
      .filter((entry) => now - entry.timestamp <= ttl)
      .sort((a, b) => b.hits - a.hits) // Keep most used items

    cache.clear()
    entries.slice(0, maxSize).forEach(({ key, value, timestamp, hits }) => {
      cache.set(key, { value, timestamp, hits })
    })
  }

  // Cleanup interval
  const cleanupInterval = setInterval(cleanup, 60 * 1000) // Every minute

  return {
    get(key: string): T | undefined {
      const entry = cache.get(key)
      if (!entry) return undefined

      const now = Date.now()
      if (now - entry.timestamp > ttl) {
        cache.delete(key)
        return undefined
      }

      entry.hits++
      return entry.value
    },

    set(key: string, value: T): void {
      if (cache.size >= maxSize) {
        cleanup()
      }
      cache.set(key, { value, timestamp: Date.now(), hits: 1 })
    },

    invalidate(key?: string): void {
      if (key) {
        cache.delete(key)
      } else {
        cache.clear()
      }
    },

    size(): number {
      return cache.size
    },

    destroy(): void {
      clearInterval(cleanupInterval)
      cache.clear()
    }
  }
}

// Streaming utilities for large file operations
export function createFileStreamProcessor<TInput, TOutput>(
  processor: (item: TInput, index: number, signal?: AbortSignal) => Promise<TOutput>,
  options: FileOperationOptions = {}
) {
  const { maxConcurrency = 3, progressCallback, signal } = options

  return {
    async *processStream(
      items: TInput[]
    ): AsyncIterableIterator<{ item: TOutput; index: number } | { error: string; index: number }> {
      const promises: Promise<{ item: TOutput; index: number } | { error: string; index: number }>[] = []

      for (let i = 0; i < items.length; i++) {
        const promise = processor(items[i]!, i, signal)
          .then((result) => ({ item: result, index: i }))
          .catch((error) => ({ error: error instanceof Error ? error.message : String(error), index: i }))

        promises.push(promise)

        // Yield results as they complete, respecting concurrency
        if (promises.length >= maxConcurrency || i === items.length - 1) {
          const results = await Promise.allSettled(promises.splice(0, maxConcurrency))
          for (const result of results) {
            if (result.status === 'fulfilled') {
              yield result.value
            }
          }
          progressCallback?.(Math.min(i + 1, items.length) / items.length)
        }
      }
    }
  }
}

// Parallel processing utilities
export function createParallelProcessor<TInput, TOutput>(
  processor: (batch: TInput[]) => Promise<TOutput[]>,
  config: FileServiceConfig['parallel'] = DEFAULT_CONFIG.parallel!
) {
  return {
    async processBatch(items: TInput[]): Promise<BatchResult<TOutput>> {
      const startTime = Date.now()
      const batchSize = config.batchSize
      const successful: TOutput[] = []
      const failed: Array<{ item: TInput; error: string }> = []

      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize)

        try {
          const results = await processor(batch)
          successful.push(...results)
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          batch.forEach((item) => failed.push({ item, error: errorMsg }))
        }
      }

      return {
        successful,
        failed,
        totalProcessed: successful.length + failed.length,
        processingTime: Date.now() - startTime
      }
    }
  }
}

// Memory management utilities
export function createMemoryManager(config: FileServiceConfig['memory'] = DEFAULT_CONFIG.memory!) {
  let currentMemoryUsage = 0
  const trackedObjects = new Set<{ size: number }>()

  return {
    track<T>(obj: T, estimatedSize: number): T {
      currentMemoryUsage += estimatedSize
      const tracked = { size: estimatedSize }
      trackedObjects.add(tracked)

      // Trigger cleanup if threshold exceeded
      if (currentMemoryUsage > config.maxTotalMemory * config.gcThreshold) {
        this.cleanup()
      }

      return obj
    },

    untrack(estimatedSize: number): void {
      currentMemoryUsage = Math.max(0, currentMemoryUsage - estimatedSize)
    },

    cleanup(): void {
      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      // Reset tracking (objects should be gc'd)
      trackedObjects.clear()
      currentMemoryUsage = 0
    },

    getUsage(): { current: number; limit: number; percentage: number } {
      return {
        current: currentMemoryUsage,
        limit: config.maxTotalMemory,
        percentage: (currentMemoryUsage / config.maxTotalMemory) * 100
      }
    },

    canAllocate(size: number): boolean {
      return currentMemoryUsage + size <= config.maxTotalMemory
    }
  }
}

// Progress tracking utilities
export function createProgressTracker(totalItems: number) {
  let completed = 0
  let errors = 0
  const startTime = Date.now()

  return {
    increment(): void {
      completed++
    },

    error(): void {
      errors++
    },

    getProgress(): {
      completed: number
      total: number
      errors: number
      percentage: number
      elapsedTime: number
      estimatedTimeRemaining: number
    } {
      const elapsedTime = Date.now() - startTime
      const percentage = (completed + errors) / totalItems
      const estimatedTimeRemaining = percentage > 0 ? (elapsedTime / percentage) * (1 - percentage) : 0

      return {
        completed,
        total: totalItems,
        errors,
        percentage: percentage * 100,
        elapsedTime,
        estimatedTimeRemaining
      }
    }
  }
}

// File service factory
export function createFileService<TConfig extends Record<string, any> = {}>(
  serviceName: string,
  config: FileServiceConfig & TConfig = {} as FileServiceConfig & TConfig
) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config }
  const cache = mergedConfig.cache ? createFileCache(mergedConfig.cache) : undefined
  const memoryManager = createMemoryManager(mergedConfig.memory)

  return {
    serviceName,
    config: mergedConfig,
    cache,
    memoryManager,

    // Utility methods
    withErrorContext: <T>(
      operation: () => Promise<T>,
      context: { action: string; id?: string | number }
    ): Promise<T> => {
      return withErrorContext(operation, {
        entity: serviceName,
        action: context.action,
        id: context.id
      })
    },

    // Streaming support
    createStreamProcessor: <TInput, TOutput>(
      processor: (item: TInput, index: number, signal?: AbortSignal) => Promise<TOutput>
    ) => createFileStreamProcessor(processor, { maxConcurrency: mergedConfig.streaming?.maxConcurrency }),

    // Parallel processing
    createParallelProcessor: <TInput, TOutput>(processor: (batch: TInput[]) => Promise<TOutput[]>) =>
      createParallelProcessor(processor, mergedConfig.parallel),

    // Progress tracking
    createProgressTracker,

    // Cleanup
    destroy(): void {
      cache?.destroy()
      memoryManager.cleanup()
    }
  }
}

// File filtering utilities
export function createFileFilter() {
  const binaryExtensions = new Set([
    'jpg',
    'jpeg',
    'png',
    'gif',
    'bmp',
    'ico',
    'svg',
    'webp',
    'mp4',
    'avi',
    'mov',
    'mp3',
    'wav',
    'pdf',
    'doc',
    'docx',
    'zip',
    'tar',
    'gz',
    'exe',
    'dll',
    'so',
    'dylib'
  ])

  const skipPaths = new Set([
    'node_modules',
    'vendor',
    'dist',
    'build',
    '.git',
    '.next',
    '.nuxt',
    'coverage',
    'tmp',
    'temp'
  ])

  return {
    shouldSkipFile(file: File): boolean {
      // Check extension
      const ext = file.path.split('.').pop()?.toLowerCase()
      if (ext && binaryExtensions.has(ext)) return true

      // Check file size
      if (file.size && file.size > 1024 * 1024) return true // > 1MB

      // Check path
      if (Array.from(skipPaths).some((skip) => file.path.includes(skip))) return true

      return false
    },

    filterTextFiles(files: File[]): File[] {
      return files.filter((file) => !this.shouldSkipFile(file))
    },

    getFileCategory(file: File): string {
      const ext = file.path.split('.').pop()?.toLowerCase() || ''

      const categories: Record<string, string[]> = {
        component: ['tsx', 'jsx', 'vue', 'svelte'],
        style: ['css', 'scss', 'sass', 'less', 'styl'],
        script: ['ts', 'js', 'mjs', 'cjs'],
        config: ['json', 'yaml', 'yml', 'toml', 'ini', 'env'],
        documentation: ['md', 'mdx', 'txt', 'rst'],
        test: file.path.includes('test') || file.path.includes('spec') ? ['ts', 'js'] : [],
        api: ['ts', 'js'] // if path includes 'api' or 'route'
      }

      for (const [category, extensions] of Object.entries(categories)) {
        if (extensions.includes(ext)) {
          // Additional path-based checks
          if (category === 'api' && !(file.path.includes('api') || file.path.includes('route'))) {
            continue
          }
          return category
        }
      }

      return 'code'
    }
  }
}

// Token estimation utilities
export function createTokenEstimator() {
  return {
    estimateTokens(text: string): number {
      // Rough estimation: 1 token ≈ 4 characters
      return Math.ceil(text.length / 4)
    },

    estimateFileTokens(file: File): number {
      let tokens = 0

      // File metadata
      tokens += this.estimateTokens(file.path + file.name)

      // Summary
      // Summary removed; no additional tokens for summary

      // Content (cap at 1000 chars for estimation)
      if (file.content) {
        tokens += this.estimateTokens(file.content.slice(0, 1000))
      }

      // Imports/exports
      if (file.imports) {
        tokens += file.imports.length * 10 // ~10 tokens per import
      }
      if (file.exports) {
        tokens += file.exports.length * 8 // ~8 tokens per export
      }

      return tokens
    },

    canFitInTokenLimit(files: File[], limit: number): boolean {
      const totalTokens = files.reduce((sum, file) => sum + this.estimateFileTokens(file), 0)
      return totalTokens <= limit
    }
  }
}
