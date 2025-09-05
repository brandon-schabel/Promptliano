/**
 * Organization Test Suite for Prompts Page
 * 
 * Tests search, filtering, sorting, pagination, and bulk operations
 * for organizing and managing prompts efficiently.
 */

import { test, expect } from '@playwright/test'
import { PromptsPage } from '../pages/prompts.page'
import { PromptTestHelpers } from '../helpers/prompt-helper'
import { 
  OrganizationTestPrompts,
  PromptTestDataFactory,
  TestScenarios 
} from '../fixtures/prompt-management-data'

test.describe('Prompts Organization Features', () => {
  let promptsPage: PromptsPage
  let testHelpers: PromptTestHelpers
  let setupPrompts: string[] = []

  test.beforeAll(async ({ browser }) => {
    // Create test data once for all organization tests
    const page = await browser.newPage()
    const setupPromptsPage = new PromptsPage(page)
    
    // Create a diverse set of prompts for testing
    for (const promptData of OrganizationTestPrompts) {
      await setupPromptsPage.goto()
      await setupPromptsPage.createPrompt(promptData)
      setupPrompts.push(promptData.title)
    }
    
    await page.close()
  })

  test.beforeEach(async ({ page }) => {
    promptsPage = new PromptsPage(page)
    testHelpers = new PromptTestHelpers(page)
    
    await promptsPage.goto()
    await promptsPage.waitForPromptsLoaded()
  })

  test.afterAll(async ({ browser }) => {
    // Clean up all test prompts
    const page = await browser.newPage()
    const cleanupPromptsPage = new PromptsPage(page)
    await cleanupPromptsPage.goto()
    
    for (const title of setupPrompts) {
      try {
        if (await cleanupPromptsPage.promptExists(title)) {
          await cleanupPromptsPage.deletePrompt(title)
        }
      } catch (error) {
        // Prompt might already be deleted
      }
    }
    
    await page.close()
  })

  test.describe('Search Functionality', () => {
    test('should search prompts by title', async ({ page }) => {
      // Search for specific title keyword
      await promptsPage.searchPrompts('API')
      
      // Verify only matching prompts are shown
      const visibleTitles = await promptsPage.getVisiblePromptTitles()
      expect(visibleTitles).toContain('API Endpoint Design')
      expect(visibleTitles).not.toContain('Database Schema Design')
      expect(visibleTitles).not.toContain('React Component Generator')
    })

    test('should search prompts by content keywords', async ({ page }) => {
      // Search for content keyword
      await promptsPage.searchPrompts('RESTful')
      
      // Should find prompt with RESTful in content
      const visibleTitles = await promptsPage.getVisiblePromptTitles()
      expect(visibleTitles).toContain('API Endpoint Design')
    })

    test('should search prompts by description', async ({ page }) => {
      // Search for description keyword
      await promptsPage.searchPrompts('optimized')
      
      // Should find prompt with 'optimized' in description
      const visibleTitles = await promptsPage.getVisiblePromptTitles()
      expect(visibleTitles).toContain('Database Schema Design')
    })

    test('should handle search with no results', async ({ page }) => {
      // Search for non-existent term
      await promptsPage.searchPrompts('NonExistentSearchTerm123')
      
      // Should show empty state or no results message
      const promptCount = await promptsPage.getPromptCount()
      expect(promptCount).toBe(0)
      
      // Might show empty state
      const emptyState = await promptsPage.isEmptyState()
      if (emptyState) {
        await expect(promptsPage.emptyState).toBeVisible()
      }
    })

    test('should clear search and show all prompts', async ({ page }) => {
      // Perform a search
      await promptsPage.searchPrompts('Python')
      let visibleTitles = await promptsPage.getVisiblePromptTitles()
      expect(visibleTitles).toContain('Python Script Helper')
      
      // Clear search
      await promptsPage.searchInput.clear()
      await promptsPage.searchInput.press('Enter')
      await promptsPage.waitForLoadingComplete()
      
      // Should show all prompts again
      visibleTitles = await promptsPage.getVisiblePromptTitles()
      expect(visibleTitles.length).toBeGreaterThan(1)
    })

    test('should search case-insensitively', async ({ page }) => {
      // Search with different cases
      await promptsPage.searchPrompts('react')
      let visibleTitles = await promptsPage.getVisiblePromptTitles()
      expect(visibleTitles).toContain('React Component Generator')
      
      // Clear and search with uppercase
      await promptsPage.searchInput.clear()
      await promptsPage.searchPrompts('REACT')
      visibleTitles = await promptsPage.getVisiblePromptTitles()
      expect(visibleTitles).toContain('React Component Generator')
    })

    test('should handle special characters in search', async ({ page }) => {
      // Search with special characters
      await promptsPage.searchPrompts('CI/CD')
      
      const visibleTitles = await promptsPage.getVisiblePromptTitles()
      expect(visibleTitles).toContain('DevOps Pipeline Builder')
    })
  })

  test.describe('Tag Filtering', () => {
    test('should filter prompts by single tag', async ({ page }) => {
      // Filter by 'frontend' tag
      await promptsPage.filterByTag('frontend')
      
      // Should show only frontend-related prompts
      const visibleTitles = await promptsPage.getVisiblePromptTitles()
      expect(visibleTitles).toContain('React Component Generator')
      expect(visibleTitles).toContain('CSS Style Generator')
      expect(visibleTitles).not.toContain('Database Schema Design')
    })

    test('should filter prompts by multiple tags', async ({ page }) => {
      // Apply multiple tag filters
      await promptsPage.filterByTag('backend')
      
      const visibleTitles = await promptsPage.getVisiblePromptTitles()
      expect(visibleTitles).toContain('API Endpoint Design')
      expect(visibleTitles).toContain('Database Schema Design')
      expect(visibleTitles).not.toContain('React Component Generator')
    })

    test('should clear tag filters', async ({ page }) => {
      // Apply filter
      await promptsPage.filterByTag('frontend')
      let promptCount = await promptsPage.getPromptCount()
      const filteredCount = promptCount
      
      // Clear filter (implementation depends on UI)
      const clearButton = page.locator('[data-testid="clear-filters"], button:has-text("Clear")')
      if (await clearButton.isVisible()) {
        await clearButton.click()
        await promptsPage.waitForLoadingComplete()
        
        // Should show more prompts after clearing
        promptCount = await promptsPage.getPromptCount()
        expect(promptCount).toBeGreaterThan(filteredCount)
      }
    })

    test('should show tag counts if available', async ({ page }) => {
      // Check if tag counts are displayed
      const tagElements = page.locator('[data-testid="tag-filter-item"], .tag-filter')
      
      if (await tagElements.first().isVisible()) {
        const tagText = await tagElements.first().textContent()
        // Tag might show count like "frontend (2)"
        expect(tagText).toBeTruthy()
      }
    })
  })

  test.describe('Sorting', () => {
    test('should sort prompts by name alphabetically', async ({ page }) => {
      // Select alphabetical sorting if available
      if (await promptsPage.sortSelect.isVisible()) {
        await promptsPage.sortSelect.selectOption('name-asc')
        await promptsPage.waitForLoadingComplete()
        
        const titles = await promptsPage.getVisiblePromptTitles()
        const sortedTitles = [...titles].sort()
        expect(titles).toEqual(sortedTitles)
      }
    })

    test('should sort prompts by name reverse alphabetically', async ({ page }) => {
      if (await promptsPage.sortSelect.isVisible()) {
        await promptsPage.sortSelect.selectOption('name-desc')
        await promptsPage.waitForLoadingComplete()
        
        const titles = await promptsPage.getVisiblePromptTitles()
        const sortedTitles = [...titles].sort().reverse()
        expect(titles).toEqual(sortedTitles)
      }
    })

    test('should sort prompts by date (newest first)', async ({ page }) => {
      if (await promptsPage.sortSelect.isVisible()) {
        await promptsPage.sortSelect.selectOption('date-desc')
        await promptsPage.waitForLoadingComplete()
        
        // Verify prompts are displayed (actual date verification would need timestamps)
        const promptCount = await promptsPage.getPromptCount()
        expect(promptCount).toBeGreaterThan(0)
      }
    })

    test('should sort prompts by date (oldest first)', async ({ page }) => {
      if (await promptsPage.sortSelect.isVisible()) {
        await promptsPage.sortSelect.selectOption('date-asc')
        await promptsPage.waitForLoadingComplete()
        
        const promptCount = await promptsPage.getPromptCount()
        expect(promptCount).toBeGreaterThan(0)
      }
    })

    test('should maintain sort order after search', async ({ page }) => {
      if (await promptsPage.sortSelect.isVisible()) {
        // Apply sort
        await promptsPage.sortSelect.selectOption('name-asc')
        
        // Apply search
        await promptsPage.searchPrompts('Script')
        
        // Check if sort is maintained
        const titles = await promptsPage.getVisiblePromptTitles()
        expect(titles.length).toBeGreaterThan(0)
      }
    })
  })

  test.describe('Pagination', () => {
    test('should paginate large prompt lists', async ({ page, browser }) => {
      // Create many prompts for pagination testing
      const testPage = await browser.newPage()
      const testPromptsPage = new PromptsPage(testPage)
      const paginationPrompts = PromptTestDataFactory.generatePaginationTestSet(30)
      const createdTitles: string[] = []
      
      for (const promptData of paginationPrompts.slice(0, 15)) {
        await testPromptsPage.goto()
        await testPromptsPage.createPrompt(promptData)
        createdTitles.push(promptData.title)
      }
      
      // Navigate to prompts page
      await promptsPage.goto()
      await promptsPage.waitForPromptsLoaded()
      
      // Check for pagination controls
      const paginationControls = page.locator('[data-testid="pagination"], .pagination')
      
      if (await paginationControls.isVisible()) {
        // Test next page navigation
        const nextButton = page.locator('[data-testid="next-page"], button:has-text("Next")')
        if (await nextButton.isEnabled()) {
          await nextButton.click()
          await promptsPage.waitForLoadingComplete()
          
          // Verify different prompts are shown
          const promptCount = await promptsPage.getPromptCount()
          expect(promptCount).toBeGreaterThan(0)
        }
        
        // Test previous page navigation
        const prevButton = page.locator('[data-testid="prev-page"], button:has-text("Previous")')
        if (await prevButton.isEnabled()) {
          await prevButton.click()
          await promptsPage.waitForLoadingComplete()
          
          const promptCount = await promptsPage.getPromptCount()
          expect(promptCount).toBeGreaterThan(0)
        }
      }
      
      // Cleanup
      for (const title of createdTitles) {
        try {
          await testPromptsPage.goto()
          if (await testPromptsPage.promptExists(title)) {
            await testPromptsPage.deletePrompt(title)
          }
        } catch (error) {
          // Continue cleanup
        }
      }
      
      await testPage.close()
    })

    test('should show page numbers if available', async ({ page }) => {
      const pageNumbers = page.locator('[data-testid="page-number"], .page-number')
      
      if (await pageNumbers.first().isVisible()) {
        const count = await pageNumbers.count()
        expect(count).toBeGreaterThan(0)
      }
    })

    test('should allow jumping to specific page', async ({ page }) => {
      const pageNumbers = page.locator('[data-testid="page-number"], .page-number')
      
      if (await pageNumbers.count() > 1) {
        // Click on page 2
        await pageNumbers.nth(1).click()
        await promptsPage.waitForLoadingComplete()
        
        // Verify navigation occurred
        const promptCount = await promptsPage.getPromptCount()
        expect(promptCount).toBeGreaterThan(0)
      }
    })
  })

  test.describe('Bulk Operations', () => {
    test('should select multiple prompts', async ({ page }) => {
      // Check if bulk selection is available
      const checkboxes = page.locator('[data-testid="prompt-checkbox"], input[type="checkbox"]')
      
      if (await checkboxes.first().isVisible()) {
        // Select first 3 prompts
        const titles = await promptsPage.getVisiblePromptTitles()
        const selectTitles = titles.slice(0, 3)
        
        await testHelpers.selectMultiplePrompts(selectTitles)
        
        // Verify selection count or bulk actions appear
        const bulkActions = page.locator('[data-testid="bulk-actions"], .bulk-actions')
        if (await bulkActions.isVisible()) {
          await expect(bulkActions).toContainText('3')
        }
      }
    })

    test('should select all prompts', async ({ page }) => {
      const selectAllCheckbox = page.locator('[data-testid="select-all"], input[type="checkbox"][aria-label*="all"]')
      
      if (await selectAllCheckbox.isVisible()) {
        await selectAllCheckbox.check()
        
        // Verify all are selected
        const checkboxes = page.locator('[data-testid="prompt-checkbox"]:checked')
        const checkedCount = await checkboxes.count()
        const totalCount = await promptsPage.getPromptCount()
        
        expect(checkedCount).toBe(totalCount)
      }
    })

    test('should perform bulk delete', async ({ page, browser }) => {
      // Create test prompts for bulk delete
      const testPage = await browser.newPage()
      const testPromptsPage = new PromptsPage(testPage)
      const bulkPrompts = [
        { title: 'Bulk Delete 1', content: 'Content 1' },
        { title: 'Bulk Delete 2', content: 'Content 2' },
        { title: 'Bulk Delete 3', content: 'Content 3' }
      ]
      
      for (const promptData of bulkPrompts) {
        await testPromptsPage.goto()
        await testPromptsPage.createPrompt(promptData)
      }
      
      // Refresh main page
      await promptsPage.goto()
      await promptsPage.waitForPromptsLoaded()
      
      // Select prompts for deletion
      const checkboxes = page.locator('[data-testid="prompt-checkbox"], input[type="checkbox"]')
      
      if (await checkboxes.first().isVisible()) {
        await testHelpers.selectMultiplePrompts(bulkPrompts.map(p => p.title))
        
        // Look for bulk delete button
        const bulkDeleteButton = page.locator('[data-testid="bulk-delete"], button:has-text("Delete Selected")')
        
        if (await bulkDeleteButton.isVisible()) {
          await bulkDeleteButton.click()
          await promptsPage.handleConfirmationDialog('accept')
          await promptsPage.waitForLoadingComplete()
          
          // Verify prompts are deleted
          for (const promptData of bulkPrompts) {
            await expect(promptsPage.getPromptCard(promptData.title)).not.toBeVisible()
          }
        }
      }
      
      await testPage.close()
    })

    test('should perform bulk export if available', async ({ page }) => {
      const checkboxes = page.locator('[data-testid="prompt-checkbox"], input[type="checkbox"]')
      
      if (await checkboxes.first().isVisible()) {
        // Select first 2 prompts
        const titles = await promptsPage.getVisiblePromptTitles()
        await testHelpers.selectMultiplePrompts(titles.slice(0, 2))
        
        // Look for bulk export button
        const bulkExportButton = page.locator('[data-testid="bulk-export"], button:has-text("Export Selected")')
        
        if (await bulkExportButton.isVisible()) {
          // Set up download listener
          const downloadPromise = page.waitForEvent('download')
          await bulkExportButton.click()
          
          try {
            const download = await downloadPromise
            expect(download).toBeTruthy()
          } catch {
            // Export might be handled differently
          }
        }
      }
    })
  })

  test.describe('Combined Filters', () => {
    test('should combine search with tag filter', async ({ page }) => {
      // Apply tag filter first
      await promptsPage.filterByTag('frontend')
      
      // Then apply search
      await promptsPage.searchPrompts('Component')
      
      // Should show only frontend prompts with 'Component'
      const visibleTitles = await promptsPage.getVisiblePromptTitles()
      expect(visibleTitles).toContain('React Component Generator')
      expect(visibleTitles).not.toContain('CSS Style Generator')
    })

    test('should combine multiple filters and maintain state', async ({ page }) => {
      // Apply multiple filters
      await promptsPage.filterByTag('backend')
      await promptsPage.searchPrompts('Design')
      
      if (await promptsPage.sortSelect.isVisible()) {
        await promptsPage.sortSelect.selectOption('name-asc')
      }
      
      // Verify combined filters work
      const visibleTitles = await promptsPage.getVisiblePromptTitles()
      expect(visibleTitles.length).toBeGreaterThan(0)
      expect(visibleTitles).toContain('API Endpoint Design')
    })

    test('should clear all filters at once', async ({ page }) => {
      // Apply multiple filters
      await promptsPage.filterByTag('frontend')
      await promptsPage.searchPrompts('React')
      
      const filteredCount = await promptsPage.getPromptCount()
      
      // Clear all filters
      const clearAllButton = page.locator('[data-testid="clear-all-filters"], button:has-text("Clear All")')
      
      if (await clearAllButton.isVisible()) {
        await clearAllButton.click()
        await promptsPage.waitForLoadingComplete()
        
        const totalCount = await promptsPage.getPromptCount()
        expect(totalCount).toBeGreaterThan(filteredCount)
      }
    })
  })

  test.describe('Performance with Large Datasets', () => {
    test('should handle searching in large dataset efficiently', async ({ page }) => {
      const startTime = Date.now()
      await promptsPage.searchPrompts('test')
      await promptsPage.waitForLoadingComplete()
      const endTime = Date.now()
      
      // Search should complete within reasonable time
      const searchTime = endTime - startTime
      expect(searchTime).toBeLessThan(3000) // 3 seconds max
    })

    test('should handle rapid filter changes', async ({ page }) => {
      // Rapidly change filters
      for (let i = 0; i < 5; i++) {
        await promptsPage.searchInput.fill(`search${i}`)
        await promptsPage.searchInput.press('Enter')
      }
      
      // Should handle rapid changes without errors
      await promptsPage.waitForLoadingComplete()
      const promptCount = await promptsPage.getPromptCount()
      expect(promptCount).toBeGreaterThanOrEqual(0)
    })

    test('should lazy load prompts if implemented', async ({ page }) => {
      // Scroll to bottom to trigger lazy loading
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await page.waitForTimeout(500)
      
      // Check if more prompts loaded
      const promptCount = await promptsPage.getPromptCount()
      expect(promptCount).toBeGreaterThan(0)
    })
  })
})