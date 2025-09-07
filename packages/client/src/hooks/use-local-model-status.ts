import { useQuery } from '@tanstack/react-query'
import { useApiClient } from '@/hooks/api/use-api-client'
import { useEffect, useRef } from 'react'

// Default URLs for local model providers
const DEFAULT_OLLAMA_URL = 'http://localhost:11434'
const DEFAULT_LMSTUDIO_URL = 'http://localhost:1234'

export type LocalModelProvider = 'ollama' | 'lmstudio'

interface ConnectionStatus {
  connected: boolean
  error?: string
  lastChecked?: Date
  url?: string
}

interface UseLocalModelStatusOptions {
  url?: string
  enabled?: boolean
  refetchInterval?: number
}

export function useLocalModelStatus(provider: LocalModelProvider, options: UseLocalModelStatusOptions = {}) {
  const { url, enabled = true, refetchInterval = 5000 } = options
  const previousUrlRef = useRef(url)
  const client = useApiClient()

  const query = useQuery({
    queryKey: ['local-model-status', provider, url || 'default'],
    queryFn: async (): Promise<ConnectionStatus> => {
      // Use custom URL if provided, otherwise use default
      const testUrl = url || (provider === 'ollama' ? DEFAULT_OLLAMA_URL : DEFAULT_LMSTUDIO_URL)
      console.log(`[${provider}] Testing connection to:`, testUrl)

      // Return disconnected status if client is not available
      if (!client) {
        return {
          connected: false,
          error: 'Client not connected',
          lastChecked: new Date(),
          url: testUrl
        }
      }

      try {
        // Create a timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Connection timeout')), 2000)
        })

        // Create the fetch promise
        const fetchPromise = (async () => {
          const urlParams = provider === 'ollama' ? { ollamaUrl: testUrl } : { lmstudioUrl: testUrl }

          return await client.genAi.getModels(provider, urlParams)
        })()

        // Race between timeout and fetch
        const response = (await Promise.race([fetchPromise, timeoutPromise])) as any

        // Accept both wrapped and unwrapped shapes
        const models = Array.isArray(response)
          ? response
          : response && typeof response === 'object' && 'data' in response
            ? (response as any).data
            : null

        if (Array.isArray(models)) {
          console.log(`[${provider}] Connected! Found ${models.length} models`)
          return {
            connected: true,
            lastChecked: new Date(),
            url: testUrl
          }
        }

        console.log(`[${provider}] Invalid response:`, response)
        return {
          connected: false,
          error: 'Invalid response from server',
          lastChecked: new Date(),
          url: testUrl
        }
      } catch (error: any) {
        console.log(`[${provider}] Connection failed:`, error.message)
        return {
          connected: false,
          error: error.message || 'Connection failed',
          lastChecked: new Date(),
          url: testUrl
        }
      }
    },
    enabled: enabled && !!client,
    refetchInterval: enabled ? refetchInterval : false,
    staleTime: 2000,
    retry: false
  })

  // Refetch immediately when URL changes
  useEffect(() => {
    if (url !== previousUrlRef.current) {
      query.refetch()
      previousUrlRef.current = url
    }
  }, [url, query])

  // Trigger initial fetch on mount
  useEffect(() => {
    query.refetch()
  }, [])

  return {
    isConnected: query.data?.connected ?? false,
    isChecking: query.isLoading || query.isFetching,
    error: query.data?.error,
    lastChecked: query.data?.lastChecked,
    refetch: query.refetch
  }
}
