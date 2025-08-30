/**
 * Comprehensive Test Utilities and Helpers for Manage Project Modal E2E Tests
 *
 * This file provides reusable functionality that supports all the test files
 * for the Manage Project Modal, including project management, file browser
 * interactions, form validation, and comprehensive assertion utilities.
 */

import { type Page, type Locator, expect } from '@playwright/test'
import {
  TestAssertions,
  APITestHelpers,
  EnhancedAPIHelpers,
  TestDataManager,
  AccessibilityHelpers,
  WaitHelpers
} from './test-helpers'
import {
  ManageProjectModalTestData,
  ManageProjectModalTestUtils,
  type ProjectWithMetadata,
  type ProjectCreationData,
  type FileBrowserScenario,
  type MockFileSystemNode
} from '../fixtures/manage-project-modal-data'
import { API_ENDPOINTS, HTTP_STATUS } from './api-endpoint-config'
import { TestErrorHandler, FormHelper } from './error-handling'

// ===== INTERFACES AND TYPES =====

export interface ModalTestConfig {
  skipCleanup?: boolean
  enablePerformanceMonitoring?: boolean
  mockFileSystem?: boolean
  enableAccessibilityChecks?: boolean
}

export interface ProjectFormData {
  name: string
  path: string
  description?: string
  template?: string
  tags?: string[]
}

export interface FileBrowserState {
  currentPath: string
  selectedPath?: string
  files: string[]
  directories: string[]
  loading: boolean
  error?: string
}

export interface SyncProgress {
  percent: number
  filesProcessed: number
  totalFiles: number
  currentFile?: string
  status: 'idle' | 'syncing' | 'complete' | 'error'
  error?: string
}

// ===== MAIN TEST SETUP AND CLEANUP UTILITIES =====

/**
 * Central test setup utility for Manage Project Modal tests
 */
export class ManageProjectModalTestSetup {
  constructor(
    private page: Page,
    private config: ModalTestConfig = {}
  ) {}

  /**
   * Common setup for all manage project modal tests
   */
  async setupManageProjectModalTests(): Promise<void> {
    // Set up API mocking if enabled
    if (this.config.mockFileSystem) {
      await this.setupFileSystemMocks()
    }

    // Enable performance monitoring if requested
    if (this.config.enablePerformanceMonitoring) {
      await this.enablePerformanceMonitoring()
    }

    // Navigate to projects page and ensure modal trigger is available
    await this.page.goto('/projects')
    await this.page.waitForLoadState('networkidle')

    // Wait for projects page to be fully loaded
    await expect(this.page.locator('[data-testid="projects-container"], .projects-grid')).toBeVisible()

    // Verify modal trigger exists
    const modalTrigger = this.page.locator('[data-testid="manage-projects-button"], button:has-text("Manage Projects")')
    await expect(modalTrigger).toBeVisible()
  }

  /**
   * Clean up modal state between tests
   */
  async cleanupModalState(): Promise<void> {
    try {
      // Close any open modals
      const modal = this.page.locator('[role="dialog"], [data-testid="project-modal"]')
      if (await modal.isVisible()) {
        // Try escape key first
        await this.page.keyboard.press('Escape')

        // If modal still visible, try close button
        if (await modal.isVisible()) {
          const closeButton = modal.locator(
            'button[aria-label="Close"], button:has-text("Cancel"), button:has-text("Close")'
          )
          if (await closeButton.isVisible()) {
            await closeButton.click()
          }
        }

        // Wait for modal to be hidden
        await expect(modal).not.toBeVisible()
      }

      // Clear any active form states
      await this.page.evaluate(() => {
        // Reset any form states that might persist
        const forms = document.querySelectorAll('form')
        forms.forEach((form) => form.reset())
      })
    } catch (error) {
      console.warn('Error during modal cleanup:', error)
    }
  }

  /**
   * Reset project database to clean state
   */
  async resetProjectDatabase(): Promise<void> {
    if (!this.config.skipCleanup) {
      // Use API to reset test data
      try {
        await EnhancedAPIHelpers.makeAPICall(this.page, API_ENDPOINTS.PROJECTS.RESET, 'POST')
      } catch (error) {
        console.warn('Database reset not available, continuing with test cleanup')
      }
    }
  }

  /**
   * Enable performance monitoring for tests
   */
  private async enablePerformanceMonitoring(): Promise<void> {
    await this.page.addInitScript(() => {
      window.performanceMetrics = {
        modalOpenTime: 0,
        fileBrowserLoadTime: 0,
        formSubmissionTime: 0
      }
    })
  }

  /**
   * Setup file system mocks
   */
  private async setupFileSystemMocks(): Promise<void> {
    // Mock file system APIs with test data
    await this.page.route('**/api/filesystem/**', (route) => {
      const url = route.request().url()
      const method = route.request().method()

      if (method === 'GET' && url.includes('/browse')) {
        // Extract path from URL
        const pathMatch = url.match(/path=([^&]+)/)
        const path = pathMatch ? decodeURIComponent(pathMatch[1]) : '/'

        const mockData = this.getMockFileSystemData(path)
        route.fulfill({
          status: HTTP_STATUS.OK,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: mockData
          })
        })
      } else {
        route.continue()
      }
    })
  }

  /**
   * Get mock file system data for path
   */
  private getMockFileSystemData(path: string): any {
    const mockStructure = ManageProjectModalTestData.mockDirectoryStructure

    // Navigate to the requested path in mock data
    const pathParts = path.split('/').filter((p) => p.length > 0)
    let currentNode = mockStructure['/']

    for (const part of pathParts) {
      if (currentNode && currentNode.children && currentNode.children[part]) {
        currentNode = currentNode.children[part]
      } else {
        // Path not found, return error
        return {
          error: 'Directory not found',
          code: 'ENOENT'
        }
      }
    }

    if (currentNode && currentNode.type === 'directory') {
      const files: string[] = []
      const directories: string[] = []

      if (currentNode.children) {
        for (const [name, node] of Object.entries(currentNode.children)) {
          if (node.type === 'file' && !node.isHidden) {
            files.push(name)
          } else if (node.type === 'directory') {
            directories.push(name)
          }
        }
      }

      return {
        path,
        files,
        directories,
        permissions: currentNode.permissions || 'readwrite'
      }
    }

    return {
      error: 'Not a directory',
      code: 'ENOTDIR'
    }
  }
}

// ===== MOCK MANAGEMENT UTILITIES =====

/**
 * Utilities for managing API and file system mocks
 */
export class MockManager {
  constructor(private page: Page) {}

  /**
   * Setup project API mocks with realistic responses
   */
  async setupProjectAPIMocks(): Promise<void> {
    // Mock project list endpoint
    await this.page.route(`**${API_ENDPOINTS.PROJECTS.BASE}`, (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: HTTP_STATUS.OK,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: ManageProjectModalTestData.existingProjects
          })
        })
      } else {
        route.continue()
      }
    })

    // Mock project creation
    await this.page.route(`**${API_ENDPOINTS.PROJECTS.BASE}`, (route) => {
      if (route.request().method() === 'POST') {
        const requestBody = route.request().postDataJSON()
        const newProject = {
          ...requestBody,
          id: Date.now(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'active',
          fileCount: 0
        }

        route.fulfill({
          status: HTTP_STATUS.CREATED,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: newProject
          })
        })
      } else {
        route.continue()
      }
    })
  }

  /**
   * Setup sync progress mocks for testing progress indicators
   */
  async setupSyncProgressMocks(scenario: 'success' | 'error' | 'timeout' = 'success'): Promise<void> {
    await this.page.route('**/api/projects/*/sync', (route) => {
      if (scenario === 'error') {
        route.fulfill({
          status: HTTP_STATUS.INTERNAL_ERROR,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Sync failed due to file system error'
          })
        })
      } else if (scenario === 'timeout') {
        // Don't respond to simulate timeout
        return
      } else {
        // Success scenario with progress updates
        route.fulfill({
          status: HTTP_STATUS.OK,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              progress: 100,
              filesProcessed: 50,
              totalFiles: 50,
              status: 'complete'
            }
          })
        })
      }
    })
  }

  /**
   * Setup various error scenario mocks
   */
  async setupErrorScenarioMocks(errorType: 'validation' | 'network' | 'permission' | 'timeout'): Promise<void> {
    const errorResponses = {
      validation: {
        status: HTTP_STATUS.VALIDATION_ERROR,
        body: {
          success: false,
          error: 'Validation failed',
          details: {
            name: 'Project name is required',
            path: 'Project path must be absolute'
          }
        }
      },
      network: {
        status: HTTP_STATUS.INTERNAL_ERROR,
        body: {
          success: false,
          error: 'Network connection failed'
        }
      },
      permission: {
        status: HTTP_STATUS.FORBIDDEN,
        body: {
          success: false,
          error: 'Permission denied accessing directory'
        }
      },
      timeout: null // Will not respond
    }

    const errorResponse = errorResponses[errorType]

    await this.page.route('**/api/projects/**', (route) => {
      if (errorType === 'timeout') {
        // Don't respond to simulate timeout
        return
      }

      if (errorResponse) {
        route.fulfill({
          status: errorResponse.status,
          contentType: 'application/json',
          body: JSON.stringify(errorResponse.body)
        })
      } else {
        route.continue()
      }
    })
  }
}

// ===== PROJECT MANAGEMENT HELPERS =====

/**
 * Utilities for managing test projects and data
 */
export class ProjectManagementHelpers {
  private testDataManager: TestDataManager

  constructor(private page: Page) {
    this.testDataManager = new TestDataManager(page)
  }

  /**
   * Create test project with comprehensive validation
   */
  async createTestProject(projectData: ProjectFormData): Promise<{ success: boolean; project?: any; error?: string }> {
    try {
      const response = await this.testDataManager.createProject({
        name: projectData.name,
        path: projectData.path,
        description: projectData.description,
        ...projectData
      })

      if (response.ok) {
        return { success: true, project: response.data.data }
      } else {
        return { success: false, error: response.data.error || 'Failed to create project' }
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * Delete test project with cleanup
   */
  async deleteTestProject(projectId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await APITestHelpers.deleteTestProject(this.page, projectId)

      if (response.ok) {
        return { success: true }
      } else {
        return { success: false, error: response.data.error || 'Failed to delete project' }
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * Get project by name from test data
   */
  getProjectByName(name: string): ProjectWithMetadata | null {
    return ManageProjectModalTestData.existingProjects.find((p) => p.name === name) || null
  }

  /**
   * Validate project data integrity
   */
  async validateProjectData(project: ProjectWithMetadata): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = []

    // Validate required fields
    if (!project.name || project.name.trim() === '') {
      errors.push('Project name is required')
    }

    if (!project.path || project.path.trim() === '') {
      errors.push('Project path is required')
    }

    // Validate path format
    if (project.path && !project.path.startsWith('/')) {
      errors.push('Project path must be absolute')
    }

    // Validate name uniqueness
    const existingProject = this.getProjectByName(project.name)
    if (existingProject && existingProject.id !== project.id) {
      errors.push('Project name already exists')
    }

    // Validate file count
    if (project.fileCount !== undefined && project.fileCount < 0) {
      errors.push('File count cannot be negative')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Create multiple test projects for bulk operations
   */
  async createTestProjects(projects: ProjectFormData[]): Promise<ProjectWithMetadata[]> {
    const createdProjects: ProjectWithMetadata[] = []

    for (const projectData of projects) {
      const result = await this.createTestProject(projectData)
      if (result.success && result.project) {
        createdProjects.push(result.project)
      }
    }

    return createdProjects
  }

  /**
   * Cleanup all test data
   */
  async cleanupTestProjects(): Promise<void> {
    await this.testDataManager.cleanup()
  }
}

// ===== FILE BROWSER HELPERS =====

/**
 * Utilities for file browser interactions and testing
 */
export class FileBrowserHelpers {
  constructor(private page: Page) {}

  /**
   * Mock directory navigation for testing
   */
  async mockDirectoryNavigation(scenario: FileBrowserScenario): Promise<void> {
    await this.page.route('**/api/filesystem/browse**', (route) => {
      const url = new URL(route.request().url())
      const path = url.searchParams.get('path') || '/'

      let mockData: any

      if (scenario.shouldSucceed) {
        mockData = {
          success: true,
          data: {
            path: scenario.expectedPath,
            files: scenario.expectedFiles || [],
            directories: scenario.expectedFolders || [],
            permissions: 'readwrite'
          }
        }
      } else {
        mockData = {
          success: false,
          error: scenario.expectedError || 'Directory access failed'
        }
      }

      route.fulfill({
        status: scenario.shouldSucceed ? HTTP_STATUS.OK : HTTP_STATUS.FORBIDDEN,
        contentType: 'application/json',
        body: JSON.stringify(mockData)
      })
    })
  }

  /**
   * Validate directory structure display
   */
  async validateDirectoryStructure(
    expectedFiles: string[],
    expectedDirectories: string[]
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = []

    try {
      // Wait for file browser to load
      await this.page.waitForSelector('[data-testid="file-browser"], .file-browser')

      // Check for expected files
      for (const fileName of expectedFiles) {
        const fileElement = this.page.locator(
          `[data-testid="file-item"]:has-text("${fileName}"), .file-item:has-text("${fileName}")`
        )
        if (!(await fileElement.isVisible())) {
          errors.push(`Expected file not found: ${fileName}`)
        }
      }

      // Check for expected directories
      for (const dirName of expectedDirectories) {
        const dirElement = this.page.locator(
          `[data-testid="directory-item"]:has-text("${dirName}"), .directory-item:has-text("${dirName}")`
        )
        if (!(await dirElement.isVisible())) {
          errors.push(`Expected directory not found: ${dirName}`)
        }
      }
    } catch (error) {
      errors.push(`File browser validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Simulate file system errors for testing error handling
   */
  async simulateFileSystemError(errorType: 'permission' | 'not_found' | 'timeout'): Promise<void> {
    const errorResponses = {
      permission: {
        status: HTTP_STATUS.FORBIDDEN,
        body: { success: false, error: 'Permission denied', code: 'EACCES' }
      },
      not_found: {
        status: HTTP_STATUS.NOT_FOUND,
        body: { success: false, error: 'Directory not found', code: 'ENOENT' }
      },
      timeout: null // Will not respond
    }

    await this.page.route('**/api/filesystem/**', (route) => {
      if (errorType === 'timeout') {
        // Don't respond to simulate timeout
        return
      }

      const errorResponse = errorResponses[errorType]
      if (errorResponse) {
        route.fulfill({
          status: errorResponse.status,
          contentType: 'application/json',
          body: JSON.stringify(errorResponse.body)
        })
      } else {
        route.continue()
      }
    })
  }

  /**
   * Navigate through file browser
   */
  async navigateThroughDirectories(path: string[]): Promise<void> {
    for (const dirName of path) {
      if (dirName === '..') {
        // Handle parent directory navigation
        const parentButton = this.page.locator('[data-testid="parent-directory"], button:has-text("..")')
        await parentButton.click()
      } else {
        // Navigate to child directory
        const dirElement = this.page.locator(`[data-testid="directory-item"]:has-text("${dirName}")`)
        await expect(dirElement).toBeVisible()
        await dirElement.dblclick()
      }

      // Wait for navigation to complete
      await this.page.waitForLoadState('networkidle')
      await TestAssertions.assertLoadingComplete(this.page)
    }
  }

  /**
   * Get current file browser state
   */
  async getFileBrowserState(): Promise<FileBrowserState> {
    return await this.page.evaluate(() => {
      const browser = document.querySelector('[data-testid="file-browser"]')
      const currentPath = browser?.getAttribute('data-current-path') || '/'
      const selectedPath = browser?.getAttribute('data-selected-path')

      const fileElements = browser?.querySelectorAll('[data-testid="file-item"]') || []
      const dirElements = browser?.querySelectorAll('[data-testid="directory-item"]') || []
      const loadingElement = browser?.querySelector('[data-testid="loading"]')
      const errorElement = browser?.querySelector('[data-testid="error"]')

      return {
        currentPath,
        selectedPath: selectedPath || undefined,
        files: Array.from(fileElements).map((el) => el.textContent || ''),
        directories: Array.from(dirElements).map((el) => el.textContent || ''),
        loading: loadingElement?.style.display !== 'none',
        error: errorElement?.textContent || undefined
      }
    })
  }
}

// ===== FORM INTERACTION HELPERS =====

/**
 * Utilities for form interactions and validation testing
 */
export class FormInteractionHelpers {
  private formHelper: FormHelper

  constructor(private page: Page) {
    this.formHelper = new FormHelper(page)
  }

  /**
   * Fill project creation form with comprehensive data handling
   */
  async fillProjectCreationForm(projectData: ProjectFormData): Promise<void> {
    // Wait for form to be visible
    const form = this.page.locator('[data-testid="project-form"], form')
    await expect(form).toBeVisible()

    // Fill project name
    await this.formHelper.fillFormField('name', projectData.name)

    // Fill project path
    await this.formHelper.fillFormField('path', projectData.path)

    // Fill description if provided
    if (projectData.description) {
      await this.formHelper.fillFormField('description', projectData.description)
    }

    // Handle template selection if provided
    if (projectData.template) {
      const templateSelect = this.page.locator('[name="template"], select[data-testid="template-select"]')
      if (await templateSelect.isVisible()) {
        await templateSelect.selectOption(projectData.template)
      }
    }

    // Handle tags if provided
    if (projectData.tags && projectData.tags.length > 0) {
      const tagsInput = this.page.locator('[name="tags"], input[data-testid="tags-input"]')
      if (await tagsInput.isVisible()) {
        await tagsInput.fill(projectData.tags.join(', '))
      }
    }
  }

  /**
   * Trigger validation errors for testing
   */
  async triggerValidationError(
    field: 'name' | 'path' | 'description',
    errorType: 'empty' | 'invalid' | 'duplicate'
  ): Promise<void> {
    const testData = ManageProjectModalTestData.newProjectData.invalid

    let testValue: string
    switch (errorType) {
      case 'empty':
        testValue = ''
        break
      case 'invalid':
        testValue = field === 'path' ? './relative/path' : 'invalid/name/with/slashes'
        break
      case 'duplicate':
        testValue = field === 'name' ? 'Promptliano Core' : '/Users/developer/projects/promptliano'
        break
      default:
        testValue = ''
    }

    await this.formHelper.fillFormField(field, testValue)

    // Trigger validation by trying to submit or moving focus
    await this.page.keyboard.press('Tab')
    await this.page.waitForTimeout(500) // Allow validation to run
  }

  /**
   * Submit form with retry logic for flaky scenarios
   */
  async submitFormWithRetry(maxRetries: number = 3): Promise<{ success: boolean; error?: string }> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const submitButton = this.page.locator(
          'button[type="submit"], button:has-text("Create"), button:has-text("Save")'
        )
        await expect(submitButton).toBeEnabled()

        // Click submit
        await submitButton.click()

        // Wait for either success or error response
        await Promise.race([
          this.page.waitForResponse(
            (response) => response.url().includes('/api/projects') && response.request().method() === 'POST'
          ),
          this.page.waitForSelector('[data-testid="error"], .error-message', { timeout: 5000 })
        ])

        // Check if there was an error
        const errorElement = this.page.locator('[data-testid="error"], .error-message')
        if (await errorElement.isVisible()) {
          const errorText = await errorElement.textContent()
          if (attempt < maxRetries) {
            console.warn(`Form submission failed (attempt ${attempt}): ${errorText}, retrying...`)
            await this.page.waitForTimeout(1000 * attempt) // Exponential backoff
            continue
          } else {
            return { success: false, error: errorText || 'Form submission failed' }
          }
        }

        // Success - form submitted and modal should close or show success
        return { success: true }
      } catch (error) {
        if (attempt < maxRetries) {
          console.warn(`Form submission attempt ${attempt} failed:`, error)
          await this.page.waitForTimeout(1000 * attempt)
        } else {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Form submission failed after retries'
          }
        }
      }
    }

    return { success: false, error: 'Max retries exceeded' }
  }

  /**
   * Validate form field states
   */
  async validateFormFieldStates(
    expectedStates: Record<string, { valid: boolean; error?: string }>
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = []

    for (const [fieldName, expectedState] of Object.entries(expectedStates)) {
      const field = this.page.locator(`[name="${fieldName}"]`)

      if (!(await field.isVisible())) {
        errors.push(`Field ${fieldName} is not visible`)
        continue
      }

      // Check validation state
      const isValid = await field.evaluate((el) => el.checkValidity())
      if (isValid !== expectedState.valid) {
        errors.push(`Field ${fieldName} validation state mismatch. Expected: ${expectedState.valid}, Got: ${isValid}`)
      }

      // Check error message
      if (expectedState.error) {
        const errorElement = this.page.locator(
          `[data-testid="${fieldName}-error"], .field-error[data-field="${fieldName}"]`
        )
        if (await errorElement.isVisible()) {
          const errorText = await errorElement.textContent()
          if (!errorText?.includes(expectedState.error)) {
            errors.push(
              `Field ${fieldName} error message mismatch. Expected: "${expectedState.error}", Got: "${errorText}"`
            )
          }
        } else {
          errors.push(`Expected error message for field ${fieldName} not found`)
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }
}

// ===== ASSERTION HELPERS =====

/**
 * Specialized assertion helpers for manage project modal testing
 */
export class ModalAssertionHelpers extends TestAssertions {
  constructor(private page: Page) {
    super()
  }

  /**
   * Assert that modal is visible and properly rendered
   */
  async assertModalVisible(): Promise<void> {
    const modal = this.page.locator('[role="dialog"], [data-testid="project-modal"]')

    // Check visibility
    await expect(modal).toBeVisible()

    // Check modal has proper ARIA attributes
    await expect(modal).toHaveAttribute('role', 'dialog')
    await expect(modal).toHaveAttribute('aria-modal', 'true')

    // Check modal content is loaded
    await expect(modal.locator('[data-testid="modal-content"]')).toBeVisible()

    // Check focus trap is working
    const focusableElements = modal.locator('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')
    await expect(focusableElements.first()).toBeFocused()
  }

  /**
   * Assert that project exists in the system
   */
  async assertProjectExists(projectName: string, shouldExist: boolean = true): Promise<void> {
    // Check in project list
    const projectElement = this.page.locator(
      `[data-testid="project-item"]:has-text("${projectName}"), .project-card:has-text("${projectName}")`
    )

    if (shouldExist) {
      await expect(projectElement).toBeVisible()
    } else {
      await expect(projectElement).not.toBeVisible()
    }

    // Optionally verify via API
    try {
      const response = await this.page.evaluate(async (name) => {
        const res = await fetch('/api/projects')
        const data = await res.json()
        return data.data?.some((p: any) => p.name === name) || false
      }, projectName)

      if (shouldExist && !response) {
        throw new Error(`Project "${projectName}" not found in API response`)
      }

      if (!shouldExist && response) {
        throw new Error(`Project "${projectName}" unexpectedly found in API response`)
      }
    } catch (error) {
      console.warn('API verification not available:', error)
    }
  }

  /**
   * Assert error message with specific validation
   */
  async assertErrorMessage(expectedMessage: string, timeout: number = 5000): Promise<void> {
    const errorElement = this.page.locator('[data-testid="error"], .error-message, [role="alert"]')

    await expect(errorElement).toBeVisible({ timeout })

    const errorText = await errorElement.textContent()
    expect(errorText).toContain(expectedMessage)

    // Check error styling
    await expect(errorElement).toHaveClass(/error|danger|alert/)
  }

  /**
   * Assert accessibility compliance for modal
   */
  async assertAccessibilityCompliance(): Promise<void> {
    const violations = await AccessibilityHelpers.checkBasicAccessibility(this.page)

    if (violations.length > 0) {
      throw new Error(`Accessibility violations found: ${violations.join(', ')}`)
    }

    // Check keyboard navigation
    await this.assertKeyboardNavigation()

    // Check ARIA labels
    await this.assertAriaLabels()
  }

  /**
   * Assert keyboard navigation works correctly
   */
  private async assertKeyboardNavigation(): Promise<void> {
    const modal = this.page.locator('[role="dialog"]')
    await expect(modal).toBeVisible()

    // Test Tab navigation
    await this.page.keyboard.press('Tab')
    const firstFocused = await this.page.evaluate(() => document.activeElement?.tagName)
    expect(['BUTTON', 'INPUT', 'SELECT'].includes(firstFocused || '')).toBe(true)

    // Test Escape key closes modal
    await this.page.keyboard.press('Escape')
    await expect(modal).not.toBeVisible()
  }

  /**
   * Assert proper ARIA labels are present
   */
  private async assertAriaLabels(): Promise<void> {
    // Re-open modal for ARIA testing
    const trigger = this.page.locator('[data-testid="manage-projects-button"]')
    await trigger.click()

    const modal = this.page.locator('[role="dialog"]')
    await expect(modal).toBeVisible()

    // Check modal has aria-label or aria-labelledby
    const hasAriaLabel = (await modal.getAttribute('aria-label')) !== null
    const hasAriaLabelledBy = (await modal.getAttribute('aria-labelledby')) !== null

    expect(hasAriaLabel || hasAriaLabelledBy).toBe(true)

    // Check form fields have labels
    const inputs = modal.locator('input, select, textarea')
    const inputCount = await inputs.count()

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i)
      const hasLabel =
        (await input.getAttribute('aria-label')) !== null ||
        (await input.getAttribute('aria-labelledby')) !== null ||
        (await input.evaluate((el) => !!document.querySelector(`label[for="${el.id}"]`)))

      expect(hasLabel).toBe(true)
    }
  }

  /**
   * Assert form validation state
   */
  async assertFormValidation(isValid: boolean, expectedErrors: string[] = []): Promise<void> {
    const form = this.page.locator('form, [data-testid="project-form"]')
    await expect(form).toBeVisible()

    // Check form validity state
    const formIsValid = await form.evaluate((el) => el.checkValidity?.() ?? true)
    expect(formIsValid).toBe(isValid)

    // Check specific error messages
    for (const expectedError of expectedErrors) {
      await this.assertErrorMessage(expectedError)
    }

    // Check submit button state
    const submitButton = this.page.locator('button[type="submit"]')
    if (isValid) {
      await expect(submitButton).toBeEnabled()
    } else {
      await expect(submitButton).toBeDisabled()
    }
  }

  /**
   * Assert sync progress display
   */
  async assertSyncProgress(expectedProgress: SyncProgress): Promise<void> {
    const progressElement = this.page.locator('[data-testid="sync-progress"], .progress-indicator')
    await expect(progressElement).toBeVisible()

    // Check progress percentage
    const progressBar = progressElement.locator('[data-testid="progress-bar"], .progress-bar')
    const progressValue = (await progressBar.getAttribute('value')) || (await progressBar.getAttribute('aria-valuenow'))

    if (progressValue) {
      expect(parseInt(progressValue)).toBe(expectedProgress.percent)
    }

    // Check progress text
    const progressText = await progressElement.locator('[data-testid="progress-text"], .progress-text').textContent()
    expect(progressText).toContain(`${expectedProgress.filesProcessed}`)
    expect(progressText).toContain(`${expectedProgress.totalFiles}`)

    // Check status
    const statusElement = progressElement.locator('[data-testid="sync-status"], .status-indicator')
    await expect(statusElement).toHaveText(expectedProgress.status)
  }

  /**
   * Assert file browser display
   */
  async assertFileBrowserDisplay(expectedState: FileBrowserState): Promise<void> {
    const browser = this.page.locator('[data-testid="file-browser"], .file-browser')
    await expect(browser).toBeVisible()

    // Check current path display
    const pathElement = browser.locator('[data-testid="current-path"], .current-path')
    await expect(pathElement).toHaveText(expectedState.currentPath)

    // Check file listings
    const fileElements = browser.locator('[data-testid="file-item"], .file-item')
    const fileCount = await fileElements.count()
    expect(fileCount).toBe(expectedState.files.length)

    // Check directory listings
    const dirElements = browser.locator('[data-testid="directory-item"], .directory-item')
    const dirCount = await dirElements.count()
    expect(dirCount).toBe(expectedState.directories.length)

    // Check loading state
    const loadingElement = browser.locator('[data-testid="loading"], .loading')
    if (expectedState.loading) {
      await expect(loadingElement).toBeVisible()
    } else {
      await expect(loadingElement).not.toBeVisible()
    }

    // Check error state
    if (expectedState.error) {
      const errorElement = browser.locator('[data-testid="error"], .error')
      await expect(errorElement).toBeVisible()
      await expect(errorElement).toContainText(expectedState.error)
    }
  }
}

// ===== MAIN EXPORT CLASS =====

/**
 * Main utility class that combines all helpers for easy use in tests
 */
export class ManageProjectModalHelpers {
  public readonly setup: ManageProjectModalTestSetup
  public readonly mocks: MockManager
  public readonly projects: ProjectManagementHelpers
  public readonly fileBrowser: FileBrowserHelpers
  public readonly forms: FormInteractionHelpers
  public readonly assertions: ModalAssertionHelpers

  constructor(page: Page, config: ModalTestConfig = {}) {
    this.setup = new ManageProjectModalTestSetup(page, config)
    this.mocks = new MockManager(page)
    this.projects = new ProjectManagementHelpers(page)
    this.fileBrowser = new FileBrowserHelpers(page)
    this.forms = new FormInteractionHelpers(page)
    this.assertions = new ModalAssertionHelpers(page)
  }

  /**
   * Complete setup for manage project modal tests
   */
  async setupTest(
    options: {
      mockApis?: boolean
      mockFileSystem?: boolean
      enableAccessibilityChecks?: boolean
    } = {}
  ): Promise<void> {
    await this.setup.setupManageProjectModalTests()

    if (options.mockApis) {
      await this.mocks.setupProjectAPIMocks()
    }

    if (options.mockFileSystem) {
      await this.setup['setupFileSystemMocks']()
    }
  }

  /**
   * Complete cleanup for manage project modal tests
   */
  async cleanupTest(): Promise<void> {
    await this.setup.cleanupModalState()
    await this.projects.cleanupTestProjects()
    await this.setup.resetProjectDatabase()
  }

  /**
   * Open manage project modal
   */
  async openModal(): Promise<void> {
    const trigger = this.assertions.page.locator(
      '[data-testid="manage-projects-button"], button:has-text("Manage Projects")'
    )
    await trigger.click()
    await this.assertions.assertModalVisible()
  }

  /**
   * Close manage project modal
   */
  async closeModal(): Promise<void> {
    await this.assertions.page.keyboard.press('Escape')
    const modal = this.assertions.page.locator('[role="dialog"]')
    await expect(modal).not.toBeVisible()
  }

  /**
   * Comprehensive form submission test
   */
  async testProjectCreation(
    projectData: ProjectFormData,
    shouldSucceed: boolean = true
  ): Promise<{ success: boolean; error?: string }> {
    await this.openModal()

    const createButton = this.assertions.page.locator(
      'button:has-text("New Project"), [data-testid="create-project-button"]'
    )
    await createButton.click()

    await this.forms.fillProjectCreationForm(projectData)
    const result = await this.forms.submitFormWithRetry()

    if (shouldSucceed && result.success) {
      await this.assertions.assertProjectExists(projectData.name, true)
    }

    return result
  }

  /**
   * Test file browser navigation
   */
  async testFileBrowserNavigation(scenario: FileBrowserScenario): Promise<{ success: boolean; error?: string }> {
    try {
      await this.fileBrowser.mockDirectoryNavigation(scenario)
      await this.openModal()

      const browseButton = this.assertions.page.locator('button:has-text("Browse"), [data-testid="browse-button"]')
      await browseButton.click()

      await this.fileBrowser.navigateThroughDirectories(scenario.navigationPath)

      if (scenario.shouldSucceed) {
        const validation = await this.fileBrowser.validateDirectoryStructure(
          scenario.expectedFiles || [],
          scenario.expectedFolders || []
        )

        if (!validation.valid) {
          return { success: false, error: validation.errors.join(', ') }
        }
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'File browser navigation failed'
      }
    }
  }
}

// Export utility functions for easy access
export { ManageProjectModalTestData, ManageProjectModalTestUtils }

// Export default for easy importing
export default ManageProjectModalHelpers
