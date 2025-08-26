import { claudeAgentRepository } from '@promptliano/database'
import {
  type ClaudeAgent,
  type InsertClaudeAgent,
  selectClaudeAgentSchema as ClaudeAgentSchema,
  claudeAgents
} from '@promptliano/database'
import { eq } from 'drizzle-orm'
import { db } from '@promptliano/database/src/db'
// Agent creation/update types
export type CreateClaudeAgentBody = Pick<InsertClaudeAgent, 'name' | 'description' | 'instructions' | 'model'>
export type UpdateClaudeAgentBody = Partial<
  Pick<InsertClaudeAgent, 'name' | 'description' | 'instructions' | 'model' | 'isActive'>
>

// AI generation schemas - define locally for now until schemas package is updated
import { z } from 'zod'

// Define AgentSuggestions schema locally
export const AgentSuggestionsSchema = z.object({
  suggestions: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      instructions: z.string(),
      model: z.string().default('claude-3-sonnet'),
      specializations: z.array(z.string()).default([])
    })
  )
})

export type AgentSuggestions = z.infer<typeof AgentSuggestionsSchema>

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
  const { repository = claudeAgentRepository, logger = console, cache, projectPath = process.cwd() } = deps

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

  const createAgent = async (projectPath: string, data: CreateClaudeAgentBody): Promise<ClaudeAgent> => {
    return withErrorContext(
      async () => {
        // Generate unique agent ID
        const agentId = generateAgentId(data.name)

        // Check if agent already exists
        const [existingAgent] = await db.select().from(claudeAgents).where(eq(claudeAgents.id, agentId)).limit(1)
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

        const [agent] = await db
          .insert(claudeAgents)
          .values({
            ...agentData,
            createdAt: Date.now(),
            updatedAt: Date.now()
          })
          .returning()

        // Write markdown file if instructions provided
        if (data.instructions) {
          const agentsDir = getAgentsDir(projectPath || process.cwd())
          const filePath = path.join(agentsDir, `${agentId}.md`)
          await writeAgentFile(filePath, data.instructions)
        }

        return agent as ClaudeAgent
      },
      { entity: 'Agent', action: 'create', data: { name: data.name } }
    )
  }

  const getAgentById = async (projectPath: string, agentId: string | number): Promise<ClaudeAgent> => {
    return withErrorContext(
      async () => {
        // Convert number ID to string since agent IDs are strings
        const id = String(agentId)
        const [agent] = await db.select().from(claudeAgents).where(eq(claudeAgents.id, id)).limit(1)
        assertExists(agent, 'Agent', id)
        return agent as ClaudeAgent
      },
      { entity: 'Agent', action: 'getById', id: agentId }
    )
  }

  const listAgents = async (projectPath?: string): Promise<ClaudeAgent[]> => {
    return withErrorContext(
      async () => {
        const agents = await db.select().from(claudeAgents).orderBy(claudeAgents.name)
        return agents as ClaudeAgent[]
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
        return agents.filter((agent) => agent.isActive) // Only return active agents
      },
      { entity: 'Agent', action: 'getByProject', projectId }
    )
  }

  const updateAgent = async (
    projectPath: string,
    agentId: string | number,
    data: UpdateClaudeAgentBody
  ): Promise<ClaudeAgent> => {
    return withErrorContext(
      async () => {
        // Convert number ID to string since agent IDs are strings
        const id = String(agentId)

        // Verify agent exists
        const [existing] = await db.select().from(claudeAgents).where(eq(claudeAgents.id, id)).limit(1)
        assertExists(existing, 'Agent', id)

        // Prepare update data to match current schema
        const updateData: Partial<UpdateClaudeAgentBody> = {
          name: data.name,
          description: data.description,
          instructions: data.instructions,
          model: data.model,
          isActive: data.isActive
        }

        // Remove undefined fields
        Object.keys(updateData).forEach((key) => {
          if (updateData[key as keyof typeof updateData] === undefined) {
            delete updateData[key as keyof typeof updateData]
          }
        })

        // Update agent in database
        const [updatedAgent] = await db
          .update(claudeAgents)
          .set({ ...updateData, updatedAt: Date.now() })
          .where(eq(claudeAgents.id, id))
          .returning()

        // Update markdown file if instructions changed
        if (data.instructions !== undefined) {
          const agentsDir = getAgentsDir(projectPath || process.cwd())
          const filePath = path.join(agentsDir, `${id}.md`)

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

        return updatedAgent as ClaudeAgent
      },
      { entity: 'Agent', action: 'update', id: agentId }
    )
  }

  const deleteAgent = async (projectPath: string, agentId: string | number): Promise<boolean> => {
    return withErrorContext(
      async () => {
        // Convert number ID to string since agent IDs are strings
        const id = String(agentId)

        // Verify agent exists
        const [agent] = await db.select().from(claudeAgents).where(eq(claudeAgents.id, id)).limit(1)
        if (!agent) {
          return false
        }

        // Delete from database
        const result = (await db.delete(claudeAgents).where(eq(claudeAgents.id, id)).run()) as unknown as {
          changes: number
        }

        const success = result.changes > 0

        // Delete markdown file if it exists
        const agentsDir = getAgentsDir(projectPath || process.cwd())
        const filePath = path.join(agentsDir, `${id}.md`)

        try {
          await fs.unlink(filePath)
        } catch (error) {
          // File might not exist, that's okay
          logger?.debug(`Could not delete agent file: ${filePath}`, error)
        }

        return success
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

  const getAgentContent = async (projectPath: string, agentId: string): Promise<string | null> => {
    return withErrorContext(
      async () => {
        try {
          const agent = await getAgentById(projectPath, agentId)

          // Try to read content from markdown file first
          const agentsDir = getAgentsDir(projectPath || process.cwd())
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

  const formatAgentContext = async (projectPath: string, agentId: string): Promise<string> => {
    return withErrorContext(
      async () => {
        try {
          const agent = await getAgentById(projectPath, agentId)
          const content = await getAgentContent(projectPath, agentId)

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
            const agent = await getAgentById(deps.projectPath || process.cwd(), agentId)
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

  const suggestAgentForTask = async (
    taskTitle: string,
    taskDescription: string = '',
    availableAgents?: ClaudeAgent[]
  ): Promise<string | null> => {
    return withErrorContext(
      async () => {
        // Get available agents if not provided
        const agents = availableAgents || (await listAgents())
        if (agents.length === 0) return null

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

        for (const agent of agents) {
          const keywords = agentPriorities[agent.id] || []
          let score = 0

          for (const keyword of keywords) {
            if (taskContent.includes(keyword)) {
              score += 1
            }
          }

          // Also check agent description
          if (agent.description) {
            const descWords = agent.description.toLowerCase().split(' ')
            for (const word of descWords) {
              if (taskContent.includes(word) && word.length > 3) {
                score += 0.5
              }
            }
          }

          if (score > highestScore) {
            highestScore = score
            bestMatch = agent.id
          }
        }

        return bestMatch
      },
      { entity: 'Agent', action: 'suggestForTask', task: taskTitle }
    )
  }

  // Return service interface
  return {
    // Core CRUD operations
    create: (data: CreateClaudeAgentBody) => createAgent(projectPath, data),
    getById: (agentId: string | number) => getAgentById(projectPath, agentId),
    list: () => listAgents(projectPath),
    update: (agentId: string | number, data: UpdateClaudeAgentBody) => updateAgent(projectPath, agentId, data),
    delete: (agentId: string | number) => deleteAgent(projectPath, agentId),

    // Query operations
    getByProject: getAgentsByProject,
    getByIds: getAgentsByIds,

    // Content operations
    getContent: (agentId: string) => getAgentContent(projectPath, agentId),
    formatContext: (agentId: string) => formatAgentContext(projectPath, agentId),

    // AI-powered operations
    suggest: suggestAgents,
    suggestForTask: suggestAgentForTask
  }
}

// Export service type for consumers
export type ClaudeAgentService = ReturnType<typeof createClaudeAgentService>

// Export singleton for backward compatibility
export const claudeAgentService = createClaudeAgentService()

// Export individual functions for tree-shaking
export const {
  create: createAgent,
  getById: getAgentById,
  list: listAgents,
  update: updateAgent,
  delete: deleteAgent,
  getByProject: getAgentsByProject,
  getByIds: getAgentsByIds,
  getContent: getAgentContent,
  formatContext: formatAgentContext,
  suggest: suggestAgents,
  suggestForTask: suggestAgentForTask
} = claudeAgentService

// Add backward compatibility alias
export const getAgentsByProjectId = getAgentsByProject
