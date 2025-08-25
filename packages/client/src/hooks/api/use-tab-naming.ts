import { useMutation } from '@tanstack/react-query'
import { useApiClient } from './use-api-client'
import { toast } from 'sonner'

export interface TabNameGenerationRequest {
  projectName: string
  selectedFiles?: string[]
  context?: string
}

export function useGenerateTabName() {
  const client = useApiClient()

  return useMutation({
    mutationFn: async (params: TabNameGenerationRequest) => {
      // Client null check removed - handled by React Query
      // Since we're using AI generation, we'll call the gen-ai endpoint directly
      if (!client) throw new Error('API client not initialized')
      const response = await client.genAi.generateStructured({
        schemaKey: 'tabNaming',
        userInput: `Project Name: ${params.projectName}, Selected Files: ${params.selectedFiles?.join(', ') || 'None'}, Context: ${params.context || 'General project work'}`
      })

      // Handle various response formats for generated content
      const tabName = (response as any)?.data?.output?.tabName || 
                     (response as any)?.data?.tabName || 
                     (response as any)?.output?.tabName ||
                     (response as any)?.tabName;
      
      if (!response?.success || !tabName) {
        throw new Error('Failed to generate tab name')
      }

      return tabName as string
    },
    onError: (error) => {
      console.error('Failed to generate tab name:', error)
      toast.error('Failed to generate tab name')
    }
  })
}
