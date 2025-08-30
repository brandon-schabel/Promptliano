import { useMutation } from '@tanstack/react-query'
import { useApiClient } from './use-api-client'
import type { BrowseDirectoryRequest, DirectoryEntry } from '@promptliano/schemas'
import { toast } from 'sonner'

// Simple factory for directory browsing functionality
export function createBrowseDirectoryHooks() {
  return {
    useBrowseDirectory: () => {
      const client = useApiClient()

      return useMutation({
        mutationFn: async (data?: BrowseDirectoryRequest) => {
          if (!client) throw new Error('API client not initialized')
          const response = await client.system.browseDirectory(data)
          return response
        },
        onError: (error: any) => {
          console.error('Failed to browse directory:', error)
          toast.error('Failed to browse directory')
        }
      })
    }
  }
}

// Create hooks instance
const browseDirectoryHooks = createBrowseDirectoryHooks()

// Export individual hooks for backward compatibility
export const useBrowseDirectory = browseDirectoryHooks.useBrowseDirectory
