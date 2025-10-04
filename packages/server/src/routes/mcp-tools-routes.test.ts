/**
 * Backend tests for MCP Tools Routes
 * Tests the /api/mcp/active-tools endpoint with various provider and project configurations
 */

import { describe, it, expect, beforeEach } from 'bun:test'
import { OpenAPIHono } from '@hono/zod-openapi'
import { mcpToolsRoutes } from './mcp-tools-routes'

describe('MCP Tools Routes', () => {
  let app: OpenAPIHono

  beforeEach(() => {
    app = new OpenAPIHono().route('/', mcpToolsRoutes)
  })

  describe('GET /api/mcp/active-tools', () => {
    it('returns default MCPs without provider parameter', async () => {
      const res = await app.request('/api/mcp/active-tools')
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data).toBeDefined()
      expect(json.data.mcps).toBeArray()
      expect(json.data.totalTools).toBeNumber()

      // Should have at least Promptliano and Chrome DevTools MCPs
      expect(json.data.mcps.length).toBeGreaterThanOrEqual(2)

      // Verify Promptliano MCP
      const promptlianoMCP = json.data.mcps.find((mcp: any) => mcp.name === 'Promptliano')
      expect(promptlianoMCP).toBeDefined()
      expect(promptlianoMCP.type).toBe('local')
      expect(promptlianoMCP.enabled).toBe(true)
      expect(promptlianoMCP.toolCount).toBeGreaterThan(0)
      expect(promptlianoMCP.tools).toBeArray()

      // Verify Chrome DevTools MCP
      const chromeMCP = json.data.mcps.find((mcp: any) => mcp.name === 'Chrome DevTools')
      expect(chromeMCP).toBeDefined()
      expect(chromeMCP.type).toBe('local')
      expect(chromeMCP.enabled).toBe(true)
    })

    it('includes disabled Groq MCP when provider is not groq', async () => {
      const res = await app.request('/api/mcp/active-tools?provider=openai')
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)

      // Should have 3 MCPs total (Promptliano, Chrome DevTools, Groq disabled)
      expect(json.data.mcps.length).toBe(3)

      // Verify Groq MCP is present but disabled
      const groqMCP = json.data.mcps.find((mcp: any) => mcp.name === 'Groq')
      expect(groqMCP).toBeDefined()
      expect(groqMCP.enabled).toBe(false)
      expect(groqMCP.type).toBe('remote')
      expect(groqMCP.conditionalOn).toBe('groq-provider')
    })

    it('enables Groq MCP when provider is groq', async () => {
      const res = await app.request('/api/mcp/active-tools?provider=groq')
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)

      // Should have 3 MCPs with all enabled
      const enabledMCPs = json.data.mcps.filter((mcp: any) => mcp.enabled)
      expect(enabledMCPs.length).toBe(3)

      // Verify Groq MCP is enabled
      const groqMCP = json.data.mcps.find((mcp: any) => mcp.name === 'Groq')
      expect(groqMCP).toBeDefined()
      expect(groqMCP.enabled).toBe(true)
      expect(groqMCP.type).toBe('remote')
      expect(groqMCP.toolCount).toBe(5) // web_search, web_scrape, stripe_invoice, stripe_payment, web_fetch
      expect(groqMCP.tools).toBeArray()
      expect(groqMCP.tools.length).toBe(5)

      // Verify Groq tools structure
      const webSearchTool = groqMCP.tools.find((tool: any) => tool.name === 'web_search')
      expect(webSearchTool).toBeDefined()
      expect(webSearchTool.description).toContain('web search')
      expect(webSearchTool.category).toBe('search')
    })

    it('handles case-insensitive provider matching', async () => {
      const res = await app.request('/api/mcp/active-tools?provider=GROQ')
      expect(res.status).toBe(200)

      const json = await res.json()
      const groqMCP = json.data.mcps.find((mcp: any) => mcp.name === 'Groq')
      expect(groqMCP.enabled).toBe(true)
    })

    it('returns correct total tool count with Groq enabled', async () => {
      const res = await app.request('/api/mcp/active-tools?provider=groq')
      expect(res.status).toBe(200)

      const json = await res.json()
      const expectedTotal = json.data.mcps.reduce((sum: number, mcp: any) => {
        return mcp.enabled ? sum + mcp.toolCount : sum
      }, 0)

      expect(json.data.totalTools).toBe(expectedTotal)
      // Should be 12 (Promptliano) + 8 (Chrome DevTools) + 5 (Groq) = 25
      expect(json.data.totalTools).toBeGreaterThanOrEqual(25)
    })

    it('returns correct total tool count with Groq disabled', async () => {
      const res = await app.request('/api/mcp/active-tools?provider=openai')
      expect(res.status).toBe(200)

      const json = await res.json()
      // Should be 12 (Promptliano) + 8 (Chrome DevTools) = 20 (Groq not counted when disabled)
      expect(json.data.totalTools).toBe(20)
    })

    it('includes provider in response when specified', async () => {
      const res = await app.request('/api/mcp/active-tools?provider=anthropic')
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.data.provider).toBe('anthropic')
    })

    it('handles projectId parameter', async () => {
      const res = await app.request('/api/mcp/active-tools?projectId=123')
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)
      // Should still return MCPs even if project-specific fetching fails
      expect(json.data.mcps.length).toBeGreaterThanOrEqual(2)
    })

    it('handles both provider and projectId parameters', async () => {
      const res = await app.request('/api/mcp/active-tools?provider=groq&projectId=456')
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.provider).toBe('groq')

      const groqMCP = json.data.mcps.find((mcp: any) => mcp.name === 'Groq')
      expect(groqMCP.enabled).toBe(true)
    })

    it('validates tool structure for all MCPs', async () => {
      const res = await app.request('/api/mcp/active-tools?provider=groq')
      expect(res.status).toBe(200)

      const json = await res.json()

      // Validate each MCP has required fields
      json.data.mcps.forEach((mcp: any) => {
        expect(mcp.name).toBeString()
        expect(mcp.type).toMatch(/^(local|remote)$/)
        expect(mcp.enabled).toBeBoolean()
        expect(mcp.toolCount).toBeNumber()
        expect(mcp.tools).toBeArray()

        // Validate each tool has required fields
        mcp.tools.forEach((tool: any) => {
          expect(tool.name).toBeString()
          // description and category are optional
          if (tool.description) expect(tool.description).toBeString()
          if (tool.category) expect(tool.category).toBeString()
        })
      })
    })

    it('returns consistent data structure across multiple calls', async () => {
      const res1 = await app.request('/api/mcp/active-tools?provider=groq')
      const res2 = await app.request('/api/mcp/active-tools?provider=groq')

      const json1 = await res1.json()
      const json2 = await res2.json()

      expect(json1.data.mcps.length).toBe(json2.data.mcps.length)
      expect(json1.data.totalTools).toBe(json2.data.totalTools)
    })

    it('handles unknown provider gracefully', async () => {
      const res = await app.request('/api/mcp/active-tools?provider=unknown')
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)
      // Should return default MCPs with Groq disabled
      expect(json.data.mcps.length).toBeGreaterThanOrEqual(2)

      const groqMCP = json.data.mcps.find((mcp: any) => mcp.name === 'Groq')
      if (groqMCP) {
        expect(groqMCP.enabled).toBe(false)
      }
    })
  })

  describe('Response Format Validation', () => {
    it('matches OpenAPI schema structure', async () => {
      const res = await app.request('/api/mcp/active-tools?provider=groq')
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('application/json')

      const json = await res.json()

      // Validate top-level structure
      expect(json).toHaveProperty('success')
      expect(json).toHaveProperty('data')
      expect(json.success).toBe(true)

      // Validate data structure
      expect(json.data).toHaveProperty('mcps')
      expect(json.data).toHaveProperty('totalTools')
      expect(json.data).toHaveProperty('provider')

      // Validate MCP structure
      expect(Array.isArray(json.data.mcps)).toBe(true)
      expect(typeof json.data.totalTools).toBe('number')
    })
  })
})
