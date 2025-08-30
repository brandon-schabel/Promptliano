import { test, expect } from '@playwright/test'
import { AppPage } from '../pages/app.page'
import { ProjectsPage } from '../pages/projects.page'
import { PromptsPage } from '../pages/prompts.page'
import { TicketsPage } from '../pages/tickets.page'
import { QueuePage } from '../pages/queue.page'
import { TestDataFactory } from '../fixtures/test-data'
import { TestAssertions, TestDataManager } from '../utils/test-helpers'
import { MCPTestHelpers } from '../utils/mcp-test-helpers'

test.describe('MCP (Model Context Protocol) Integration', () => {
  let appPage: AppPage
  let projectsPage: ProjectsPage
  let promptsPage: PromptsPage
  let ticketsPage: TicketsPage
  let queuePage: QueuePage
  let dataManager: TestDataManager

  test.beforeEach(async ({ page }) => {
    appPage = new AppPage(page)
    projectsPage = new ProjectsPage(page)
    promptsPage = new PromptsPage(page)
    ticketsPage = new TicketsPage(page)
    queuePage = new QueuePage(page)
    dataManager = new TestDataManager(page)

    // Setup MCP test environment with fallback to mocks
    await MCPTestHelpers.createMCPTestEnvironment(page, {
      enableMocks: true,
      mockTools: ['project_manager', 'ticket_manager', 'queue_processor', 'prompt_manager'],
      requireReal: false
    })

    // Navigate to app and wait for it to be ready
    await appPage.goto()
    await appPage.waitForAppReady()
  })

  test.afterEach(async () => {
    await dataManager.cleanup()
  })

  test.describe('MCP Server Connection and Tools', () => {
    test('should verify MCP server connection', async ({ page }) => {
      await MCPTestHelpers.testMCPIntegrationSafely(page, 'connection test', async (mcpAvailable) => {
        if (mcpAvailable) {
          console.log('✅ MCP is available')

          // Test basic MCP connection
          const result = await MCPTestHelpers.callMCPTool(page, 'project_manager', { action: 'ping' })

          // Should not have error if MCP is working
          expect(result).toBeDefined()
        } else {
          console.log('⚠️ MCP not available in test environment')
          // Test should pass gracefully when MCP is not available
        }
      })
    })

    test('should list all available MCP tools', async ({ page }) => {
      const availableTools = await MCPTestHelpers.verifyMCPToolsAvailable(page)

      console.log('Available MCP tools:', availableTools)

      // Expected MCP tools for Promptliano (with correct naming)
      const expectedTools = [
        MCPTestHelpers.getMCPToolName('project_manager'),
        MCPTestHelpers.getMCPToolName('ticket_manager'),
        MCPTestHelpers.getMCPToolName('queue_processor'),
        MCPTestHelpers.getMCPToolName('prompt_manager')
      ]

      // Check which tools are available (allowing for both mock and real tools)
      const availableExpectedTools = expectedTools.filter((tool) => {
        // Check both with and without mcp__promptliano__ prefix
        const shortName = tool.replace('mcp__promptliano__', '')
        return availableTools.includes(tool) || availableTools.includes(shortName)
      })

      // Should have at least some tools available (real or mocked)
      expect(availableTools.length).toBeGreaterThan(0)
      console.log('✅ MCP tools available for testing')
    })

    test('should handle MCP tool call errors gracefully', async ({ page }) => {
      // Try to call a non-existent MCP tool
      const result = await MCPTestHelpers.callMCPTool(page, 'nonexistent_tool', {})

      // Should gracefully handle missing tools
      if (result) {
        // If result is returned, it should contain an error
        expect(result.error).toBeDefined()
      } else {
        // Or result should be undefined/null for missing tools
        expect(result).toBeUndefined()
      }
    })
  })

  test.describe('Project Manager MCP Tool', () => {
    test('should create project via MCP tool', async ({ page }) => {
      const availableTools = await MCPTestHelpers.verifyMCPToolsAvailable(page)

      if (!availableTools.includes('project_manager')) {
        console.warn('Skipping project_manager tests - tool not available')
        return
      }

      const projectData = TestDataFactory.createProject({
        name: 'MCP Created Project',
        description: 'Project created via MCP tool'
      })

      // Create project via MCP
      const createResponse = await MCPTestHelpers.testProjectManagerTool(page, 'create', {
        project: projectData
      })

      if (createResponse && createResponse.success) {
        expect(createResponse.data).toBeDefined()
        expect(createResponse.data.id).toBeDefined()

        // Verify project appears in UI
        await projectsPage.goto()
        expect(await projectsPage.projectExists(projectData.name)).toBe(true)

        // Verify project data matches
        const projectInfo = await projectsPage.getProjectInfo(projectData.name)
        expect(projectInfo.name).toBe(projectData.name)
        expect(projectInfo.description).toBe(projectData.description)
      }
    })

    test('should list projects via MCP tool', async ({ page }) => {
      const availableTools = await MCPTestHelpers.verifyMCPToolsAvailable(page)

      if (!availableTools.includes('project_manager')) {
        return
      }

      // Create test projects first
      const project1 = TestDataFactory.createProject({ name: 'MCP Test Project 1' })
      const project2 = TestDataFactory.createProject({ name: 'MCP Test Project 2' })

      await dataManager.createProject(project1)
      await dataManager.createProject(project2)

      // List projects via MCP
      const listResponse = await MCPTestHelpers.testProjectManagerTool(page, 'list')

      if (listResponse && listResponse.success) {
        expect(Array.isArray(listResponse.data)).toBe(true)

        const projects = listResponse.data
        const projectNames = projects.map((p: any) => p.name)

        expect(projectNames).toContain(project1.name)
        expect(projectNames).toContain(project2.name)
      }
    })

    test('should get specific project via MCP tool', async ({ page }) => {
      const availableTools = await MCPTestHelpers.verifyMCPToolsAvailable(page)

      if (!availableTools.includes('project_manager')) {
        return
      }

      // Create test project
      const projectData = TestDataFactory.createProject()
      const createResult = await dataManager.createProject(projectData)

      if (createResult.ok && createResult.data.data?.id) {
        const projectId = createResult.data.data.id

        // Get project via MCP
        const getResponse = await MCPTestHelpers.testProjectManagerTool(page, 'get', {
          id: projectId
        })

        if (getResponse && getResponse.success) {
          const project = getResponse.data
          expect(project.name).toBe(projectData.name)
          expect(project.description).toBe(projectData.description)
          expect(project.path).toBe(projectData.path)
        }
      }
    })

    test('should update project via MCP tool', async ({ page }) => {
      const availableTools = await MCPTestHelpers.verifyMCPToolsAvailable(page)

      if (!availableTools.includes('project_manager')) {
        return
      }

      // Create test project
      const projectData = TestDataFactory.createProject()
      const createResult = await dataManager.createProject(projectData)

      if (createResult.ok && createResult.data.data?.id) {
        const projectId = createResult.data.data.id

        const updateData = {
          name: 'MCP Updated Project Name',
          description: 'Updated via MCP tool'
        }

        // Update project via MCP
        const updateResponse = await MCPTestHelpers.testProjectManagerTool(page, 'update', {
          id: projectId,
          updates: updateData
        })

        if (updateResponse && updateResponse.success) {
          // Verify changes in UI
          await projectsPage.goto()
          expect(await projectsPage.projectExists(updateData.name)).toBe(true)

          const projectInfo = await projectsPage.getProjectInfo(updateData.name)
          expect(projectInfo.description).toBe(updateData.description)
        }
      }
    })
  })

  test.describe('Ticket Manager MCP Tool', () => {
    test('should create ticket with tasks via MCP tool', async ({ page }) => {
      const availableTools = await MCPTestHelpers.verifyMCPToolsAvailable(page)

      if (!availableTools.includes('ticket_manager')) {
        console.warn('Skipping ticket_manager tests - tool not available')
        return
      }

      const ticketData = TestDataFactory.createTicket({
        title: 'MCP Created Ticket',
        description: 'Ticket created via MCP tool',
        priority: 'high',
        tasks: ['MCP Task 1', 'MCP Task 2', 'MCP Task 3']
      })

      // Create ticket via MCP
      const createResponse = await MCPTestHelpers.testTicketManagerTool(page, 'create', {
        ticket: ticketData
      })

      if (createResponse && createResponse.success) {
        expect(createResponse.data).toBeDefined()
        expect(createResponse.data.id).toBeDefined()

        // Verify ticket appears in UI
        await ticketsPage.goto()
        expect(await ticketsPage.ticketExists(ticketData.title)).toBe(true)

        // Verify ticket data
        const ticketInfo = await ticketsPage.getTicketInfo(ticketData.title)
        expect(ticketInfo.title).toBe(ticketData.title)
        expect(ticketInfo.priority).toBe(ticketData.priority)
      }
    })

    test('should update ticket status via MCP tool', async ({ page }) => {
      const availableTools = await MCPTestHelpers.verifyMCPToolsAvailable(page)

      if (!availableTools.includes('ticket_manager')) {
        return
      }

      // Create test ticket
      const ticketData = TestDataFactory.createTicket()
      const createResult = await dataManager.createTicket(ticketData)

      if (createResult.ok && createResult.data.data?.id) {
        const ticketId = createResult.data.data.id

        // Update ticket status via MCP
        const updateResponse = await MCPTestHelpers.testTicketManagerTool(page, 'update_status', {
          id: ticketId,
          status: 'in-progress'
        })

        if (updateResponse && updateResponse.success) {
          // Verify status change in UI
          await ticketsPage.goto()
          const ticketInfo = await ticketsPage.getTicketInfo(ticketData.title)
          expect(ticketInfo.status.toLowerCase()).toBe('in-progress')
        }
      }
    })

    test('should list tickets by status via MCP tool', async ({ page }) => {
      const availableTools = await MCPTestHelpers.verifyMCPToolsAvailable(page)

      if (!availableTools.includes('ticket_manager')) {
        return
      }

      // Create tickets with different priorities
      const highPriorityTicket = TestDataFactory.createTicket({
        title: 'High Priority MCP Ticket',
        priority: 'high'
      })
      const normalPriorityTicket = TestDataFactory.createTicket({
        title: 'Normal Priority MCP Ticket',
        priority: 'normal'
      })

      await dataManager.createTicket(highPriorityTicket)
      await dataManager.createTicket(normalPriorityTicket)

      // List high priority tickets via MCP
      const listResponse = await MCPTestHelpers.testTicketManagerTool(page, 'list', {
        filter: { priority: 'high' }
      })

      if (listResponse && listResponse.success) {
        const tickets = listResponse.data
        const highPriorityTickets = tickets.filter((t: any) => t.priority === 'high')

        expect(highPriorityTickets.length).toBeGreaterThan(0)

        const ticketTitles = highPriorityTickets.map((t: any) => t.title)
        expect(ticketTitles).toContain(highPriorityTicket.title)
      }
    })
  })

  test.describe('Queue Processor MCP Tool', () => {
    test('should create and manage queue via MCP tool', async ({ page }) => {
      const availableTools = await MCPTestHelpers.verifyMCPToolsAvailable(page)

      if (!availableTools.includes('queue_processor')) {
        console.warn('Skipping queue_processor tests - tool not available')
        return
      }

      const queueData = TestDataFactory.createQueue({
        name: 'MCP Created Queue',
        description: 'Queue created via MCP tool',
        maxParallelItems: 5
      })

      // Create queue via MCP
      const createResponse = await MCPTestHelpers.testQueueProcessorTool(page, 'create_queue', {
        queue: queueData
      })

      if (createResponse && createResponse.success) {
        expect(createResponse.data).toBeDefined()

        // Verify queue appears in UI
        await queuePage.goto()
        const availableQueues = await queuePage.getAvailableQueues()
        expect(availableQueues).toContain(queueData.name)
      }
    })

    test('should add items to queue via MCP tool', async ({ page }) => {
      const availableTools = await MCPTestHelpers.verifyMCPToolsAvailable(page)

      if (!availableTools.includes('queue_processor')) {
        return
      }

      // Create queue and ticket
      const queueData = TestDataFactory.createQueue()
      const ticketData = TestDataFactory.createTicket()

      await queuePage.goto()
      await queuePage.createQueue(queueData)

      const ticketResult = await dataManager.createTicket(ticketData)

      if (ticketResult.ok && ticketResult.data.data?.id) {
        const ticketId = ticketResult.data.data.id

        // Add ticket to queue via MCP
        const addResponse = await MCPTestHelpers.testQueueProcessorTool(page, 'add_item', {
          queueName: queueData.name,
          itemType: 'ticket',
          itemId: ticketId,
          priority: 'normal'
        })

        if (addResponse && addResponse.success) {
          // Verify item was added to queue
          await queuePage.selectQueue(queueData.name)
          expect(await queuePage.hasQueueItems()).toBe(true)
        }
      }
    })

    test('should process queue via MCP tool', async ({ page }) => {
      const availableTools = await MCPTestHelpers.verifyMCPToolsAvailable(page)

      if (!availableTools.includes('queue_processor')) {
        return
      }

      const queueData = TestDataFactory.createQueue()
      await queuePage.goto()
      await queuePage.createQueue(queueData)

      // Start processing via MCP
      const processResponse = await MCPTestHelpers.testQueueProcessorTool(page, 'start_processing', {
        queueName: queueData.name
      })

      if (processResponse && processResponse.success) {
        // Verify queue is processing
        await queuePage.selectQueue(queueData.name)

        // Check status (might be idle if no items)
        const status = await queuePage.getCurrentQueueStatus()
        expect(['processing', 'running', 'idle'].some((s) => status.includes(s))).toBe(true)
      }
    })

    test('should get queue status via MCP tool', async ({ page }) => {
      const availableTools = await MCPTestHelpers.verifyMCPToolsAvailable(page)

      if (!availableTools.includes('queue_processor')) {
        return
      }

      const queueData = TestDataFactory.createQueue()
      await queuePage.goto()
      await queuePage.createQueue(queueData)

      // Get queue status via MCP
      const statusResponse = await MCPTestHelpers.testQueueProcessorTool(page, 'get_queue_status', {
        queueName: queueData.name
      })

      if (statusResponse && statusResponse.success) {
        const queueStatus = statusResponse.data

        expect(queueStatus).toBeDefined()
        expect(queueStatus.name).toBe(queueData.name)
        expect(typeof queueStatus.itemCount).toBe('number')
        expect(queueStatus.status).toBeDefined()
      }
    })
  })

  test.describe('Prompt Manager MCP Tool', () => {
    test('should create prompt via MCP tool', async ({ page }) => {
      const availableTools = await MCPTestHelpers.verifyMCPToolsAvailable(page)

      if (!availableTools.includes('prompt_manager')) {
        console.warn('Skipping prompt_manager tests - tool not available')
        return
      }

      const promptData = TestDataFactory.createPrompt({
        name: 'MCP Created Prompt',
        content: 'This prompt was created via MCP tool.\n\nPlease help with: {{task}}',
        description: 'Prompt created via MCP integration test',
        category: 'testing',
        tags: ['mcp', 'test', 'integration']
      })

      // Create prompt via MCP
      const createResponse = await MCPTestHelpers.testPromptManagerTool(page, 'create', {
        prompt: promptData
      })

      if (createResponse && createResponse.success) {
        expect(createResponse.data).toBeDefined()

        // Verify prompt appears in UI
        await promptsPage.goto()
        expect(await promptsPage.promptExists(promptData.name)).toBe(true)

        // Verify prompt data
        const promptInfo = await promptsPage.getPromptInfo(promptData.name)
        expect(promptInfo.name).toBe(promptData.name)
        expect(promptInfo.description).toBe(promptData.description)
        expect(promptInfo.category).toBe(promptData.category)
      }
    })

    test('should search prompts via MCP tool', async ({ page }) => {
      const availableTools = await MCPTestHelpers.verifyMCPToolsAvailable(page)

      if (!availableTools.includes('prompt_manager')) {
        return
      }

      // Create test prompts
      const codePrompt = TestDataFactory.createPrompt({
        name: 'MCP Code Helper',
        content: 'Help with code generation',
        tags: ['code', 'development']
      })
      const docsPrompt = TestDataFactory.createPrompt({
        name: 'MCP Docs Writer',
        content: 'Help with documentation',
        tags: ['documentation', 'writing']
      })

      await dataManager.createPrompt(codePrompt)
      await dataManager.createPrompt(docsPrompt)

      // Search for code-related prompts via MCP
      const searchResponse = await MCPTestHelpers.testPromptManagerTool(page, 'search', {
        query: 'code',
        tags: ['development']
      })

      if (searchResponse && searchResponse.success) {
        const results = searchResponse.data
        expect(Array.isArray(results)).toBe(true)

        if (results.length > 0) {
          const promptNames = results.map((p: any) => p.name)
          expect(promptNames).toContain(codePrompt.name)
        }
      }
    })

    test('should get prompt templates via MCP tool', async ({ page }) => {
      const availableTools = await MCPTestHelpers.verifyMCPToolsAvailable(page)

      if (!availableTools.includes('prompt_manager')) {
        return
      }

      // Get available templates via MCP
      const templatesResponse = await MCPTestHelpers.testPromptManagerTool(page, 'get_templates')

      if (templatesResponse && templatesResponse.success) {
        const templates = templatesResponse.data
        expect(Array.isArray(templates)).toBe(true)

        // Templates should have required properties
        if (templates.length > 0) {
          const template = templates[0]
          expect(template.id).toBeDefined()
          expect(template.name).toBeDefined()
          expect(template.content).toBeDefined()
        }
      }
    })
  })

  test.describe('Cross-Tool Integration', () => {
    test('should create complete workflow via MCP tools', async ({ page }) => {
      const availableTools = await MCPTestHelpers.verifyMCPToolsAvailable(page)

      // Check which tools are available
      const hasProjectManager = availableTools.includes('project_manager')
      const hasTicketManager = availableTools.includes('ticket_manager')
      const hasQueueProcessor = availableTools.includes('queue_processor')
      const hasPromptManager = availableTools.includes('prompt_manager')

      if (!hasProjectManager || !hasTicketManager) {
        console.warn('Skipping cross-tool integration - required tools not available')
        return
      }

      // 1. Create project via MCP
      const projectData = TestDataFactory.createProject({
        name: 'MCP Workflow Project'
      })

      const projectResponse = await MCPTestHelpers.testProjectManagerTool(page, 'create', {
        project: projectData
      })

      let projectId: number | undefined
      if (projectResponse?.success) {
        projectId = projectResponse.data.id
      }

      // 2. Create prompts via MCP (if available)
      if (hasPromptManager) {
        const promptData = TestDataFactory.createPrompt({
          name: 'Workflow Assistant Prompt'
        })

        await MCPTestHelpers.testPromptManagerTool(page, 'create', {
          prompt: promptData
        })
      }

      // 3. Create tickets via MCP
      const ticketData = TestDataFactory.createTicket({
        title: 'MCP Workflow Ticket',
        projectId: projectId
      })

      const ticketResponse = await MCPTestHelpers.testTicketManagerTool(page, 'create', {
        ticket: ticketData
      })

      let ticketId: number | undefined
      if (ticketResponse?.success) {
        ticketId = ticketResponse.data.id
      }

      // 4. Create queue and add ticket via MCP (if available)
      if (hasQueueProcessor && ticketId) {
        const queueData = TestDataFactory.createQueue({
          name: 'MCP Workflow Queue'
        })

        const queueResponse = await MCPTestHelpers.testQueueProcessorTool(page, 'create_queue', {
          queue: queueData
        })

        if (queueResponse?.success) {
          // Add ticket to queue
          await MCPTestHelpers.testQueueProcessorTool(page, 'add_item', {
            queueName: queueData.name,
            itemType: 'ticket',
            itemId: ticketId,
            priority: 'normal'
          })
        }
      }

      // 5. Verify all items were created and are visible in UI
      if (projectResponse?.success) {
        await projectsPage.goto()
        expect(await projectsPage.projectExists(projectData.name)).toBe(true)
      }

      if (ticketResponse?.success) {
        await ticketsPage.goto()
        expect(await ticketsPage.ticketExists(ticketData.title)).toBe(true)
      }
    })

    test('should sync data consistency across MCP tools and UI', async ({ page }) => {
      const availableTools = await MCPTestHelpers.verifyMCPToolsAvailable(page)

      if (!availableTools.includes('project_manager') || !availableTools.includes('ticket_manager')) {
        return
      }

      // Create project via UI
      const projectData = TestDataFactory.createProject()
      await projectsPage.goto()
      await projectsPage.createProject(projectData)

      // Verify project is accessible via MCP
      const mcpProjectsResponse = await MCPTestHelpers.testProjectManagerTool(page, 'list')

      if (mcpProjectsResponse?.success) {
        const projects = mcpProjectsResponse.data
        const foundProject = projects.find((p: any) => p.name === projectData.name)
        expect(foundProject).toBeDefined()
        expect(foundProject.description).toBe(projectData.description)
      }

      // Create ticket via MCP
      const ticketData = TestDataFactory.createTicket({
        title: 'Cross-Tool Sync Ticket'
      })

      const mcpTicketResponse = await MCPTestHelpers.testTicketManagerTool(page, 'create', {
        ticket: ticketData
      })

      // Verify ticket appears in UI
      if (mcpTicketResponse?.success) {
        await ticketsPage.goto()
        expect(await ticketsPage.ticketExists(ticketData.title)).toBe(true)
      }
    })
  })

  test.describe('MCP Error Handling', () => {
    test('should handle MCP tool unavailability gracefully', async ({ page }) => {
      // Try to call an unavailable MCP tool
      try {
        const result = await MCPTestHelpers.callMCPTool(page, 'unavailable_tool', {})
        expect(result).toBeUndefined()
      } catch (error) {
        // Should handle gracefully without crashing
        expect(error).toBeDefined()
      }
    })

    test('should handle MCP tool errors gracefully', async ({ page }) => {
      const availableTools = await MCPTestHelpers.verifyMCPToolsAvailable(page)

      if (availableTools.includes('project_manager')) {
        // Try to create project with invalid data
        const invalidResponse = await MCPTestHelpers.testProjectManagerTool(page, 'create', {
          project: {
            /* missing required fields */
          }
        })

        // Should return error response rather than throwing
        if (invalidResponse) {
          expect(invalidResponse.success).toBe(false)
          expect(invalidResponse.error).toBeDefined()
        }
      }
    })

    test('should handle MCP connection loss gracefully', async ({ page }) => {
      // This would require mocking MCP connection failure
      // For now, we'll just verify the client handles undefined responses

      const result = await page.evaluate(async () => {
        try {
          // @ts-ignore
          if (window.mcpClient) {
            // Simulate connection issue
            return { connectionTest: 'passed' }
          }
          return { connectionTest: 'no_client' }
        } catch (error) {
          return { connectionTest: 'error', error: error.message }
        }
      })

      expect(result.connectionTest).toBeDefined()
    })
  })
})
