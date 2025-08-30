import { z } from 'zod'

/**
 * Custom error class for API client operations
 */
export class PromptlianoError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string,
    public details?: any
  ) {
    super(message)
    this.name = 'PromptlianoError'
  }
}

/**
 * API client configuration interface
 */
export interface ApiConfig {
  baseUrl: string
  timeout?: number
  headers?: Record<string, string>
  customFetch?: typeof fetch
}

/**
 * Generic data response wrapper
 * Matches the server's standard response format
 */
export type DataResponseSchema<T> = {
  success: true
  data: T
}

/**
 * Base API client with common functionality shared across all service clients
 */
export class BaseApiClient {
  protected baseUrl: string
  protected timeout: number
  protected headers: Record<string, string>
  protected customFetch: typeof fetch

  constructor(config: ApiConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.timeout = config.timeout || 30000
    this.headers = {
      'Content-Type': 'application/json',
      ...config.headers
    }
    // Ensure fetch maintains its context
    if (config.customFetch) {
      // Wrap the custom fetch to ensure it maintains context
      this.customFetch = config.customFetch
    } else {
      // Bind default fetch to window context for browser environments
      this.customFetch =
        typeof window !== 'undefined' && window.fetch ? (window.fetch.bind(window) as typeof fetch) : fetch
    }
  }

  /**
   * Make a request to the API with proper error handling and validation
   */
  protected async request<TResponse>(
    method: string,
    endpoint: string,
    options?: {
      body?: unknown
      params?: Record<string, string | number | boolean>
      responseSchema?: z.ZodType<TResponse>
      skipValidation?: boolean
      timeout?: number
      expectTextResponse?: boolean
    }
  ): Promise<TResponse> {
    // Handle both absolute and relative URLs
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

    const controller = new AbortController()
    const requestTimeout = options?.timeout || this.timeout
    const timeoutId = setTimeout(() => controller.abort(), requestTimeout)

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
      console.error(`[API Client] Request failed for ${method} ${url.toString()}:`, e)
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
   * Validate request body against schema
   */
  protected validateBody<T>(schema: z.ZodType<T>, data: unknown): T {
    try {
      return schema.parse(data)
    } catch (e) {
      if (e instanceof z.ZodError) {
        throw new PromptlianoError(`Request validation failed: ${e.message}`, undefined, 'VALIDATION_ERROR', e.errors)
      }
      throw e
    }
  }

  /**
   * ErrorFactory pattern helpers for consistent error handling
   */

  /**
   * Assert that a response exists and is not null/undefined
   */
  protected assertResponse<T>(response: T | null | undefined, context: string): T {
    if (response === null || response === undefined) {
      throw new PromptlianoError(`${context}: Response is missing`, undefined, 'ASSERTION_ERROR')
    }
    return response
  }

  /**
   * Assert that an operation was successful
   */
  protected assertSuccess(response: { success: boolean }, operation: string): void {
    if (!response.success) {
      throw new PromptlianoError(`${operation} failed`, undefined, 'OPERATION_FAILED', response)
    }
  }

  /**
   * Validate numeric ID parameters
   */
  protected validateId(id: number, paramName: string): void {
    if (!Number.isInteger(id) || id <= 0) {
      throw new PromptlianoError(`Invalid ${paramName}: must be a positive integer`, undefined, 'VALIDATION_ERROR')
    }
  }

  /**
   * Validate string parameters
   */
  protected validateString(str: string, paramName: string, options?: { minLength?: number; maxLength?: number }): void {
    if (typeof str !== 'string') {
      throw new PromptlianoError(`Invalid ${paramName}: must be a string`, undefined, 'VALIDATION_ERROR')
    }

    if (str.trim().length === 0) {
      throw new PromptlianoError(`Invalid ${paramName}: cannot be empty`, undefined, 'VALIDATION_ERROR')
    }

    if (options?.minLength && str.length < options.minLength) {
      throw new PromptlianoError(
        `Invalid ${paramName}: must be at least ${options.minLength} characters`,
        undefined,
        'VALIDATION_ERROR'
      )
    }

    if (options?.maxLength && str.length > options.maxLength) {
      throw new PromptlianoError(
        `Invalid ${paramName}: must be no more than ${options.maxLength} characters`,
        undefined,
        'VALIDATION_ERROR'
      )
    }
  }

  /**
   * Build query string from object
   */
  protected buildQueryString(params: Record<string, any>): string {
    const searchParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value))
      }
    }
    const queryString = searchParams.toString()
    return queryString ? `?${queryString}` : ''
  }

  /**
   * HTTP GET request
   */
  protected async get<TResponse>(
    endpoint: string,
    options?: {
      params?: Record<string, string | number | boolean>
      responseSchema?: z.ZodType<TResponse>
      skipValidation?: boolean
      timeout?: number
    }
  ): Promise<TResponse> {
    return this.request<TResponse>('GET', endpoint, options)
  }

  /**
   * HTTP POST request
   */
  protected async post<TResponse>(
    endpoint: string,
    body?: unknown,
    options?: {
      params?: Record<string, string | number | boolean>
      responseSchema?: z.ZodType<TResponse>
      skipValidation?: boolean
      timeout?: number
    }
  ): Promise<TResponse> {
    return this.request<TResponse>('POST', endpoint, { ...options, body })
  }

  /**
   * HTTP PATCH request
   */
  protected async patch<TResponse>(
    endpoint: string,
    body?: unknown,
    options?: {
      params?: Record<string, string | number | boolean>
      responseSchema?: z.ZodType<TResponse>
      skipValidation?: boolean
      timeout?: number
    }
  ): Promise<TResponse> {
    return this.request<TResponse>('PATCH', endpoint, { ...options, body })
  }

  /**
   * HTTP PUT request
   */
  protected async put<TResponse>(
    endpoint: string,
    body?: unknown,
    options?: {
      params?: Record<string, string | number | boolean>
      responseSchema?: z.ZodType<TResponse>
      skipValidation?: boolean
      timeout?: number
    }
  ): Promise<TResponse> {
    return this.request<TResponse>('PUT', endpoint, { ...options, body })
  }

  /**
   * HTTP DELETE request
   */
  protected async delete<TResponse>(
    endpoint: string,
    options?: {
      params?: Record<string, string | number | boolean>
      responseSchema?: z.ZodType<TResponse>
      skipValidation?: boolean
      timeout?: number
    }
  ): Promise<TResponse> {
    return this.request<TResponse>('DELETE', endpoint, options)
  }
}
