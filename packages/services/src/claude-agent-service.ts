import { claudeAgentRepository } from '@promptliano/database'
import {
  type ClaudeAgent,
  type InsertClaudeAgent as CreateClaudeAgentBody,
  type InsertClaudeAgent as UpdateClaudeAgentBody,
  selectClaudeAgentSchema as ClaudeAgentSchema
} from '@promptliano/database'
// AI generation schemas - may remain in schemas package
import {
  type AgentSuggestions,
  AgentSuggestionsSchema
} from '@promptliano/schemas'

import { ApiError, promptsMap } from '@promptliano/shared'
import { ErrorFactory, assertExists, withErrorContext } from '@promptliano/shared'
import { generateStructuredData } from './gen-ai-services'
import { getCompactProjectSummary } from './utils/project-summary-service'
import * as path from 'path'
import * as fs from 'fs/promises'
import { relativePosix, toPosixPath, toOSPath } from '@promptliano/shared'

// Service dependencies interface
export interface ClaudeAgentServiceDeps {
  repository?: typeof claudeAgentRepository
  logger?: any
  cache?: any
  projectPath?: string
}

/**
 * Create Claude Agent Service factory function
 */
export function createClaudeAgentService(deps: ClaudeAgentServiceDeps = {}) {
  const {
    repository = claudeAgentRepository,
    logger = console,
    cache,
    projectPath = process.cwd()
  } = deps

  // Helper function to generate agent ID from name
  const generateAgentId = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, 50) // Limit length
  }

  // Helper function to get agents directory
  const getAgentsDir = (basePath: string): string => {
    return path.join(basePath, 'claude-agents')
  }

  // Helper function to write agent markdown file
  const writeAgentFile = async (agentPath: string, content: string): Promise<void> => {
    const dir = path.dirname(agentPath)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(agentPath, content, 'utf-8')
  }

  const createAgent = async (data: CreateClaudeAgentBody): Promise<ClaudeAgent> => {
    return withErrorContext(
      async () => {
        // Generate unique agent ID
        const agentId = generateAgentId(data.name)
        
        // Check if agent already exists
        const existingAgent = await repository.getById(agentId)
        if (existingAgent) {
          throw ErrorFactory.duplicate('Agent', 'ID', agentId)
        }

        // Create agent in database with current schema fields
        const agentData = {
          id: agentId,
          name: data.name,
          description: data.description || null,
          instructions: data.instructions || '',
          model: data.model || 'claude-3-sonnet',
          isActive: true
        }

        const agent = await repository.create(agentData)
        
        // Write markdown file if instructions provided
        if (data.instructions) {
          const agentsDir = getAgentsDir(projectPath)
          const filePath = path.join(agentsDir, `${agentId}.md`)
          await writeAgentFile(filePath, data.instructions)
        }

        return agent
      },
      { entity: 'Agent', action: 'create', data: { name: data.name } }
    )
  }

  const getAgentById = async (agentId: string): Promise<ClaudeAgent> => {
    return withErrorContext(
      async () => {
        const agent = await repository.getById(agentId)
        assertExists(agent, 'Agent', agentId)
        return agent
      },
      { entity: 'Agent', action: 'getById', id: agentId }
    )
  }

  const listAgents = async (): Promise<ClaudeAgent[]> => {
    return withErrorContext(
      async () => {
        const agents = await repository.getAll('asc')
        // Sort by name for consistent ordering
        return agents.sort((a, b) => a.name.localeCompare(b.name))
      },
      { entity: 'Agent', action: 'list' }
    )
  }

  const getAgentsByProject = async (projectId?: number): Promise<ClaudeAgent[]> => {
    return withErrorContext(
      async () => {
        // Get all agents since current schema doesn't have projectId association
        // This can be filtered client-side or enhanced later with project associations
        const agents = await listAgents()
        return agents.filter(agent => agent.isActive) // Only return active agents
      },
      { entity: 'Agent', action: 'getByProject', projectId }
    )
  }

  const updateAgent = async (agentId: string, data: Partial<UpdateClaudeAgentBody>): Promise<ClaudeAgent> => {
    return withErrorContext(
      async () => {
        // Verify agent exists
        await getAgentById(agentId)
        
        // Prepare update data to match current schema
        const updateData: Partial<UpdateClaudeAgentBody> = {
          name: data.name,
          description: data.description,
          instructions: data.instructions,
          model: data.model,
          isActive: data.isActive
        }
        
        // Remove undefined fields
        Object.keys(updateData).forEach(key => {
          if (updateData[key as keyof typeof updateData] === undefined) {
            delete updateData[key as keyof typeof updateData]
          }
        })

        const updatedAgent = await repository.update(agentId, updateData)
        
        // Update markdown file if instructions changed
        if (data.instructions !== undefined) {
          const agentsDir = getAgentsDir(projectPath)
          const filePath = path.join(agentsDir, `${agentId}.md`)
          
          if (data.instructions) {
            await writeAgentFile(filePath, data.instructions)
          } else {
            // Remove file if instructions are empty
            try {
              await fs.unlink(filePath)
            } catch (error) {
              // File might not exist, that's okay
              logger?.debug(`Could not delete agent file: ${filePath}`, error)
            }
          }
        }

        return updatedAgent
      },
      { entity: 'Agent', action: 'update', id: agentId }
    )
  }

  const deleteAgent = async (agentId: string): Promise<boolean> => {
    return withErrorContext(
      async () => {
        // Verify agent exists
        const agent = await repository.getById(agentId)
        if (!agent) {
          return false
        }

        // Delete from database
        await repository.delete(agentId)
        
        // Delete markdown file if it exists
        const agentsDir = getAgentsDir(projectPath)
        const filePath = path.join(agentsDir, `${agentId}.md`)
        
        try {
          await fs.unlink(filePath)
        } catch (error) {
          // File might not exist, that's okay
          logger?.debug(`Could not delete agent file: ${filePath}`, error)
        }

        return true
      },
      { entity: 'Agent', action: 'delete', id: agentId }
    )
  }

  const suggestAgents = async (
    projectId: number,
    context: string = '',
    limit: number = 5
  ): Promise<AgentSuggestions> => {
    return withErrorContext(
      async () => {
        // Get project summary for context
        let projectSummary = ''
        try {
          projectSummary = await getCompactProjectSummary(projectId)
        } catch (error) {
          logger?.warn(
            `Could not get project summary for agent suggestions: ${error instanceof Error ? error.message : String(error)}`
          )
          projectSummary = 'No project context available'
        }

        // Create a system prompt for agent suggestions
        const systemPrompt = `
You are an expert at analyzing project codebases and suggesting specialized AI agents that would be most helpful for development tasks.

## Your Task:
Based on the project structure, technologies used, and any user context provided, suggest AI agents that would provide the most value for this specific project.

## Agent Creation Guidelines:
1. Each agent should have a specific, well-defined purpose
2. Agents should complement each other without overlapping responsibilities
3. Consider the project's tech stack, architecture patterns, and coding style
4. Suggest agents that address common pain points in the type of project analyzed
5. Each agent should have a clear specialty (e.g., "Frontend Performance Expert", "Database Query Optimizer", "Test Coverage Specialist")

## Output Requirements:
- Provide practical, actionable agent suggestions
- Each agent's content should be a complete markdown instruction set
- Include specific technologies and patterns relevant to this project
- Make agents that would genuinely help with real development tasks
`

        const userPrompt = `
<project_summary>
${projectSummary}
</project_summary>

<user_context>
${context || 'General development assistance needed'}
</user_context>

Based on this project's structure and the user's context, suggest ${limit} specialized AI agents that would be most valuable for this project. Focus on agents that address the specific technologies, patterns, and potential challenges visible in this codebase.
`

        // Use AI to generate agent suggestions
        const result = await generateStructuredData({
          prompt: userPrompt,
          schema: AgentSuggestionsSchema,
          systemMessage: systemPrompt
        })

        return result.object
      },
      { entity: 'Agent', action: 'suggest', projectId, context, limit }
    )
  }

  const getAgentContent = async (agentId: string): Promise<string | null> => {
    return withErrorContext(
      async () => {
        try {
          const agent = await getAgentById(agentId)
          
          // Try to read content from markdown file first
          const agentsDir = getAgentsDir(projectPath)
          const filePath = path.join(agentsDir, `${agentId}.md`)
          
          try {
            const fileContent = await fs.readFile(filePath, 'utf-8')
            return fileContent
          } catch {
            // Fall back to database instructions field
            return agent.instructions || null
          }
        } catch (error) {
          logger?.warn(
            `Could not get agent content for ${agentId}: ${error instanceof Error ? error.message : String(error)}`
          )
          return null
        }
      },
      { entity: 'Agent', action: 'getContent', id: agentId }
    )
  }

  const formatAgentContext = async (agentId: string): Promise<string> => {
    return withErrorContext(
      async () => {
        try {
          const agent = await getAgentById(agentId)
          const content = await getAgentContent(agentId)
          
          return `## Agent: ${agent.name}

${content || agent.instructions || 'No instructions available.'}

---
Agent ID: ${agent.id}
Model: ${agent.model}
Description: ${agent.description || 'No description provided.'}
`
        } catch (error) {
          logger?.warn(
            `Could not format agent context for ${agentId}: ${error instanceof Error ? error.message : String(error)}`
          )
          return `## Agent: ${agentId} (not found)

This agent could not be loaded. Please proceed with general knowledge.
`
        }
      },
      { entity: 'Agent', action: 'formatContext', id: agentId }
    )
  }

  const getAgentsByIds = async (agentIds: string[]): Promise<ClaudeAgent[]> => {
    return withErrorContext(
      async () => {
        const agents: ClaudeAgent[] = []
        
        for (const agentId of agentIds) {
          try {
            const agent = await getAgentById(agentId)
            agents.push(agent)
          } catch (error) {
            logger?.warn(`Could not get agent ${agentId}: ${error instanceof Error ? error.message : String(error)}`)
          }
        }
        
        return agents
      },
      { entity: 'Agent', action: 'getByIds', ids: agentIds }
    )
  }

export async function suggestAgentForTask(
  taskTitle: string,
  taskDescription: string = '',
  availableAgents: ClaudeAgent[]
): Promise<string | null> {
  if (availableAgents.length === 0) return null

  // Simple heuristic-based matching
  const taskContent = `${taskTitle} ${taskDescription}`.toLowerCase()

  // Priority mappings for common task types
  const agentPriorities: Record<string, string[]> = {
    'zod-schema-architect': ['schema', 'zod', 'validation', 'data model', 'type'],
    'promptliano-ui-architect': ['ui', 'component', 'frontend', 'react', 'shadcn', 'button', 'form', 'page'],
    'hono-bun-api-architect': ['api', 'endpoint', 'route', 'hono', 'rest', 'http'],
    'promptliano-service-architect': ['service', 'business logic', 'storage'],
    'promptliano-mcp-tool-creator': ['mcp', 'tool', 'claude'],
    'staff-engineer-code-reviewer': ['review', 'quality', 'refactor', 'improve'],
    'code-modularization-expert': ['modularize', 'split', 'refactor', 'organize'],
    'promptliano-sqlite-expert': ['migration', 'database', 'sqlite', 'table'],
    'tanstack-router-expert': ['route', 'router', 'navigation', 'tanstack'],
    'vercel-ai-sdk-expert': ['ai', 'llm', 'vercel', 'streaming', 'chat'],
    'simple-git-integration-expert': ['git', 'version', 'commit', 'branch'],
    'promptliano-planning-architect': ['plan', 'architect', 'design', 'breakdown']
  }

  // Find best match
  let bestMatch: string | null = null
  let highestScore = 0

  for (const agent of availableAgents) {
    const keywords = agentPriorities[agent.id] || []
    let score = 0

    for (const keyword of keywords) {
      if (taskContent.includes(keyword)) {
        score += 1
      }
    }

    // Also check agent description
    const descWords = agent.description.toLowerCase().split(' ')
    for (const word of descWords) {
      if (taskContent.includes(word) && word.length > 3) {
        score += 0.5
      }
    }

    if (score > highestScore) {
      highestScore = score
      bestMatch = agent.id
    }
  }

  return bestMatch
}

// Create singleton service instance
class ClaudeAgentService {
  listAgents = listAgents
  getAgentById = getAgentById
  createAgent = createAgent
  updateAgent = updateAgent
  deleteAgent = deleteAgent
  getAgentsByProjectId = getAgentsByProjectId
  suggestAgents = suggestAgents
  getAgentContentById = getAgentContentById
  formatAgentContext = formatAgentContext
  getAgentsByIds = getAgentsByIds
  suggestAgentForTask = suggestAgentForTask
}

// Export singleton instance
export const claudeAgentService = new ClaudeAgentService()

// Export factory function for consistency with other services
export function createClaudeAgentService(): ClaudeAgentService {
  return claudeAgentService
}
