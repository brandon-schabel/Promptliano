/**
 * Command Schema Definitions
 * Schemas for Claude Code slash command functionality
 */

import { z } from 'zod'

/**
 * Command scope enum - where the command can be used
 */
export const CommandScopeSchema = z.enum(['global', 'project', 'file'])
export type CommandScope = z.infer<typeof CommandScopeSchema>

/**
 * Search commands query parameters
 */
export const SearchCommandsQuerySchema = z.object({
  query: z.string().optional(),
  scope: CommandScopeSchema.optional(),
  includeGlobal: z.boolean().default(true),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0)
})
export type SearchCommandsQuery = z.infer<typeof SearchCommandsQuerySchema>

/**
 * Command generation context options
 */
export const CommandContextOptionsSchema = z.object({
  includeProjectSummary: z.boolean().default(true),
  includeFileStructure: z.boolean().default(true),
  includeTechStack: z.boolean().default(true),
  selectedFiles: z.array(z.string()).optional(),
  additionalContext: z.string().optional()
})
export type CommandContextOptions = z.infer<typeof CommandContextOptionsSchema>

/**
 * Command generation request
 */
export const CommandGenerationRequestSchema = z.object({
  name: z.string()
    .min(1, 'Command name is required')
    .regex(/^[a-z0-9-]+$/, 'Command name must only contain lowercase letters, numbers, and hyphens'),
  description: z.string().min(1, 'Description is required'),
  userIntent: z.string().min(1, 'User intent is required'),
  category: z.string().default('general'),
  scope: CommandScopeSchema.default('project'),
  context: CommandContextOptionsSchema.optional()
})
export type CommandGenerationRequest = z.infer<typeof CommandGenerationRequestSchema>

/**
 * Generated command data
 */
export const GeneratedCommandSchema = z.object({
  name: z.string(),
  description: z.string(),
  content: z.string(),
  category: z.string(),
  reasoning: z.string()
})
export type GeneratedCommand = z.infer<typeof GeneratedCommandSchema>

/**
 * Command generation response
 */
export const CommandGenerationResponseSchema = z.object({
  success: z.boolean(),
  data: GeneratedCommandSchema,
  error: z.string().optional()
})
export type CommandGenerationResponse = z.infer<typeof CommandGenerationResponseSchema>

/**
 * Command suggestion
 */
export const CommandSuggestionSchema = z.object({
  name: z.string(),
  description: z.string(),
  content: z.string(),
  category: z.string(),
  useCase: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium')
})
export type CommandSuggestion = z.infer<typeof CommandSuggestionSchema>

/**
 * Command suggestions response
 */
export const CommandSuggestionsSchema = z.object({
  suggestions: z.array(CommandSuggestionSchema),
  reasoning: z.string()
})
export type CommandSuggestions = z.infer<typeof CommandSuggestionsSchema>

/**
 * Command execution result
 */
export const CommandExecutionResultSchema = z.object({
  result: z.string(),
  metadata: z.record(z.any()).optional(),
  success: z.boolean().default(true),
  error: z.string().optional()
})
export type CommandExecutionResult = z.infer<typeof CommandExecutionResultSchema>

// CRUD Schemas for commands
export const CreateClaudeCommandBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  command: z.string().min(1),
  args: z.record(z.any()).optional().default({}),
  isActive: z.boolean().optional().default(true)
})
export type CreateClaudeCommandBody = z.infer<typeof CreateClaudeCommandBodySchema>

export const UpdateClaudeCommandBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  command: z.string().min(1).optional(),
  args: z.record(z.any()).optional(),
  isActive: z.boolean().optional()
})
export type UpdateClaudeCommandBody = z.infer<typeof UpdateClaudeCommandBodySchema>

// Execute Command Body Schema
export const ExecuteClaudeCommandBodySchema = z.object({
  arguments: z.record(z.any()).optional().default({})
})
export type ExecuteClaudeCommandBody = z.infer<typeof ExecuteClaudeCommandBodySchema>

// Suggest Agents Request Schema
export const SuggestAgentsRequestSchema = z.object({
  userContext: z.string().min(1),
  limit: z.number().int().positive().max(10).optional().default(5)
})
export type SuggestAgentsRequest = z.infer<typeof SuggestAgentsRequestSchema>

// Create Claude Agent Body Schema
export const CreateClaudeAgentBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  instructions: z.string().min(1),
  model: z.string().optional().default('claude-3-sonnet')
})
export type CreateClaudeAgentBody = z.infer<typeof CreateClaudeAgentBodySchema>

// Update Claude Agent Body Schema
export const UpdateClaudeAgentBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  instructions: z.string().min(1).optional(),
  model: z.string().optional()
})
export type UpdateClaudeAgentBody = z.infer<typeof UpdateClaudeAgentBodySchema>