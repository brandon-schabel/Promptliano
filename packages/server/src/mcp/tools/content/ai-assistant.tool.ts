import { z } from '@hono/zod-openapi'
import { validateDataField, createTrackedHandler, type MCPToolDefinition, type MCPToolResponse } from '../shared'

export enum AIAssistantAction {
  OPTIMIZE_PROMPT = 'optimize_prompt'
}

const AIAssistantSchema = z.object({
  action: z.enum([AIAssistantAction.OPTIMIZE_PROMPT]),
  projectId: z.number(),
  data: z.any().optional()
})

export const aiAssistantTool: MCPToolDefinition = {
  name: 'ai_assistant',
  description: 'AI-powered utilities for prompt optimization.',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The action to perform',
        enum: Object.values(AIAssistantAction)
      },
      projectId: {
        type: 'number',
        description: 'The project ID (required for all actions). Tip: use project_manager(list) to fetch a valid ID.'
      },
      data: {
        type: 'object',
        description: 'Action-specific data. For optimize_prompt: { prompt: "help me fix the authentication" }'
      }
    },
    required: ['action', 'projectId']
  },
  handler: createTrackedHandler(
    'ai_assistant',
    async (args: z.infer<typeof AIAssistantSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, projectId, data } = args
        switch (action) {
          case AIAssistantAction.OPTIMIZE_PROMPT: {
            const prompt = validateDataField<string>(data, 'prompt', 'string', '"help me fix the authentication flow"')
            // Simple passthrough optimizer (feature minimized)
            const optimizedPrompt = String(prompt || '').trim()
            return {
              content: [{ type: 'text', text: optimizedPrompt }]
            }
          }
          default:
            throw new Error(`Unknown action: ${action}`)
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        }
      }
    }
  )
}
