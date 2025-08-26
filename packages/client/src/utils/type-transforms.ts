/**
 * Type transformation utilities to convert database JSON types to typed schema types
 * This provides a bridge between raw database responses and client-side typed schemas
 */

// Json type from drizzle-orm - represents any JSON value
type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

/**
 * Safely converts a Json field to a string array
 */
export function jsonToStringArray(json: Json): string[] {
  if (json === null || json === undefined) {
    return []
  }
  if (Array.isArray(json)) {
    return json.filter((item): item is string => typeof item === 'string')
  }
  return []
}

/**
 * Safely converts a Json field to a number array
 */
export function jsonToNumberArray(json: Json): number[] {
  if (json === null || json === undefined) {
    return []
  }
  if (Array.isArray(json)) {
    return json.filter((item): item is number => typeof item === 'number')
  }
  return []
}

/**
 * Transform a raw database Ticket to properly typed Ticket
 */
export function transformTicketFromDb(dbTicket: any): any {
  return {
    ...dbTicket,
    suggestedFileIds: jsonToStringArray(dbTicket.suggestedFileIds),
    suggestedAgentIds: jsonToStringArray(dbTicket.suggestedAgentIds),
    suggestedPromptIds: jsonToNumberArray(dbTicket.suggestedPromptIds)
  }
}

/**
 * Transform a raw database TicketTask to properly typed TicketTask
 */
export function transformTicketTaskFromDb(dbTask: any): any {
  return {
    ...dbTask,
    suggestedFileIds: jsonToStringArray(dbTask.suggestedFileIds),
    dependencies: jsonToNumberArray(dbTask.dependencies),
    tags: jsonToStringArray(dbTask.tags),
    suggestedPromptIds: jsonToNumberArray(dbTask.suggestedPromptIds)
  }
}

/**
 * Transform a raw database Prompt to properly typed Prompt
 */
export function transformPromptFromDb(dbPrompt: any): any {
  return {
    ...dbPrompt,
    tags: jsonToStringArray(dbPrompt.tags)
  }
}

/**
 * Transform a raw database TicketWithTasks to properly typed TicketWithTasks
 */
export function transformTicketWithTasksFromDb(dbTicketWithTasks: any): any {
  return {
    ticket: transformTicketFromDb(dbTicketWithTasks.ticket),
    tasks: dbTicketWithTasks.tasks.map(transformTicketTaskFromDb)
  }
}
