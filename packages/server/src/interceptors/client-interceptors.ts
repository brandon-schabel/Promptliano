/**
 * Client-side interceptor system for HTTP requests
 * Provides request/response/error interception capabilities for fetch requests
 */

// DOM types for Node.js environments
type RequestCredentials = 'same-origin' | 'include' | 'omit'
type RequestInfo = string | Request

export interface ClientInterceptorConfig {
  /** Whether the interceptor system is enabled */
  enabled: boolean
  /** Request timeout in milliseconds */
  timeout: number
  /** Number of retry attempts for failed requests */
  retries: number
  /** Base URL for relative requests */
  baseURL?: string
  /** Default headers to include with all requests */
  defaultHeaders?: Record<string, string>
  /** Whether to include credentials with requests */
  credentials?: RequestCredentials
}

export interface ClientInterceptorContext {
  /** The request being made */
  request: Request
  /** The response (if available) */
  response?: Response
  /** Any error that occurred */
  error?: Error
  /** Metadata that can be shared between interceptors */
  metadata: Record<string, any>
  /** Start time of the request */
  startTime: number
  /** Duration of the request (set after response) */
  duration?: number
  /** Current attempt number (for retries) */
  attempt: number
  /** Configuration for this request */
  config: ClientInterceptorConfig
}

export type ClientInterceptorType = 'request' | 'response' | 'error'

export interface ClientInterceptor {
  /** Unique name for the interceptor */
  name: string
  /** Type of interceptor */
  type: ClientInterceptorType
  /** Execution order (lower numbers run first) */
  order: number
  /** Whether this interceptor is enabled */
  enabled: boolean
  /** The interceptor handler function */
  handler: (context: ClientInterceptorContext) => Promise<ClientInterceptorContext>
  /** Optional description */
  description?: string
  /** Tags for categorization */
  tags?: string[]
}

export type ClientRequestInterceptor = ClientInterceptor & { type: 'request' }
export type ClientResponseInterceptor = ClientInterceptor & { type: 'response' }
export type ClientErrorInterceptor = ClientInterceptor & { type: 'error' }

export interface ClientFetchOptions extends RequestInit {
  /** Override timeout for this request */
  timeout?: number
  /** Override retry count for this request */
  retries?: number
  /** Additional metadata for this request */
  metadata?: Record<string, any>
}

/**
 * Client-side interceptor system
 */
export class ClientInterceptorSystem {
  private config: ClientInterceptorConfig
  private interceptors: ClientInterceptor[] = []

  constructor(config?: Partial<ClientInterceptorConfig>) {
    this.config = {
      enabled: true,
      timeout: 30000, // 30 seconds
      retries: 3,
      ...config
    }
  }

  /**
   * Add an interceptor to the system
   */
  addInterceptor(interceptor: ClientInterceptor): void {
    // Remove existing interceptor with same name
    this.removeInterceptor(interceptor.name)

    // Add new interceptor and sort by order
    this.interceptors.push(interceptor)
    this.interceptors.sort((a, b) => a.order - b.order)
  }

  /**
   * Remove an interceptor by name
   */
  removeInterceptor(name: string): boolean {
    const index = this.interceptors.findIndex((i) => i.name === name)
    if (index >= 0) {
      this.interceptors.splice(index, 1)
      return true
    }
    return false
  }

  /**
   * Clear all interceptors
   */
  clearInterceptors(): void {
    this.interceptors = []
  }

  /**
   * Enable or disable an interceptor
   */
  setInterceptorEnabled(name: string, enabled: boolean): boolean {
    const interceptor = this.interceptors.find((i) => i.name === name)
    if (interceptor) {
      interceptor.enabled = enabled
      return true
    }
    return false
  }

  /**
   * Get all interceptors
   */
  getInterceptors(): ClientInterceptor[] {
    return [...this.interceptors]
  }

  /**
   * Get configuration
   */
  getConfig(): ClientInterceptorConfig {
    return { ...this.config }
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ClientInterceptorConfig>): void {
    this.config = { ...this.config, ...updates }
  }

  /**
   * Enhanced fetch with interceptor support
   */
  async fetch(input: RequestInfo | URL, options?: ClientFetchOptions): Promise<Response> {
    // If system is disabled, use native fetch
    if (!this.config.enabled) {
      return this.nativeFetch(input, options)
    }

    const startTime = Date.now()
    const requestConfig = { ...this.config, ...options }
    const maxAttempts = (options?.retries ?? this.config.retries) + 1

    let lastError: Error | undefined

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await this.executeRequest(input, options, startTime, attempt)
        return result
      } catch (error) {
        lastError = error as Error

        // Don't retry on last attempt
        if (attempt === maxAttempts) {
          break
        }

        // Only retry on network errors, not HTTP errors
        if (error instanceof TypeError && error.message.includes('fetch')) {
          // Wait before retry (exponential backoff)
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
          await new Promise((resolve) => setTimeout(resolve, delay))
          continue
        } else {
          // Don't retry HTTP errors or other types
          break
        }
      }
    }

    // If we get here, all attempts failed
    throw lastError || new Error('Request failed after all retry attempts')
  }

  /**
   * Execute a single request attempt with interceptors
   */
  private async executeRequest(
    input: RequestInfo | URL,
    options?: ClientFetchOptions,
    startTime: number = Date.now(),
    attempt: number = 1
  ): Promise<Response> {
    // Create initial request
    const request = this.createRequest(input, options)

    // Create context
    let context: ClientInterceptorContext = {
      request,
      metadata: { ...options?.metadata },
      startTime,
      attempt,
      config: { ...this.config, ...options }
    }

    try {
      // Execute request interceptors
      context = await this.executeInterceptors('request', context)

      // Make the actual fetch call with timeout
      const timeout = options?.timeout ?? this.config.timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      try {
        const response = await this.nativeFetch(context.request, {
          ...options,
          signal: controller.signal
        })
        clearTimeout(timeoutId)

        context.response = response
        context.duration = Date.now() - startTime

        // Execute response interceptors
        context = await this.executeInterceptors('response', context)

        return context.response!
      } catch (fetchError) {
        clearTimeout(timeoutId)

        if (controller.signal.aborted) {
          throw new Error('Request timeout')
        }

        throw fetchError
      }
    } catch (error) {
      // Execute error interceptors
      context.error = error as Error
      context.duration = Date.now() - startTime

      context = await this.executeInterceptors('error', context)

      // If error interceptor provided a response, return it
      if (context.response) {
        return context.response
      }

      // Otherwise, re-throw the error
      throw context.error
    }
  }

  /**
   * Execute interceptors of a specific type
   */
  private async executeInterceptors(
    type: ClientInterceptorType,
    context: ClientInterceptorContext
  ): Promise<ClientInterceptorContext> {
    const interceptors = this.interceptors.filter((i) => i.type === type && i.enabled).sort((a, b) => a.order - b.order)

    for (const interceptor of interceptors) {
      try {
        context = await interceptor.handler(context)
      } catch (error) {
        // If an interceptor fails, log the error but continue
        console.error(`Client interceptor '${interceptor.name}' failed:`, error)

        // For error interceptors, we still want to continue processing
        if (type === 'error') {
          continue
        }

        // For request/response interceptors, treat as an error
        throw error
      }
    }

    return context
  }

  /**
   * Create a Request object from input and options
   */
  private createRequest(input: RequestInfo | URL, options?: ClientFetchOptions): Request {
    // Handle base URL
    let url: string
    if (typeof input === 'string') {
      if (input.startsWith('http://') || input.startsWith('https://')) {
        url = input
      } else if (this.config.baseURL) {
        url = new URL(input, this.config.baseURL).toString()
      } else {
        // For relative URLs without base URL, assume localhost for testing
        url = `http://localhost${input.startsWith('/') ? input : '/' + input}`
      }
    } else if (input instanceof URL) {
      url = input.toString()
    } else {
      // input is a Request
      url = input.url
    }

    // Merge headers
    const headers = new Headers()

    // Add default headers
    if (this.config.defaultHeaders) {
      Object.entries(this.config.defaultHeaders).forEach(([key, value]) => {
        headers.set(key, value)
      })
    }

    // Add request headers
    if (options?.headers) {
      const requestHeaders = new Headers(options.headers)
      requestHeaders.forEach((value, key) => {
        headers.set(key, value)
      })
    }

    // If input is already a Request, copy its headers
    if (input instanceof Request) {
      input.headers.forEach((value, key) => {
        headers.set(key, value)
      })
    }

    // Create request init
    const requestInit: RequestInit = {
      method: 'GET',
      ...options,
      headers,
      credentials: options?.credentials ?? this.config.credentials
    }

    // If input is a Request, merge its properties
    if (input instanceof Request) {
      requestInit.method = input.method
      requestInit.body = input.body
      if (!options?.credentials) {
        requestInit.credentials = input.credentials
      }
    }

    return new Request(url, requestInit)
  }

  /**
   * Native fetch implementation (can be overridden for testing)
   */
  private async nativeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    return fetch(input, init)
  }
}

/**
 * Helper function to create client interceptors
 */
export function createClientInterceptor(config: {
  name: string
  type: ClientInterceptorType
  order: number
  enabled?: boolean
  description?: string
  tags?: string[]
  handler: (context: ClientInterceptorContext) => Promise<ClientInterceptorContext>
}): ClientInterceptor {
  return {
    enabled: true,
    ...config
  }
}

/**
 * Pre-built interceptors for common use cases
 */
export const ClientInterceptors = {
  /**
   * Add authentication token to requests
   */
  auth: (getToken: () => string | Promise<string>): ClientRequestInterceptor =>
    createClientInterceptor({
      name: 'auth',
      type: 'request',
      order: 10,
      description: 'Add authentication token to requests',
      tags: ['auth', 'security'],
      handler: async (context) => {
        const token = await getToken()
        if (token) {
          context.request.headers.set('Authorization', `Bearer ${token}`)
        }
        return context
      }
    }) as ClientRequestInterceptor,

  /**
   * Add request ID for tracing
   */
  requestId: (): ClientRequestInterceptor =>
    createClientInterceptor({
      name: 'request-id',
      type: 'request',
      order: 5,
      description: 'Add unique request ID for tracing',
      tags: ['logging', 'tracing'],
      handler: async (context) => {
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        context.request.headers.set('X-Request-ID', requestId)
        context.metadata.requestId = requestId
        return context
      }
    }) as ClientRequestInterceptor,

  /**
   * Log requests and responses
   */
  logger: (logger: (level: string, message: string, data?: any) => void = console.log): ClientInterceptor[] => [
    createClientInterceptor({
      name: 'request-logger',
      type: 'request',
      order: 100,
      description: 'Log outgoing requests',
      tags: ['logging'],
      handler: async (context) => {
        logger('info', 'HTTP Request', {
          method: context.request.method,
          url: context.request.url,
          headers: Object.fromEntries(context.request.headers.entries()),
          attempt: context.attempt
        })
        return context
      }
    }),
    createClientInterceptor({
      name: 'response-logger',
      type: 'response',
      order: 100,
      description: 'Log incoming responses',
      tags: ['logging'],
      handler: async (context) => {
        logger('info', 'HTTP Response', {
          status: context.response?.status,
          statusText: context.response?.statusText,
          headers: context.response ? Object.fromEntries(context.response.headers.entries()) : {},
          duration: context.duration,
          url: context.request.url
        })
        return context
      }
    })
  ],

  /**
   * Handle common HTTP errors
   */
  errorHandler: (): ClientErrorInterceptor =>
    createClientInterceptor({
      name: 'error-handler',
      type: 'error',
      order: 10,
      description: 'Handle common HTTP errors',
      tags: ['error-handling'],
      handler: async (context) => {
        if (context.error) {
          console.error('HTTP Request Error:', {
            url: context.request.url,
            method: context.request.method,
            error: context.error.message,
            attempt: context.attempt
          })
        }

        if (context.response && !context.response.ok) {
          console.error('HTTP Response Error:', {
            url: context.request.url,
            status: context.response.status,
            statusText: context.response.statusText
          })
        }

        return context
      }
    }) as ClientErrorInterceptor,

  /**
   * Add Content-Type header for JSON requests
   */
  json: (): ClientRequestInterceptor =>
    createClientInterceptor({
      name: 'json-content-type',
      type: 'request',
      order: 15,
      description: 'Set Content-Type header for JSON requests',
      tags: ['json', 'headers'],
      handler: async (context) => {
        if (context.request.body && !context.request.headers.has('Content-Type')) {
          // Check if body looks like JSON
          const body = context.request.body
          if (typeof body === 'string' || body instanceof ReadableStream) {
            context.request.headers.set('Content-Type', 'application/json')
          }
        }
        return context
      }
    }) as ClientRequestInterceptor,

  /**
   * Transform response based on Content-Type
   */
  autoTransform: (): ClientResponseInterceptor =>
    createClientInterceptor({
      name: 'auto-transform',
      type: 'response',
      order: 20,
      description: 'Automatically parse response based on Content-Type',
      tags: ['transform', 'parsing'],
      handler: async (context) => {
        if (context.response) {
          const contentType = context.response.headers.get('Content-Type')

          // Store parsed data in metadata for easy access
          if (contentType?.includes('application/json')) {
            try {
              const clonedResponse = context.response.clone()
              context.metadata.data = await clonedResponse.json()
            } catch (error) {
              console.warn('Failed to parse JSON response:', error)
            }
          } else if (contentType?.includes('text/')) {
            try {
              const clonedResponse = context.response.clone()
              context.metadata.data = await clonedResponse.text()
            } catch (error) {
              console.warn('Failed to parse text response:', error)
            }
          }
        }

        return context
      }
    }) as ClientResponseInterceptor
}

/**
 * Create a default client interceptor system with common interceptors
 */
export function createDefaultClientSystem(config?: {
  baseURL?: string
  getAuthToken?: () => string | Promise<string>
  enableLogging?: boolean
}): ClientInterceptorSystem {
  const system = new ClientInterceptorSystem({
    baseURL: config?.baseURL,
    defaultHeaders: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }
  })

  // Add request ID interceptor
  system.addInterceptor(ClientInterceptors.requestId())

  // Add auth interceptor if token getter provided
  if (config?.getAuthToken) {
    system.addInterceptor(ClientInterceptors.auth(config.getAuthToken))
  }

  // Add JSON content type interceptor
  system.addInterceptor(ClientInterceptors.json())

  // Add logging if enabled
  if (config?.enableLogging) {
    ClientInterceptors.logger().forEach((interceptor) => {
      system.addInterceptor(interceptor)
    })
  }

  // Add auto-transform interceptor
  system.addInterceptor(ClientInterceptors.autoTransform())

  // Add error handler
  system.addInterceptor(ClientInterceptors.errorHandler())

  return system
}

/**
 * Global client interceptor system instance
 */
let globalClientSystem: ClientInterceptorSystem | undefined

/**
 * Get or create the global client interceptor system
 */
export function getGlobalClientSystem(): ClientInterceptorSystem {
  if (!globalClientSystem) {
    globalClientSystem = createDefaultClientSystem()
  }
  return globalClientSystem
}

/**
 * Set the global client interceptor system
 */
export function setGlobalClientSystem(system: ClientInterceptorSystem): void {
  globalClientSystem = system
}

/**
 * Enhanced fetch using the global client system
 */
export function enhancedFetch(input: RequestInfo | URL, options?: ClientFetchOptions): Promise<Response> {
  return getGlobalClientSystem().fetch(input, options)
}
