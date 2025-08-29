import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiClient } from '../api/use-api-client'

const QUERY_KEY = ['security', 'encryption-key-status'] as const

export function useEncryptionKeyStatus() {
  const client = useApiClient()
  return useQuery({
    queryKey: QUERY_KEY,
    enabled: !!client,
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      const res = await client.security.getEncryptionKeyStatus()
      // { success: true, data: { hasKey, isDefault } }
      return res?.data as { hasKey: boolean; isDefault: boolean }
    },
    staleTime: 60_000
  })
}

export function useSetEncryptionKey() {
  const client = useApiClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { key?: string; generate?: boolean }) => {
      if (!client) throw new Error('API client not initialized')
      return client.security.setEncryptionKey(params)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY })
    }
  })
}

export function useUseDefaultEncryptionKey() {
  const client = useApiClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('API client not initialized')
      return client.security.useDefaultEncryptionKey()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY })
    }
  })
}

export function useRotateEncryptionKey() {
  const client = useApiClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { newKey?: string; generate?: boolean; reencryptExisting?: boolean }) => {
      if (!client) throw new Error('API client not initialized')
      return client.security.rotateEncryptionKey(params)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY })
    }
  })
}
