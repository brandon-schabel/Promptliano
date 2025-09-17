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
  OPTIMIZE_PROMPT = 'optimize_prompt',
  GENERATE_PROMPT = 'generate_prompt',
  ANALYZE_CODE = 'analyze_code',
  SUGGEST_IMPROVEMENTS = 'suggest_improvements',
  EXPLAIN_CONCEPT = 'explain_concept',
  GENERATE_DOCUMENTATION = 'generate_documentation',
  CODE_REVIEW = 'code_review',
  REFACTOR_SUGGESTIONS = 'refactor_suggestions'
}

const AIAssistantSchema = z.object({
  action: z.nativeEnum(AIAssistantAction),
  projectId: z.number().optional(),
  data: z.any().optional()
})

export const aiAssistantTool: MCPToolDefinition = {
  name: 'ai_assistant',
  description: 'Comprehensive AI-powered assistant for development tasks. Actions: optimize_prompt, generate_prompt, analyze_code, suggest_improvements, explain_concept, generate_documentation, code_review, refactor_suggestions',
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
        description: 'The project ID (optional for some actions). Tip: use project_manager(list) to fetch a valid ID.'
      },
      data: {
        type: 'object',
        description: 'Action-specific data. For optimize_prompt: { prompt: "original prompt", context?: "additional context" }. For analyze_code: { code: "code to analyze", language?: "typescript" }. For explain_concept: { concept: "concept to explain", level?: "beginner|intermediate|advanced" }'
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
            const type = data?.type as string | undefined || 'general'
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

          case AIAssistantAction.ANALYZE_CODE: {
            const code = validateDataField<string>(data, 'code', 'string', '"function example() { return true; }"')
            const language = data?.language as string | undefined || 'auto-detect'
            const focus = data?.focus as string | undefined || 'general analysis'

            const systemPrompt = `You are a senior software engineer conducting a code analysis.

Code to analyze:
\`\`\`${language}
${code}
\`\`\`

Focus: ${focus}

Provide a comprehensive analysis covering:
1. Code quality and best practices
2. Potential issues or bugs
3. Performance considerations
4. Security concerns (if applicable)
5. Suggestions for improvement
6. Overall assessment

Be specific and actionable in your feedback.`

            const schema = z.object({
              analysis: z.string().describe('Comprehensive code analysis'),
              issues: z.array(z.string()).optional().describe('List of identified issues'),
              suggestions: z.array(z.string()).optional().describe('List of improvement suggestions')
            })

            const result = await generateStructuredData({
              prompt: code,
              systemMessage: systemPrompt,
              schema
            })

            let response = result.object.analysis
            if (result.object.issues && result.object.issues.length) {
              response += '\n\n**Issues Found:**\n' + result.object.issues.map((i: string) => `• ${i}`).join('\n')
            }
            if (result.object.suggestions && result.object.suggestions.length) {
              response += '\n\n**Suggestions:**\n' + result.object.suggestions.map((s: string) => `• ${s}`).join('\n')
            }

            return {
              content: [{ type: 'text', text: response }]
            }
          }

          case AIAssistantAction.EXPLAIN_CONCEPT: {
            const concept = validateDataField<string>(data, 'concept', 'string', '"React hooks"')
            const level = data?.level as string | undefined || 'intermediate'
            const context = data?.context as string | undefined

            const systemPrompt = `You are an expert technical educator. Explain the given concept clearly and effectively.

Concept: ${concept}
Target Level: ${level}
${context ? `Context: ${context}` : ''}

Provide an explanation that:
1. Is appropriate for the target level
2. Uses clear, accessible language
3. Includes practical examples when helpful
4. Covers key aspects and common pitfalls
5. Relates to practical development scenarios

Make it engaging and easy to understand.`

            const schema = z.object({
              explanation: z.string().describe('Clear explanation of the concept')
            })

            const result = await generateStructuredData({
              prompt: concept,
              systemMessage: systemPrompt,
              schema
            })

            return {
              content: [{ type: 'text', text: result.object.explanation }]
            }
          }

          case AIAssistantAction.GENERATE_DOCUMENTATION: {
            const code = validateDataField<string>(data, 'code', 'string', '"function calculateTotal() { ... }"')
            const type = data?.type as string | undefined || 'api'
            const style = data?.style as string | undefined || 'comprehensive'

            const systemPrompt = `You are a technical writer creating high-quality documentation.

Code to document:
\`\`\`
${code}
\`\`\`

Documentation Type: ${type}
Style: ${style}

Generate documentation that:
1. Clearly describes purpose and functionality
2. Documents parameters, return values, and types
3. Includes usage examples
4. Covers edge cases and important notes
5. Follows documentation best practices
6. Is well-structured and readable

Provide complete, professional documentation.`

            const schema = z.object({
              documentation: z.string().describe('Generated documentation')
            })

            const result = await generateStructuredData({
              prompt: code,
              systemMessage: systemPrompt,
              schema
            })

            return {
              content: [{ type: 'text', text: result.object.documentation }]
            }
          }

          case AIAssistantAction.CODE_REVIEW: {
            const code = validateDataField<string>(data, 'code', 'string', '"function example() { ... }"')
            const context = data?.context as string | undefined
            const focus = data?.focus as string | undefined || 'comprehensive'

            const systemPrompt = `You are a senior engineer conducting a thorough code review.

Code to review:
\`\`\`
${code}
\`\`\`

${context ? `Context: ${context}` : ''}
Focus: ${focus}

Provide a detailed code review covering:
1. Code correctness and logic
2. Style and conventions
3. Performance implications
4. Security considerations
5. Maintainability and readability
6. Test coverage suggestions
7. Overall recommendations

Be constructive and specific in your feedback.`

            const schema = z.object({
              review: z.string().describe('Comprehensive code review'),
              rating: z.enum(['excellent', 'good', 'needs_improvement', 'major_issues']).optional().describe('Overall quality rating')
            })

            const result = await generateStructuredData({
              prompt: code,
              systemMessage: systemPrompt,
              schema
            })

            let response = result.object.review
            if (result.object.rating) {
              response = `**Overall Rating: ${result.object.rating.replace('_', ' ').toUpperCase()}**\n\n${response}`
            }

            return {
              content: [{ type: 'text', text: response }]
            }
          }

          case AIAssistantAction.REFACTOR_SUGGESTIONS: {
            const code = validateDataField<string>(data, 'code', 'string', '"function example() { ... }"')
            const goals = data?.goals as string | undefined || 'improve readability and maintainability'
            const constraints = data?.constraints as string | undefined

            const systemPrompt = `You are a senior engineer providing refactoring guidance.

Code to refactor:
\`\`\`
${code}
\`\`\`

Refactoring Goals: ${goals}
${constraints ? `Constraints: ${constraints}` : ''}

Provide specific refactoring suggestions that:
1. Address the stated goals
2. Improve code quality and maintainability
3. Are practical and implementable
4. Consider potential risks and trade-offs
5. Include before/after examples where helpful

Focus on actionable, specific improvements.`

            const schema = z.object({
              suggestions: z
                .array(
                  z.object({
                    title: z.string(),
                    description: z.string(),
                    priority: z.enum(['high', 'medium', 'low'])
                  })
                )
                .describe('List of refactoring suggestions')
            })

            const result = await generateStructuredData({
              prompt: code,
              systemMessage: systemPrompt,
              schema
            })

            const suggestions = result.object.suggestions || []
            const response = suggestions.map((s, i) =>
              `${i + 1}. **${s.title}** (Priority: ${s.priority})\n   ${s.description}`
            ).join('\n\n')

            return {
              content: [{ type: 'text', text: response || 'No specific refactoring suggestions identified.' }]
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
