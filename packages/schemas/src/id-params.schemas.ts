import { z } from '@hono/zod-openapi'
import { entityIdCoercibleSchema } from './schema-utils'

// Re-export existing schemas to avoid conflicts
export { ProjectIdParamsSchema } from './project.schemas'
export { PromptIdParamsSchema } from './prompt.schemas'

// =============================================================================
// ID PARAMETER SCHEMAS FOR OTHER ENTITIES
// =============================================================================
// These schemas are used by auto-generated routes to validate path parameters.
// Each schema defines the ID parameter for a specific entity type.

// Ticket ID Parameters
export const TicketIdParamsSchema = z
  .object({
    id: entityIdCoercibleSchema.openapi({ param: { name: 'id', in: 'path' } })
  })
  .openapi('TicketIdParams')

// Chat ID Parameters
export const ChatIdParamsSchema = z
  .object({
    id: entityIdCoercibleSchema.openapi({ param: { name: 'id', in: 'path' } })
  })
  .openapi('ChatIdParams')

// Chat Message ID Parameters
export const ChatMessageIdParamsSchema = z
  .object({
    id: entityIdCoercibleSchema.openapi({ param: { name: 'id', in: 'path' } })
  })
  .openapi('ChatMessageIdParams')

// Queue ID Parameters
export const QueueIdParamsSchema = z
  .object({
    id: entityIdCoercibleSchema.openapi({ param: { name: 'id', in: 'path' } })
  })
  .openapi('QueueIdParams')

// Queue Item ID Parameters
export const QueueItemIdParamsSchema = z
  .object({
    id: entityIdCoercibleSchema.openapi({ param: { name: 'id', in: 'path' } })
  })
  .openapi('QueueItemIdParams')

// Ticket Task ID Parameters
export const TicketTaskIdParamsSchema = z
  .object({
    id: entityIdCoercibleSchema.openapi({ param: { name: 'id', in: 'path' } })
  })
  .openapi('TicketTaskIdParams')

// File ID Parameters
export const FileIdParamsSchema = z
  .object({
    id: entityIdCoercibleSchema.openapi({ param: { name: 'id', in: 'path' } })
  })
  .openapi('FileIdParams')

// Claude Agent ID Parameters
export const ClaudeAgentIdParamsSchema = z
  .object({
    id: entityIdCoercibleSchema.openapi({ param: { name: 'id', in: 'path' } })
  })
  .openapi('ClaudeAgentIdParams')

// Agent ID Parameters (backward compatibility alias)
export const AgentIdParamsSchema = z
  .object({
    agentId: z.string().openapi({ param: { name: 'agentId', in: 'path' } })
  })
  .openapi('AgentIdParams')

// Command Name Parameters
export const CommandNameParamsSchema = z
  .object({
    commandName: z.string().openapi({ param: { name: 'commandName', in: 'path' } })
  })
  .openapi('CommandNameParams')

// Claude Command ID Parameters
export const ClaudeCommandIdParamsSchema = z
  .object({
    id: entityIdCoercibleSchema.openapi({ param: { name: 'id', in: 'path' } })
  })
  .openapi('ClaudeCommandIdParams')

// Claude Hook ID Parameters
export const ClaudeHookIdParamsSchema = z
  .object({
    id: entityIdCoercibleSchema.openapi({ param: { name: 'id', in: 'path' } })
  })
  .openapi('ClaudeHookIdParams')

// Provider Key ID Parameters
export const ProviderKeyIdParamsSchema = z
  .object({
    id: entityIdCoercibleSchema.openapi({ param: { name: 'id', in: 'path' } })
  })
  .openapi('ProviderKeyIdParams')

// Active Tab ID Parameters
export const ActiveTabIdParamsSchema = z
  .object({
    id: entityIdCoercibleSchema.openapi({ param: { name: 'id', in: 'path' } })
  })
  .openapi('ActiveTabIdParams')

// Selected File ID Parameters
export const SelectedFileIdParamsSchema = z
  .object({
    id: entityIdCoercibleSchema.openapi({ param: { name: 'id', in: 'path' } })
  })
  .openapi('SelectedFileIdParams')

// =============================================================================
// TYPE EXPORTS
// =============================================================================

// Note: ProjectIdParams is exported from project.schemas.ts
// Note: PromptIdParams is exported from prompt.schemas.ts
// These are not re-exported here to avoid duplicate export conflicts
export type TicketIdParams = z.infer<typeof TicketIdParamsSchema>
export type ChatIdParams = z.infer<typeof ChatIdParamsSchema>
export type ChatMessageIdParams = z.infer<typeof ChatMessageIdParamsSchema>
export type QueueIdParams = z.infer<typeof QueueIdParamsSchema>
export type QueueItemIdParams = z.infer<typeof QueueItemIdParamsSchema>
export type TicketTaskIdParams = z.infer<typeof TicketTaskIdParamsSchema>
export type FileIdParams = z.infer<typeof FileIdParamsSchema>
export type ClaudeAgentIdParams = z.infer<typeof ClaudeAgentIdParamsSchema>
export type AgentIdParams = z.infer<typeof AgentIdParamsSchema>
export type CommandNameParams = z.infer<typeof CommandNameParamsSchema>
export type ClaudeCommandIdParams = z.infer<typeof ClaudeCommandIdParamsSchema>
export type ClaudeHookIdParams = z.infer<typeof ClaudeHookIdParamsSchema>
export type ProviderKeyIdParams = z.infer<typeof ProviderKeyIdParamsSchema>
export type ActiveTabIdParams = z.infer<typeof ActiveTabIdParamsSchema>
export type SelectedFileIdParams = z.infer<typeof SelectedFileIdParamsSchema>
