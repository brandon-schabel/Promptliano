import { test, expect } from '@playwright/test'
import { ProjectsPage } from '../pages/projects.page'
import { ChatPage } from '../pages/chat.page'
import { FlowPage } from '../pages/flow.page'
import { FilesPage } from '../pages/files.page'
import { testDataFactory } from '../utils/test-data-factory'

// Performance thresholds (in milliseconds)
const PERFORMANCE_THRESHOLDS = {
  PAGE_LOAD: 3000,
  API_RESPONSE: 2000,
  UI_INTERACTION: 500,
  LARGE_DATA_RENDER: 5000,
  SEARCH_RESPONSE: 1000,
  FILE_UPLOAD: 10000,
  AI_RESPONSE: 30000
}

test.describe('Performance Test Suite', () => {
  test.describe('Page Load Performance', () => {
    test('should load main dashboard within performance threshold', async ({ page }) => {
      const startTime = Date.now()
      
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      await expect(page.getByTestId('dashboard')).toBeVisible()
      
      const loadTime = Date.now() - startTime
      expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.PAGE_LOAD)
      
      // Measure Core Web Vitals
      const webVitals = await page.evaluate(() => {
        return new Promise(resolve => {
          new PerformanceObserver(list => {
            const entries = list.getEntries()
            const vitals = {
              LCP: 0, // Largest Contentful Paint
              FID: 0, // First Input Delay
              CLS: 0  // Cumulative Layout Shift
            }
            
            entries.forEach(entry => {
              if (entry.entryType === 'largest-contentful-paint') {
                vitals.LCP = entry.startTime
              }
              if (entry.entryType === 'first-input') {
                vitals.FID = entry.processingStart - entry.startTime
              }
              if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
                vitals.CLS += entry.value
              }
            })
            
            setTimeout(() => resolve(vitals), 2000)
          }).observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] })
        })
      })
      
      // Verify Core Web Vitals are within acceptable ranges
      expect(webVitals.LCP).toBeLessThan(2500) // Good LCP < 2.5s
      expect(webVitals.FID).toBeLessThan(100)  // Good FID < 100ms
      expect(webVitals.CLS).toBeLessThan(0.1)  // Good CLS < 0.1
    })

    test('should load project list quickly with many projects', async ({ page }) => {
      const projectsPage = new ProjectsPage(page)
      
      // Create multiple projects for testing
      const projectCount = 50
      const projects = []
      
      for (let i = 0; i < projectCount; i++) {
        const projectName = `PerfTest-${i}-${Date.now()}`
        projects.push(projectName)
      }
      
      // Batch create projects
      const startCreateTime = Date.now()
      
      await page.evaluate((projectNames) => {
        // Mock bulk project creation
        window.dispatchEvent(new CustomEvent('bulk-create-projects', {
          detail: { projects: projectNames.map(name => ({ name, description: `Performance test project ${name}` })) }
        }))
      }, projects)
      
      const createTime = Date.now() - startCreateTime
      
      // Navigate to projects and measure load time
      const startLoadTime = Date.now()
      
      await page.goto('/projects')
      await page.waitForLoadState('networkidle')
      
      // Wait for all project cards to be rendered
      await expect(page.getByTestId('project-card')).toHaveCount(projectCount, { timeout: 10000 })
      
      const loadTime = Date.now() - startLoadTime
      expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LARGE_DATA_RENDER)
      
      // Verify project count
      const renderedProjects = await projectsPage.getProjectCount()
      expect(renderedProjects).toBe(projectCount)
    })

    test('should handle project detail loading efficiently', async ({ page }) => {
      const projectsPage = new ProjectsPage(page)
      const testProjectName = `DetailPerf-${Date.now()}`
      
      // Create project with substantial content
      await projectsPage.createProject(testProjectName, 'Performance test project with content')
      
      // Add substantial content
      await page.evaluate(() => {
        const prompts = []
        for (let i = 0; i < 100; i++) {
          prompts.push({
            name: `Prompt ${i}`,
            content: `This is test prompt ${i} with content that should load efficiently.`
          })
        }
        
        window.dispatchEvent(new CustomEvent('bulk-create-prompts', {
          detail: { prompts }
        }))
      })
      
      // Measure project detail load time
      const startTime = Date.now()
      
      await projectsPage.openProject(testProjectName)
      await page.waitForSelector('[data-testid="project-content-loaded"]')
      
      const loadTime = Date.now() - startTime
      expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LARGE_DATA_RENDER)
      
      // Verify all prompts are loaded
      await expect(page.getByTestId('prompt-card')).toHaveCount(100)
    })
  })

  test.describe('API Response Performance', () => {
    test('should handle project operations within response thresholds', async ({ page }) => {
      const projectsPage = new ProjectsPage(page)
      const testProjectName = `APIPerf-${Date.now()}`
      
      // Measure project creation API time
      const startCreateTime = Date.now()
      await projectsPage.createProject(testProjectName, 'API performance test project')
      const createTime = Date.now() - startCreateTime
      
      expect(createTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE)
      
      // Measure project update API time
      const startUpdateTime = Date.now()
      await projectsPage.openProject(testProjectName)
      await page.getByTestId('project-name-input').fill(`${testProjectName}-Updated`)
      await page.getByTestId('save-project').click()
      await page.waitForSelector('[data-testid="save-success"]')
      const updateTime = Date.now() - startUpdateTime
      
      expect(updateTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE)
      
      // Measure project deletion API time
      const startDeleteTime = Date.now()
      await projectsPage.deleteProject(`${testProjectName}-Updated`)
      const deleteTime = Date.now() - startDeleteTime
      
      expect(deleteTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE)
    })

    test('should handle bulk operations efficiently', async ({ page }) => {
      const projectsPage = new ProjectsPage(page)
      const testProjectName = `BulkPerf-${Date.now()}`
      
      await projectsPage.createProject(testProjectName, 'Bulk operations test')
      await projectsPage.openProject(testProjectName)
      
      // Measure bulk prompt creation
      const promptCount = 25
      const startBulkTime = Date.now()
      
      for (let i = 0; i < promptCount; i++) {
        await page.getByTestId('add-prompt-button').click()
        await page.getByTestId('prompt-name-input').fill(`Bulk Prompt ${i}`)
        await page.getByTestId('prompt-content-textarea').fill(`Bulk content ${i}`)
        await page.getByTestId('save-prompt').click()
        await page.waitForSelector('[data-testid="prompt-saved"]')
      }
      
      const bulkTime = Date.now() - startBulkTime
      const averageTime = bulkTime / promptCount
      
      expect(averageTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE)
      
      // Verify all prompts were created
      await expect(page.getByTestId('prompt-card')).toHaveCount(promptCount)
    })

    test('should handle concurrent API requests efficiently', async ({ page, context }) => {
      const projectsPage = new ProjectsPage(page)
      
      // Create multiple pages for concurrent requests
      const pages = [page]
      for (let i = 0; i < 2; i++) {
        const newPage = await context.newPage()
        await newPage.goto('/')
        pages.push(newPage)
      }
      
      const startTime = Date.now()
      const promises = []
      
      // Create concurrent project creation requests
      for (let i = 0; i < pages.length; i++) {
        const currentPage = pages[i]
        const currentProjectsPage = new ProjectsPage(currentPage)
        
        promises.push(
          currentProjectsPage.createProject(
            `ConcurrentPerf-${i}-${Date.now()}`,
            `Concurrent test project ${i}`
          )
        )
      }
      
      await Promise.all(promises)
      const concurrentTime = Date.now() - startTime
      
      // Should handle concurrent requests reasonably well
      expect(concurrentTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE * 2)
      
      // Clean up additional pages
      for (let i = 1; i < pages.length; i++) {
        await pages[i].close()
      }
    })
  })

  test.describe('UI Interaction Performance', () => {
    test('should respond to clicks within interaction threshold', async ({ page }) => {
      const projectsPage = new ProjectsPage(page)
      const testProjectName = `UIPerf-${Date.now()}`
      
      await projectsPage.createProject(testProjectName, 'UI performance test')
      await projectsPage.openProject(testProjectName)
      
      // Measure button click response time
      const startTime = Date.now()
      
      await page.getByTestId('add-prompt-button').click()
      await page.waitForSelector('[data-testid="prompt-dialog"]')
      
      const responseTime = Date.now() - startTime
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.UI_INTERACTION)
      
      // Measure form interaction response
      const startFormTime = Date.now()
      
      await page.getByTestId('prompt-name-input').fill('Performance Test Prompt')
      await page.getByTestId('prompt-content-textarea').fill('Test content')
      await page.getByTestId('save-prompt').click()
      await page.waitForSelector('[data-testid="prompt-saved"]')
      
      const formResponseTime = Date.now() - startFormTime
      expect(formResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE)
    })

    test('should handle rapid consecutive clicks efficiently', async ({ page }) => {
      const projectsPage = new ProjectsPage(page)
      const testProjectName = `RapidClick-${Date.now()}`
      
      await projectsPage.createProject(testProjectName, 'Rapid click test')
      await projectsPage.openProject(testProjectName)
      
      // Create some prompts first
      for (let i = 0; i < 5; i++) {
        await page.getByTestId('add-prompt-button').click()
        await page.getByTestId('prompt-name-input').fill(`Rapid Test ${i}`)
        await page.getByTestId('prompt-content-textarea').fill(`Content ${i}`)
        await page.getByTestId('save-prompt').click()
        await page.waitForSelector('[data-testid="prompt-saved"]')
      }
      
      // Measure rapid consecutive operations
      const startTime = Date.now()
      
      // Rapidly click through prompts
      for (let i = 0; i < 5; i++) {
        await page.getByTestId(`prompt-Rapid Test ${i}`).click()
        await page.waitForSelector('[data-testid="prompt-selected"]')
      }
      
      const rapidClickTime = Date.now() - startTime
      const averageClickTime = rapidClickTime / 5
      
      expect(averageClickTime).toBeLessThan(PERFORMANCE_THRESHOLDS.UI_INTERACTION)
    })

    test('should handle scrolling performance with large lists', async ({ page }) => {
      const projectsPage = new ProjectsPage(page)
      const testProjectName = `ScrollPerf-${Date.now()}`
      
      await projectsPage.createProject(testProjectName, 'Scroll performance test')
      await projectsPage.openProject(testProjectName)
      
      // Create many items for scrolling
      await page.evaluate(() => {
        const prompts = []
        for (let i = 0; i < 200; i++) {
          prompts.push({
            name: `Scroll Test ${i}`,
            content: `Content for scroll test item ${i}`
          })
        }
        
        window.dispatchEvent(new CustomEvent('bulk-create-prompts', {
          detail: { prompts }
        }))
      })
      
      await page.waitForSelector('[data-testid="prompt-list-loaded"]')
      
      // Measure scrolling performance
      const startTime = Date.now()
      
      // Scroll to bottom
      await page.evaluate(() => {
        const container = document.querySelector('[data-testid="prompt-list-container"]')
        if (container) {
          container.scrollTop = container.scrollHeight
        }
      })
      
      await page.waitForFunction(() => {
        const container = document.querySelector('[data-testid="prompt-list-container"]')
        return container && container.scrollTop > 0
      })
      
      const scrollTime = Date.now() - startTime
      expect(scrollTime).toBeLessThan(PERFORMANCE_THRESHOLDS.UI_INTERACTION * 2)
      
      // Verify virtualization is working (not all items should be in DOM)
      const visibleItems = await page.getByTestId('prompt-card').count()
      expect(visibleItems).toBeLessThan(200) // Should be virtualized
    })
  })

  test.describe('Search and Filter Performance', () => {
    test('should perform search operations within threshold', async ({ page }) => {
      const projectsPage = new ProjectsPage(page)
      const testProjectName = `SearchPerf-${Date.now()}`
      
      await projectsPage.createProject(testProjectName, 'Search performance test')
      await projectsPage.openProject(testProjectName)
      
      // Create searchable content
      const searchTerms = ['performance', 'test', 'search', 'filter', 'optimization']
      
      for (let i = 0; i < 50; i++) {
        const term = searchTerms[i % searchTerms.length]
        await page.evaluate((name, content) => {
          window.dispatchEvent(new CustomEvent('create-prompt', {
            detail: { name, content }
          }))
        }, `${term} prompt ${i}`, `Content containing ${term} for testing search functionality`)
      }
      
      await page.waitForSelector('[data-testid="prompts-loaded"]')
      
      // Measure search performance
      for (const term of searchTerms) {
        const startSearchTime = Date.now()
        
        await page.getByTestId('search-input').fill(term)
        await page.waitForSelector(`[data-testid="search-results-${term}"]`)
        
        const searchTime = Date.now() - startSearchTime
        expect(searchTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_RESPONSE)
        
        // Verify search results
        const results = await page.getByTestId('prompt-card').count()
        expect(results).toBeGreaterThan(0)
        expect(results).toBeLessThanOrEqual(10) // Should show relevant results
        
        // Clear search
        await page.getByTestId('search-input').fill('')
        await page.waitForSelector('[data-testid="all-prompts-visible"]')
      }
    })

    test('should handle complex filtering efficiently', async ({ page }) => {
      const projectsPage = new ProjectsPage(page)
      const testProjectName = `FilterPerf-${Date.now()}`
      
      await projectsPage.createProject(testProjectName, 'Filter performance test')
      await projectsPage.openProject(testProjectName)
      
      // Create items with different categories and tags
      const categories = ['ai', 'web', 'mobile', 'backend', 'frontend']
      const priorities = ['high', 'medium', 'low']
      
      for (let i = 0; i < 100; i++) {
        const category = categories[i % categories.length]
        const priority = priorities[i % priorities.length]
        
        await page.evaluate((name, category, priority) => {
          window.dispatchEvent(new CustomEvent('create-prompt', {
            detail: { 
              name, 
              content: `Content for ${name}`,
              category,
              priority,
              tags: [category, priority, 'test']
            }
          }))
        }, `Filter Test ${i}`, category, priority)
      }
      
      await page.waitForSelector('[data-testid="prompts-loaded"]')
      
      // Measure complex filter performance
      const startFilterTime = Date.now()
      
      // Apply multiple filters
      await page.getByTestId('filter-category').selectOption('ai')
      await page.getByTestId('filter-priority').selectOption('high')
      await page.getByTestId('filter-tags').fill('test')
      await page.getByTestId('apply-filters').click()
      
      await page.waitForSelector('[data-testid="filtered-results"]')
      
      const filterTime = Date.now() - startFilterTime
      expect(filterTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_RESPONSE * 2)
      
      // Verify filtered results
      const filteredCount = await page.getByTestId('prompt-card').count()
      expect(filteredCount).toBeLessThan(100) // Should be filtered
      expect(filteredCount).toBeGreaterThan(0) // Should have results
    })
  })

  test.describe('File Operations Performance', () => {
    test('should handle file uploads within threshold', async ({ page }) => {
      const filesPage = new FilesPage(page)
      const projectsPage = new ProjectsPage(page)
      const testProjectName = `FilePerf-${Date.now()}`
      
      await projectsPage.createProject(testProjectName, 'File performance test')
      await projectsPage.openProject(testProjectName)
      await page.getByTestId('open-files').click()
      
      // Create test files of various sizes
      const testFiles = [
        { name: 'small.txt', size: 1024 },      // 1KB
        { name: 'medium.txt', size: 102400 },   // 100KB
        { name: 'large.txt', size: 1048576 }   // 1MB
      ]
      
      for (const file of testFiles) {
        const startUploadTime = Date.now()
        
        // Mock file upload
        await page.evaluate((fileName, fileSize) => {
          const content = 'x'.repeat(fileSize)
          const blob = new Blob([content], { type: 'text/plain' })
          const file = new File([blob], fileName, { type: 'text/plain' })
          
          window.dispatchEvent(new CustomEvent('upload-file', {
            detail: { file }
          }))
        }, file.name, file.size)
        
        await page.waitForSelector(`[data-testid="file-${file.name}-uploaded"]`)
        
        const uploadTime = Date.now() - startUploadTime
        
        // Adjust threshold based on file size
        const expectedThreshold = file.size > 500000 
          ? PERFORMANCE_THRESHOLDS.FILE_UPLOAD 
          : PERFORMANCE_THRESHOLDS.FILE_UPLOAD / 2
        
        expect(uploadTime).toBeLessThan(expectedThreshold)
      }
    })

    test('should handle multiple file uploads concurrently', async ({ page }) => {
      const filesPage = new FilesPage(page)
      const projectsPage = new ProjectsPage(page)
      const testProjectName = `MultiFilePerf-${Date.now()}`
      
      await projectsPage.createProject(testProjectName, 'Multi-file performance test')
      await projectsPage.openProject(testProjectName)
      await page.getByTestId('open-files').click()
      
      const fileCount = 10
      const startTime = Date.now()
      
      // Upload multiple files concurrently
      const uploadPromises = []
      
      for (let i = 0; i < fileCount; i++) {
        const fileName = `concurrent-${i}.txt`
        uploadPromises.push(
          page.evaluate((fileName) => {
            const content = 'Test content for concurrent upload'
            const blob = new Blob([content], { type: 'text/plain' })
            const file = new File([blob], fileName, { type: 'text/plain' })
            
            return new Promise(resolve => {
              window.dispatchEvent(new CustomEvent('upload-file', {
                detail: { file, callback: resolve }
              }))
            })
          }, fileName)
        )
      }
      
      await Promise.all(uploadPromises)
      
      const totalUploadTime = Date.now() - startTime
      expect(totalUploadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FILE_UPLOAD)
      
      // Verify all files were uploaded
      for (let i = 0; i < fileCount; i++) {
        await expect(page.getByTestId(`file-concurrent-${i}.txt`)).toBeVisible()
      }
    })
  })

  test.describe('Chat and AI Performance', () => {
    test('should handle chat interface interactions efficiently', async ({ page }) => {
      const chatPage = new ChatPage(page)
      const projectsPage = new ProjectsPage(page)
      const testProjectName = `ChatPerf-${Date.now()}`
      
      await projectsPage.createProject(testProjectName, 'Chat performance test')
      await projectsPage.openProject(testProjectName)
      await page.getByTestId('open-chat').click()
      
      // Measure chat message sending performance
      const messages = [
        'Hello, this is a performance test message',
        'Can you help me with a coding question?',
        'What are the best practices for web development?',
        'How do I optimize database queries?',
        'Explain machine learning concepts'
      ]
      
      for (const message of messages) {
        const startTime = Date.now()
        
        await chatPage.sendMessage(message)
        await page.waitForSelector('[data-testid="message-sent"]')
        
        const sendTime = Date.now() - startTime
        expect(sendTime).toBeLessThan(PERFORMANCE_THRESHOLDS.UI_INTERACTION * 2)
      }
      
      // Verify all messages are displayed
      await expect(page.getByTestId('chat-message')).toHaveCount(messages.length)
    })

    test('should handle AI response waiting efficiently', async ({ page }) => {
      const chatPage = new ChatPage(page)
      const projectsPage = new ProjectsPage(page)
      const testProjectName = `AIPerf-${Date.now()}`
      
      await projectsPage.createProject(testProjectName, 'AI performance test')
      await projectsPage.openProject(testProjectName)
      await page.getByTestId('open-chat').click()
      
      // Mock AI provider response time
      await page.route('**/api/chat/completion', route => {
        setTimeout(() => {
          route.fulfill({
            status: 200,
            body: JSON.stringify({
              response: 'This is a test AI response for performance testing.',
              timestamp: Date.now()
            })
          })
        }, 2000) // 2 second simulated AI response
      })
      
      const startTime = Date.now()
      
      await chatPage.sendMessage('Test AI performance')
      await chatPage.waitForAIResponse()
      
      const responseTime = Date.now() - startTime
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.AI_RESPONSE)
      
      // Verify AI response is displayed
      await expect(page.getByTestId('ai-response')).toBeVisible()
      await expect(page.getByText('This is a test AI response')).toBeVisible()
    })
  })

  test.describe('Memory and Resource Usage', () => {
    test('should maintain reasonable memory usage with large datasets', async ({ page }) => {
      const projectsPage = new ProjectsPage(page)
      const testProjectName = `MemoryPerf-${Date.now()}`
      
      await projectsPage.createProject(testProjectName, 'Memory performance test')
      await projectsPage.openProject(testProjectName)
      
      // Get initial memory usage
      const initialMemory = await page.evaluate(() => {
        if ('memory' in performance) {
          return performance.memory.usedJSHeapSize
        }
        return 0
      })
      
      // Create large dataset
      await page.evaluate(() => {
        const prompts = []
        for (let i = 0; i < 1000; i++) {
          prompts.push({
            name: `Memory Test Prompt ${i}`,
            content: `This is a test prompt with substantial content for memory testing. Item ${i}. `.repeat(10)
          })
        }
        
        window.dispatchEvent(new CustomEvent('bulk-create-prompts', {
          detail: { prompts }
        }))
      })
      
      await page.waitForSelector('[data-testid="large-dataset-loaded"]')
      
      // Get memory usage after loading large dataset
      const afterLoadMemory = await page.evaluate(() => {
        if ('memory' in performance) {
          return performance.memory.usedJSHeapSize
        }
        return 0
      })
      
      // Perform operations on the dataset
      for (let i = 0; i < 10; i++) {
        await page.getByTestId('search-input').fill(`Memory Test Prompt ${i * 100}`)
        await page.waitForSelector('[data-testid="search-completed"]')
        await page.getByTestId('search-input').fill('')
        await page.waitForSelector('[data-testid="search-cleared"]')
      }
      
      // Get final memory usage
      const finalMemory = await page.evaluate(() => {
        if ('memory' in performance) {
          return performance.memory.usedJSHeapSize
        }
        return 0
      })
      
      // Memory should not grow excessively
      if (initialMemory > 0 && finalMemory > 0) {
        const memoryIncrease = finalMemory - initialMemory
        const maxAcceptableIncrease = 50 * 1024 * 1024 // 50MB
        
        expect(memoryIncrease).toBeLessThan(maxAcceptableIncrease)
      }
    })

    test('should handle DOM cleanup efficiently', async ({ page }) => {
      const projectsPage = new ProjectsPage(page)
      const testProjectName = `DOMCleanup-${Date.now()}`
      
      await projectsPage.createProject(testProjectName, 'DOM cleanup test')
      await projectsPage.openProject(testProjectName)
      
      // Create and remove many DOM elements
      for (let iteration = 0; iteration < 5; iteration++) {
        // Add many elements
        await page.evaluate(() => {
          const prompts = []
          for (let i = 0; i < 100; i++) {
            prompts.push({
              name: `Temporary Prompt ${i}`,
              content: `Temporary content ${i}`
            })
          }
          
          window.dispatchEvent(new CustomEvent('bulk-create-prompts', {
            detail: { prompts }
          }))
        })
        
        await page.waitForSelector('[data-testid="prompts-created"]')
        
        // Remove all elements
        await page.evaluate(() => {
          window.dispatchEvent(new CustomEvent('clear-all-prompts'))
        })
        
        await page.waitForSelector('[data-testid="prompts-cleared"]')
      }
      
      // Check DOM node count is reasonable
      const nodeCount = await page.evaluate(() => {
        return document.querySelectorAll('*').length
      })
      
      // DOM should not have excessive nodes left over
      expect(nodeCount).toBeLessThan(5000)
    })
  })

  test.describe('Network Performance', () => {
    test('should handle slow network conditions gracefully', async ({ page, context }) => {
      const projectsPage = new ProjectsPage(page)
      const testProjectName = `NetworkPerf-${Date.now()}`
      
      // Simulate slow network (3G)
      await context.route('**/*', async route => {
        await new Promise(resolve => setTimeout(resolve, 200)) // 200ms delay
        route.continue()
      })
      
      const startTime = Date.now()
      
      await projectsPage.createProject(testProjectName, 'Network performance test')
      
      const operationTime = Date.now() - startTime
      
      // Should handle slow network but still complete operations
      expect(operationTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE * 3)
      
      // Verify loading states are shown
      await expect(page.getByTestId('loading-indicator')).toHaveBeenVisible()
    })

    test('should optimize data fetching with caching', async ({ page }) => {
      const projectsPage = new ProjectsPage(page)
      const testProjectName = `CachePerf-${Date.now()}`
      
      await projectsPage.createProject(testProjectName, 'Cache performance test')
      
      // First load - measure initial fetch time
      const startFirstLoad = Date.now()
      await projectsPage.openProject(testProjectName)
      await page.waitForLoadState('networkidle')
      const firstLoadTime = Date.now() - startFirstLoad
      
      // Navigate away and back - measure cached load time
      await page.goBack()
      await page.waitForLoadState('networkidle')
      
      const startSecondLoad = Date.now()
      await projectsPage.openProject(testProjectName)
      await page.waitForLoadState('networkidle')
      const secondLoadTime = Date.now() - startSecondLoad
      
      // Second load should be significantly faster due to caching
      expect(secondLoadTime).toBeLessThan(firstLoadTime * 0.5)
    })
  })
})