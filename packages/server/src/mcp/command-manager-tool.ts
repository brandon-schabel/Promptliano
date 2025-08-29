import { z } from '@hono/zod-openapi'
import type { MCPToolDefinition, MCPToolResponse } from './tools-registry'
import { MCPError, MCPErrorCode, createMCPError, formatMCPErrorResponse } from './mcp-errors'
import { trackMCPToolExecution } from '@promptliano/services'
import {
  listCommands,
  getCommandByName,
  createCommand,
  updateCommand,
  deleteCommand,
  executeCommand,
  suggestCommands,
  generateCommand,
  getProjectById,
  type SearchCommandsQuery,
  type CommandGenerationRequest
} from '@promptliano/services'
import {
  type InsertClaudeCommand as CreateClaudeCommandBody,
  type InsertClaudeCommand as UpdateClaudeCommandBody
} from '@promptliano/database'

// Action enum
export enum CommandManagerAction {
  LIST = 'list',
  GET = 'get',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  EXECUTE = 'execute',
  SEARCH = 'search',
  SUGGEST = 'suggest',
  GENERATE = 'generate'
}

// Command Manager schema
export const CommandManagerSchema = z.object({
  action: z.nativeEnum(CommandManagerAction),
  projectId: z.number().optional(),
  data: z.any().optional()
})

// Helper to validate required parameters
function validateRequiredParam<T>(value: T | undefined, name: string, type: string, example: string): T {
  if (value === undefined || value === null) {
    throw createMCPError(MCPErrorCode.INVALID_PARAMS, `Missing required parameter: ${name}`, {
      parameter: name,
      value: undefined,
      validationErrors: { [name]: `Expected ${type}, example: ${example}` }
    })
  }
  return value
}

// Helper to validate data fields
function validateDataField<T>(data: any, field: string, type: string, example: string): T {
  if (!data || data[field] === undefined) {
    throw createMCPError(MCPErrorCode.INVALID_PARAMS, `Missing required field in data: ${field}`, {
      parameter: field,
      value: undefined,
      validationErrors: { [field]: `Expected ${type}, example: ${example}` }
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
    } finally {
      // Track execution
      try {
        // Note: trackMCPToolExecution expects multiple parameters, not an object
        // We'll use a simplified tracking approach here
        console.log(`MCP Tool Execution: ${toolName}`, {
          projectId: projectId || args.projectId,
          executionTime: Date.now() - startTime,
          success,
          errorMessage
        })
      } catch (trackError) {
        console.error('Failed to track MCP tool execution:', trackError)
      }
    }
  }
}

export const commandManagerTool: MCPToolDefinition = {
  name: 'command_manager',
  description:
    'Manage Claude Code slash commands. Actions: list (list all commands), get (get command details), create (create new command), update (update command), delete (delete command), execute (execute command with arguments), search (search commands), suggest (AI-powered suggestions), generate (AI-powered command generation)',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The action to perform',
        enum: Object.values(CommandManagerAction)
      },
      projectId: {
        type: 'number',
        description: 'The project ID (required for all actions). Tip: use project_manager(list) to fetch a valid ID.'
      },
      data: {
        type: 'object',
        description:
          'Action-specific data. For get/update/delete/execute: { commandName: "review-code" }. For create: { name: "test-runner", command: "Run tests for: $ARGUMENTS", description: "Run tests", args: {} }. For search: { query: "security", includeGlobal: true }. For suggest: { context: "I need help with testing", limit: 5 }. For execute: { commandName: "review", arguments: { file: "src/auth" } }'
      }
    },
    required: ['action', 'projectId']
  },
  handler: createTrackedHandler(
    'command_manager',
    async (args: z.infer<typeof CommandManagerSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, projectId, data } = args
        const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '<PROJECT_ID>')

        // Get project to validate and get path
        const project = await getProjectById(validProjectId)

        switch (action) {
          case CommandManagerAction.LIST: {
            const query: SearchCommandsQuery = data || {}
            const commands = await listCommands(validProjectId, query)
            const commandList = commands
              .map((cmd) => {
                return `${cmd.name} - ${cmd.description || 'No description'}`
              })
              .join('\n')
            return {
              content: [{ type: 'text', text: commandList || 'No commands found' }]
            }
          }

          case CommandManagerAction.GET: {
            const commandName = validateDataField<string>(data, 'commandName', 'string', 'review-code')
            const command = await getCommandByName(validProjectId, commandName)
            const details = `Command: ${command.name}
Description: ${command.description || 'No description'}
Active: ${command.isActive}
Args: ${JSON.stringify(command.args, null, 2)}

Command Content:
${command.command}`
            return {
              content: [{ type: 'text', text: details }]
            }
          }

          case CommandManagerAction.CREATE: {
            const name = validateDataField<string>(data, 'name', 'string', 'test-runner')
            const command = validateDataField<string>(data, 'command', 'string', 'Run tests for: $ARGUMENTS')

            const createData: CreateClaudeCommandBody = {
              name,
              command,
              description: data.description,
              args: data.args || {},
              projectId: validProjectId,
              isActive: true,
              createdAt: Date.now(),
              updatedAt: Date.now()
            }

            const createdCommand = await createCommand(validProjectId, createData)
            return {
              content: [
                {
                  type: 'text',
                  text: `Command created successfully: ${createdCommand.name}`
                }
              ]
            }
          }

          case CommandManagerAction.UPDATE: {
            const commandName = validateDataField<string>(data, 'commandName', 'string', 'review-code')

            const updateData: Partial<UpdateClaudeCommandBody> = {
              updatedAt: Date.now()
            }
            if (data.command !== undefined) updateData.command = data.command
            if (data.description !== undefined) updateData.description = data.description
            if (data.args !== undefined) updateData.args = data.args
            if (data.isActive !== undefined) updateData.isActive = data.isActive

            const command = await updateCommand(validProjectId, commandName, updateData)
            return {
              content: [{ type: 'text', text: `Command updated successfully: ${command.name}` }]
            }
          }

          case CommandManagerAction.DELETE: {
            const commandName = validateDataField<string>(data, 'commandName', 'string', 'review-code')

            await deleteCommand(validProjectId, commandName)
            return {
              content: [{ type: 'text', text: `Command '${commandName}' deleted successfully` }]
            }
          }

          case CommandManagerAction.EXECUTE: {
            const commandName = validateDataField<string>(data, 'commandName', 'string', 'review-code')
            const args = data?.arguments as Record<string, any> | undefined

            const result = await executeCommand(validProjectId, commandName, args)
            return {
              content: [{ type: 'text', text: result.result }]
            }
          }

          case CommandManagerAction.SEARCH: {
            const query: SearchCommandsQuery = data || {}
            const commands = await listCommands(validProjectId, query)
            const results = commands
              .map((cmd) => {
                return `${cmd.name} - ${cmd.description || 'No description'}`
              })
              .join('\n')
            return {
              content: [{ type: 'text', text: results || 'No commands found matching search criteria' }]
            }
          }

          case CommandManagerAction.SUGGEST: {
            const context = data?.context || ''
            const limit = data?.limit || 5
            const suggestions = await suggestCommands(validProjectId, context, limit)
            const suggestionList = suggestions.suggestions
              .map(
                (cmd: any, idx: number) =>
                  `${idx + 1}. ${cmd.name}\n   Description: ${cmd.description}\n   Category: ${cmd.category}\n   Use Case: ${cmd.useCase}\n   Difficulty: ${cmd.difficulty}`
              )
              .join('\n\n')
            return {
              content: [{ type: 'text', text: suggestionList || 'No command suggestions generated' }]
            }
          }

          case CommandManagerAction.GENERATE: {
            // Validate required fields
            const name = validateDataField<string>(data, 'name', 'string', 'test-runner')
            const description = validateDataField<string>(
              data,
              'description',
              'string',
              'Run tests for the current file'
            )
            const userIntent = validateDataField<string>(
              data,
              'userIntent',
              'string',
              'I want a command that runs tests with coverage'
            )

            // Build generation request
            const generationRequest: CommandGenerationRequest = {
              name,
              description,
              userIntent,
              category: data?.category || 'general',
              scope: data?.scope || 'project',
              context: data?.context
            }

            // Generate the command
            const generatedCommand = await generateCommand(validProjectId, generationRequest)

            // Format the response
            let response = `Generated Command: ${generatedCommand.name}\n\n`
            response += `Description: ${generatedCommand.description}\n\n`
            response += `Content:\n${generatedCommand.content}\n\n`
            response += `Category: ${generatedCommand.category}\n\n`
            response += `Reasoning: ${generatedCommand.reasoning}\n`

            return {
              content: [{ type: 'text', text: response }]
            }
          }

          default:
            throw createMCPError(
              MCPErrorCode.UNKNOWN_ACTION,
              `Unknown action: ${action}. Valid actions: ${Object.values(CommandManagerAction).join(', ')}`,
              {
                action
              }
            )
        }
      } catch (error) {
        // Convert to MCPError if not already
        const mcpError =
          error instanceof MCPError
            ? error
            : MCPError.fromError(error, {
                tool: 'command_manager',
                action: args.action,
                projectId: args.projectId
              })
        // Return formatted error response with recovery suggestions
        return await formatMCPErrorResponse(mcpError)
      }
    }
  )
}
