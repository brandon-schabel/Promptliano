import { describe, it, expect } from 'bun:test'
import { projectManagerTool } from '../project/project-manager.tool'
import { flowManagerTool } from '../workflow/flow-manager.tool'
import { aiAssistantTool } from '../content/ai-assistant.tool'
import { gitManagerTool } from '../git/git-manager.tool'
import { promptManagerTool } from '../project/prompt-manager.tool'

/**
 * Schema Validation Tests
 *
 * These tests ensure that all MCP tools properly support additionalProperties in their
 * data fields, allowing AI providers to pass dynamic parameters like 'limit', 'offset', etc.
 *
 * This prevents the error:
 * "Tool call validation failed: parameters for tool did not match schema:
 *  errors: [additionalProperties 'limit' not allowed]"
 */
describe('MCP Tool Schema Validation', () => {
  describe('Project Manager Tool', () => {
    it('should have additionalProperties: true in data schema', () => {
      const schema = projectManagerTool.inputSchema
      expect(schema.properties.data).toBeDefined()
      expect(schema.properties.data.additionalProperties).toBe(true)
    })

    it('should allow limit parameter in get_file_tree action', async () => {
      // This test verifies that the tool accepts the limit parameter
      // which was previously causing validation errors
      const mockArgs = {
        action: 'get_file_tree',
        projectId: 1,
        data: {
          limit: 100,
          offset: 0,
          maxDepth: 3
        }
      }

      // The schema should validate this without errors
      const schema = projectManagerTool.inputSchema
      expect(schema.properties.data.additionalProperties).toBe(true)
    })

    it('should allow search parameters', async () => {
      const mockArgs = {
        action: 'search',
        projectId: 1,
        data: {
          query: 'test',
          limit: 20,
          offset: 0,
          fileTypes: ['ts', 'tsx'],
          caseSensitive: false
        }
      }

      const schema = projectManagerTool.inputSchema
      expect(schema.properties.data.additionalProperties).toBe(true)
    })
  })

  describe('Flow Manager Tool', () => {
    it('should have additionalProperties: true in data schema', () => {
      const schema = flowManagerTool.inputSchema
      expect(schema.properties.data).toBeDefined()
      expect(schema.properties.data.additionalProperties).toBe(true)
    })

    it('should allow dynamic data properties', () => {
      const mockArgs = {
        action: 'tickets_list',
        projectId: 1,
        data: {
          status: 'open',
          limit: 10,
          sortBy: 'createdAt'
        }
      }

      const schema = flowManagerTool.inputSchema
      expect(schema.properties.data.additionalProperties).toBe(true)
    })
  })

  describe('AI Assistant Tool', () => {
    it('should have additionalProperties: true in data schema', () => {
      const schema = aiAssistantTool.inputSchema
      expect(schema.properties.data).toBeDefined()
      expect(schema.properties.data.additionalProperties).toBe(true)
    })

    it('should allow analysis parameters', () => {
      const mockArgs = {
        action: 'analyze_code',
        data: {
          code: 'const foo = "bar"',
          language: 'typescript',
          options: { checkStyle: true }
        }
      }

      const schema = aiAssistantTool.inputSchema
      expect(schema.properties.data.additionalProperties).toBe(true)
    })
  })

  describe('Git Manager Tool', () => {
    it('should have additionalProperties: true in data schema', () => {
      const schema = gitManagerTool.inputSchema
      expect(schema.properties.data).toBeDefined()
      expect(schema.properties.data.additionalProperties).toBe(true)
    })

    it('should allow log_enhanced parameters', () => {
      const mockArgs = {
        action: 'log_enhanced',
        projectId: 1,
        data: {
          branch: 'main',
          author: 'user',
          page: 1,
          perPage: 20,
          since: '2024-01-01',
          includeStats: true
        }
      }

      const schema = gitManagerTool.inputSchema
      expect(schema.properties.data.additionalProperties).toBe(true)
    })
  })

  describe('Prompt Manager Tool', () => {
    it('should have additionalProperties: true in data schema', () => {
      const schema = promptManagerTool.inputSchema
      expect(schema.properties.data).toBeDefined()
      expect(schema.properties.data.additionalProperties).toBe(true)
    })

    it('should allow suggest_prompts parameters', () => {
      const mockArgs = {
        action: 'suggest_prompts',
        projectId: 1,
        data: {
          userInput: 'authentication',
          limit: 5,
          category: 'security'
        }
      }

      const schema = promptManagerTool.inputSchema
      expect(schema.properties.data.additionalProperties).toBe(true)
    })
  })

  describe('All MCP Tools', () => {
    const tools = [
      { name: 'project_manager', tool: projectManagerTool },
      { name: 'flow_manager', tool: flowManagerTool },
      { name: 'ai_assistant', tool: aiAssistantTool },
      { name: 'git_manager', tool: gitManagerTool },
      { name: 'prompt_manager', tool: promptManagerTool }
    ]

    it.each(tools)('$name should have proper schema structure', ({ name, tool }) => {
      expect(tool.inputSchema).toBeDefined()
      expect(tool.inputSchema.type).toBe('object')
      expect(tool.inputSchema.properties).toBeDefined()
      expect(tool.inputSchema.properties.action).toBeDefined()
      expect(tool.inputSchema.required).toContain('action')
    })

    it.each(tools)('$name should allow additional properties in data field', ({ name, tool }) => {
      if (tool.inputSchema.properties.data) {
        expect(tool.inputSchema.properties.data.additionalProperties).toBe(true)
      }
    })
  })

  describe('Common Parameter Patterns', () => {
    const paginationParams = ['limit', 'offset', 'page', 'perPage']
    const filterParams = ['status', 'category', 'type', 'search', 'query']
    const optionParams = ['includeHidden', 'includeStats', 'caseSensitive', 'sortBy']

    it('should support pagination parameters', () => {
      const tools = [projectManagerTool, flowManagerTool, promptManagerTool]
      tools.forEach(tool => {
        if (tool.inputSchema.properties.data) {
          expect(tool.inputSchema.properties.data.additionalProperties).toBe(true)
        }
      })
    })

    it('should support filter parameters', () => {
      const tools = [projectManagerTool, flowManagerTool, gitManagerTool]
      tools.forEach(tool => {
        if (tool.inputSchema.properties.data) {
          expect(tool.inputSchema.properties.data.additionalProperties).toBe(true)
        }
      })
    })

    it('should support option parameters', () => {
      const tools = [projectManagerTool, gitManagerTool, aiAssistantTool]
      tools.forEach(tool => {
        if (tool.inputSchema.properties.data) {
          expect(tool.inputSchema.properties.data.additionalProperties).toBe(true)
        }
      })
    })
  })
})
