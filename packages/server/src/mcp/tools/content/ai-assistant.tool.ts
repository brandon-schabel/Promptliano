import { z } from '@hono/zod-openapi'
import {
  validateDataField,
  validateRequiredParam,
  createTrackedHandler,
  createMCPError,
  MCPError,
  MCPErrorCode,
  formatMCPErrorResponse,
  type MCPToolDefinition,
  type MCPToolResponse
} from '../shared'

export enum AIAssistantAction {
  // Prompt Engineering (AI-powered)
  OPTIMIZE_PROMPT = 'optimize_prompt',
  GENERATE_PROMPT = 'generate_prompt',

  // File & Prompt Suggestions (AI-powered)
  SUGGEST_FILES = 'suggest_files',
  SUGGEST_PROMPTS = 'suggest_prompts'
}

const AIAssistantSchema = z.object({
  action: z.nativeEnum(AIAssistantAction),
  projectId: z.number().optional(),
  data: z.any().optional()
})

export const aiAssistantTool: MCPToolDefinition = {
  name: 'ai_assistant',
  description:
    'AI-powered tools for intelligent development assistance. All actions use AI models for smart suggestions and optimizations. Actions: optimize_prompt (improve prompt quality), generate_prompt (create prompts from descriptions), suggest_files (AI-powered file suggestions based on context), suggest_prompts (AI-powered prompt suggestions). This tool separates AI-based features from traditional algorithmic tools.',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The AI-powered action to perform',
        enum: Object.values(AIAssistantAction)
      },
      projectId: {
        type: 'number',
        description: 'The project ID (required for suggest_files and suggest_prompts). Tip: use project_manager(list) to fetch a valid ID.'
      },
      data: {
        type: 'object',
        description:
          'Action-specific data. For optimize_prompt: { prompt: "original prompt", context?: "additional context" }. For generate_prompt: { task: "task description", type?: "general|code|documentation", context?: "additional context" }. For suggest_files: { prompt: "what I\'m working on", strategy?: "fast|balanced|thorough", limit?: 10, lineCount?: 50, userContext?: "additional context", includeReasons?: false }. For suggest_prompts: { userInput: "search terms", strategy?: "fast|balanced|thorough", limit?: 10 }',
        additionalProperties: true
      }
    },
    required: ['action']
  },
  handler: createTrackedHandler(
    'ai_assistant',
    async (args: z.infer<typeof AIAssistantSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, projectId, data } = args

        // Import AI services dynamically
        const { generateStructuredData } = await import('@promptliano/services')

        switch (action) {
          case AIAssistantAction.OPTIMIZE_PROMPT: {
            const prompt = validateDataField<string>(data, 'prompt', 'string', '"help me fix the authentication flow"')
            const context = data?.context as string | undefined

            const systemPrompt = `You are an expert prompt engineer. Optimize the given prompt to be more effective, clear, and specific.

Original prompt: "${prompt}"
${context ? `Context: ${context}` : ''}

Return an optimized version that:
1. Is more specific and actionable
2. Uses clear, direct language
3. Includes relevant context and constraints
4. Follows prompt engineering best practices
5. Maintains the original intent but enhances clarity

Provide the optimized prompt directly without explanations.`

            const schema = z.object({
              optimizedPrompt: z.string().describe('The optimized prompt')
            })

            const result = await generateStructuredData({
              prompt,
              systemMessage: systemPrompt,
              schema
            })

            return {
              content: [{ type: 'text', text: result.object.optimizedPrompt }]
            }
          }

          case AIAssistantAction.GENERATE_PROMPT: {
            const task = validateDataField<string>(data, 'task', 'string', '"code review for React component"')
            const type = (data?.type as string | undefined) || 'general'
            const context = data?.context as string | undefined

            const systemPrompt = `You are a prompt engineering expert. Generate an effective prompt for the specified task.

Task: ${task}
Type: ${type}
${context ? `Context: ${context}` : ''}

Create a well-structured prompt that:
1. Clearly defines the task and expected output
2. Provides necessary context and constraints
3. Uses effective prompt engineering techniques
4. Is specific and actionable
5. Follows best practices for the task type

Return only the generated prompt without explanations.`

            const schema = z.object({
              generatedPrompt: z.string().describe('The generated prompt')
            })

            const result = await generateStructuredData({
              prompt: task,
              systemMessage: systemPrompt,
              schema
            })

            return {
              content: [{ type: 'text', text: result.object.generatedPrompt }]
            }
          }

          case AIAssistantAction.SUGGEST_FILES: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '<PROJECT_ID>')
            const prompt = validateDataField<string>(data, 'prompt', 'string', '"authentication flow"')
            const limit = (data?.limit as number) || 10
            const lineCount = (data?.lineCount as number) || 50
            const strategy = (data?.strategy as 'fast' | 'balanced' | 'thorough') || 'balanced'
            const userContext = data?.userContext as string | undefined
            const includeReasons = (data?.includeReasons as boolean) ?? false

            // Import the file suggestion service
            const { suggestFilesForProject } = await import('@promptliano/services')

            const result = await suggestFilesForProject(validProjectId, prompt, {
              maxResults: limit,
              strategy,
              lineCount,
              userContext,
              includeScores: true,
              includeReasons
            })

            // Format results with metadata
            const lines: string[] = [
              `# AI-Powered File Suggestions for: "${prompt}"`,
              '',
              `Strategy: ${result.metadata.strategy}`,
              `Files Analyzed: ${result.metadata.analyzedFiles}`,
              `Processing Time: ${result.metadata.processingTime}ms`,
              '',
              '## Suggested Files:',
              ''
            ]

            result.suggestedFiles.forEach((file, idx) => {
              lines.push(`${idx + 1}. ${file.path}`)
              lines.push(`   Relevance: ${(file.relevance * 100).toFixed(1)}%`)
              lines.push(`   Confidence: ${(file.confidence * 100).toFixed(1)}%`)
              if (includeReasons && file.reasons && file.reasons.length > 0) {
                lines.push(`   Reasons: ${file.reasons.join(', ')}`)
              }
              lines.push('')
            })

            return {
              content: [{ type: 'text', text: lines.join('\n') || 'No file suggestions found' }]
            }
          }

          case AIAssistantAction.SUGGEST_PROMPTS: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '<PROJECT_ID>')
            const userInput = validateDataField<string>(data, 'userInput', 'string', '"help me with authentication"')
            const limit = (data?.limit as number) || 5
            const strategy = (data?.strategy as 'fast' | 'balanced' | 'thorough') || 'balanced'

            // Import prompt suggestion services
            const { suggestPrompts, listPromptsByProject, listAllPrompts } = await import('@promptliano/services')

            // Get AI-powered prompt suggestions
            const suggestedPrompts = await suggestPrompts(validProjectId, userInput)

            // Handle case where no suggestions found
            if (suggestedPrompts.length === 0) {
              const projectPrompts = await listPromptsByProject(validProjectId)
              const allPrompts = await listAllPrompts()

              if (projectPrompts.length === 0 && allPrompts.length > 0) {
                return {
                  content: [
                    {
                      type: 'text',
                      text:
                        `No prompts are currently associated with project ${validProjectId}.\n\n` +
                        `There are ${allPrompts.length} prompts available in the system.\n` +
                        `To use them with this project, first add them using the prompt_manager tool.`
                    }
                  ]
                }
              } else if (allPrompts.length === 0) {
                return {
                  content: [
                    {
                      type: 'text',
                      text:
                        'No prompts exist in the system yet.\n\n' +
                        'Create prompts using the prompt_manager tool with the "create" action.'
                    }
                  ]
                }
              }
            }

            const promptList = suggestedPrompts.slice(0, limit).map((suggestion: string, index: number) => `${index + 1}: ${suggestion}`).join('\n\n')

            return {
              content: [
                {
                  type: 'text',
                  text:
                    suggestedPrompts.length > 0
                      ? `# AI-Powered Prompt Suggestions for: "${userInput}"\n\nStrategy: ${strategy}\n\n${promptList}`
                      : `No prompts found matching your input "${userInput}" in project ${validProjectId}`
                }
              ]
            }
          }

          default:
            throw createMCPError(MCPErrorCode.UNKNOWN_ACTION, `Unknown action: ${action}`, {
              action,
              validActions: Object.values(AIAssistantAction)
            })
        }
      } catch (error) {
        if (error instanceof MCPError) {
          return await formatMCPErrorResponse(error)
        }

        const mcpError = MCPError.fromError(error, {
          tool: 'ai_assistant',
          action: args.action,
          projectId: args.projectId
        })

        return await formatMCPErrorResponse(mcpError)
      }
    }
  )
}
