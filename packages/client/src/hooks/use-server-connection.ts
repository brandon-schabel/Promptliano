import { usePromptlianoClient } from '@/context/promptliano-client-context'
import { CONNECTION_QUERY_KEY, ConnectionSnapshot, selectConnectionError, selectConnectionStatus, selectConnectionTimestamps } from '@/lib/system/connection-status'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Hook for accessing server connection status and management
 */
export function useServerConnection() {
  const queryClient = useQueryClient()
  const snapshot = queryClient.getQueryData<ConnectionSnapshot>(CONNECTION_QUERY_KEY)

  const {
    serverUrl,
    setServerUrl,
    connectionStatus,
    connectionError,
    testConnection,
    savedServers,
    addSavedServer,
    removeSavedServer,
    reconnect
  } = usePromptlianoClient()

  const resolvedStatus = selectConnectionStatus(snapshot)
  const resolvedError = selectConnectionError(snapshot)
  const { lastCheckedAt, lastSuccessfulConnectionAt } = selectConnectionTimestamps(snapshot)

  return {
    serverUrl,
    setServerUrl,
    connectionStatus: resolvedStatus,
    connectionError: resolvedError,
    lastCheckedAt,
    lastSuccessfulConnectionAt,
    isConnected: resolvedStatus === 'connected',
    isConnecting: resolvedStatus === 'connecting',
    isDisconnected: resolvedStatus === 'disconnected',
    hasError: resolvedStatus === 'error',
    testConnection,
    savedServers,
    addSavedServer,
    removeSavedServer,
    reconnect
  }
}
