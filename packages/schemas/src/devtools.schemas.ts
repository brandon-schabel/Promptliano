import { z } from '@hono/zod-openapi'
import { createSuccessResponseSchema } from './factories'

export const McpInspectorSessionSchema = z
  .object({
    enabled: z.boolean().describe('Whether MCP Inspector dev tools are enabled via environment configuration'),
    sessionToken: z.string().min(1).nullable().describe('Current MCP Inspector session token if available'),
    clientUrl: z.string().url().nullable().describe('Local URL for the MCP Inspector UI when enabled'),
    proxyUrl: z.string().url().nullable().describe('Local URL for the MCP Inspector proxy server when enabled'),
    sessionFilePath: z.string().nullable().describe('File path used to read the session token'),
    lastUpdated: z.number().nullable().describe('Last modification time (ms) for the session file')
  })
  .openapi('McpInspectorSession')

export const McpInspectorSessionResponseSchema = createSuccessResponseSchema(McpInspectorSessionSchema, {
  name: 'McpInspectorSession'
})

export type McpInspectorSession = z.infer<typeof McpInspectorSessionSchema>
export type McpInspectorSessionResponse = z.infer<typeof McpInspectorSessionResponseSchema>
