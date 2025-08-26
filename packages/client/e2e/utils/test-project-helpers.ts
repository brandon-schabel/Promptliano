import { type Page, expect } from '@playwright/test'
import { TestProjectFactory, type TestProject, type TestProjectConfig } from '../fixtures/test-project-factory'
import { join } from 'path'
import { existsSync } from 'fs'
import { stat } from 'fs/promises'

/**
 * Utilities for managing test projects in E2E tests
 */
export class TestProjectHelpers {
  private static activeProjects: TestProject[] = []

  /**
   * Create and register a test project
   */
  static async createTestProject(config: TestProjectConfig): Promise<TestProject> {
    const project = await TestProjectFactory.createProject(config)
    this.activeProjects.push(project)
    return project
  }

  /**
   * Create multiple test projects
   */
  static async createTestProjects(configs: TestProjectConfig[]): Promise<TestProject[]> {
    const projects = await TestProjectFactory.createMultipleProjects(configs)
    this.activeProjects.push(...projects)
    return projects
  }

  /**
   * Clean up all test projects created in current test session
   */
  static async cleanupTestProjects(): Promise<void> {
    if (this.activeProjects.length > 0) {
      await TestProjectFactory.cleanupProjects(this.activeProjects)
      this.activeProjects = []
    }
  }

  /**
   * Clean up specific test projects
   */
  static async cleanupSpecificProjects(projects: TestProject[]): Promise<void> {
    await TestProjectFactory.cleanupProjects(projects)

    // Remove from active projects
    for (const project of projects) {
      const index = this.activeProjects.findIndex((p) => p.path === project.path)
      if (index !== -1) {
        this.activeProjects.splice(index, 1)
      }
    }
  }

  /**
   * Verify project exists on disk
   */
  static async verifyProjectOnDisk(project: TestProject): Promise<boolean> {
    if (!existsSync(project.path)) {
      return false
    }

    // Verify some key files exist
    for (const file of project.files.slice(0, 3)) {
      // Check first 3 files
      const filePath = join(project.path, file.path)
      if (!existsSync(filePath)) {
        return false
      }
    }

    return true
  }

  /**
   * Get project statistics
   */
  static async getProjectStats(project: TestProject): Promise<{
    fileCount: number
    directoryCount: number
    totalSize: number
    depth: number
  }> {
    let fileCount = 0
    let directoryCount = 0
    let totalSize = 0
    let maxDepth = 0

    for (const item of project.structure) {
      if (item.endsWith('/')) {
        directoryCount++
        const depth = item.split('/').length - 1
        maxDepth = Math.max(maxDepth, depth)
      } else {
        fileCount++
        try {
          const filePath = join(project.path, item)
          const stats = await stat(filePath)
          totalSize += stats.size
        } catch (error) {
          // File might not exist, skip
        }
      }
    }

    return {
      fileCount,
      directoryCount,
      totalSize,
      depth: maxDepth
    }
  }

  /**
   * Load project into application via UI
   */
  static async loadProjectIntoApp(page: Page, project: TestProject): Promise<void> {
    // Navigate to projects page
    await page.goto('/projects')

    // Wait for page to load
    await expect(page.locator('[data-testid="projects-grid"], .projects-container')).toBeVisible()

    // Click create/import project button
    const createButton = page.locator(
      '[data-testid="create-project"], button:has-text("New Project"), button:has-text("Import Project")'
    )
    await createButton.click()

    // Fill project form with test project data
    const dialog = page.locator('[role="dialog"], [data-testid="project-dialog"]')
    await expect(dialog).toBeVisible()

    // Fill project name
    const nameInput = page.locator('input[name="name"], input[placeholder*="project name" i]')
    await nameInput.fill(project.name)

    // Fill project path
    const pathInput = page.locator('input[name="path"], input[placeholder*="path" i]')
    await pathInput.fill(project.path)

    // Add description
    const descriptionInput = page.locator('textarea[name="description"], textarea[placeholder*="description" i]')
    if (await descriptionInput.isVisible()) {
      await descriptionInput.fill(`Test project: ${project.name}`)
    }

    // Submit form
    const submitButton = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save")')
    await submitButton.click()

    // Wait for project to be created and appear in list
    await expect(page.locator(`text="${project.name}"`)).toBeVisible({ timeout: 10000 })
  }

  /**
   * Verify project appears in application
   */
  static async verifyProjectInApp(page: Page, project: TestProject): Promise<boolean> {
    try {
      // Look for project in the UI
      const projectElement = page.locator(`[data-testid="project-card"]:has-text("${project.name}")`)
      return await projectElement.isVisible()
    } catch {
      return false
    }
  }

  /**
   * Open project in application
   */
  static async openProjectInApp(page: Page, project: TestProject): Promise<void> {
    const projectCard = page.locator(`[data-testid="project-card"]:has-text("${project.name}")`)
    await expect(projectCard).toBeVisible()
    await projectCard.click()

    // Wait for project to load
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/projects\/\d+/)
  }

  /**
   * Create preset project types for common testing scenarios
   */
  static async createWebAppProject(): Promise<TestProject> {
    return this.createTestProject({
      template: 'web-app',
      name: `test-webapp-${Date.now()}`,
      includeDependencies: true,
      includeGit: true
    })
  }

  static async createApiProject(): Promise<TestProject> {
    return this.createTestProject({
      template: 'api-service',
      name: `test-api-${Date.now()}`,
      includeDependencies: true,
      includeGit: true
    })
  }

  static async createLibraryProject(): Promise<TestProject> {
    return this.createTestProject({
      template: 'library',
      name: `test-lib-${Date.now()}`,
      includeDependencies: true,
      includeGit: true
    })
  }

  static async createSimpleProject(): Promise<TestProject> {
    return this.createTestProject({
      template: 'simple',
      name: `test-simple-${Date.now()}`,
      includeGit: false,
      includeDependencies: false
    })
  }

  static async createLargeProject(options?: {
    fileCount?: number
    directoryDepth?: number
    includeVariousFileTypes?: boolean
  }): Promise<TestProject> {
    const { fileCount = 100, directoryDepth = 3, includeVariousFileTypes = false } = options || {}

    return this.createTestProject({
      template: 'monorepo',
      name: `test-large-${Date.now()}`,
      fileCount,
      depth: directoryDepth,
      includeDependencies: true,
      includeGit: true,
      addBinaryFiles: includeVariousFileTypes
    })
  }

  /**
   * Create projects for specific test scenarios
   */
  static async createProjectSet(): Promise<{
    webApp: TestProject
    api: TestProject
    library: TestProject
    simple: TestProject
  }> {
    const [webApp, api, library, simple] = await this.createTestProjects([
      { template: 'web-app', includeDependencies: true },
      { template: 'api-service', includeDependencies: true },
      { template: 'library', includeDependencies: true },
      { template: 'simple', includeDependencies: false }
    ])

    return { webApp, api, library, simple }
  }

  /**
   * Wait for file system operations to complete
   */
  static async waitForFileSystem(): Promise<void> {
    // Small delay to ensure file system operations are complete
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  /**
   * Get project file by path
   */
  static getProjectFile(project: TestProject, filePath: string): string | null {
    const file = project.files.find((f) => f.path === filePath)
    return file?.content || null
  }

  /**
   * Get project files by extension
   */
  static getProjectFilesByExtension(project: TestProject, extension: string): string[] {
    return project.files.filter((f) => f.path.endsWith(`.${extension}`)).map((f) => f.path)
  }

  /**
   * Get project TypeScript files
   */
  static getProjectTypeScriptFiles(project: TestProject): string[] {
    return this.getProjectFilesByExtension(project, 'ts').concat(this.getProjectFilesByExtension(project, 'tsx'))
  }

  /**
   * Get project JavaScript files
   */
  static getProjectJavaScriptFiles(project: TestProject): string[] {
    return this.getProjectFilesByExtension(project, 'js').concat(this.getProjectFilesByExtension(project, 'jsx'))
  }

  /**
   * Get project configuration files
   */
  static getProjectConfigFiles(project: TestProject): string[] {
    const configExtensions = ['json', 'yaml', 'yml', 'toml', 'ini']
    let configFiles: string[] = []

    for (const ext of configExtensions) {
      configFiles = configFiles.concat(this.getProjectFilesByExtension(project, ext))
    }

    // Add common config file names
    const commonConfigFiles = ['package.json', 'tsconfig.json', '.gitignore', '.eslintrc.js', '.prettierrc']

    for (const configFile of commonConfigFiles) {
      if (project.files.find((f) => f.path === configFile)) {
        configFiles.push(configFile)
      }
    }

    return Array.from(new Set(configFiles)) // Remove duplicates
  }

  /**
   * Validate project structure
   */
  static validateProjectStructure(project: TestProject): {
    valid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    // Check required files
    if (!project.files.find((f) => f.path === 'package.json')) {
      errors.push('Missing package.json')
    }

    if (!project.files.find((f) => f.path === 'README.md')) {
      errors.push('Missing README.md')
    }

    // Check for main entry point
    const hasEntryPoint = project.files.some(
      (f) =>
        f.path === 'index.js' || f.path === 'src/index.js' || f.path === 'src/index.ts' || f.path === 'src/index.tsx'
    )

    if (!hasEntryPoint) {
      errors.push('No main entry point found')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Monitor project creation progress
   */
  static async monitorProjectCreation(callback: (progress: number) => void): Promise<void> {
    // Simulate project creation monitoring
    for (let i = 0; i <= 100; i += 10) {
      callback(i)
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }

  /**
   * Get active projects count
   */
  static getActiveProjectsCount(): number {
    return this.activeProjects.length
  }

  /**
   * Get active projects
   */
  static getActiveProjects(): TestProject[] {
    return [...this.activeProjects]
  }

  /**
   * Find project by name
   */
  static findProjectByName(name: string): TestProject | null {
    return this.activeProjects.find((p) => p.name === name) || null
  }

  /**
   * Clear all active projects (without cleanup)
   */
  static clearActiveProjects(): void {
    this.activeProjects = []
  }
}

/**
 * File system utilities for E2E testing
 */
export class TestFileSystemUtils {
  /**
   * Create a temporary directory for testing
   */
  static async createTempDirectory(): Promise<string> {
    const { mkdtemp } = await import('fs/promises')
    const { tmpdir } = await import('os')
    const { join } = await import('path')

    return mkdtemp(join(tmpdir(), 'e2e-test-'))
  }

  /**
   * Check if path is safe for testing
   */
  static isSafeTestPath(path: string): boolean {
    const safePrefixes = ['/tmp', '/var/tmp', process.env.TEMP, process.env.TMP]
    return safePrefixes.some((prefix) => prefix && path.startsWith(prefix))
  }

  /**
   * Generate unique test path
   */
  static generateTestPath(): string {
    return `/tmp/e2e-test-projects/test-${Date.now()}-${Math.random().toString(36).substring(7)}`
  }
}

/**
 * Project template presets for different test scenarios
 */
export const TestProjectPresets = {
  /**
   * Minimal project for quick tests
   */
  minimal: (): TestProjectConfig => ({
    template: 'simple',
    includeGit: false,
    includeDependencies: false
  }),

  /**
   * Standard web application
   */
  webApp: (): TestProjectConfig => ({
    template: 'web-app',
    includeDependencies: true,
    includeGit: true
  }),

  /**
   * API service project
   */
  apiService: (): TestProjectConfig => ({
    template: 'api-service',
    includeDependencies: true,
    includeGit: true
  }),

  /**
   * Library project
   */
  library: (): TestProjectConfig => ({
    template: 'library',
    includeDependencies: true,
    includeGit: true
  }),

  /**
   * Large monorepo for performance testing
   */
  largeMonorepo: (): TestProjectConfig => ({
    template: 'monorepo',
    fileCount: 200,
    depth: 6,
    includeDependencies: true,
    includeGit: true
  }),

  /**
   * Project with binary files
   */
  withBinaryFiles: (): TestProjectConfig => ({
    template: 'web-app',
    includeDependencies: true,
    addBinaryFiles: true,
    includeGit: true
  }),

  /**
   * Project with various file sizes for performance testing
   */
  withVariousFileSizes: (): TestProjectConfig => ({
    template: 'web-app',
    includeDependencies: true,
    addBinaryFiles: true,
    includeGit: true,
    fileCount: 50,
    addLargeFiles: true
  })
}
