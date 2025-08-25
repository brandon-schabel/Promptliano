import { z } from '@hono/zod-openapi'

// =============================================================================
// ACTIVE TAB API REQUEST SCHEMAS
// =============================================================================
// These schemas validate incoming requests to active tab endpoints

// Update Active Tab Schema
export const updateActiveTabSchema = z
  .object({
    tabId: z.number().int().min(0), // Required field that was missing
    clientId: z.string().optional(),
    tabMetadata: z
      .object({
        displayName: z.string().optional(),
        selectedFiles: z.array(z.number()).optional(),
        selectedPrompts: z.array(z.number()).optional(),
        userPrompt: z.string().optional(),
        fileSearch: z.string().optional(),
        contextLimit: z.number().optional(),
        preferredEditor: z.enum(['vscode', 'cursor', 'webstorm']).optional(),
        suggestedFileIds: z.array(z.number()).optional(),
        ticketSearch: z.string().optional(),
        ticketSort: z.enum(['created_asc', 'created_desc', 'status', 'priority']).optional(),
        ticketStatusFilter: z.enum(['all', 'open', 'in_progress', 'closed', 'non_closed']).optional()
      })
      .optional()
  })
  .openapi('UpdateActiveTab')

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type UpdateActiveTab = z.infer<typeof updateActiveTabSchema>