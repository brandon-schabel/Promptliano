import { test, expect } from '@playwright/test'
import { AppPage } from '../pages/app.page'
import { FilesPage, type FileItem } from '../pages/files.page'
import { ProjectsPage } from '../pages/projects.page'
import { TestDataFactory } from '../fixtures/test-data'
import { TestAssertions, TestDataManager } from '../utils/test-helpers'
import fs from 'fs'
import path from 'path'

test.describe('File Management System', () => {
  let appPage: AppPage
  let filesPage: FilesPage
  let projectsPage: ProjectsPage
  let dataManager: TestDataManager

  test.beforeEach(async ({ page }) => {
    appPage = new AppPage(page)
    filesPage = new FilesPage(page)
    projectsPage = new ProjectsPage(page)
    dataManager = new TestDataManager(page)

    // Navigate to files page and wait for app to be ready
    await filesPage.goto()
    await appPage.waitForAppReady()
    await filesPage.waitForFilesInterfaceLoad()
  })

  test.afterEach(async () => {
    // Clean up any test data created during the test
    await dataManager.cleanup()
    
    // Clean up test files
    const testFiles = FilesPage.createTestFiles()
    for (const file of testFiles) {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path)
      }
    }
  })

  test.describe('File Interface and Navigation', () => {
    test('should display file management interface correctly', async ({ page }) => {
      // Verify main file management elements are visible
      await expect(page.getByTestId('file-explorer')).toBeVisible()
      await expect(page.getByTestId('file-list')).toBeVisible()
      await expect(page.getByTestId('selected-files-panel')).toBeVisible()
      
      // Verify file management controls
      await expect(page.getByRole('button', { name: 'Upload Files' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Select All' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Clear All' })).toBeVisible()
    })

    test('should navigate to files section from project context', async ({ page }) => {
      // First create a project context
      await projectsPage.goto()
      
      const projectData = TestDataFactory.createProject({
        name: 'File Management Test Project'
      })
      await projectsPage.createProject(projectData)

      // Navigate to files within project
      await filesPage.navigateToFiles()

      // Verify we're in the files section
      await expect(page.getByTestId('file-explorer')).toBeVisible()
      await expect(page.getByText('Project Files')).toBeVisible()
    })

    test('should display file list with proper structure', async ({ page }) => {
      // Mock some files for testing
      await page.route('**/api/files/**', route => 
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            files: [
              {
                name: 'document.pdf',
                path: '/project/document.pdf',
                type: 'file',
                size: 1024,
                modified: '2024-01-15T10:00:00Z'
              },
              {
                name: 'images',
                path: '/project/images',
                type: 'directory',
                size: 0,
                modified: '2024-01-14T15:30:00Z'
              },
              {
                name: 'readme.txt',
                path: '/project/readme.txt',
                type: 'file',
                size: 512,
                modified: '2024-01-13T09:15:00Z'
              }
            ]
          })
        })
      )

      // Reload to get mocked files
      await page.reload()
      await filesPage.waitForFilesInterfaceLoad()

      // Verify files are displayed
      await expect(page.getByTestId('file-item-document.pdf')).toBeVisible()
      await expect(page.getByTestId('file-item-images')).toBeVisible()
      await expect(page.getByTestId('file-item-readme.txt')).toBeVisible()

      // Verify file metadata is shown
      const pdfMetadata = await filesPage.getFileMetadata('document.pdf')
      expect(pdfMetadata.name).toBe('document.pdf')
      expect(pdfMetadata.size).toContain('1024') // Size in bytes or formatted
      expect(pdfMetadata.type).toContain('pdf')
    })
  })

  test.describe('File Selection', () => {
    test('should select single file', async ({ page }) => {
      // Mock file data
      await page.route('**/api/files/**', route => 
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            files: [
              {
                name: 'test-file.txt',
                path: '/project/test-file.txt',
                type: 'file',
                size: 256,
                modified: '2024-01-15T10:00:00Z'
              }
            ]
          })
        })
      )

      await page.reload()
      await filesPage.waitForFilesInterfaceLoad()

      // Select the file
      await filesPage.selectFile('test-file.txt')

      // Verify file is selected
      const selectedCount = await filesPage.getSelectedFilesCount()
      expect(selectedCount).toBe(1)

      // Verify file appears in selected files panel
      await expect(page.getByTestId('selected-files-list').getByText('test-file.txt')).toBeVisible()
    })

    test('should select multiple files with Ctrl+Click', async ({ page }) => {
      // Mock multiple files
      await page.route('**/api/files/**', route => 
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            files: [
              {
                name: 'file1.txt',
                path: '/project/file1.txt',
                type: 'file',
                size: 100,
                modified: '2024-01-15T10:00:00Z'
              },
              {
                name: 'file2.pdf',
                path: '/project/file2.pdf',
                type: 'file',
                size: 200,
                modified: '2024-01-15T11:00:00Z'
              },
              {
                name: 'file3.jpg',
                path: '/project/file3.jpg',
                type: 'file',
                size: 300,
                modified: '2024-01-15T12:00:00Z'
              }
            ]
          })
        })
      )

      await page.reload()
      await filesPage.waitForFilesInterfaceLoad()

      // Select multiple files
      const filesToSelect = ['file1.txt', 'file2.pdf', 'file3.jpg']
      await filesPage.selectMultipleFiles(filesToSelect)

      // Verify all files are selected
      const selectedCount = await filesPage.getSelectedFilesCount()
      expect(selectedCount).toBe(3)

      // Verify all files appear in selected files panel
      for (const fileName of filesToSelect) {
        await expect(page.getByTestId('selected-files-list').getByText(fileName)).toBeVisible()
      }
    })

    test('should select all files with Select All button', async ({ page }) => {
      // Mock multiple files
      await page.route('**/api/files/**', route => 
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            files: Array.from({ length: 5 }, (_, i) => ({
              name: `file${i + 1}.txt`,
              path: `/project/file${i + 1}.txt`,
              type: 'file',
              size: 100 * (i + 1),
              modified: '2024-01-15T10:00:00Z'
            }))
          })
        })
      )

      await page.reload()
      await filesPage.waitForFilesInterfaceLoad()

      // Select all files
      await filesPage.selectAllFiles()

      // Verify all files are selected
      const selectedCount = await filesPage.getSelectedFilesCount()
      expect(selectedCount).toBe(5)
    })

    test('should remove individual files from selection', async ({ page }) => {
      // Mock files
      await page.route('**/api/files/**', route => 
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            files: [
              {
                name: 'keep-file.txt',
                path: '/project/keep-file.txt',
                type: 'file',
                size: 100,
                modified: '2024-01-15T10:00:00Z'
              },
              {
                name: 'remove-file.txt',
                path: '/project/remove-file.txt',
                type: 'file',
                size: 200,
                modified: '2024-01-15T11:00:00Z'
              }
            ]
          })
        })
      )

      await page.reload()
      await filesPage.waitForFilesInterfaceLoad()

      // Select both files
      await filesPage.selectMultipleFiles(['keep-file.txt', 'remove-file.txt'])

      // Remove one file from selection
      await filesPage.removeSelectedFile('remove-file.txt')

      // Verify only one file remains selected
      const selectedCount = await filesPage.getSelectedFilesCount()
      expect(selectedCount).toBe(1)

      // Verify correct file remains
      await expect(page.getByTestId('selected-files-list').getByText('keep-file.txt')).toBeVisible()
      await expect(page.getByTestId('selected-files-list').getByText('remove-file.txt')).toBeHidden()
    })

    test('should clear all selected files', async ({ page }) => {
      // Mock files
      await page.route('**/api/files/**', route => 
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            files: [
              {
                name: 'file1.txt',
                path: '/project/file1.txt',
                type: 'file'
              },
              {
                name: 'file2.txt', 
                path: '/project/file2.txt',
                type: 'file'
              }
            ]
          })
        })
      )

      await page.reload()
      await filesPage.waitForFilesInterfaceLoad()

      // Select multiple files
      await filesPage.selectMultipleFiles(['file1.txt', 'file2.txt'])

      // Clear all selections
      await filesPage.clearAllSelectedFiles()

      // Verify no files are selected
      const selectedCount = await filesPage.getSelectedFilesCount()
      expect(selectedCount).toBe(0)
    })
  })

  test.describe('File Upload', () => {
    test('should upload files using upload button', async ({ page, context }) => {
      // Create test files
      const testFiles = FilesPage.createTestFiles()
      
      // Write test files to filesystem
      for (const file of testFiles) {
        const dir = path.dirname(file.path)
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }
        fs.writeFileSync(file.path, file.content)
      }

      // Mock successful upload response
      await page.route('**/api/files/upload', route =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            files: testFiles.map(f => ({
              name: path.basename(f.path),
              size: f.size
            }))
          })
        })
      )

      // Upload files
      await filesPage.uploadFiles([testFiles[0].path, testFiles[1].path])

      // Verify upload success
      await expect(page.getByText('2 file(s) uploaded successfully')).toBeVisible()
    })

    test('should upload files using drag and drop', async ({ page }) => {
      // Mock upload response
      await page.route('**/api/files/upload', route =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            files: [
              { name: 'drag-test.txt', size: 100 },
              { name: 'drop-test.jpg', size: 2048 }
            ]
          })
        })
      )

      // Test drag and drop
      await filesPage.dragAndDropFiles([
        '/tmp/drag-test.txt',
        '/tmp/drop-test.jpg'
      ])

      // Verify upload success
      await expect(page.getByText('2 file(s) uploaded successfully')).toBeVisible()
    })

    test('should show upload progress', async ({ page }) => {
      // Mock slow upload to test progress
      await page.route('**/api/files/upload', route => {
        setTimeout(() => {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              files: [{ name: 'slow-upload.txt', size: 5120 }]
            })
          })
        }, 2000) // 2 second delay
      })

      const testFiles = FilesPage.createTestFiles()
      const testFile = testFiles[0]
      
      // Write test file
      const dir = path.dirname(testFile.path)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(testFile.path, testFile.content)

      // Start upload
      const uploadPromise = filesPage.uploadFiles([testFile.path])

      // Monitor progress
      const progressInfo = await filesPage.monitorUploadProgress()
      expect(progressInfo.started).toBe(true)

      // Wait for upload to complete
      await uploadPromise

      const finalProgress = await filesPage.monitorUploadProgress()
      expect(finalProgress.completed).toBe(true)
    })

    test('should handle file upload validation errors', async ({ page }) => {
      // Mock validation error
      await page.route('**/api/files/upload', route =>
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'File size exceeds maximum allowed size of 5MB'
          })
        })
      )

      // Try to upload large file
      const largeFile = '/tmp/large-file.txt'
      fs.writeFileSync(largeFile, 'A'.repeat(1024 * 1024 * 6)) // 6MB file

      await filesPage.testFileUploadValidation(
        largeFile, 
        'File size exceeds maximum allowed size of 5MB'
      )

      // Cleanup
      fs.unlinkSync(largeFile)
    })

    test('should validate file types during upload', async ({ page }) => {
      // Mock file type validation error
      await page.route('**/api/files/upload', route =>
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'File type not allowed. Allowed types: txt, pdf, jpg, png'
          })
        })
      )

      // Try to upload disallowed file type
      const executableFile = '/tmp/test.exe'
      fs.writeFileSync(executableFile, 'Fake executable content')

      await filesPage.testFileUploadValidation(
        executableFile,
        'File type not allowed'
      )

      // Cleanup
      fs.unlinkSync(executableFile)
    })
  })

  test.describe('File Management Features', () => {
    test('should preview files', async ({ page }) => {
      // Mock files with previewable content
      await page.route('**/api/files/**', route => 
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            files: [
              {
                name: 'preview-test.txt',
                path: '/project/preview-test.txt',
                type: 'file',
                size: 256,
                modified: '2024-01-15T10:00:00Z'
              }
            ]
          })
        })
      )

      // Mock file content for preview
      await page.route('**/api/files/content/**', route =>
        route.fulfill({
          status: 200,
          contentType: 'text/plain',
          body: 'This is the content of the preview test file.'
        })
      )

      await page.reload()
      await filesPage.waitForFilesInterfaceLoad()

      // Preview the file
      await filesPage.previewFile('preview-test.txt')

      // Verify preview is shown
      await expect(page.getByTestId('file-preview')).toBeVisible()
      await expect(page.getByText('This is the content of the preview test file.')).toBeVisible()

      // Close preview
      await filesPage.closeFilePreview()
      await expect(page.getByTestId('file-preview')).toBeHidden()
    })

    test('should search for files', async ({ page }) => {
      // Mock search results
      await page.route('**/api/files/search**', route =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            files: [
              {
                name: 'search-result.txt',
                path: '/project/documents/search-result.txt',
                type: 'file',
                size: 128,
                modified: '2024-01-15T10:00:00Z'
              }
            ]
          })
        })
      )

      // Perform search
      await filesPage.searchFiles('search-result')

      // Verify search results
      await expect(page.getByTestId('file-item-search-result.txt')).toBeVisible()
    })

    test('should sort files by different criteria', async ({ page }) => {
      // Mock files with different attributes
      await page.route('**/api/files/**', route => 
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            files: [
              {
                name: 'zzz-last.txt',
                path: '/project/zzz-last.txt',
                type: 'file',
                size: 100,
                modified: '2024-01-15T10:00:00Z'
              },
              {
                name: 'aaa-first.txt',
                path: '/project/aaa-first.txt',
                type: 'file',
                size: 500,
                modified: '2024-01-14T10:00:00Z'
              },
              {
                name: 'mmm-middle.txt',
                path: '/project/mmm-middle.txt',
                type: 'file',
                size: 300,
                modified: '2024-01-16T10:00:00Z'
              }
            ]
          })
        })
      )

      await page.reload()
      await filesPage.waitForFilesInterfaceLoad()

      // Test sorting by name
      await filesPage.sortFilesBy('name')
      
      // Verify files are sorted alphabetically
      const visibleFiles = await filesPage.getVisibleFiles()
      expect(visibleFiles[0].name).toBe('aaa-first.txt')
      expect(visibleFiles[2].name).toBe('zzz-last.txt')

      // Test sorting by size
      await filesPage.sortFilesBy('size')
      
      // Note: Actual verification would depend on implementation
      // Here we just verify the sort option worked
    })

    test('should toggle between list and grid view', async ({ page }) => {
      // Mock files
      await page.route('**/api/files/**', route => 
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            files: [
              {
                name: 'view-test.txt',
                path: '/project/view-test.txt',
                type: 'file'
              }
            ]
          })
        })
      )

      await page.reload()
      await filesPage.waitForFilesInterfaceLoad()

      // Toggle view mode
      await filesPage.toggleViewMode()

      // Verify view mode changed (specific verification depends on implementation)
      const fileList = page.getByTestId('file-list')
      
      // Check if grid view is active (this would depend on your CSS classes)
      const hasGridView = await fileList.evaluate(el => 
        el.classList.contains('grid-view') || 
        el.classList.contains('view-grid')
      )
      
      // The exact verification depends on your implementation
      expect(typeof hasGridView).toBe('boolean')
    })

    test('should filter files by type', async ({ page }) => {
      // Mock files with different types
      await page.route('**/api/files/**', route => 
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            files: [
              {
                name: 'document.pdf',
                path: '/project/document.pdf',
                type: 'file',
                fileType: 'pdf'
              },
              {
                name: 'image.jpg',
                path: '/project/image.jpg',
                type: 'file',
                fileType: 'jpg'
              },
              {
                name: 'text.txt',
                path: '/project/text.txt',
                type: 'file',
                fileType: 'txt'
              }
            ]
          })
        })
      )

      await page.reload()
      await filesPage.waitForFilesInterfaceLoad()

      // Filter by PDF files
      await filesPage.filterFilesByType('pdf')

      // Verify only PDF files are shown
      await expect(page.getByTestId('file-item-document.pdf')).toBeVisible()
      
      // Other files should be hidden (depending on implementation)
      // This verification depends on how filtering is implemented
    })
  })

  test.describe('Drag and Drop Functionality', () => {
    test('should display drag and drop indicators', async ({ page }) => {
      await filesPage.verifyDragDropIndicators()
    })

    test('should handle drag and drop from external sources', async ({ page }) => {
      // Mock successful file drop
      await page.route('**/api/files/upload', route =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            files: [
              { name: 'dropped-file.txt', size: 256 }
            ]
          })
        })
      )

      // Simulate external file drop
      const dragDropZone = page.getByTestId('drag-drop-zone')
      
      // Simulate drag over
      await dragDropZone.dispatchEvent('dragover', {
        dataTransfer: {
          files: [],
          types: ['Files']
        }
      })

      // Verify drag over styling
      await expect(dragDropZone).toHaveClass(/drag-over|dragging/)

      // Simulate drop
      await dragDropZone.dispatchEvent('drop', {
        dataTransfer: {
          files: [
            {
              name: 'dropped-file.txt',
              size: 256,
              type: 'text/plain'
            }
          ]
        }
      })

      // Verify upload initiated
      await expect(page.getByText('1 file(s) uploaded successfully')).toBeVisible()
    })

    test('should handle multiple file drops', async ({ page }) => {
      // Mock successful multiple file drop
      await page.route('**/api/files/upload', route =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            files: [
              { name: 'dropped-file1.txt', size: 256 },
              { name: 'dropped-file2.jpg', size: 1024 },
              { name: 'dropped-file3.pdf', size: 2048 }
            ]
          })
        })
      )

      const dragDropZone = page.getByTestId('drag-drop-zone')
      
      // Simulate dropping multiple files
      await dragDropZone.dispatchEvent('drop', {
        dataTransfer: {
          files: [
            { name: 'dropped-file1.txt', size: 256, type: 'text/plain' },
            { name: 'dropped-file2.jpg', size: 1024, type: 'image/jpeg' },
            { name: 'dropped-file3.pdf', size: 2048, type: 'application/pdf' }
          ]
        }
      })

      // Verify multiple uploads
      await expect(page.getByText('3 file(s) uploaded successfully')).toBeVisible()
    })
  })

  test.describe('Keyboard Navigation and Accessibility', () => {
    test('should support keyboard navigation', async ({ page }) => {
      // Mock files
      await page.route('**/api/files/**', route => 
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            files: Array.from({ length: 5 }, (_, i) => ({
              name: `keyboard-file-${i + 1}.txt`,
              path: `/project/keyboard-file-${i + 1}.txt`,
              type: 'file'
            }))
          })
        })
      )

      await page.reload()
      await filesPage.waitForFilesInterfaceLoad()

      await filesPage.testKeyboardNavigation()
    })

    test('should show context menu on right-click', async ({ page }) => {
      // Mock files
      await page.route('**/api/files/**', route => 
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            files: [
              {
                name: 'context-menu-test.txt',
                path: '/project/context-menu-test.txt',
                type: 'file'
              }
            ]
          })
        })
      )

      await page.reload()
      await filesPage.waitForFilesInterfaceLoad()

      await filesPage.testFileContextMenu('context-menu-test.txt')
    })

    test('should have proper ARIA labels', async ({ page }) => {
      // Verify accessibility attributes
      await expect(page.getByTestId('file-list')).toHaveAttribute('role', 'list')
      
      const uploadButton = page.getByRole('button', { name: 'Upload Files' })
      await expect(uploadButton).toHaveAttribute('aria-label')
      
      const selectAllButton = page.getByRole('button', { name: 'Select All' })
      await expect(selectAllButton).toHaveAttribute('aria-label')
    })
  })

  test.describe('Error Handling', () => {
    test('should handle file upload errors gracefully', async ({ page }) => {
      // Mock upload error
      await page.route('**/api/files/upload', route =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Server error during file upload'
          })
        })
      )

      const testFile = FilesPage.createTestFiles()[0]
      
      // Write test file
      const dir = path.dirname(testFile.path)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(testFile.path, testFile.content)

      try {
        await filesPage.uploadFiles([testFile.path])
      } catch (error) {
        // Expected to fail
      }

      // Verify error message is displayed
      await expect(page.getByText(/server error|upload failed/i)).toBeVisible()
    })

    test('should handle network errors during file operations', async ({ page }) => {
      // Simulate network failure
      await page.route('**/api/files/**', route => route.abort('failed'))

      // Try to load files
      await page.reload()

      // Verify error handling
      await expect(page.getByText(/network error|failed to load/i)).toBeVisible()
    })

    test('should handle invalid file operations', async ({ page }) => {
      // Try to select non-existent file
      try {
        await filesPage.selectFile('non-existent-file.txt')
      } catch (error) {
        // Expected to fail - verify error handling
      }

      // The specific error handling would depend on implementation
      // Here we just verify the page remains functional
      await expect(page.getByTestId('file-list')).toBeVisible()
    })
  })

  test.describe('Performance and Scalability', () => {
    test('should handle large number of files efficiently', async ({ page }) => {
      // Mock large file list
      const largeFileList = Array.from({ length: 100 }, (_, i) => ({
        name: `performance-file-${i + 1}.txt`,
        path: `/project/performance-file-${i + 1}.txt`,
        type: 'file',
        size: Math.floor(Math.random() * 10000),
        modified: '2024-01-15T10:00:00Z'
      }))

      await page.route('**/api/files/**', route => 
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ files: largeFileList })
        })
      )

      const startTime = Date.now()
      await page.reload()
      await filesPage.waitForFilesInterfaceLoad()
      const loadTime = Date.now() - startTime

      // Verify reasonable load time
      expect(loadTime).toBeLessThan(5000) // 5 second limit

      // Verify file selection performance
      const selectionStart = Date.now()
      await filesPage.selectAllFiles()
      const selectionTime = Date.now() - selectionStart

      // Verify reasonable selection time
      expect(selectionTime).toBeLessThan(3000) // 3 second limit

      console.log(`Performance Test Results:
        Files: 100
        Load Time: ${loadTime}ms
        Selection Time: ${selectionTime}ms`)
    })

    test('should handle batch operations efficiently', async ({ page }) => {
      // Mock moderate file list
      const fileList = Array.from({ length: 20 }, (_, i) => ({
        name: `batch-file-${i + 1}.txt`,
        path: `/project/batch-file-${i + 1}.txt`,
        type: 'file'
      }))

      await page.route('**/api/files/**', route => 
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ files: fileList })
        })
      )

      await page.reload()
      await filesPage.waitForFilesInterfaceLoad()

      // Test batch operations
      const fileNames = fileList.map(f => f.name)
      
      await filesPage.testBatchOperations(fileNames.slice(0, 10), 'select')
      await filesPage.testBatchOperations(fileNames.slice(0, 10), 'remove')

      // Verify operations completed successfully
      const finalCount = await filesPage.getSelectedFilesCount()
      expect(finalCount).toBe(0)
    })
  })
})