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

  describe('update_file_content with edit modes', () => {
    test('mode: replace - full file replacement (default, backward compatible)', async () => {
      const context = await createInMemoryMCPContext()
      const { client, close } = context

      try {
        // First, create a test file
        await client.callTool({
          name: 'project_manager',
          arguments: {
            action: 'create_file',
            projectId: 1,
            data: {
              path: 'test-replace.ts',
              content: 'line 1\nline 2\nline 3'
            }
          }
        })

        // Update with full replacement (no mode specified - default)
        const response = await client.callTool({
          name: 'project_manager',
          arguments: {
            action: 'update_file_content',
            projectId: 1,
            data: {
              path: 'test-replace.ts',
              content: 'completely new content'
            }
          }
        })

        expect(response).toBeDefined()
        expect(response.content[0].text).toContain('updated successfully')
        expect(response.content[0].text).toContain('full replacement')

        // Verify the file was updated
        const getResponse = await client.callTool({
          name: 'project_manager',
          arguments: {
            action: 'get_file_content',
            projectId: 1,
            data: { path: 'test-replace.ts' }
          }
        })

        expect(getResponse.content[0].text).toBe('completely new content')
      } finally {
        await close()
      }
    })

    test('mode: insert - insert content after specific line', async () => {
      const context = await createInMemoryMCPContext()
      const { client, close } = context

      try {
        // Create a test file
        await client.callTool({
          name: 'project_manager',
          arguments: {
            action: 'create_file',
            projectId: 1,
            data: {
              path: 'test-insert.ts',
              content: 'line 1\nline 2\nline 4'
            }
          }
        })

        // Insert content after line 2
        const response = await client.callTool({
          name: 'project_manager',
          arguments: {
            action: 'update_file_content',
            projectId: 1,
            data: {
              path: 'test-insert.ts',
              mode: 'insert',
              lineNumber: 2,
              position: 'after',
              content: 'line 3'
            }
          }
        })

        expect(response).toBeDefined()
        expect(response.content[0].text).toContain('inserted after line 2')

        // Verify the content
        const getResponse = await client.callTool({
          name: 'project_manager',
          arguments: {
            action: 'get_file_content',
            projectId: 1,
            data: { path: 'test-insert.ts' }
          }
        })

        expect(getResponse.content[0].text).toBe('line 1\nline 2\nline 3\nline 4')
      } finally {
        await close()
      }
    })

    test('mode: insert - insert content before specific line', async () => {
      const context = await createInMemoryMCPContext()
      const { client, close } = context

      try {
        // Create a test file
        await client.callTool({
          name: 'project_manager',
          arguments: {
            action: 'create_file',
            projectId: 1,
            data: {
              path: 'test-insert-before.ts',
              content: 'line 2\nline 3'
            }
          }
        })

        // Insert content before line 1
        const response = await client.callTool({
          name: 'project_manager',
          arguments: {
            action: 'update_file_content',
            projectId: 1,
            data: {
              path: 'test-insert-before.ts',
              mode: 'insert',
              lineNumber: 1,
              position: 'before',
              content: 'line 1'
            }
          }
        })

        expect(response).toBeDefined()
        expect(response.content[0].text).toContain('inserted before line 1')

        // Verify the content
        const getResponse = await client.callTool({
          name: 'project_manager',
          arguments: {
            action: 'get_file_content',
            projectId: 1,
            data: { path: 'test-insert-before.ts' }
          }
        })

        expect(getResponse.content[0].text).toBe('line 1\nline 2\nline 3')
      } finally {
        await close()
      }
    })

    test('mode: replace-lines - replace line range', async () => {
      const context = await createInMemoryMCPContext()
      const { client, close } = context

      try {
        // Create a test file
        await client.callTool({
          name: 'project_manager',
          arguments: {
            action: 'create_file',
            projectId: 1,
            data: {
              path: 'test-replace-lines.ts',
              content: 'line 1\nold line 2\nold line 3\nline 4'
            }
          }
        })

        // Replace lines 2-3
        const response = await client.callTool({
          name: 'project_manager',
          arguments: {
            action: 'update_file_content',
            projectId: 1,
            data: {
              path: 'test-replace-lines.ts',
              mode: 'replace-lines',
              startLine: 2,
              endLine: 3,
              content: 'new line 2\nnew line 3'
            }
          }
        })

        expect(response).toBeDefined()
        expect(response.content[0].text).toContain('replaced lines 2-3')

        // Verify the content
        const getResponse = await client.callTool({
          name: 'project_manager',
          arguments: {
            action: 'get_file_content',
            projectId: 1,
            data: { path: 'test-replace-lines.ts' }
          }
        })

        expect(getResponse.content[0].text).toBe('line 1\nnew line 2\nnew line 3\nline 4')
      } finally {
        await close()
      }
    })

    test('mode: patch - apply unified diff patch', async () => {
      const context = await createInMemoryMCPContext()
      const { client, close } = context

      try {
        // Create a test file
        await client.callTool({
          name: 'project_manager',
          arguments: {
            action: 'create_file',
            projectId: 1,
            data: {
              path: 'test-patch.ts',
              content: 'line 1\nold content\nline 3'
            }
          }
        })

        // Apply a patch
        const patch = `--- a/test-patch.ts
+++ b/test-patch.ts
@@ -1,3 +1,3 @@
 line 1
-old content
+new content
 line 3`

        const response = await client.callTool({
          name: 'project_manager',
          arguments: {
            action: 'update_file_content',
            projectId: 1,
            data: {
              path: 'test-patch.ts',
              mode: 'patch',
              content: patch
            }
          }
        })

        expect(response).toBeDefined()
        expect(response.content[0].text).toContain('patch applied')

        // Verify the content
        const getResponse = await client.callTool({
          name: 'project_manager',
          arguments: {
            action: 'get_file_content',
            projectId: 1,
            data: { path: 'test-patch.ts' }
          }
        })

        expect(getResponse.content[0].text).toBe('line 1\nnew content\nline 3')
      } finally {
        await close()
      }
    })

    test('validation: rejects invalid mode', async () => {
      const context = await createInMemoryMCPContext()
      const { client, close } = context

      try {
        const response = await client.callTool({
          name: 'project_manager',
          arguments: {
            action: 'update_file_content',
            projectId: 1,
            data: {
              path: 'test.ts',
              mode: 'invalid-mode',
              content: 'content'
            }
          }
        })

        expect(response.content[0].text).toContain('Invalid edit mode')
        expect(response.content[0].text).toContain('invalid-mode')
      } finally {
        await close()
      }
    })

    test('validation: insert mode requires lineNumber', async () => {
      const context = await createInMemoryMCPContext()
      const { client, close } = context

      try {
        // Create a test file first
        await client.callTool({
          name: 'project_manager',
          arguments: {
            action: 'create_file',
            projectId: 1,
            data: {
              path: 'test-validation.ts',
              content: 'line 1'
            }
          }
        })

        const response = await client.callTool({
          name: 'project_manager',
          arguments: {
            action: 'update_file_content',
            projectId: 1,
            data: {
              path: 'test-validation.ts',
              mode: 'insert',
              content: 'content'
              // Missing lineNumber
            }
          }
        })

        expect(response.content[0].text).toContain('lineNumber')
        expect(response.isError).toBe(true)
      } finally {
        await close()
      }
    })

    test('validation: replace-lines mode requires startLine and endLine', async () => {
      const context = await createInMemoryMCPContext()
      const { client, close } = context

      try {
        // Create a test file first
        await client.callTool({
          name: 'project_manager',
          arguments: {
            action: 'create_file',
            projectId: 1,
            data: {
              path: 'test-validation-lines.ts',
              content: 'line 1\nline 2'
            }
          }
        })

        const response = await client.callTool({
          name: 'project_manager',
          arguments: {
            action: 'update_file_content',
            projectId: 1,
            data: {
              path: 'test-validation-lines.ts',
              mode: 'replace-lines',
              content: 'content'
              // Missing startLine and endLine
            }
          }
        })

        expect(response.content[0].text).toContain('startLine')
        expect(response.isError).toBe(true)
      } finally {
        await close()
      }
    })

    test('validation: startLine must be <= endLine', async () => {
      const context = await createInMemoryMCPContext()
      const { client, close } = context

      try {
        // Create a test file first
        await client.callTool({
          name: 'project_manager',
          arguments: {
            action: 'create_file',
            projectId: 1,
            data: {
              path: 'test-validation-order.ts',
              content: 'line 1\nline 2\nline 3'
            }
          }
        })

        const response = await client.callTool({
          name: 'project_manager',
          arguments: {
            action: 'update_file_content',
            projectId: 1,
            data: {
              path: 'test-validation-order.ts',
              mode: 'replace-lines',
              startLine: 3,
              endLine: 1,
              content: 'content'
            }
          }
        })

        expect(response.content[0].text).toContain('must be <= end line')
        expect(response.isError).toBe(true)
      } finally {
        await close()
      }
    })
  })
})
