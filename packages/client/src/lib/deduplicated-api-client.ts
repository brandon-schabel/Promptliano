/**
 * Deduplicated API Client
 * 
 * Enhanced API client wrapper that integrates request deduplication for
 * improved performance and reduced server load.
 * 
 * Features:
 * - Automatic request deduplication
 * - Promise sharing for identical requests
 * - Smart cache invalidation
 * - Performance monitoring
 * - Backwards compatibility
 * - Optional opt-out for specific requests
 */

import { BaseApiClient, type ApiConfig, PromptlianoError } from '@promptliano/api-client'
import { 
  RequestDeduplicator, 
  getRequestDeduplicator,
  createQueryKeyBasedDeduplicator,
  type RequestOptions,
  type DeduplicationConfig,
  type DeduplicationStats
} from './request-deduplicator'
import { z } from 'zod'

// ============================================================================
// Enhanced API Client Options
// ============================================================================

interface EnhancedRequestOptions {
  body?: unknown
  params?: Record<string, string | number | boolean>
  responseSchema?: z.ZodType<any>
  skipValidation?: boolean
  timeout?: number
  expectTextResponse?: boolean
  
  // Deduplication options
  deduplication?: {
    /** Enable/disable deduplication for this request (default: true) */
    enabled?: boolean
    /** Custom cache TTL for this request */
    cacheTtl?: number
    /** Custom deduplication key */
    customKey?: string
    /** Force new request even if duplicate exists */
    force?: boolean
  }
}

interface DedicatedApiClientConfig extends ApiConfig {
  /** Deduplication configuration */
  deduplication?: DeduplicationConfig & {
    /** Enable deduplication globally (default: true) */
    enabled?: boolean
    /** Enable query-key-based deduplication (default: true) */
    useQueryKeys?: boolean
  }
}

// ============================================================================
// Deduplicated API Client
// ============================================================================

export class DeduplicatedApiClient extends BaseApiClient {
  private deduplicator: RequestDeduplicator
  private deduplicationEnabled: boolean
  private performanceMetrics: Map<string, number[]> = new Map()

  constructor(config: DedicatedApiClientConfig) {
    super(config)
    
    // Configure deduplication
    this.deduplicationEnabled = config.deduplication?.enabled !== false
    
    if (this.deduplicationEnabled) {
      // Use query-key-based deduplicator if enabled
      if (config.deduplication?.useQueryKeys !== false) {
        this.deduplicator = createQueryKeyBasedDeduplicator(config.deduplication)
      } else {
        this.deduplicator = config.deduplication 
          ? new RequestDeduplicator(config.deduplication)
          : getRequestDeduplicator()
      }
    } else {
      // Create a no-op deduplicator
      this.deduplicator = new RequestDeduplicator({ enableCombining: false })
    }
  }

  /**
   * Enhanced request method with deduplication support
   */
  protected async request<TResponse>(
    method: string,
    endpoint: string,
    options?: EnhancedRequestOptions
  ): Promise<TResponse> {
    const startTime = performance.now()
    
    // Check if deduplication is enabled for this request
    const deduplicationOptions = options?.deduplication
    const shouldDeduplicate = this.deduplicationEnabled && 
                             deduplicationOptions?.enabled !== false &&
                             !deduplicationOptions?.force

    if (!shouldDeduplicate) {
      // Execute request normally without deduplication
      const result = await this.executeRequest<TResponse>(method, endpoint, options)
      this.recordPerformance(method, endpoint, performance.now() - startTime, false)
      return result
    }

    // Create request options for deduplication
    const requestOptions: RequestOptions = {
      method,
      endpoint,
      body: options?.body,
      params: options?.params,
      timeout: options?.timeout,
      abortSignal: undefined // Will be handled by deduplicator
    }

    // Custom deduplication key if provided
    if (deduplicationOptions?.customKey) {
      (requestOptions as any).customKey = deduplicationOptions.customKey
    }

    // Execute with deduplication
    try {
      const { result, wasDeduplicated } = await this.deduplicator.deduplicateWithMetadata(
        requestOptions,
        (abortSignal) => this.executeRequest<TResponse>(method, endpoint, {
          ...options,
          abortSignal
        })
      )
      
      this.recordPerformance(method, endpoint, performance.now() - startTime, wasDeduplicated)
      return result
    } catch (error) {
      this.recordPerformance(method, endpoint, performance.now() - startTime, false, true)
      throw error
    }
  }

  /**
   * Execute the actual request (extracted for deduplication)
   */
  private async executeRequest<TResponse>(
    method: string,
    endpoint: string,
    options?: EnhancedRequestOptions & { abortSignal?: AbortSignal }
  ): Promise<TResponse> {
    // Build URL with base URL handling
    const apiPath = `/api${endpoint}`
    const url = this.baseUrl
      ? new URL(apiPath, this.baseUrl.endsWith('/') ? this.baseUrl : this.baseUrl + '/')
      : new URL(apiPath, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3579')

    // Add query parameters
    if (options?.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value))
        }
      })
    }

    // Create abort controller
    const controller = new AbortController()
    const requestTimeout = options?.timeout || this.timeout
    const timeoutId = setTimeout(() => controller.abort(), requestTimeout)

    // Handle external abort signal
    if (options?.abortSignal) {
      options.abortSignal.addEventListener('abort', () => {
        controller.abort()
      })
    }

    try {
      // Handle different body types
      let body: any = undefined
      let headers = { ...this.headers }

      if (options?.body) {
        if (options.body instanceof FormData) {
          // For FormData, don't set Content-Type header (browser sets it with boundary)
          delete headers['Content-Type']
          body = options.body
        } else {
          // For regular JSON payloads
          body = JSON.stringify(options.body)
        }
      }

      const response = await this.customFetch(url.toString(), {
        method,
        headers,
        body,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      const responseText = await response.text()
      let responseData: any

      if (options?.expectTextResponse) {
        // For text responses (like markdown exports), return the text directly
        return responseText as TResponse
      }

      try {
        responseData = JSON.parse(responseText)
      } catch (e) {
        throw new PromptlianoError(`Invalid JSON response: ${responseText}`, response.status)
      }

      // Handle error responses
      if (!response.ok) {
        if (responseData?.error) {
          throw new PromptlianoError(
            responseData.error.message || 'Unknown error',
            response.status,
            responseData.error.code,
            responseData.error.details
          )
        }
        throw new PromptlianoError(`HTTP ${response.status}: ${response.statusText}`, response.status)
      }

      // Validate response if schema provided
      if (options?.responseSchema && !options.skipValidation) {
        try {
          return options.responseSchema.parse(responseData)
        } catch (e) {
          if (e instanceof z.ZodError) {
            throw new PromptlianoError(
              `Response validation failed: ${e.message}`,
              undefined,
              'VALIDATION_ERROR',
              e.errors
            )
          }
          throw e
        }
      }

      return responseData as TResponse
    } catch (e) {
      console.error(`[Deduplicated API Client] Request failed for ${method} ${url.toString()}:`, e)
      if (e instanceof PromptlianoError) throw e
      if (e instanceof Error) {
        if (e.name === 'AbortError') {
          throw new PromptlianoError('Request timeout', undefined, 'TIMEOUT')
        }
        throw new PromptlianoError(`Request failed: ${e.message}`)
      }
      throw new PromptlianoError('Unknown error occurred')
    }
  }

  /**
   * Record performance metrics
   */
  private recordPerformance(
    method: string, 
    endpoint: string, 
    duration: number, 
    wasDeduplicatable: boolean,
    hadError: boolean = false
  ): void {
    const key = `${method}:${endpoint}`
    const metrics = this.performanceMetrics.get(key) || []
    
    // Store duration with metadata (negative if deduplicated, positive if not)
    const metricValue = wasDeduplicatable ? -duration : duration
    metrics.push(hadError ? 0 : metricValue)
    
    // Keep only last 100 measurements per endpoint
    if (metrics.length > 100) {
      metrics.shift()
    }
    
    this.performanceMetrics.set(key, metrics)
  }

  /**
   * Override HTTP methods to support enhanced options
   */
  protected async get<TResponse>(endpoint: string, options?: EnhancedRequestOptions): Promise<TResponse> {
    return this.request<TResponse>('GET', endpoint, options)
  }

  protected async post<TResponse>(endpoint: string, body?: unknown, options?: EnhancedRequestOptions): Promise<TResponse> {
    return this.request<TResponse>('POST', endpoint, { ...options, body })
  }

  protected async patch<TResponse>(endpoint: string, body?: unknown, options?: EnhancedRequestOptions): Promise<TResponse> {
    return this.request<TResponse>('PATCH', endpoint, { ...options, body })
  }

  protected async put<TResponse>(endpoint: string, body?: unknown, options?: EnhancedRequestOptions): Promise<TResponse> {
    return this.request<TResponse>('PUT', endpoint, { ...options, body })
  }

  protected async delete<TResponse>(endpoint: string, options?: EnhancedRequestOptions): Promise<TResponse> {
    return this.request<TResponse>('DELETE', endpoint, options)
  }

  // ============================================================================
  // Deduplication Management API
  // ============================================================================

  /**
   * Get deduplication statistics
   */
  getDeduplicationStats(): DeduplicationStats {
    return this.deduplicator.getStats()
  }

  /**
   * Get performance metrics for requests
   */
  getPerformanceMetrics(): Record<string, {
    averageTime: number
    deduplicationRate: number
    requestCount: number
    errorRate: number
  }> {
    const result: Record<string, any> = {}
    
    for (const [endpoint, metrics] of this.performanceMetrics.entries()) {
      // Parse the stored metrics based on the recording logic:
      // - Negative values: deduplicated requests (store abs value for time)
      // - Positive values: normal requests  
      // - Zero values: errors (but only if recorded as error, not zero duration)
      
      const deduplicatedRequests = metrics.filter(m => m < 0).map(m => Math.abs(m))
      const normalRequests = metrics.filter(m => m >= 0) // Include zero as valid duration
      const errors = [] // For now, treat all as successful since we don't track errors separately
      
      const totalRequests = metrics.length
      const deduplicationRate = totalRequests > 0 ? (deduplicatedRequests.length / totalRequests) * 100 : 0
      
      // Calculate average time from all successful requests (both normal and deduplicated)
      const allSuccessfulTimes = [...deduplicatedRequests, ...normalRequests]
      const averageTime = allSuccessfulTimes.length > 0 
        ? allSuccessfulTimes.reduce((sum, time) => sum + time, 0) / allSuccessfulTimes.length
        : 0
      
      const errorRate = totalRequests > 0 ? (errors.length / totalRequests) * 100 : 0
      
      result[endpoint] = {
        averageTime: Math.round(averageTime * 100) / 100,
        deduplicationRate: Math.round(deduplicationRate * 100) / 100,
        requestCount: totalRequests,
        errorRate: Math.round(errorRate * 100) / 100
      }
    }
    
    return result
  }

  /**
   * Clear deduplication cache
   */
  clearDeduplicationCache(): void {
    this.deduplicator.clearCache()
  }

  /**
   * Get active deduplication requests
   */
  getActiveRequests(): string[] {
    return this.deduplicator.getActiveRequestKeys()
  }

  /**
   * Abort a specific request
   */
  abortRequest(requestKey: string): boolean {
    return this.deduplicator.abortRequest(requestKey)
  }

  /**
   * Update deduplication configuration
   */
  updateDeduplicationConfig(config: Partial<DeduplicationConfig>): void {
    this.deduplicator.updateConfig(config)
  }

  /**
   * Enable/disable deduplication globally
   */
  setDeduplicationEnabled(enabled: boolean): void {
    this.deduplicationEnabled = enabled
  }

  /**
   * Check if deduplication is enabled
   */
  isDeduplicationEnabled(): boolean {
    return this.deduplicationEnabled
  }

  /**
   * Create a one-time request without deduplication
   */
  async requestWithoutDeduplication<TResponse>(
    method: string,
    endpoint: string,
    options?: Omit<EnhancedRequestOptions, 'deduplication'>
  ): Promise<TResponse> {
    return this.request<TResponse>(method, endpoint, {
      ...options,
      deduplication: { enabled: false }
    })
  }

  /**
   * Cleanup and destroy the client
   */
  destroy(): void {
    this.deduplicator.destroy()
    this.performanceMetrics.clear()
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a deduplicated API client
 */
export function createDeduplicatedApiClient(config: DedicatedApiClientConfig): DeduplicatedApiClient {
  return new DeduplicatedApiClient(config)
}

/**
 * Create a deduplicated API client with query-key optimization
 */
export function createOptimizedApiClient(config: Omit<DedicatedApiClientConfig, 'deduplication'> & {
  deduplication?: Omit<DeduplicationConfig, 'keyGenerator'>
}): DeduplicatedApiClient {
  return new DeduplicatedApiClient({
    ...config,
    deduplication: {
      ...config.deduplication,
      enabled: true,
      useQueryKeys: true
    }
  })
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Decorator for methods that should bypass deduplication
 */
export function withoutDeduplication<T extends (...args: any[]) => Promise<any>>(
  method: T
): T {
  return (async (...args: any[]) => {
    // Implementation would need to be handled by the calling context
    // This is more of a marker function for now
    return method(...args)
  }) as T
}

/**
 * Type guard to check if client supports deduplication
 */
export function isDeduplicatedClient(client: any): client is DeduplicatedApiClient {
  return client instanceof DeduplicatedApiClient
}

// ============================================================================
// Type Exports
// ============================================================================

export type {
  EnhancedRequestOptions,
  DedicatedApiClientConfig
}