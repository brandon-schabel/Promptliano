import { z } from '@hono/zod-openapi'
import type { MCPToolDefinition, MCPToolResponse } from './tools-registry'
import { MCPError, MCPErrorCode, createMCPError, formatMCPErrorResponse } from './mcp-errors'
import { trackMCPToolExecution } from '@promptliano/services'
import { getProjectById } from '@promptliano/services'

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
        description: 'The project ID (required for all actions). Tip: use project_manager(list) to fetch a valid ID.'
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
        const { action, projectId } = args
        const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '<PROJECT_ID>')

        // Claude hooks have been removed from the system
        return await formatMCPErrorResponse(
          createMCPError(
            MCPErrorCode.OPERATION_FAILED,
            'Claude hooks are no longer supported. Hook functionality has been removed.',
            {
              action,
              projectId: validProjectId
            }
          )
        )
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
