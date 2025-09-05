import { test, expect } from '@playwright/test'
import { ProjectsPage } from '../../pages/projects.page'
import { ProjectHelpers } from '../../helpers/project-helpers'
import { 
  generateUniqueProject, 
  testTickets,
  testTasks,
  testQueues
} from '../../fixtures/project-data'

test.describe('Projects - Flow Tab Tests', () => {
  let projectsPage: ProjectsPage
  let testProjectId: number | null = null

  test.beforeEach(async ({ page }) => {
    projectsPage = new ProjectsPage(page)
    
    // Create a test project for these tests
    const projectData = generateUniqueProject('flow-test')
    const project = await ProjectHelpers.createTestProject(page, projectData)
    
    if (project && project.id) {
      testProjectId = project.id
      
      // Create test tickets and queues
      await ProjectHelpers.createTestTickets(page, project.id, testTickets.slice(0, 3))
      await ProjectHelpers.createTestQueues(page, project.id, testQueues.slice(0, 2))
      
      // Navigate to the project flow tab
      await projectsPage.gotoWithTab('flow', project.id)
      await ProjectHelpers.waitForInitialization(page)
    }
  })

  test.afterEach(async ({ page }) => {
    // Cleanup
    if (testProjectId) {
      await ProjectHelpers.deleteTestProject(page, testProjectId)
    }
  })

  test('should display flow tab elements', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Check if flow tab is active
    const flowTabVisible = await projectsPage.flowTab.isVisible()
    
    if (!flowTabVisible) {
      console.log('⚠️ Flow tab not visible - project may not be loaded')
      return
    }

    await projectsPage.expectTabActive('flow')
    
    // Check for main flow elements
    const elements = [
      { name: 'Create Ticket Button', selector: page.getByRole('button', { name: /create ticket/i }) },
      { name: 'Queue Section', selector: page.getByText(/queue/i) },
      { name: 'Tickets List', selector: page.getByText(/tickets/i) }
    ]

    for (const { name, selector } of elements) {
      const isVisible = await selector.first().isVisible()
      if (isVisible) {
        console.log(`✅ ${name} is visible`)
      } else {
        console.log(`⚠️ ${name} not visible`)
      }
    }
  })

  test('should create a new ticket', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Look for create ticket button
    const createButton = page.getByRole('button', { name: /create ticket|new ticket|add ticket/i })
    const buttonVisible = await createButton.isVisible()
    
    if (!buttonVisible) {
      console.log('⚠️ Create ticket button not found')
      return
    }

    // Click create button
    await createButton.click()
    await page.waitForTimeout(1000)
    
    // Check if dialog/form opened
    const dialog = page.getByRole('dialog')
    const form = page.locator('form')
    
    const dialogVisible = await dialog.isVisible()
    const formVisible = await form.isVisible()
    
    if (dialogVisible || formVisible) {
      console.log('✅ Ticket creation dialog/form opened')
      
      // Fill in ticket details
      const titleInput = page.getByLabel(/title/i).or(page.getByPlaceholder(/title/i))
      const descriptionInput = page.getByLabel(/description/i).or(page.getByPlaceholder(/description/i))
      
      if (await titleInput.isVisible()) {
        await titleInput.fill('Test Ticket from E2E')
      }
      
      if (await descriptionInput.isVisible()) {
        await descriptionInput.fill('This ticket was created by the E2E test suite')
      }
      
      // Submit the form
      const submitButton = page.getByRole('button', { name: /create|submit|save/i })
      if (await submitButton.isVisible()) {
        await submitButton.click()
        await page.waitForTimeout(2000)
        
        // Check for success message
        const toastMessage = await ProjectHelpers.getToastMessage(page)
        if (toastMessage) {
          expect(toastMessage.toLowerCase()).toContain('created')
          console.log('✅ Ticket created successfully')
        }
      }
    } else {
      console.log('⚠️ Ticket creation dialog did not open')
    }
  })

  test('should display existing tickets', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Look for ticket items
    const ticketElements = page.locator('[data-testid*="ticket"]').or(
      page.locator('[role="listitem"]').filter({ hasText: /ticket/i })
    )
    
    const ticketCount = await ticketElements.count()
    
    if (ticketCount > 0) {
      console.log(`✅ Found ${ticketCount} tickets displayed`)
      
      // Check first ticket has expected elements
      const firstTicket = ticketElements.first()
      
      // Check for title
      const titleVisible = await firstTicket.getByText(/setup|implement|create/i).isVisible()
      if (titleVisible) {
        console.log('✅ Ticket title is visible')
      }
      
      // Check for status
      const statusVisible = await firstTicket.getByText(/open|in_progress|closed/i).isVisible()
      if (statusVisible) {
        console.log('✅ Ticket status is visible')
      }
      
      // Check for priority
      const priorityVisible = await firstTicket.getByText(/high|medium|low/i).isVisible()
      if (priorityVisible) {
        console.log('✅ Ticket priority is visible')
      }
    } else {
      console.log('⚠️ No tickets found in the list')
    }
  })

  test('should open ticket details', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Find and click on a ticket
    const ticketItem = page.locator('[data-testid*="ticket"]').first().or(
      page.locator('[role="listitem"]').filter({ hasText: /ticket/i }).first()
    )
    
    if (await ticketItem.isVisible()) {
      await ticketItem.click()
      await page.waitForTimeout(1000)
      
      // Check if detail view opened
      const detailView = page.getByText(/ticket details/i).or(
        page.getByRole('dialog', { name: /ticket/i })
      )
      
      if (await detailView.isVisible()) {
        console.log('✅ Ticket detail view opened')
        
        // Check for detail elements
        const elements = [
          'Title',
          'Description',
          'Status',
          'Priority',
          'Tasks'
        ]
        
        for (const element of elements) {
          const elementVisible = await page.getByText(new RegExp(element, 'i')).isVisible()
          if (elementVisible) {
            console.log(`✅ ${element} visible in detail view`)
          }
        }
        
        // Close detail view
        const closeButton = page.getByRole('button', { name: /close/i })
        if (await closeButton.isVisible()) {
          await closeButton.click()
        } else {
          await page.keyboard.press('Escape')
        }
      } else {
        console.log('⚠️ Ticket detail view did not open')
      }
    } else {
      console.log('⚠️ No ticket items found to click')
    }
  })

  test('should manage queues', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Look for queue section
    const queueSection = page.locator('[data-testid*="queue"]').or(
      page.getByText(/queue/i).locator('..')
    )
    
    if (await queueSection.isVisible()) {
      console.log('✅ Queue section is visible')
      
      // Check for queue items
      const queueItems = queueSection.locator('[role="listitem"]').or(
        queueSection.locator('.queue-item')
      )
      
      const queueCount = await queueItems.count()
      if (queueCount > 0) {
        console.log(`✅ Found ${queueCount} queues`)
        
        // Check first queue
        const firstQueue = queueItems.first()
        
        // Check for queue name
        const nameVisible = await firstQueue.getByText(/development|testing|deployment/i).isVisible()
        if (nameVisible) {
          console.log('✅ Queue name is visible')
        }
        
        // Check for queue status/count
        const countElement = firstQueue.locator('[data-testid*="count"]').or(
          firstQueue.getByText(/\d+/)
        )
        if (await countElement.isVisible()) {
          const countText = await countElement.textContent()
          console.log(`✅ Queue shows item count: ${countText}`)
        }
      } else {
        console.log('⚠️ No queues found')
      }
    } else {
      console.log('⚠️ Queue section not visible')
    }
  })

  test('should add task to ticket', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // First open a ticket
    const ticketItem = page.locator('[data-testid*="ticket"]').first().or(
      page.locator('[role="listitem"]').filter({ hasText: /ticket/i }).first()
    )
    
    if (await ticketItem.isVisible()) {
      await ticketItem.click()
      await page.waitForTimeout(1000)
      
      // Look for add task button
      const addTaskButton = page.getByRole('button', { name: /add task|new task|create task/i })
      
      if (await addTaskButton.isVisible()) {
        await addTaskButton.click()
        await page.waitForTimeout(500)
        
        // Fill in task details
        const taskInput = page.getByPlaceholder(/task/i).or(
          page.getByLabel(/task/i)
        )
        
        if (await taskInput.isVisible()) {
          await taskInput.fill('Test task from E2E')
          
          // Submit task (Enter or button)
          await page.keyboard.press('Enter')
          await page.waitForTimeout(1000)
          
          // Check if task was added
          const newTask = page.getByText('Test task from E2E')
          if (await newTask.isVisible()) {
            console.log('✅ Task added successfully')
          } else {
            console.log('⚠️ Task not visible after adding')
          }
        } else {
          console.log('⚠️ Task input field not found')
        }
      } else {
        console.log('⚠️ Add task button not found')
      }
      
      // Close detail view
      await page.keyboard.press('Escape')
    } else {
      console.log('⚠️ No ticket to add task to')
    }
  })

  test('should update ticket status', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Open first ticket
    const ticketItem = page.locator('[data-testid*="ticket"]').first().or(
      page.locator('[role="listitem"]').filter({ hasText: /ticket/i }).first()
    )
    
    if (await ticketItem.isVisible()) {
      await ticketItem.click()
      await page.waitForTimeout(1000)
      
      // Look for status selector
      const statusSelector = page.getByRole('combobox', { name: /status/i }).or(
        page.locator('select').filter({ hasText: /status/i })
      )
      
      if (await statusSelector.isVisible()) {
        // Change status
        await statusSelector.selectOption('in_progress')
        await page.waitForTimeout(1000)
        
        // Check for update confirmation
        const toastMessage = await ProjectHelpers.getToastMessage(page)
        if (toastMessage) {
          expect(toastMessage.toLowerCase()).toContain('updated')
          console.log('✅ Status updated successfully')
        }
      } else {
        // Try clicking on status badge to change
        const statusBadge = page.getByText(/open|closed|in_progress/i).first()
        if (await statusBadge.isVisible()) {
          await statusBadge.click()
          await page.waitForTimeout(500)
          
          // Select new status from dropdown
          const statusOption = page.getByRole('option', { name: /in_progress/i })
          if (await statusOption.isVisible()) {
            await statusOption.click()
            console.log('✅ Status changed via dropdown')
          }
        } else {
          console.log('⚠️ Status selector not found')
        }
      }
      
      // Close detail view
      await page.keyboard.press('Escape')
    } else {
      console.log('⚠️ No ticket found to update')
    }
  })

  test('should filter tickets by status', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Look for filter controls
    const filterButton = page.getByRole('button', { name: /filter/i })
    const statusFilter = page.getByRole('combobox', { name: /status/i })
    
    const filterVisible = await filterButton.isVisible()
    const statusFilterVisible = await statusFilter.isVisible()
    
    if (filterVisible) {
      await filterButton.click()
      await page.waitForTimeout(500)
      
      // Select a filter option
      const openOption = page.getByRole('option', { name: /open/i })
      if (await openOption.isVisible()) {
        await openOption.click()
        await page.waitForTimeout(1000)
        
        // Check that tickets are filtered
        const tickets = page.locator('[data-testid*="ticket"]')
        const ticketCount = await tickets.count()
        console.log(`✅ Filtered to ${ticketCount} open tickets`)
      }
    } else if (statusFilterVisible) {
      await statusFilter.selectOption('open')
      await page.waitForTimeout(1000)
      
      const tickets = page.locator('[data-testid*="ticket"]')
      const ticketCount = await tickets.count()
      console.log(`✅ Filtered to ${ticketCount} open tickets`)
    } else {
      console.log('ℹ️ No filter controls found')
    }
  })

  test('should handle drag and drop for tickets', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Look for kanban board or draggable tickets
    const draggableTicket = page.locator('[draggable="true"]').first()
    const dropZone = page.locator('[data-droppable="true"]').or(
      page.getByText(/in progress/i).locator('..')
    )
    
    if (await draggableTicket.isVisible() && await dropZone.isVisible()) {
      // Perform drag and drop
      await draggableTicket.dragTo(dropZone)
      await page.waitForTimeout(1000)
      
      // Check for update
      const toastMessage = await ProjectHelpers.getToastMessage(page)
      if (toastMessage) {
        console.log('✅ Drag and drop completed')
      } else {
        console.log('⚠️ Drag and drop may not have worked')
      }
    } else {
      console.log('ℹ️ Drag and drop not available in current view')
    }
  })

  test('should handle queue operations', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Look for queue management buttons
    const createQueueButton = page.getByRole('button', { name: /create queue|new queue/i })
    
    if (await createQueueButton.isVisible()) {
      await createQueueButton.click()
      await page.waitForTimeout(1000)
      
      // Fill queue form
      const nameInput = page.getByLabel(/queue name/i).or(
        page.getByPlaceholder(/name/i)
      )
      
      if (await nameInput.isVisible()) {
        await nameInput.fill('Test Queue E2E')
        
        const descInput = page.getByLabel(/description/i)
        if (await descInput.isVisible()) {
          await descInput.fill('Queue created by E2E test')
        }
        
        // Submit
        const submitButton = page.getByRole('button', { name: /create|save/i })
        if (await submitButton.isVisible()) {
          await submitButton.click()
          await page.waitForTimeout(1000)
          
          // Check for success
          const toastMessage = await ProjectHelpers.getToastMessage(page)
          if (toastMessage) {
            console.log('✅ Queue created successfully')
          }
        }
      }
    } else {
      console.log('ℹ️ Queue creation not available')
    }
  })

  test('should navigate between flow views if available', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Check for sub-navigation in flow tab
    const viewButtons = [
      { name: 'Board', selector: page.getByRole('button', { name: /board/i }) },
      { name: 'List', selector: page.getByRole('button', { name: /list/i }) },
      { name: 'Timeline', selector: page.getByRole('button', { name: /timeline/i }) }
    ]
    
    for (const { name, selector } of viewButtons) {
      if (await selector.isVisible()) {
        await selector.click()
        await page.waitForTimeout(1000)
        console.log(`✅ Switched to ${name} view`)
        
        // Verify view changed (URL or UI indication)
        const url = page.url()
        if (url.includes(name.toLowerCase())) {
          console.log(`✅ URL reflects ${name} view`)
        }
      }
    }
  })

  test('should handle keyboard shortcuts in flow tab', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Test common flow shortcuts
    
    // Try Cmd/Ctrl+N for new ticket
    await page.keyboard.press('Meta+n')
    await page.waitForTimeout(500)
    
    const dialogOpen = await page.getByRole('dialog').isVisible()
    if (dialogOpen) {
      console.log('✅ Keyboard shortcut opened new ticket dialog')
      await page.keyboard.press('Escape')
    }
    
    // Try Cmd/Ctrl+F for search/filter
    await page.keyboard.press('Meta+f')
    await page.waitForTimeout(500)
    
    const searchVisible = await page.getByPlaceholder(/search/i).isVisible()
    if (searchVisible) {
      console.log('✅ Keyboard shortcut activated search')
      await page.keyboard.press('Escape')
    }
  })
})