import { z } from '@hono/zod-openapi'
import type { MCPToolDefinition, MCPToolResponse } from './tools-registry'
import { MCPError, MCPErrorCode, createMCPError, formatMCPErrorResponse } from './mcp-errors'
import { trackMCPToolExecution } from '@promptliano/services'
import {
  claudeHookService,
  getProjectById,
  type HookEvent
} from '@promptliano/services'
import type { ClaudeHook, CreateClaudeHook } from '@promptliano/database'

// Action enum
export enum HookManagerAction {
  LIST = 'list',
  GET = 'get',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  GENERATE = 'generate',
  TEST = 'test',
  SEARCH = 'search'
}

// Hook Manager schema
export const HookManagerSchema = z.object({
  action: z.nativeEnum(HookManagerAction),
  projectId: z.number().optional(),
  data: z.any().optional()
})

// Helper to validate required parameters
function validateRequiredParam<T>(value: T | undefined, name: string, type: string, example: string): T {
  if (value === undefined || value === null) {
    throw createMCPError(MCPErrorCode.INVALID_PARAMS, `Missing required parameter: ${name}`, {
      field: name,
      expected: type,
      example,
      suggestion: `Please provide '${name}' parameter`
    })
  }
  return value
}

// Helper to validate data fields
function validateDataField<T>(data: any, field: string, type: string, example: string): T {
  if (!data || data[field] === undefined) {
    throw createMCPError(MCPErrorCode.INVALID_PARAMS, `Missing required field in data: ${field}`, {
      field,
      expected: type,
      example,
      suggestion: `Include '${field}' in the data object`
    })
  }
  return data[field]
}

// Create tracked handler wrapper
function createTrackedHandler(toolName: string, handler: (args: any) => Promise<MCPToolResponse>) {
  return async (args: any, projectId?: number) => {
    const startTime = Date.now()
    let success = true
    let errorMessage: string | undefined

    try {
      return await handler(args)
    } catch (error) {
      success = false
      errorMessage = error instanceof Error ? error.message : String(error)
      throw error
    }
  }
}

export const hookManagerTool: MCPToolDefinition = {
  name: 'hook_manager',
  description:
    'Manage Claude Code hooks. Actions: list (list all hooks), get (get hook details), create (create new hook), update (update hook), delete (delete hook), generate (AI-powered generation from description), test (test hook execution), search (search hooks by query)',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The action to perform',
        enum: Object.values(HookManagerAction)
      },
      projectId: {
        type: 'number',
        description: 'The project ID (required for all actions). Example: 1754713756748'
      },
      data: {
        type: 'object',
        description:
          'Action-specific data. For get/update/delete: { hookId: 123 }. For create: { name: "My Hook", triggerEvent: "PreToolUse", script: "echo $TOOL_NAME", description: "Optional description", hookType: "pre", isActive: true }. For generate: { description: "Block rm -rf commands", context: { suggestedEvent: "PreToolUse" } }. For test: { hookId: 123, sampleToolName: "Bash" }. For search: { query: "bash" }'
      }
    },
    required: ['action', 'projectId']
  },
  handler: createTrackedHandler(
    'hook_manager',
    async (args: z.infer<typeof HookManagerSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, projectId, data } = args
        const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1754713756748')

        // Get project to validate and get path
        const project = await getProjectById(validProjectId)

        switch (action) {
          case HookManagerAction.LIST: {
            const hooks = await claudeHookService.listHooks(validProjectId)
            const hookList = hooks
              .map((hook) => {
                return `Event: ${hook.triggerEvent}\n  Name: ${hook.name}\n  Script: ${hook.script}\n  Active: ${hook.isActive}`
              })
              .join('\n\n')
            return {
              content: [{ type: 'text', text: hookList || 'No hooks found' }]
            }
          }

          case HookManagerAction.GET: {
            const hookId = validateDataField<number>(data, 'hookId', 'number', '123')

            const hook = await claudeHookService.getById(hookId)
            if (!hook) {
              throw createMCPError(MCPErrorCode.RESOURCE_NOT_FOUND, `Hook not found: ${hookId}`, {
                projectId: validProjectId
              })
            }
            const details = `Hook Details:
ID: ${hook.id}
Name: ${hook.name}
Event: ${hook.triggerEvent}
Script: ${hook.script}
Active: ${hook.isActive}
Description: ${hook.description || 'N/A'}`
            return {
              content: [{ type: 'text', text: details }]
            }
          }

          case HookManagerAction.CREATE: {
            const name = validateDataField<string>(data, 'name', 'string', 'Block rm commands')
            const triggerEvent = validateDataField<string>(data, 'triggerEvent', 'string', 'PreToolUse')
            const script = validateDataField<string>(data, 'script', 'string', 'echo "Tool blocked"')
            const description = data.description as string | undefined
            const isActive = data.isActive !== undefined ? Boolean(data.isActive) : true

            const hookData = {
              name,
              triggerEvent,
              script,
              description,
              isActive,
              hookType: (data.hookType || 'pre') as 'pre' | 'post' | 'error'
            } as any // Work around service type mismatch

            const createdHook = await claudeHookService.create({ ...hookData, projectId: validProjectId })
            return {
              content: [
                {
                  type: 'text',
                  text: `Hook created successfully: "${createdHook.name}" for event "${createdHook.triggerEvent}"`
                }
              ]
            }
          }

          case HookManagerAction.UPDATE: {
            const hookId = validateDataField<number>(data, 'hookId', 'number', '123')

            const updateData: any = {}
            if (data.name !== undefined) updateData.name = data.name
            if (data.triggerEvent !== undefined) updateData.triggerEvent = data.triggerEvent
            if (data.script !== undefined) updateData.script = data.script
            if (data.description !== undefined) updateData.description = data.description
            if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive)
            if (data.hookType !== undefined) updateData.hookType = data.hookType

            const updatedHook = await claudeHookService.update(hookId, updateData)
            return {
              content: [
                { type: 'text', text: `Hook updated successfully: "${updatedHook.name}" (ID: ${updatedHook.id})` }
              ]
            }
          }

          case HookManagerAction.DELETE: {
            const hookId = validateDataField<number>(data, 'hookId', 'number', '123')

            const success = await claudeHookService.delete(hookId)
            if (!success) {
              throw createMCPError(MCPErrorCode.OPERATION_FAILED, `Failed to delete hook: ${hookId}`, {
                projectId: validProjectId
              })
            }
            return {
              content: [{ type: 'text', text: `Hook deleted successfully: ID ${hookId}` }]
            }
          }

          case HookManagerAction.GENERATE: {
            const description = validateDataField<string>(data, 'description', 'string', 'Block all rm -rf commands')
            const context = data.context as { projectId?: number; suggestedEvent?: HookEvent; examples?: string[] }

            const generatedHook = await claudeHookService.generateHookFromDescription(description, {
              ...context,
              projectId: validProjectId
            })
            const details = `Generated Hook:
Event: ${generatedHook.event}
Matcher: ${generatedHook.matcher}
Command: ${generatedHook.command}
Description: ${generatedHook.description}

To create this hook, use:
action: "create"
data: {
  "name": "Generated Hook",
  "triggerEvent": "${generatedHook.event}",
  "script": "${generatedHook.command}",
  "description": "${generatedHook.description}"
}`
            return {
              content: [{ type: 'text', text: details }]
            }
          }

          case HookManagerAction.TEST: {
            const hookId = validateDataField<number>(data, 'hookId', 'number', '123')
            const sampleToolName = data.sampleToolName as string | undefined

            const result = await claudeHookService.testHook(hookId, sampleToolName)
            const resultText = `Hook Test Results:\n${result.message}\n\nHook Details:\nName: ${result.hook.name}\nEvent: ${result.hook.triggerEvent}\nScript: ${result.hook.script}`
            return {
              content: [{ type: 'text', text: resultText }]
            }
          }

          case HookManagerAction.SEARCH: {
            const query = data?.query || ''
            const hooks = await claudeHookService.searchHooks(validProjectId, query)
            const results = hooks
              .map((hook) => {
                return `ID: ${hook.id} | ${hook.name} | Event: ${hook.triggerEvent}\n  Script: ${hook.script}\n  Active: ${hook.isActive}`
              })
              .join('\n\n')
            return {
              content: [{ type: 'text', text: results || 'No hooks found matching search criteria' }]
            }
          }

          default:
            throw createMCPError(MCPErrorCode.UNKNOWN_ACTION, `Unknown action: ${action}`, {
              action,
              validActions: Object.values(HookManagerAction)
            })
        }
      } catch (error) {
        // Convert to MCPError if not already
        const mcpError =
          error instanceof MCPError
            ? error
            : MCPError.fromError(error, {
                tool: 'hook_manager',
                action: args.action,
                projectId: args.projectId
              })
        // Return formatted error response with recovery suggestions
        return await formatMCPErrorResponse(mcpError)
      }
    }
  )
}
