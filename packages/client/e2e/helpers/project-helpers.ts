import { type Page } from '@playwright/test'
import { ProjectsPage } from '../pages/projects.page'

/**
 * Simple helper functions for project tests
 * Provides utilities for common project operations without complex abstractions
 */
export class ProjectHelpers {
  /**
   * Create a test project using API or UI
   */
  static async createTestProject(page: Page, projectData: {
    name: string
    path: string
    description?: string
  }) {
    // Try to use API if available
    try {
      const response = await page.request.post('/api/projects', {
        data: projectData
      })
      
      if (response.ok()) {
        const project = await response.json()
        return project.data
      }
    } catch (error) {
      console.log('API creation failed, falling back to UI creation')
    }

    // Fallback to UI creation
    const projectsPage = new ProjectsPage(page)
    await projectsPage.goto()
    
    // Open create dialog (implementation depends on UI)
    await page.getByRole('button', { name: /create project/i }).click()
    
    // Fill form
    await page.getByLabel(/project name/i).fill(projectData.name)
    await page.getByLabel(/project path/i).fill(projectData.path)
    
    if (projectData.description) {
      await page.getByLabel(/description/i).fill(projectData.description)
    }
    
    // Submit
    await page.getByRole('button', { name: /create/i }).click()
    
    // Wait for success
    await page.waitForTimeout(2000)
    
    return { id: 1, ...projectData } // Simplified return
  }

  /**
   * Delete a project using API or UI
   */
  static async deleteTestProject(page: Page, projectId: number) {
    try {
      const response = await page.request.delete(`/api/projects/${projectId}`)
      return response.ok()
    } catch (error) {
      console.log('API deletion failed, falling back to UI deletion')
    }

    // Fallback to UI deletion
    const projectsPage = new ProjectsPage(page)
    await projectsPage.gotoWithTab('manage', projectId)
    await projectsPage.deleteProject()
    
    return true
  }

  /**
   * Create test files for a project
   */
  static async createTestFiles(page: Page, projectId: number, files: Array<{
    name: string
    content: string
    path?: string
  }>) {
    const createdFiles = []
    
    for (const file of files) {
      try {
        const response = await page.request.post(`/api/projects/${projectId}/files`, {
          data: file
        })
        
        if (response.ok()) {
          const fileData = await response.json()
          createdFiles.push(fileData.data)
        }
      } catch (error) {
        console.log(`Failed to create file ${file.name}`)
      }
    }
    
    return createdFiles
  }

  /**
   * Create test prompts
   */
  static async createTestPrompts(page: Page, prompts: Array<{
    name: string
    content: string
    tags?: string[]
  }>) {
    const createdPrompts = []
    
    for (const prompt of prompts) {
      try {
        const response = await page.request.post('/api/prompts', {
          data: prompt
        })
        
        if (response.ok()) {
          const promptData = await response.json()
          createdPrompts.push(promptData.data)
        }
      } catch (error) {
        console.log(`Failed to create prompt ${prompt.name}`)
      }
    }
    
    return createdPrompts
  }

  /**
   * Create test tickets
   */
  static async createTestTickets(page: Page, projectId: number, tickets: Array<{
    title: string
    description?: string
    status?: string
    priority?: string
  }>) {
    const createdTickets = []
    
    for (const ticket of tickets) {
      try {
        const response = await page.request.post(`/api/projects/${projectId}/tickets`, {
          data: {
            ...ticket,
            projectId
          }
        })
        
        if (response.ok()) {
          const ticketData = await response.json()
          createdTickets.push(ticketData.data)
        }
      } catch (error) {
        console.log(`Failed to create ticket ${ticket.title}`)
      }
    }
    
    return createdTickets
  }

  /**
   * Create test queues
   */
  static async createTestQueues(page: Page, projectId: number, queues: Array<{
    name: string
    description?: string
    maxParallelItems?: number
  }>) {
    const createdQueues = []
    
    for (const queue of queues) {
      try {
        const response = await page.request.post(`/api/projects/${projectId}/queues`, {
          data: {
            ...queue,
            projectId
          }
        })
        
        if (response.ok()) {
          const queueData = await response.json()
          createdQueues.push(queueData.data)
        }
      } catch (error) {
        console.log(`Failed to create queue ${queue.name}`)
      }
    }
    
    return createdQueues
  }

  /**
   * Navigate to project and wait for it to load
   */
  static async navigateToProject(page: Page, projectId: number, tab?: 'context' | 'flow' | 'git' | 'manage') {
    const projectsPage = new ProjectsPage(page)
    
    if (tab) {
      await projectsPage.gotoWithTab(tab, projectId)
    } else {
      await projectsPage.goto(projectId)
    }
    
    // Wait for content to load
    await page.waitForLoadState('networkidle')
  }

  /**
   * Check if project is in initialization state
   */
  static async isInitializing(page: Page): Promise<boolean> {
    const projectsPage = new ProjectsPage(page)
    return await projectsPage.initializingMessage.isVisible()
  }

  /**
   * Wait for project to finish initializing
   */
  static async waitForInitialization(page: Page, timeout: number = 30000) {
    const projectsPage = new ProjectsPage(page)
    
    if (await ProjectHelpers.isInitializing(page)) {
      // Wait for initialization to complete
      await projectsPage.initializingMessage.waitFor({ 
        state: 'hidden', 
        timeout 
      }).catch(() => {
        console.log('Initialization did not complete within timeout')
      })
    }
  }

  /**
   * Get current tab from URL
   */
  static async getCurrentTab(page: Page): Promise<string> {
    const url = new URL(page.url())
    return url.searchParams.get('activeView') || 'context'
  }

  /**
   * Get current project ID from URL
   */
  static async getCurrentProjectId(page: Page): Promise<number | null> {
    const url = new URL(page.url())
    const projectId = url.searchParams.get('projectId')
    return projectId ? parseInt(projectId) : null
  }

  /**
   * Clean up all test data
   */
  static async cleanupTestData(page: Page, projectIds: number[]) {
    for (const projectId of projectIds) {
      await ProjectHelpers.deleteTestProject(page, projectId)
    }
  }

  /**
   * Wait for a specific element to be ready
   */
  static async waitForElement(page: Page, selector: string, timeout: number = 5000) {
    await page.waitForSelector(selector, { 
      state: 'visible', 
      timeout 
    })
  }

  /**
   * Check if we're on the projects page
   */
  static async isOnProjectsPage(page: Page): Promise<boolean> {
    return page.url().includes('/projects')
  }

  /**
   * Get toast message if visible
   */
  static async getToastMessage(page: Page): Promise<string | null> {
    const toast = page.locator('[role="status"]').or(page.getByTestId('toast'))
    
    if (await toast.isVisible()) {
      return await toast.textContent()
    }
    
    return null
  }

  /**
   * Dismiss any visible toasts
   */
  static async dismissToasts(page: Page) {
    const toasts = page.locator('[role="status"]').or(page.getByTestId('toast'))
    const count = await toasts.count()
    
    for (let i = 0; i < count; i++) {
      const closeButton = toasts.nth(i).getByRole('button', { name: /close/i })
      if (await closeButton.isVisible()) {
        await closeButton.click()
      }
    }
  }
}