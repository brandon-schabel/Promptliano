/**
 * AUTO-GENERATED API CLIENT
 * Generated at: 2025-08-23T00:21:48.700Z
 * 
 * ⚠️  DO NOT EDIT MANUALLY - Changes will be overwritten
 */

// Type-safe API types
export * from './api-types'

// Type-safe API client
export * from './type-safe-client'

// Advanced React Query hooks (replaces simple hooks)
export * from './advanced-hooks'

// React Query provider
export * from './react-query-provider'

// OpenAPI specification  
export { default as openApiSpec } from './openapi-spec.json'

// Legacy exports for backwards compatibility
export {
  useProjects,
  useCreateProject,
  useTickets,
  useCreateTicket,
  useChats,
  useCreateChat,
  useQueues,
  useCreateQueue
} from './advanced-hooks'
