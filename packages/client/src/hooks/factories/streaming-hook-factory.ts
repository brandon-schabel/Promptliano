/**
 * Streaming Hook Factory
 * Specialized factory for WebSocket/SSE streaming patterns
 * Used for AI chat, real-time updates, and server-sent events
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions
} from '@tanstack/react-query'
import { toast } from 'sonner'
import type { ApiError } from '@promptliano/shared'

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface StreamingConfig {
  // WebSocket configuration
  websocket?: {
    url: string | ((args: any[]) => string)
    protocols?: string[]
    reconnect?: boolean
    reconnectDelay?: number
    maxRetries?: number
  }
  
  // Server-Sent Events configuration  
  sse?: {
    url: string | ((args: any[]) => string)
    withCredentials?: boolean
    reconnect?: boolean
    reconnectDelay?: number
    maxRetries?: number
  }
  
  // Progress tracking
  progress?: {
    onProgress?: (data: any) => void
    onComplete?: (data: any) => void
    onError?: (error: any) => void
  }
}

export interface StreamingHookConfig<TResponse = any> {
  entityName: string
  queryKeys: {
    all: readonly string[]
    stream: (id: string | number) => readonly unknown[]
  }
  streaming: StreamingConfig
  staleTime?: number
  messages?: {
    streamStart?: string
    streamComplete?: string
    streamError?: string | ((error: any) => string)
  }
}

// ============================================================================
// Streaming Hook Factory
// ============================================================================

export function createStreamingHooks<TResponse = any>(
  config: StreamingHookConfig<TResponse>
) {
  const {
    entityName,
    queryKeys,
    streaming,
    staleTime = 0, // Streaming data is always fresh
    messages = {}
  } = config

  const resolvedMessages = {
    streamStart: messages.streamStart || `${entityName} stream started`,
    streamComplete: messages.streamComplete || `${entityName} stream completed`,
    streamError: messages.streamError || ((error: any) => error?.message || `${entityName} stream failed`)
  }

  // ============================================================================
  // WebSocket Streaming Hook
  // ============================================================================

  function useWebSocketStream(
    id: string | number,
    options?: {
      enabled?: boolean
      onMessage?: (data: any) => void
      onOpen?: () => void
      onClose?: () => void
      onError?: (error: any) => void
    }
  ) {
    const queryClient = useQueryClient()
    
    return useQuery({
      queryKey: queryKeys.stream(id),
      queryFn: () => {
        return new Promise<TResponse>((resolve, reject) => {
          if (!streaming.websocket) {
            reject(new Error('WebSocket configuration not provided'))
            return
          }

          const wsUrl = typeof streaming.websocket.url === 'function'
            ? streaming.websocket.url([id])
            : streaming.websocket.url

          const ws = new WebSocket(wsUrl, streaming.websocket.protocols)
          
          let retryCount = 0
          const maxRetries = streaming.websocket.maxRetries || 3

          ws.onopen = () => {
            options?.onOpen?.()
            retryCount = 0 // Reset retry count on successful connection
          }

          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data)
              options?.onMessage?.(data)
              
              if (data.type === 'complete') {
                resolve(data)
                ws.close()
              } else if (data.type === 'error') {
                reject(new Error(data.message))
                ws.close()
              }
            } catch (error) {
              console.error('Error parsing WebSocket message:', error)
            }
          }

          ws.onerror = (error) => {
            options?.onError?.(error)
            
            // Implement retry logic
            if (retryCount < maxRetries && streaming.websocket?.reconnect) {
              retryCount++
              const delay = (streaming.websocket.reconnectDelay || 1000) * retryCount
              setTimeout(() => {
                // Reconnection would need to be handled at a higher level
                queryClient.refetchQueries({ queryKey: queryKeys.stream(id) })
              }, delay)
            } else {
              reject(error)
            }
          }

          ws.onclose = () => {
            options?.onClose?.()
          }

          // Cleanup function
          return () => {
            ws.close()
          }
        })
      },
      enabled: options?.enabled ?? true,
      staleTime,
      gcTime: 0, // Don't cache streaming data
      refetchOnWindowFocus: false,
      retry: false // Handle retries manually in WebSocket logic
    })
  }

  // ============================================================================
  // Server-Sent Events Hook
  // ============================================================================

  function useSSEStream(
    id: string | number,
    options?: {
      enabled?: boolean
      onProgress?: (data: any) => void
      onComplete?: (data: any) => void
      onError?: (error: any) => void
      abortSignal?: AbortSignal
    }
  ) {
    return useQuery({
      queryKey: queryKeys.stream(id),
      queryFn: () => {
        return new Promise<TResponse>((resolve, reject) => {
          if (!streaming.sse) {
            reject(new Error('SSE configuration not provided'))
            return
          }

          const sseUrl = typeof streaming.sse.url === 'function'
            ? streaming.sse.url([id])
            : streaming.sse.url

          const eventSource = new EventSource(sseUrl)
          
          // Handle abort signal
          if (options?.abortSignal) {
            options.abortSignal.addEventListener('abort', () => {
              eventSource.close()
              reject(new Error('Stream cancelled'))
            })
          }

          let retryCount = 0
          const maxRetries = streaming.sse.maxRetries || 3

          eventSource.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data)

              if (data.type === 'progress') {
                options?.onProgress?.(data.data)
                streaming.progress?.onProgress?.(data.data)
              } else if (data.type === 'complete') {
                options?.onComplete?.(data.data)
                streaming.progress?.onComplete?.(data.data)
                eventSource.close()
                resolve(data.data)
              } else if (data.type === 'error') {
                const error = new Error(data.data.message || 'Stream error')
                options?.onError?.(error)
                streaming.progress?.onError?.(error)
                eventSource.close()
                reject(error)
              }
            } catch (error) {
              console.error('Error parsing SSE data:', error)
            }
          }

          eventSource.onerror = (error) => {
            console.error('SSE error:', error)
            
            // Implement retry logic with exponential backoff
            if (retryCount < maxRetries && streaming.sse?.reconnect) {
              retryCount++
              const retryDelay = Math.min(
                (streaming.sse.reconnectDelay || 1000) * Math.pow(2, retryCount),
                5000
              )
              
              setTimeout(() => {
                eventSource.close()
                // Would need to restart the query at higher level
              }, retryDelay)
            } else {
              eventSource.close()
              reject(new Error('Connection to stream failed after retries'))
            }
          }

          // Cleanup function  
          return () => {
            eventSource.close()
          }
        })
      },
      enabled: options?.enabled ?? true,
      staleTime,
      gcTime: 0,
      refetchOnWindowFocus: false,
      retry: false
    })
  }

  // ============================================================================
  // Streaming Mutation (for initiating streams)
  // ============================================================================

  function useStartStream<TStreamData = any>(
    options?: UseMutationOptions<TResponse, ApiError, TStreamData>
  ) {
    return useMutation({
      mutationFn: async (data: TStreamData) => {
        // This would typically make an API call to start the stream
        // The actual streaming would be handled by the query hooks above
        throw new Error('useStartStream mutationFn must be implemented')
      },
      onMutate: () => {
        toast.loading(resolvedMessages.streamStart)
      },
      onSuccess: (result) => {
        toast.dismiss()
        toast.success(resolvedMessages.streamComplete)
      },
      onError: (error) => {
        toast.dismiss()
        const message = typeof resolvedMessages.streamError === 'function'
          ? resolvedMessages.streamError(error)
          : resolvedMessages.streamError
        toast.error(message)
      },
      ...options
    })
  }

  // ============================================================================
  // Return Streaming Hooks
  // ============================================================================

  return {
    // Streaming query hooks
    useWebSocketStream,
    useSSEStream,
    
    // Streaming mutation hooks
    useStartStream,
    
    // Metadata
    queryKeys,
    entityName,
    streaming
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

export function createStreamingQueryKeys(entityName: string) {
  return {
    all: [entityName, 'stream'] as const,
    stream: (id: string | number) => [entityName, 'stream', id] as const,
    progress: (id: string | number) => [entityName, 'stream', id, 'progress'] as const
  }
}

// ============================================================================
// Type Exports
// ============================================================================

export type { StreamingConfig, StreamingHookConfig }