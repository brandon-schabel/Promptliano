import { z } from '@hono/zod-openapi'
import type { MCPToolDefinition, MCPToolResponse } from '../../tools-registry'
import {
  createTrackedHandler,
  validateRequiredParam,
  validateDataField,
  createMCPError,
  MCPError,
  MCPErrorCode,
  formatMCPErrorResponse,
  PromptManagerAction,
  PromptManagerSchema
} from '../shared'
import {
  listAllPrompts,
  getPromptById,
  createPrompt,
  updatePrompt,
  deletePrompt,
  listPromptsByProject,
  addPromptToProject,
  removePromptFromProject,
  suggestPrompts
} from '@promptliano/services'
import { addTimestamps } from '@promptliano/services/src/utils/file-utils'
import type { CreatePromptBody, UpdatePromptBody } from '@promptliano/schemas'
import type { Prompt } from '@promptliano/database'

export const promptManagerTool: MCPToolDefinition = {
  name: 'prompt_manager',
  description:
    'Manage prompts and prompt-project associations. Actions: list, get, create, update, delete, list_by_project, add_to_project, remove_from_project, suggest_prompts',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The action to perform',
        enum: [
          'list',
          'get',
          'create',
          'update',
          'delete',
          'list_by_project',
          'add_to_project',
          'remove_from_project',
          'suggest_prompts'
        ]
      },
      projectId: {
        type: 'number',
        description:
          'The project ID (required for: list_by_project, add_to_project, remove_from_project, suggest_prompts). Tip: use project_manager(list) to fetch a valid ID.'
      },
      data: {
        type: 'object',
        description:
          'Action-specific data. For get/update/delete: { promptId: 123 }. For create: { name: "My Prompt", content: "Prompt text" }. For add_to_project: { promptId: 123 }. For suggest_prompts: { userInput: "help me with authentication", limit: 5 (optional) }'
      }
    },
    required: ['action']
  },
  handler: createTrackedHandler(
    'prompt_manager',
    async (args: z.infer<typeof PromptManagerSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, projectId, data } = args

        switch (action) {
          case PromptManagerAction.LIST: {
            const prompts = await listAllPrompts()
            const promptList = prompts
              .map(
                (p: any) => `${p.id}: ${p.title} - ${p.content.substring(0, 100)}${p.content.length > 100 ? '...' : ''}`
              )
              .join('\n')
            return {
              content: [{ type: 'text', text: promptList || 'No prompts found' }]
            }
          }

          case PromptManagerAction.GET: {
            const promptId = validateDataField<number>(data, 'promptId', 'number', '123')
            const prompt = await getPromptById(promptId)
            const details = `Name: ${prompt.title}\nProject ID: ${prompt.projectId || 'None'}\nContent:\n${prompt.content}\n\nCreated: ${new Date(prompt.createdAt).toLocaleString()}\nUpdated: ${new Date(prompt.updatedAt).toLocaleString()}`
            return {
              content: [{ type: 'text', text: details }]
            }
          }

          case PromptManagerAction.CREATE: {
            const createData = data as CreatePromptBody
            const title = validateDataField<string>(createData, 'title', 'string', '"Code Review Prompt"')
            const content = validateDataField<string>(
              createData,
              'content',
              'string',
              '"Review this code for best practices..."'
            )
            // Ensure projectId is provided (required by database schema)
            const validProjectId =
              projectId || validateDataField<number>(createData, 'projectId', 'number', '<PROJECT_ID>')
            const prompt = await createPrompt(addTimestamps({ ...createData, projectId: validProjectId }))

            // Auto-associate with project if projectId is provided
            if (projectId) {
              try {
                await addPromptToProject(prompt.id, projectId)
                return {
                  content: [
                    {
                      type: 'text',
                      text: `Prompt created and associated with project ${projectId}: ${prompt.title} (ID: ${prompt.id})`
                    }
                  ]
                }
              } catch (error) {
                // If association fails, still return success for prompt creation
                console.warn(`Created prompt but failed to associate with project ${projectId}:`, error)
                return {
                  content: [
                    {
                      type: 'text',
                      text: `Prompt created successfully: ${prompt.title} (ID: ${prompt.id})\nNote: Failed to associate with project ${projectId}`
                    }
                  ]
                }
              }
            }

            return {
              content: [{ type: 'text', text: `Prompt created successfully: ${prompt.title} (ID: ${prompt.id})` }]
            }
          }

          case PromptManagerAction.UPDATE: {
            const promptId = validateDataField<number>(data, 'promptId', 'number', '123')
            const updateData: UpdatePromptBody = {}
            if (data.title !== undefined) updateData.title = data.title
            if (data.content !== undefined) updateData.content = data.content
            const prompt = await updatePrompt(promptId, updateData)
            return {
              content: [{ type: 'text', text: `Prompt updated successfully: ${prompt.title} (ID: ${promptId})` }]
            }
          }

          case PromptManagerAction.DELETE: {
            const promptId = validateDataField<number>(data, 'promptId', 'number', '123')
            if (!deletePrompt) throw createMCPError(MCPErrorCode.OPERATION_FAILED, 'Delete prompt service unavailable')
            const success = await deletePrompt(promptId)
            return {
              content: [
                {
                  type: 'text',
                  text: success ? `Prompt ${promptId} deleted successfully` : `Failed to delete prompt ${promptId}`
                }
              ]
            }
          }

          case PromptManagerAction.LIST_BY_PROJECT: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '<PROJECT_ID>')
            const prompts = await listPromptsByProject(validProjectId)
            const promptList = prompts
              .map(
                (p: Prompt) =>
                  `${p.id}: ${p.title} - ${p.content.substring(0, 100)}${p.content.length > 100 ? '...' : ''}`
              )
              .join('\n')
            return {
              content: [{ type: 'text', text: promptList || `No prompts found for project ${validProjectId}` }]
            }
          }

          case PromptManagerAction.ADD_TO_PROJECT: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '<PROJECT_ID>')
            const promptId = validateDataField<number>(data, 'promptId', 'number', '123')
            await addPromptToProject(promptId, validProjectId)
            return {
              content: [
                { type: 'text', text: `Prompt ${promptId} successfully associated with project ${validProjectId}` }
              ]
            }
          }

          case PromptManagerAction.REMOVE_FROM_PROJECT: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '<PROJECT_ID>')
            const promptId = validateDataField<number>(data, 'promptId', 'number', '123')
            await removePromptFromProject(promptId)
            return {
              content: [
                { type: 'text', text: `Prompt ${promptId} successfully removed from project ${validProjectId}` }
              ]
            }
          }

          case PromptManagerAction.SUGGEST_PROMPTS: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '<PROJECT_ID>')

            // Enhanced validation for userInput
            if (!data || !data.userInput) {
              throw new Error(
                'userInput is required in data field. Example: { "userInput": "help me with authentication" }'
              )
            }

            const userInput = validateDataField<string>(data, 'userInput', 'string', '"help me with authentication"')

            // Additional check for empty/whitespace input
            if (!userInput || userInput.trim().length === 0) {
              throw new Error('userInput cannot be empty. Please provide a meaningful query.')
            }

            const limit = (data?.limit as number) || 5

            // First try to get project-specific prompts
            const suggestedPrompts = await suggestPrompts(validProjectId, userInput)

            // If no project-specific prompts found, check if there are any prompts at all
            if (suggestedPrompts.length === 0) {
              const projectPrompts = await listPromptsByProject(validProjectId)
              const allPrompts = await listAllPrompts()

              if (projectPrompts.length === 0 && allPrompts.length > 0) {
                // No prompts associated with this project, but prompts exist
                return {
                  content: [
                    {
                      type: 'text',
                      text:
                        `No prompts are currently associated with project ${validProjectId}.\n\n` +
                        `There are ${allPrompts.length} prompts available in the system.\n` +
                        `To use them with this project, first add them using the 'add_to_project' action.\n\n` +
                        `Example: { "action": "add_to_project", "projectId": ${validProjectId}, "data": { "promptId": <id> } }`
                    }
                  ]
                }
              } else if (allPrompts.length === 0) {
                // No prompts exist at all
                return {
                  content: [
                    {
                      type: 'text',
                      text:
                        'No prompts exist in the system yet.\n\n' +
                        'Create prompts using the "create" action:\n' +
                        `Example: { "action": "create", "data": { "name": "My Prompt", "content": "Prompt content here" } }`
                    }
                  ]
                }
              }
            }

            const promptList = suggestedPrompts
              .map((suggestion: string, index: number) => `${index + 1}: ${suggestion}`)
              .join('\n\n')

            return {
              content: [
                {
                  type: 'text',
                  text:
                    suggestedPrompts.length > 0
                      ? `Suggested prompts for "${userInput}":\n\n${promptList}`
                      : `No prompts found matching your input "${userInput}" in project ${validProjectId}`
                }
              ]
            }
          }

          default:
            throw createMCPError(MCPErrorCode.UNKNOWN_ACTION, `Unknown action: ${action}`, {
              action,
              validActions: Object.values(PromptManagerAction)
            })
        }
      } catch (error) {
        // Convert to MCPError if not already
        const mcpError =
          error instanceof MCPError
            ? error
            : MCPError.fromError(error, {
                tool: 'prompt_manager',
                action: args.action
              })

        // Return formatted error response with recovery suggestions
        return await formatMCPErrorResponse(mcpError)
      }
    }
  )
}
