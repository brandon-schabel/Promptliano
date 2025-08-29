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
  AgentManagerAction,
  AgentManagerSchema
} from '../shared'
import {
  listAgents,
  getAgentById,
  createAgent,
  updateAgent,
  deleteAgent,
  getAgentsByProject,
  suggestAgents
} from '@promptliano/services'

export const agentManagerTool: MCPToolDefinition = {
  name: 'agent_manager',
  description:
    'Manage agents dynamically loaded from .claude/agents directory. Actions: list, get, create, update, delete, list_by_project, suggest_agents',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The action to perform',
        enum: Object.values(AgentManagerAction)
      },
      agentId: {
        type: 'string',
        description: 'The agent ID (required for: get, update, delete). Example: "code-reviewer" or "test-writer"'
      },
      projectId: {
        type: 'number',
        description:
          'The project ID (required for: list_by_project, associate_with_project, suggest_agents). Tip: use project_manager(list) to fetch a valid ID.'
      },
      data: {
        type: 'object',
        description:
          'Action-specific data. For create: { name: "Code Reviewer", description: "Expert in code review", instructions: "# Code Reviewer\\n\\nYou are an expert...", model: "claude-3-sonnet" }. For update: { name: "Updated Name", description: "New description", instructions: "Updated instructions", model: "claude-3-sonnet", isActive: true }. For suggest_agents: { context: "help me with testing", limit: 5 (optional) }'
      }
    },
    required: ['action']
  },
  handler: createTrackedHandler(
    'agent_manager',
    async (args: z.infer<typeof AgentManagerSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, agentId, projectId, data } = args
        switch (action) {
          case AgentManagerAction.LIST: {
            const agents = await listAgents()
            const agentList = agents
              .map(
                (a) =>
                  `${a.id}: ${a.name} - ${a.description != null ? a.description.substring(0, 100) + (a.description.length > 100 ? '...' : '') : 'No description'}`
              )
              .join('\n')
            return {
              content: [{ type: 'text', text: agentList || 'No agents found' }]
            }
          }
          case AgentManagerAction.GET: {
            const validAgentId = validateRequiredParam(agentId, 'agentId', 'string', '"code-reviewer"')
            const agent = await getAgentById(validAgentId)
            const instructions = agent.instructions || 'No instructions available'
            const details = `Name: ${agent.name}\nID: ${agent.id}\nDescription: ${agent.description || 'No description'}\nModel: ${agent.model}\nActive: ${agent.isActive ? 'Yes' : 'No'}\nInstructions Preview:\n${instructions.substring(0, 500)}${instructions.length > 500 ? '...' : ''}\n\nCreated: ${new Date(agent.createdAt).toLocaleString()}\nUpdated: ${new Date(agent.updatedAt).toLocaleString()}`
            return {
              content: [{ type: 'text', text: details }]
            }
          }
          case AgentManagerAction.CREATE: {
            const name = validateDataField<string>(data, 'name', 'string', '"Code Reviewer"')
            const description = data?.description || null
            const instructions = validateDataField<string>(
              data,
              'instructions',
              'string',
              '"# Code Reviewer\\n\\nYou are an expert code reviewer..."'
            )
            const model = data?.model || 'claude-3-sonnet'
            const agent = await createAgent({
              name,
              description,
              instructions,
              model
            })
            return {
              content: [{ type: 'text', text: `Agent created successfully: ${agent.name} (ID: ${agent.id})` }]
            }
          }
          case AgentManagerAction.UPDATE: {
            const validAgentId = validateRequiredParam(agentId, 'agentId', 'string', '"code-reviewer"')
            const updateData: any = {}
            if (data.name !== undefined) updateData.name = data.name
            if (data.description !== undefined) updateData.description = data.description
            if (data.instructions !== undefined) updateData.instructions = data.instructions
            if (data.model !== undefined) updateData.model = data.model
            if (data.isActive !== undefined) updateData.isActive = data.isActive
            const agent = await updateAgent(validAgentId, updateData)
            return {
              content: [{ type: 'text', text: `Agent updated successfully: ${agent.name} (ID: ${agent.id})` }]
            }
          }
          case AgentManagerAction.DELETE: {
            const validAgentId = validateRequiredParam(agentId, 'agentId', 'string', '"code-reviewer"')
            const success = await deleteAgent(validAgentId)
            return {
              content: [
                {
                  type: 'text',
                  text: success
                    ? `Agent ${validAgentId} deleted successfully`
                    : `Failed to delete agent ${validAgentId}`
                }
              ]
            }
          }
          case AgentManagerAction.LIST_BY_PROJECT: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '<PROJECT_ID>')
            const agents = await getAgentsByProject(validProjectId)
            const agentList = agents
              .map(
                (a) =>
                  `${a.id}: ${a.name} - ${a.description != null ? a.description.substring(0, 100) + (a.description.length > 100 ? '...' : '') : 'No description'}`
              )
              .join('\n')
            return {
              content: [{ type: 'text', text: agentList || `No agents found for project ${validProjectId}` }]
            }
          }
          case AgentManagerAction.ASSOCIATE_WITH_PROJECT: {
            // This action is deprecated as agents are now file-based and don't need project associations
            return {
              content: [
                {
                  type: 'text',
                  text: "Agent-project associations are deprecated. Agents are now dynamically loaded from the project's .claude/agents directory."
                }
              ]
            }
          }
          case AgentManagerAction.SUGGEST_AGENTS: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '<PROJECT_ID>')
            const context = data?.context || ''
            const limit = data?.limit || 5
            const suggestions = await suggestAgents(validProjectId, context, limit)
            const agentList = suggestions.suggestions
              .map(
                (a) =>
                  `${a.name}\n   Description: ${a.description || 'No description'}\n   Model: ${a.model}\n   Instructions Preview: ${a.instructions.substring(0, 100)}${a.instructions.length > 100 ? '...' : ''}`
              )
              .join('\n\n')
            return {
              content: [{ type: 'text', text: agentList || 'No agent suggestions found' }]
            }
          }
          default:
            throw createMCPError(MCPErrorCode.UNKNOWN_ACTION, `Unknown action: ${action}`, {
              action,
              validActions: Object.values(AgentManagerAction)
            })
        }
      } catch (error) {
        // Convert to MCPError if not already
        const mcpError =
          error instanceof MCPError
            ? error
            : MCPError.fromError(error, {
                tool: 'agent_manager',
                action: args.action,
                projectId: args.projectId
              })
        // Return formatted error response with recovery suggestions
        return await formatMCPErrorResponse(mcpError)
      }
    }
  )
}
