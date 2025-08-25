import { z } from '@hono/zod-openapi'
import { ApiErrorResponseSchema, OperationSuccessResponseSchema } from './common.schemas'
import {
  appSettingsSchema,
  createInitialGlobalState,
  createSafeGlobalState,
  projectTabsStateRecordSchema
} from './global-state-schema'
import { idSchemaSpec } from './schema-utils'

export const KVKeyEnum = {
  appSettings: 'appSettings',
  projectTabs: 'projectTabs',
  activeProjectTabId: 'activeProjectTabId',
  activeChatId: 'activeChatId',
  recentProjects: 'recentProjects'
} as const

export type KVKey = (typeof KVKeyEnum)[keyof typeof KVKeyEnum]

export const kvKeyEnumSchema = z.enum(Object.values(KVKeyEnum) as [KVKey, ...KVKey[]])

// Schema for recent projects - array of project IDs
const recentProjectsSchema = z.array(z.number()).max(5).default([])

export const KvSchemas = {
  [KVKeyEnum.appSettings]: appSettingsSchema,
  [KVKeyEnum.projectTabs]: projectTabsStateRecordSchema,
  // No active project tab by default; will be set when user opens/selects a project tab
  [KVKeyEnum.activeProjectTabId]: idSchemaSpec.default(-1),
  [KVKeyEnum.activeChatId]: idSchemaSpec.default(-1),
  [KVKeyEnum.recentProjects]: recentProjectsSchema
} as const

const getInitialGlobalState = () => {
  try {
    return createInitialGlobalState()
  } catch (error) {
    console.error('Failed to create initial global state for KV defaults, using safe fallback:', error)
    return createSafeGlobalState()
  }
}

const initialGlobalState = getInitialGlobalState()

export const KVDefaultValues: { [K in KVKey]: KVValue<K> } = {
  activeChatId: initialGlobalState.activeChatId ?? 1,
  // Default to -1 (none) if not present to avoid referencing a non-existent numeric tab like "1"
  activeProjectTabId: initialGlobalState.projectActiveTabId ?? -1,
  appSettings: initialGlobalState.appSettings,
  projectTabs: initialGlobalState.projectTabs,
  recentProjects: []
}

export type KVValue<K extends KVKey> = z.infer<(typeof KvSchemas)[K]>

// --- OpenAPI Schemas ---

// Request Schemas
export const KvKeyQuerySchema = z
  .object({
    key: kvKeyEnumSchema.openapi({
      param: { name: 'key', in: 'query' },
      description: 'The key to retrieve or delete.',
      example: KVKeyEnum.appSettings
    })
  })
  .openapi('KvKeyQuery')

export const KvSetBodySchema = z
  .object({
    value: z.any().openapi({
      description: "The value to store for the key. Must conform to the key's specific schema.",
      example: { theme: 'dark', language: 'en' }
    })
  })
  .openapi('KvSetBody')

// Response Schemas
export const KvGetResponseSchema = z
  .object({
    success: z.literal(true),
    key: kvKeyEnumSchema.openapi({
      description: 'The key whose value was retrieved.',
      example: KVKeyEnum.appSettings
    }),
    value: z.any().openapi({
      // Value type depends on the key
      description: 'The retrieved value associated with the key.',
      example: { name: 'Alice', age: 30 }
    })
  })
  .openapi('KvGetResponse')

export const KvSetResponseSchema = z
  .object({
    success: z.literal(true),
    key: kvKeyEnumSchema.openapi({
      description: 'The key that was set.',
      example: KVKeyEnum.appSettings
    }),
    value: z.any().openapi({
      // Value type depends on the key
      description: 'The value that was stored.',
      example: ['new-feature', 'beta-test']
    })
  })
  .openapi('KvSetResponse')

// Using common success schema for DELETE
export const KvDeleteResponseSchema = OperationSuccessResponseSchema.openapi('KvDeleteResponse')

// Re-export common error schema for consistency if needed elsewhere
export { ApiErrorResponseSchema }
