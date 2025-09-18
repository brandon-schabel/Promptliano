import { describe, expect, test } from 'bun:test'
import { createInMemoryMCPContext } from '../../../mcp/test-utils/inmemory-client'

describe('project_manager MCP tool', () => {
  test('lists projects successfully', async () => {
    const context = await createInMemoryMCPContext()
    const { client, close } = context

    try {
      const response = await client.callTool({
        name: 'project_manager',
        arguments: { action: 'list' }
      })

      expect(response).toBeDefined()
      expect(Array.isArray(response.content)).toBe(true)
      const first = response.content[0]
      expect(first).toBeDefined()
      expect(first.type).toBe('text')
      expect(typeof first.text).toBe('string')
    } finally {
      await close()
    }
  })

  test('suggest_files returns results', async () => {
    const context = await createInMemoryMCPContext()
    const { client, close } = context

    try {
      const response = await client.callTool({
        name: 'project_manager',
        arguments: {
          action: 'suggest_files',
          projectId: 1,
          data: {
            prompt: 'I would like to simplify my MCP',
            limit: 5
          }
        }
      })

      expect(response).toBeDefined()
      expect(Array.isArray(response.content)).toBe(true)
      const first = response.content[0]
      expect(first).toBeDefined()
      expect(first.type).toBe('text')
      expect(typeof first.text).toBe('string')
    } finally {
      await close()
    }
  })
})
