/**
 * Realtime Hooks Factory - WebSocket and polling patterns for live data
 * 
 * This factory creates hooks for:
 * - WebSocket subscriptions with auto-reconnection
 * - Polling with configurable intervals
 * - Event-based updates with optimistic UI
 * - Connection status management
 * - Message queuing for offline support
 */

import {
  useQuery,
  useQueryClient,
  type UseQueryOptions,
  type UseQueryResult
} from '@tanstack/react-query'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { useApiClient } from '../api/use-api-client'
import { createQueryKeys, type QueryKeyFactory } from './query-key-factory'

/**
 * WebSocket connection states
 */
export enum ConnectionState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

/**
 * WebSocket configuration
 */
export interface WebSocketConfig {
  /**
   * WebSocket URL (defaults to auto-detect from window.location)
   */
  url?: string
  
  /**
   * Reconnection options
   */
  reconnect?: {
    enabled?: boolean
    maxAttempts?: number
    delay?: number
    backoff?: number
  }
  
  /**
   * Heartbeat/ping configuration
   */
  heartbeat?: {
    enabled?: boolean
    interval?: number
    timeout?: number
  }
  
  /**
   * Message queue for offline support
   */
  queue?: {
    enabled?: boolean
    maxSize?: number
    persist?: boolean
  }
}

/**
 * Polling configuration
 */
export interface PollingConfig {
  /**
   * Polling interval in milliseconds
   */
  interval?: number
  
  /**
   * Continue polling in background
   */
  backgroundRefetch?: boolean
  
  /**
   * Stop polling on error
   */
  stopOnError?: boolean
  
  /**
   * Dynamic interval based on activity
   */
  dynamicInterval?: {
    idle?: number
    active?: number
    focused?: number
  }
}

/**
 * Realtime subscription configuration
 */
export interface RealtimeConfig<TEntity> {
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
   * WebSocket configuration
   */
  websocket?: WebSocketConfig
  
  /**
   * Polling configuration
   */
  polling?: PollingConfig
  
  /**
   * Event handlers
   */
  events?: {
    onConnect?: () => void
    onDisconnect?: () => void
    onMessage?: (data: TEntity) => void
    onError?: (error: Error) => void
  }
}

/**
 * Realtime message types
 */
export interface RealtimeMessage<T = any> {
  type: 'create' | 'update' | 'delete' | 'sync' | 'heartbeat' | 'error'
  entity?: string
  id?: number | string
  data?: T
  timestamp?: number
  error?: string
}

/**
 * Realtime hooks return type
 */
export interface RealtimeHooks<TEntity> {
  // WebSocket subscription
  useWebSocketSubscription: (
    channel: string,
    options?: UseQueryOptions<TEntity[]>
  ) => {
    data: TEntity[]
    connectionState: ConnectionState
    isConnected: boolean
    error: Error | null
    send: (message: any) => void
    reconnect: () => void
    disconnect: () => void
  }
  
  // Polling hook
  usePolling: (
    fetcher: () => Promise<TEntity[]>,
    options?: PollingConfig & UseQueryOptions<TEntity[]>
  ) => UseQueryResult<TEntity[], Error> & {
    isPolling: boolean
    startPolling: () => void
    stopPolling: () => void
    setInterval: (interval: number) => void
  }
  
  // Event subscription
  useEventSubscription: <TEvent = any>(
    eventName: string,
    handler: (event: TEvent) => void
  ) => {
    isSubscribed: boolean
    subscribe: () => void
    unsubscribe: () => void
  }
  
  // Presence tracking
  usePresence: (
    roomId: string
  ) => {
    users: Array<{ id: string; name: string; status: string }>
    updateStatus: (status: string) => void
    isTracking: boolean
  }
  
  // Live query with automatic updates
  useLiveQuery: (
    params?: any,
    options?: UseQueryOptions<TEntity[]>
  ) => UseQueryResult<TEntity[], Error> & {
    isLive: boolean
    lastUpdate: Date | null
  }
  
  // Optimistic streaming
  useOptimisticStream: () => {
    messages: TEntity[]
    addOptimistic: (message: Partial<TEntity>) => string
    confirmMessage: (tempId: string, realMessage: TEntity) => void
    removeOptimistic: (tempId: string) => void
  }
}

/**
 * Create realtime hooks for live data synchronization
 */
export function createRealtimeHooks<TEntity extends { id: number | string }>(
  config: RealtimeConfig<TEntity>
): RealtimeHooks<TEntity> {
  const {
    entityName,
    clientPath,
    websocket = {},
    polling = {},
    events = {}
  } = config

  // Create query keys
  const KEYS = config.queryKeys || createQueryKeys(clientPath)

  /**
   * WebSocket subscription hook
   */
  const useWebSocketSubscription = (
    channel: string,
    options?: UseQueryOptions<TEntity[]>
  ) => {
    const [data, setData] = useState<TEntity[]>([])
    const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED)
    const [error, setError] = useState<Error | null>(null)
    const wsRef = useRef<WebSocket | null>(null)
    const reconnectAttemptsRef = useRef(0)
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const messageQueueRef = useRef<any[]>([])
    const queryClient = useQueryClient()

    // Determine WebSocket URL
    const wsUrl = useMemo(() => {
      if (websocket.url) return websocket.url
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      return `${protocol}//${window.location.host}/ws`
    }, [websocket.url])

    // Connect to WebSocket
    const connect = useCallback(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return

      try {
        setConnectionState(ConnectionState.CONNECTING)
        const ws = new WebSocket(`${wsUrl}/${channel}`)
        wsRef.current = ws

        ws.onopen = () => {
          setConnectionState(ConnectionState.CONNECTED)
          reconnectAttemptsRef.current = 0
          setError(null)
          events.onConnect?.()

          // Send queued messages
          while (messageQueueRef.current.length > 0) {
            const msg = messageQueueRef.current.shift()
            ws.send(JSON.stringify(msg))
          }

          // Start heartbeat if configured
          if (websocket.heartbeat?.enabled !== false) {
            heartbeatIntervalRef.current = setInterval(() => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'heartbeat' }))
              }
            }, websocket.heartbeat?.interval || 30000)
          }
        }

        ws.onmessage = (event) => {
          try {
            const message: RealtimeMessage<TEntity> = JSON.parse(event.data)
            
            switch (message.type) {
              case 'create':
                setData(prev => [...prev, message.data as TEntity])
                queryClient.invalidateQueries({ queryKey: KEYS.lists() })
                break
              
              case 'update':
                setData(prev => prev.map(item => 
                  item.id === message.id ? { ...item, ...message.data } : item
                ))
                queryClient.invalidateQueries({ queryKey: KEYS.detail(message.id!) })
                break
              
              case 'delete':
                setData(prev => prev.filter(item => item.id !== message.id))
                queryClient.invalidateQueries({ queryKey: KEYS.lists() })
                break
              
              case 'sync':
                setData(message.data as unknown as TEntity[])
                break
              
              case 'heartbeat':
                // Heartbeat acknowledged
                break
              
              case 'error':
                setError(new Error(message.error || 'Unknown error'))
                break
            }
            
            events.onMessage?.(message.data as TEntity)
          } catch (err) {
            console.error('Failed to parse WebSocket message:', err)
          }
        }

        ws.onerror = (event) => {
          const err = new Error('WebSocket error')
          setError(err)
          setConnectionState(ConnectionState.ERROR)
          events.onError?.(err)
        }

        ws.onclose = () => {
          setConnectionState(ConnectionState.DISCONNECTED)
          events.onDisconnect?.()
          
          // Clear heartbeat
          if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current)
          }

          // Attempt reconnection if enabled
          if (websocket.reconnect?.enabled !== false) {
            const maxAttempts = websocket.reconnect?.maxAttempts || 5
            if (reconnectAttemptsRef.current < maxAttempts) {
              setConnectionState(ConnectionState.RECONNECTING)
              const delay = (websocket.reconnect?.delay || 1000) * 
                Math.pow(websocket.reconnect?.backoff || 2, reconnectAttemptsRef.current)
              
              reconnectTimeoutRef.current = setTimeout(() => {
                reconnectAttemptsRef.current++
                connect()
              }, delay)
            }
          }
        }
      } catch (err) {
        setError(err as Error)
        setConnectionState(ConnectionState.ERROR)
      }
    }, [wsUrl, channel, queryClient, events, websocket, KEYS])

    // Send message through WebSocket
    const send = useCallback((message: any) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(message))
      } else if (websocket.queue?.enabled !== false) {
        // Queue message if offline
        messageQueueRef.current.push(message)
        if (websocket.queue?.maxSize && messageQueueRef.current.length > websocket.queue.maxSize) {
          messageQueueRef.current.shift() // Remove oldest
        }
      }
    }, [websocket.queue])

    // Manual reconnect
    const reconnect = useCallback(() => {
      disconnect()
      reconnectAttemptsRef.current = 0
      connect()
    }, [connect])

    // Disconnect
    const disconnect = useCallback(() => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      setConnectionState(ConnectionState.DISCONNECTED)
    }, [])

    // Auto-connect on mount
    useEffect(() => {
      connect()
      return () => disconnect()
    }, [connect, disconnect])

    return {
      data,
      connectionState,
      isConnected: connectionState === ConnectionState.CONNECTED,
      error,
      send,
      reconnect,
      disconnect
    }
  }

  /**
   * Polling hook with dynamic intervals
   */
  const usePolling = (
    fetcher: () => Promise<TEntity[]>,
    options?: PollingConfig & UseQueryOptions<TEntity[]>
  ) => {
    const [isPolling, setIsPolling] = useState(true)
    const [currentInterval, setCurrentInterval] = useState(options?.interval || 5000)
    const client = useApiClient()

    // Determine interval based on page visibility and focus
    useEffect(() => {
      if (!options?.dynamicInterval) return

      const handleVisibilityChange = () => {
        if (document.hidden) {
          setCurrentInterval(options.dynamicInterval?.idle || 30000)
        } else if (document.hasFocus()) {
          setCurrentInterval(options.dynamicInterval?.focused || 5000)
        } else {
          setCurrentInterval(options.dynamicInterval?.active || 10000)
        }
      }

      document.addEventListener('visibilitychange', handleVisibilityChange)
      window.addEventListener('focus', handleVisibilityChange)
      window.addEventListener('blur', handleVisibilityChange)

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        window.removeEventListener('focus', handleVisibilityChange)
        window.removeEventListener('blur', handleVisibilityChange)
      }
    }, [options?.dynamicInterval])

    const query = useQuery({
      queryKey: [...KEYS.all, 'polling', currentInterval],
      queryFn: fetcher,
      refetchInterval: isPolling ? currentInterval : false,
      refetchIntervalInBackground: options?.backgroundRefetch !== false,
      enabled: isPolling && !!client,
      ...options
    })

    return {
      ...query,
      isPolling,
      startPolling: () => setIsPolling(true),
      stopPolling: () => setIsPolling(false),
      setInterval: (interval: number) => setCurrentInterval(interval)
    }
  }

  /**
   * Event subscription hook
   */
  const useEventSubscription = <TEvent = any>(
    eventName: string,
    handler: (event: TEvent) => void
  ) => {
    const [isSubscribed, setIsSubscribed] = useState(false)
    const eventSourceRef = useRef<EventSource | null>(null)

    const subscribe = useCallback(() => {
      if (eventSourceRef.current) return

      const eventSource = new EventSource(`/api/events/${entityName}/${eventName}`)
      eventSourceRef.current = eventSource

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          handler(data)
        } catch (err) {
          console.error('Failed to parse event data:', err)
        }
      }

      eventSource.onerror = () => {
        setIsSubscribed(false)
        eventSource.close()
        eventSourceRef.current = null
      }

      setIsSubscribed(true)
    }, [eventName, handler])

    const unsubscribe = useCallback(() => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
        setIsSubscribed(false)
      }
    }, [])

    useEffect(() => {
      return () => unsubscribe()
    }, [unsubscribe])

    return {
      isSubscribed,
      subscribe,
      unsubscribe
    }
  }

  /**
   * Presence tracking hook
   */
  const usePresence = (roomId: string) => {
    const [users, setUsers] = useState<Array<{ id: string; name: string; status: string }>>([])
    const [isTracking, setIsTracking] = useState(false)
    const { data, send, isConnected } = useWebSocketSubscription(`presence/${roomId}`)

    useEffect(() => {
      if (isConnected) {
        send({ type: 'join', roomId })
        setIsTracking(true)

        return () => {
          send({ type: 'leave', roomId })
          setIsTracking(false)
        }
      }
    }, [isConnected, roomId, send])

    const updateStatus = useCallback((status: string) => {
      send({ type: 'status', status })
    }, [send])

    return {
      users: data as any || [],
      updateStatus,
      isTracking
    }
  }

  /**
   * Live query with automatic updates
   */
  const useLiveQuery = (
    params?: any,
    options?: UseQueryOptions<TEntity[]>
  ) => {
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
    const client = useApiClient()
    
    // Regular query
    const query = useQuery({
      queryKey: [...KEYS.all, 'live', params],
      queryFn: async () => {
        if (!client) throw new Error('API client not initialized')
        const api = (client as any)[clientPath]
        if (!api?.list) throw new Error(`API client missing list method for ${clientPath}`)
        
        const response = await api.list(params)
        setLastUpdate(new Date())
        return response.data || response
      },
      ...options
    })

    // Subscribe to updates
    const { data: updates } = useWebSocketSubscription(`${entityName}/updates`)
    
    // Merge updates with query data
    const mergedData = useMemo(() => {
      if (!query.data) return []
      if (!updates || updates.length === 0) return query.data
      
      // Merge updates into query data
      const merged = [...query.data]
      updates.forEach((update: any) => {
        const index = merged.findIndex(item => item.id === update.id)
        if (index >= 0) {
          merged[index] = { ...merged[index], ...update }
        } else {
          merged.push(update)
        }
      })
      
      return merged
    }, [query.data, updates])

    return {
      ...query,
      data: mergedData,
      isLive: true,
      lastUpdate
    } as UseQueryResult<TEntity[], Error> & {
      isLive: boolean
      lastUpdate: Date | null
    }
  }

  /**
   * Optimistic streaming for chat-like interfaces
   */
  const useOptimisticStream = () => {
    const [messages, setMessages] = useState<TEntity[]>([])
    const tempIdMapRef = useRef<Map<string, TEntity>>(new Map())

    const addOptimistic = useCallback((message: Partial<TEntity>) => {
      const tempId = `temp-${Date.now()}-${Math.random()}`
      const optimisticMessage = ({
        ...message,
        id: tempId,
        pending: true,
        createdAt: new Date().toISOString()
      } as unknown as TEntity)

      setMessages(prev => [...prev, optimisticMessage])
      tempIdMapRef.current.set(tempId, optimisticMessage)
      
      return tempId
    }, [])

    const confirmMessage = useCallback((tempId: string, realMessage: TEntity) => {
      setMessages(prev => prev.map(msg => 
        (msg.id === tempId) ? realMessage : msg
      ))
      tempIdMapRef.current.delete(tempId)
    }, [])

    const removeOptimistic = useCallback((tempId: string) => {
      setMessages(prev => prev.filter(msg => msg.id !== tempId))
      tempIdMapRef.current.delete(tempId)
    }, [])

    return {
      messages,
      addOptimistic,
      confirmMessage,
      removeOptimistic
    }
  }

  return {
    useWebSocketSubscription,
    usePolling,
    useEventSubscription,
    usePresence,
    useLiveQuery,
    useOptimisticStream
  }
}