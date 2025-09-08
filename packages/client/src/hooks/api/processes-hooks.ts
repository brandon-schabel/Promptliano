import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { SERVER_HTTP_ENDPOINT } from '@/constants/server-constants'
import { toast } from 'sonner'
import { useApiClient } from '@/hooks/api/use-api-client'

const KEY = {
  list: (projectId: number) => ['processes', 'list', projectId] as const,
  history: (projectId: number) => ['processes', 'history', projectId] as const,
  logs: (projectId: number, processId: string) => ['processes', 'logs', projectId, processId] as const,
  ports: (projectId: number) => ['processes', 'ports', projectId] as const,
  scripts: (projectId: number) => ['processes', 'scripts', projectId] as const
}

export function useListProcesses(projectId: number | undefined) {
  const client = useApiClient()
  return useQuery({
    queryKey: KEY.list(projectId || -1),
    queryFn: async () => {
      if (!projectId || projectId === -1) return []

      // Prefer generated client if available
      try {
        const api = (client as any)?.typeSafeClient
        if (api && typeof api.getProjectsByIdProcesses === 'function') {
          const result = await api.getProjectsByIdProcesses(projectId)
          return result?.data ?? result ?? []
        }
      } catch (e) {
        // Fallback to fetch below
      }

      const res = await fetch(`${SERVER_HTTP_ENDPOINT}/api/projects/${projectId}/processes`)
      if (!res.ok) throw new Error('Failed to fetch processes')
      const json = await res.json()
      return json.data || []
    },
    enabled: !!projectId && projectId !== -1,
    refetchInterval: 4000
  })
}

export function useStartProcess(projectId: number | undefined) {
  const qc = useQueryClient()
  const client = useApiClient()
  return useMutation({
    mutationFn: async (data: { command: string; args?: string[]; name?: string }) => {
      if (!projectId || projectId === -1) throw new Error('No project selected')

      // Prefer generated client if available
      try {
        const api = (client as any)?.typeSafeClient
        if (api && typeof api.createProjectsByIdProcessesStart === 'function') {
          return await api.createProjectsByIdProcessesStart(projectId, data)
        }
      } catch (e) {
        // Fallback to fetch below
      }

      const res = await fetch(`${SERVER_HTTP_ENDPOINT}/api/projects/${projectId}/processes/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) throw new Error('Failed to start process')
      return res.json()
    },
    onSuccess: async (_, __) => {
      if (!projectId) return
      await qc.invalidateQueries({ queryKey: KEY.list(projectId) })
      toast.success('Process started')
    },
    onError: (err: any) => toast.error(err.message || 'Failed to start process')
  })
}

export function useStopProcess(projectId: number | undefined) {
  const qc = useQueryClient()
  const client = useApiClient()
  return useMutation({
    mutationFn: async (processId: string) => {
      if (!projectId || projectId === -1) throw new Error('No project selected')

      // Prefer generated client if available
      try {
        const api = (client as any)?.typeSafeClient
        if (api && typeof api.createProjectsByIdProcessesByProcessIdStop === 'function') {
          return await api.createProjectsByIdProcessesByProcessIdStop(projectId, processId)
        }
      } catch (e) {
        // Fallback to fetch below
      }

      const res = await fetch(
        `${SERVER_HTTP_ENDPOINT}/api/projects/${projectId}/processes/${encodeURIComponent(processId)}/stop`,
        { method: 'POST' }
      )
      if (!res.ok) throw new Error('Failed to stop process')
      return res.json()
    },
    onSuccess: async (_, __) => {
      if (!projectId) return
      await qc.invalidateQueries({ queryKey: KEY.list(projectId) })
      toast.success('Process stopped')
    },
    onError: (err: any) => toast.error(err.message || 'Failed to stop process')
  })
}

// Get process history
export function useProcessHistory(projectId: number | undefined, limit = 50, offset = 0) {
  return useQuery({
    queryKey: [...KEY.history(projectId || -1), { limit, offset }],
    queryFn: async () => {
      if (!projectId || projectId === -1) return []

      const res = await fetch(
        `${SERVER_HTTP_ENDPOINT}/api/projects/${projectId}/processes/history?limit=${limit}&offset=${offset}`
      )
      if (!res.ok) throw new Error('Failed to fetch process history')
      const json = await res.json()
      return json.data || []
    },
    enabled: !!projectId && projectId !== -1
  })
}

// Get process logs
export function useProcessLogs(
  projectId: number | undefined,
  processId: string | undefined,
  options?: { limit?: number; offset?: number; type?: 'stdout' | 'stderr' | 'system' | 'all' }
) {
  const { limit = 1000, offset = 0, type = 'all' } = options || {}

  return useQuery({
    queryKey: [...KEY.logs(projectId || -1, processId || ''), { limit, offset, type }],
    queryFn: async () => {
      if (!projectId || !processId) return []

      const res = await fetch(
        `${SERVER_HTTP_ENDPOINT}/api/projects/${projectId}/processes/${encodeURIComponent(processId)}/logs?` +
          `limit=${limit}&offset=${offset}&type=${type}`
      )
      if (!res.ok) throw new Error('Failed to fetch process logs')
      const json = await res.json()
      return json.data || []
    },
    enabled: !!projectId && !!processId,
    refetchInterval: type === 'all' ? 2000 : false // Auto-refresh for live logs
  })
}

// Get process ports
export function useProcessPorts(
  projectId: number | undefined,
  state: 'listening' | 'established' | 'closed' | 'all' = 'listening'
) {
  return useQuery({
    queryKey: [...KEY.ports(projectId || -1), state],
    queryFn: async () => {
      if (!projectId || projectId === -1) return []

      const res = await fetch(`${SERVER_HTTP_ENDPOINT}/api/projects/${projectId}/processes/ports?state=${state}`)
      if (!res.ok) throw new Error('Failed to fetch process ports')
      const json = await res.json()
      return json.data || []
    },
    enabled: !!projectId && projectId !== -1,
    refetchInterval: state === 'listening' ? 5000 : false // Auto-refresh active ports
  })
}

// Kill process by port
export function useKillByPort(projectId: number | undefined) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (port: number) => {
      if (!projectId || projectId === -1) throw new Error('No project selected')

      const res = await fetch(`${SERVER_HTTP_ENDPOINT}/api/projects/${projectId}/processes/ports/${port}/kill`, {
        method: 'POST'
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to kill process')
      }
      return res.json()
    },
    onSuccess: async (data) => {
      if (!projectId) return
      await qc.invalidateQueries({ queryKey: KEY.list(projectId) })
      await qc.invalidateQueries({ queryKey: KEY.ports(projectId) })
      toast.success(`Process on port killed (PID: ${data.data?.pid || 'unknown'})`)
    },
    onError: (err: any) => toast.error(err.message || 'Failed to kill process by port')
  })
}

// Scan ports
export function useScanPorts(projectId: number | undefined) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!projectId || projectId === -1) throw new Error('No project selected')

      const res = await fetch(`${SERVER_HTTP_ENDPOINT}/api/projects/${projectId}/processes/ports/scan`, {
        method: 'POST'
      })
      if (!res.ok) throw new Error('Failed to scan ports')
      return res.json()
    },
    onSuccess: async (data) => {
      if (!projectId) return
      await qc.invalidateQueries({ queryKey: KEY.ports(projectId) })
      toast.success(`Port scan complete: ${data.data?.length || 0} ports found`)
    },
    onError: (err: any) => toast.error(err.message || 'Failed to scan ports')
  })
}

// Run package.json script
export function useRunScript(projectId: number | undefined) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      scriptName,
      packageManager = 'bun',
      packagePath
    }: {
      scriptName: string
      packageManager?: 'npm' | 'bun' | 'yarn' | 'pnpm'
      packagePath?: string
    }) => {
      if (!projectId || projectId === -1) throw new Error('No project selected')

      const res = await fetch(`${SERVER_HTTP_ENDPOINT}/api/projects/${projectId}/processes/scripts/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptName, packageManager, packagePath })
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to run script')
      }
      return res.json()
    },
    onSuccess: async (_, variables) => {
      if (!projectId) return
      await qc.invalidateQueries({ queryKey: KEY.list(projectId) })
      toast.success(`Script '${variables.scriptName}' started`)
    },
    onError: (err: any) => toast.error(err.message || 'Failed to run script')
  })
}

// List package.json scripts available in the project (root + packages/*)
export function useProjectScripts(projectId: number | undefined) {
  return useQuery({
    queryKey: KEY.scripts(projectId || -1),
    queryFn: async () => {
      if (!projectId || projectId === -1) return []
      const res = await fetch(`${SERVER_HTTP_ENDPOINT}/api/projects/${projectId}/processes/scripts`)
      if (!res.ok) throw new Error('Failed to fetch scripts')
      const json = await res.json()
      return json.data || []
    },
    enabled: !!projectId && projectId !== -1
  })
}
