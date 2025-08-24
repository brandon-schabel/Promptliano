import { z } from 'zod'

export const hookEventTypeSchema = z.enum([
  'PreToolUse',
  'PostToolUse',
  'UserPromptSubmit',
  'Notification',
  'Stop',
  'SubagentStop',
  'SessionStart',
  'PreCompact'
])

export type HookEventType = z.infer<typeof hookEventTypeSchema>

export const hookConfigSchema = z.object({
  command: z.string(),
  timeout: z.number().optional(),
  description: z.string().optional(),
  enabled: z.boolean().optional().default(true)
})

export type HookConfig = z.infer<typeof hookConfigSchema>

export const hookListItemSchema = z.object({
  event: z.string(),
  matcher: z.string(),
  command: z.string(),
  timeout: z.number().optional(),
  description: z.string().optional()
})

export type HookListItem = z.infer<typeof hookListItemSchema>

// Hook configuration levels
export const hookConfigurationLevelSchema = z.enum(['global', 'project', 'user'])
export type HookConfigurationLevel = z.infer<typeof hookConfigurationLevelSchema>

// Hook Configuration Body Schemas (for hook management, not API)
export const createHookConfigBodySchema = z.object({
  command: z.string().min(1),
  timeout: z.number().positive().optional(),
  description: z.string().optional(),
  enabled: z.boolean().optional().default(true)
})
export type CreateHookConfigBody = z.infer<typeof createHookConfigBodySchema>

export const updateHookConfigBodySchema = z.object({
  command: z.string().min(1).optional(),
  timeout: z.number().positive().optional(),
  description: z.string().optional(),
  enabled: z.boolean().optional()
})
export type UpdateHookConfigBody = z.infer<typeof updateHookConfigBodySchema>

// Application-level hook operation schemas (not API request/response)
export const hookGenerationSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  event: hookEventTypeSchema,
  script: z.string().min(1),
  isActive: z.boolean().optional().default(true)
})
export type HookGeneration = z.infer<typeof hookGenerationSchema>

export const hookTestSchema = z.object({
  hookId: z.number(),
  testData: z.record(z.any()).optional()
})
export type HookTest = z.infer<typeof hookTestSchema>

export const createHookBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  hookType: z.enum(['pre', 'post', 'error']),
  triggerEvent: z.string().min(1),
  script: z.string().min(1),
  isActive: z.boolean().optional().default(true)
})
export type CreateHookBody = z.infer<typeof createHookBodySchema>

export const updateHookBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  hookType: z.enum(['pre', 'post', 'error']).optional(),
  triggerEvent: z.string().min(1).optional(),
  script: z.string().min(1).optional(),
  isActive: z.boolean().optional()
})
export type UpdateHookBody = z.infer<typeof updateHookBodySchema>