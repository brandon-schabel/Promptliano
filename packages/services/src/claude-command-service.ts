import { claudeCommandRepository } from '@promptliano/database'
import {
  type ClaudeCommand,
  type InsertClaudeCommand as CreateClaudeCommandBody,
  type InsertClaudeCommand as UpdateClaudeCommandBody
} from '@promptliano/database'
import {
  type CommandScope,
  type CommandSuggestions,
  CommandSuggestionsSchema,
  type SearchCommandsQuery,
  type CommandGenerationRequest,
  type CommandGenerationResponse,
  CommandGenerationResponseSchema
} from '@promptliano/schemas'
import { ErrorFactory, withErrorContext } from '@promptliano/shared'
import { ZodError } from 'zod'
import { generateStructuredData } from './gen-ai-services'
import { getCompactProjectSummary } from './utils/project-summary-service'
import { ClaudeCommandParser } from '@promptliano/shared'
import { HIGH_MODEL_CONFIG } from '@promptliano/config'

async function createCommand(projectId: number, data: CreateClaudeCommandBody): Promise<ClaudeCommand> {
  return withErrorContext(
    async (): Promise<ClaudeCommand> => {
      // Validate command name
      if (!/^[a-z0-9-]+$/.test(data.name)) {
        throw ErrorFactory.invalidInput('name', 'lowercase letters, numbers, and hyphens only', data.name)
      }

      // Check if command already exists for this project
      const existingCommands = await claudeCommandRepository.getByProject(projectId)
      const existing = existingCommands.find((cmd) => cmd.name === data.name)

      if (existing) {
        throw ErrorFactory.conflict(`Command '${data.name}' already exists in project`, {
          commandName: data.name,
          projectId
        })
      }

      // Create command in database
      const command = await claudeCommandRepository.create({
        ...data,
        projectId
      })

      return command as ClaudeCommand
    },
    { entity: 'ClaudeCommand', action: 'create', projectId }
  )
}

async function listCommands(
  projectId: number,
  query: SearchCommandsQuery = {
    includeGlobal: true,
    limit: 20,
    offset: 0
  }
): Promise<ClaudeCommand[]> {
  return withErrorContext(
    async () => {
      let commands = await claudeCommandRepository.getByProject(projectId)

      // Apply search filter
      if (query.query) {
        const searchLower = query.query.toLowerCase()
        commands = commands.filter(
          (cmd) =>
            cmd.name.toLowerCase().includes(searchLower) ||
            cmd.description?.toLowerCase().includes(searchLower) ||
            cmd.command.toLowerCase().includes(searchLower)
        )
      }

      // Filter by active status
      commands = commands.filter((cmd) => cmd.isActive)

      // Sort by name
      commands.sort((a, b) => a.name.localeCompare(b.name))

      // Apply pagination
      const offset = query.offset || 0
      const limit = query.limit || 20
      commands = commands.slice(offset, offset + limit)

      return commands
    },
    { entity: 'ClaudeCommand', action: 'list', projectId }
  )
}

async function getCommandByName(projectId: number, commandName: string): Promise<ClaudeCommand> {
  return withErrorContext(
    async () => {
      const commands = await claudeCommandRepository.getByProject(projectId)
      const command = commands.find((cmd) => cmd.name === commandName && cmd.isActive)

      if (!command) {
        throw ErrorFactory.notFound('ClaudeCommand', commandName, { projectId })
      }

      return command
    },
    { entity: 'ClaudeCommand', action: 'getByName', projectId, commandName }
  )
}

async function updateCommand(
  projectId: number,
  commandName: string,
  data: Partial<UpdateClaudeCommandBody>
): Promise<ClaudeCommand> {
  return withErrorContext(
    async (): Promise<ClaudeCommand> => {
      // Get existing command
      const existing = await getCommandByName(projectId, commandName)

      // Merge args if provided - handle JSON type conversion
      const existingArgs = existing.args as Record<string, any> | null
      const dataArgs = data.args as Record<string, any> | null
      const updatedArgs = {
        ...(existingArgs || {}),
        ...(dataArgs || {})
      }

      // Update command
      const command = await claudeCommandRepository.update(existing.id, {
        ...data,
        args: updatedArgs
      })

      return command as ClaudeCommand
    },
    { entity: 'ClaudeCommand', action: 'update', projectId, commandName }
  )
}

async function deleteCommand(projectId: number, commandName: string): Promise<boolean> {
  return withErrorContext(
    async () => {
      // Get command to verify it exists
      const command = await getCommandByName(projectId, commandName)

      // Soft delete by setting isActive to false
      await claudeCommandRepository.update(command.id, { isActive: false })

      return true
    },
    { entity: 'ClaudeCommand', action: 'delete', projectId, commandName }
  )
}

async function executeCommand(
  projectId: number,
  commandName: string,
  args?: Record<string, any>
): Promise<{ result: string; metadata?: any }> {
  return withErrorContext(
    async () => {
      const command = await getCommandByName(projectId, commandName)

      // Parse command to substitute arguments
      const parser = new ClaudeCommandParser()
      let content = command.command

      if (args) {
        // Convert args object to string format expected by parser
        const argsString = Object.entries(args)
          .map(([key, value]) => `${key}=${value}`)
          .join(' ')
        content = parser.substituteArguments(content, argsString)
      }

      // In a real implementation, this would execute the command
      // through Claude API with the specified tools and settings
      return {
        result: `Would execute command '${commandName}' with content:\n${content}`,
        metadata: {
          args: command.args,
          description: command.description,
          isActive: command.isActive
        }
      }
    },
    { entity: 'ClaudeCommand', action: 'execute', projectId, commandName }
  )
}

async function generateCommand(
  projectId: number,
  data: CommandGenerationRequest
): Promise<CommandGenerationResponse['data']> {
  return withErrorContext(
    async () => {
      // Get project context if requested
      let projectContext = ''
      const contextOptions = data.context || {
        includeProjectSummary: true,
        includeFileStructure: true,
        includeTechStack: true
      }

      if (contextOptions.includeProjectSummary !== false) {
        try {
          projectContext = await getCompactProjectSummary(projectId)
        } catch (error) {
          console.log(
            `Warning: Could not get project summary: ${error instanceof Error ? error.message : String(error)}`
          )
          projectContext = 'Project summary unavailable'
        }
      }

      // Build system prompt for command generation
      const systemPrompt = `You are an expert at creating Claude Code slash commands that automate development tasks.

## Your Task:
Generate a Claude Code slash command based on the user's requirements and project context.

## Command Requirements:
1. The command name should be: ${data.name}
2. The command should accomplish: ${data.description}
3. Detailed user intent: ${data.userIntent}

## Command Creation Guidelines:
- Use appropriate Claude tools (Edit, Read, Bash, WebSearch, etc.)
- Include the $ARGUMENTS placeholder where user input is expected
- Write clear, step-by-step instructions in the command content
- Include error handling and validation where appropriate
- Follow the project's coding conventions and tech stack
- Make the command efficient and reliable

## Output Requirements:
- The command content should be complete and ready to use
- Provide a clear rationale explaining your design choices
- Focus on practical, actionable commands`

      // Build user prompt with context
      let userPrompt = ''

      if (projectContext) {
        userPrompt += `<project_context>\n${projectContext}\n</project_context>\n\n`
      }

      if (contextOptions.selectedFiles && contextOptions.selectedFiles.length > 0) {
        userPrompt += `<relevant_files>\n${contextOptions.selectedFiles.join(', ')}\n</relevant_files>\n\n`
      }

      if (contextOptions.additionalContext) {
        userPrompt += `<additional_context>\n${contextOptions.additionalContext}\n</additional_context>\n\n`
      }

      userPrompt += `Generate a Claude Code slash command that meets the requirements above. Focus on making it practical, efficient, and tailored to this specific project.`

      // Generate the command using AI
      const result = await generateStructuredData({
        prompt: userPrompt,
        schema: CommandGenerationResponseSchema.shape.data,
        systemMessage: systemPrompt,
        options: HIGH_MODEL_CONFIG
      })

      // Ensure the generated name matches the requested name
      result.object.name = data.name
      return result.object
    },
    { entity: 'ClaudeCommand', action: 'generate', projectId }
  )
}

async function suggestCommands(
  projectId: number,
  context: string = '',
  limit: number = 5
): Promise<CommandSuggestions> {
  return withErrorContext(
    async () => {
      // Get project summary for context
      let projectSummary = ''
      try {
        projectSummary = await getCompactProjectSummary(projectId)
      } catch (error) {
        console.log(
          `Warning: Could not get project summary for command suggestions: ${error instanceof Error ? error.message : String(error)}`
        )
        projectSummary = 'No project context available'
      }

      // Create a system prompt for command suggestions
      const systemPrompt = `
You are an expert at analyzing project codebases and suggesting useful Claude Code slash commands.

## Your Task:
Based on the project structure, technologies used, and any user context provided, suggest Claude Code slash commands that would provide the most value for this specific project.

## Command Creation Guidelines:
1. Each command should automate a specific, repetitive task
2. Commands should leverage Claude's tools (Edit, Read, Bash, WebSearch, etc.)
3. Consider the project's tech stack and common workflows
4. Suggest commands that save significant time or reduce errors
5. Each command should use the $ARGUMENTS placeholder where appropriate

## Output Requirements:
- Provide practical, actionable command suggestions
- Each command's content should be complete and ready to use
- Focus on commands that address real development pain points
`

      const userPrompt = `
<project_summary>
${projectSummary}
</project_summary>

<user_context>
${context || 'General development automation needed'}
</user_context>

Based on this project's structure and the user's context, suggest ${limit} Claude Code slash commands that would be most valuable. Focus on commands that automate common tasks, improve code quality, or speed up development workflows.
`

      // Use AI to generate command suggestions
      const result = await generateStructuredData({
        prompt: userPrompt,
        schema: CommandSuggestionsSchema,
        systemMessage: systemPrompt
      })

      return result.object
    },
    { entity: 'ClaudeCommand', action: 'suggest', projectId }
  )
}

// Service factory following modern functional pattern
function createClaudeCommandService(
  deps: {
    repository?: typeof claudeCommandRepository
  } = {}
) {
  const repository = deps.repository || claudeCommandRepository

  return {
    // Route factory compatible interface
    async list(): Promise<ClaudeCommand[]> {
      // List all commands across all projects
      return withErrorContext(
        async () => {
          const results = await repository.getAll()
          // Cast to ensure proper type with JSON fields
          return results as ClaudeCommand[]
        },
        { entity: 'ClaudeCommand', action: 'list' }
      )
    },

    async getById(id: number | string): Promise<ClaudeCommand> {
      return withErrorContext(
        async () => {
          const command = await repository.getById(Number(id))
          if (!command) {
            throw ErrorFactory.notFound('ClaudeCommand', id)
          }
          return command as ClaudeCommand
        },
        { entity: 'ClaudeCommand', action: 'getById', id }
      )
    },

    async create(data: any): Promise<ClaudeCommand> {
      // Wrapper for project-specific creation - requires projectId
      if (!data.projectId) {
        throw ErrorFactory.missingRequired('projectId', 'ClaudeCommand creation')
      }
      return createCommand(data.projectId, data)
    },

    async update(id: number | string, data: any): Promise<ClaudeCommand> {
      return withErrorContext(
        async () => {
          const command = await this.getById(id)
          // Update by name since that's how the original service works
          return updateCommand(command.projectId, command.name, data)
        },
        { entity: 'ClaudeCommand', action: 'update', id }
      )
    },

    async delete(id: number | string): Promise<boolean> {
      return withErrorContext(
        async () => {
          const command = await this.getById(id)
          return deleteCommand(command.projectId, command.name)
        },
        { entity: 'ClaudeCommand', action: 'delete', id }
      )
    },

    // Original methods for backward compatibility
    createCommand,
    listCommands,
    getByName: getCommandByName,
    updateCommand,
    deleteCommand,
    execute: executeCommand,
    suggest: suggestCommands,
    generate: generateCommand
  }
}

// Export singleton instance for backward compatibility
export const claudeCommandService = createClaudeCommandService()

// Export individual functions for tree-shaking
export {
  createCommand,
  listCommands,
  getCommandByName,
  updateCommand,
  deleteCommand,
  executeCommand,
  suggestCommands,
  generateCommand,
  createClaudeCommandService
}
