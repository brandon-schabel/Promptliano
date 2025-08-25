import { type Page, type Locator, expect } from '@playwright/test'
import { BasePage } from './base.page'

export interface FileItem {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  modified?: Date
  selected?: boolean
}

export interface UploadFile {
  path: string
  name: string
  size: number
  type: string
}

export class FilesPage extends BasePage {
  private readonly fileExplorer: Locator
  private readonly fileList: Locator
  private readonly selectedFilesPanel: Locator
  private readonly fileUploadArea: Locator
  private readonly fileUploadButton: Locator
  private readonly fileUploadInput: Locator
  private readonly dragDropZone: Locator
  private readonly selectedFilesList: Locator
  private readonly removeFileButton: Locator
  private readonly clearAllButton: Locator
  private readonly selectAllButton: Locator
  private readonly filePreview: Locator
  private readonly uploadProgress: Locator
  private readonly fileSearch: Locator
  private readonly sortBySelect: Locator
  private readonly viewModeToggle: Locator
  private readonly fileSizeLimit: Locator
  private readonly fileTypeFilter: Locator

  constructor(page: Page) {
    super(page)
    this.fileExplorer = page.getByTestId('file-explorer')
    this.fileList = page.getByTestId('file-list')
    this.selectedFilesPanel = page.getByTestId('selected-files-panel')
    this.fileUploadArea = page.getByTestId('file-upload-area')
    this.fileUploadButton = page.getByRole('button', { name: 'Upload Files' })
    this.fileUploadInput = page.locator('input[type="file"]')
    this.dragDropZone = page.getByTestId('drag-drop-zone')
    this.selectedFilesList = page.getByTestId('selected-files-list')
    this.removeFileButton = page.getByRole('button', { name: 'Remove' })
    this.clearAllButton = page.getByRole('button', { name: 'Clear All' })
    this.selectAllButton = page.getByRole('button', { name: 'Select All' })
    this.filePreview = page.getByTestId('file-preview')
    this.uploadProgress = page.getByTestId('upload-progress')
    this.fileSearch = page.getByTestId('file-search')
    this.sortBySelect = page.getByRole('combobox', { name: 'Sort by' })
    this.viewModeToggle = page.getByTestId('view-mode-toggle')
    this.fileSizeLimit = page.getByTestId('file-size-limit')
    this.fileTypeFilter = page.getByTestId('file-type-filter')
  }

  /**
   * Navigate to file management interface
   */
  async goto() {
    await super.goto('/files')
  }

  /**
   * Navigate to files section within a project or context
   */
  async navigateToFiles() {
    const filesTab = this.page.getByRole('tab', { name: 'Files' })
    await filesTab.click()
    await this.waitForFilesInterfaceLoad()
  }

  /**
   * Wait for file management interface to load
   */
  async waitForFilesInterfaceLoad(): Promise<void> {
    await expect(this.fileExplorer).toBeVisible()
    await expect(this.selectedFilesPanel).toBeVisible()
    await this.page.waitForTimeout(500)
  }

  /**
   * Select a single file
   */
  async selectFile(fileName: string): Promise<void> {
    const fileItem = this.fileList.getByTestId(`file-item-${fileName}`)
    await fileItem.click()

    // Verify file is selected (visual indicator)
    await expect(fileItem).toHaveClass(/selected|active/)

    // Verify file appears in selected files panel
    await expect(this.selectedFilesList.getByText(fileName)).toBeVisible()
  }

  /**
   * Select multiple files using Ctrl+Click
   */
  async selectMultipleFiles(fileNames: string[]): Promise<void> {
    for (const fileName of fileNames) {
      const fileItem = this.fileList.getByTestId(`file-item-${fileName}`)
      
      if (fileName === fileNames[0]) {
        // First file - regular click
        await fileItem.click()
      } else {
        // Additional files - Ctrl+Click
        await fileItem.click({ modifiers: ['Control'] })
      }

      // Verify file is selected
      await expect(fileItem).toHaveClass(/selected|active/)
    }

    // Verify all files appear in selected files panel
    for (const fileName of fileNames) {
      await expect(this.selectedFilesList.getByText(fileName)).toBeVisible()
    }

    // Verify selection count
    const selectionCount = await this.getSelectedFilesCount()
    expect(selectionCount).toBe(fileNames.length)
  }

  /**
   * Select all files using Select All button
   */
  async selectAllFiles(): Promise<void> {
    await this.selectAllButton.click()

    // Verify all files are selected
    const allFileItems = await this.fileList.getByTestId(/file-item-/).all()
    for (const fileItem of allFileItems) {
      await expect(fileItem).toHaveClass(/selected|active/)
    }
  }

  /**
   * Upload files using the upload button
   */
  async uploadFiles(filePaths: string[]): Promise<void> {
    // Use file chooser to select files
    const fileChooserPromise = this.page.waitForEvent('filechooser')
    await this.fileUploadButton.click()
    
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(filePaths)

    // Wait for upload to complete
    await this.waitForUploadCompletion(filePaths.length)
  }

  /**
   * Upload files using drag and drop
   */
  async dragAndDropFiles(filePaths: string[]): Promise<void> {
    // Create file objects for drag and drop
    const files = filePaths.map(path => ({
      name: path.split('/').pop() || '',
      type: this.getMimeType(path),
      content: 'Mock file content for testing'
    }))

    // Simulate drag and drop
    await this.dragDropZone.dispatchEvent('drop', {
      dataTransfer: {
        files: files,
        types: ['Files']
      }
    })

    // Wait for upload to complete
    await this.waitForUploadCompletion(filePaths.length)
  }

  /**
   * Wait for file upload to complete
   */
  async waitForUploadCompletion(fileCount: number, timeout: number = 30000): Promise<void> {
    // Wait for upload progress to appear
    await expect(this.uploadProgress).toBeVisible({ timeout: 5000 })

    // Wait for upload to complete
    await expect(this.uploadProgress).toBeHidden({ timeout })

    // Wait for files to appear in the list
    await this.page.waitForTimeout(1000)

    // Verify success message
    await expect(this.page.getByText(`${fileCount} file(s) uploaded successfully`)).toBeVisible()
  }

  /**
   * Remove a specific file from selection
   */
  async removeSelectedFile(fileName: string): Promise<void> {
    const selectedFileItem = this.selectedFilesList.getByTestId(`selected-file-${fileName}`)
    const removeButton = selectedFileItem.getByRole('button', { name: 'Remove' })
    
    await removeButton.click()

    // Verify file is removed from selection
    await expect(selectedFileItem).toBeHidden()

    // Verify file is deselected in main list
    const mainFileItem = this.fileList.getByTestId(`file-item-${fileName}`)
    await expect(mainFileItem).not.toHaveClass(/selected|active/)
  }

  /**
   * Clear all selected files
   */
  async clearAllSelectedFiles(): Promise<void> {
    await this.clearAllButton.click()

    // Verify selected files panel is empty
    const selectedItems = await this.selectedFilesList.getByTestId(/selected-file-/).all()
    expect(selectedItems).toHaveLength(0)

    // Verify no files are selected in main list
    const selectedFileItems = await this.fileList.locator('.selected, .active').all()
    expect(selectedFileItems).toHaveLength(0)
  }

  /**
   * Get count of selected files
   */
  async getSelectedFilesCount(): Promise<number> {
    const selectedItems = await this.selectedFilesList.getByTestId(/selected-file-/).all()
    return selectedItems.length
  }

  /**
   * Preview a file
   */
  async previewFile(fileName: string): Promise<void> {
    const fileItem = this.fileList.getByTestId(`file-item-${fileName}`)
    const previewButton = fileItem.getByRole('button', { name: 'Preview' })
    
    await previewButton.click()

    // Verify preview opens
    await expect(this.filePreview).toBeVisible()
    await expect(this.filePreview.getByText(fileName)).toBeVisible()
  }

  /**
   * Close file preview
   */
  async closeFilePreview(): Promise<void> {
    const closeButton = this.filePreview.getByRole('button', { name: 'Close' })
    await closeButton.click()

    await expect(this.filePreview).toBeHidden()
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileName: string): Promise<{
    name: string
    size: string
    type: string
    modified: string
  }> {
    const fileItem = this.fileList.getByTestId(`file-item-${fileName}`)
    
    const name = await fileItem.getByTestId('file-name').textContent() || ''
    const size = await fileItem.getByTestId('file-size').textContent() || ''
    const type = await fileItem.getByTestId('file-type').textContent() || ''
    const modified = await fileItem.getByTestId('file-modified').textContent() || ''

    return { name, size, type, modified }
  }

  /**
   * Search for files
   */
  async searchFiles(searchTerm: string): Promise<void> {
    await this.fileSearch.fill(searchTerm)
    await this.fileSearch.press('Enter')

    // Wait for search results
    await this.page.waitForTimeout(1000)
  }

  /**
   * Sort files by different criteria
   */
  async sortFilesBy(sortBy: 'name' | 'size' | 'type' | 'modified'): Promise<void> {
    await this.sortBySelect.selectOption(sortBy)

    // Wait for sorting to apply
    await this.page.waitForTimeout(500)
  }

  /**
   * Toggle between list and grid view
   */
  async toggleViewMode(): Promise<void> {
    await this.viewModeToggle.click()

    // Wait for view change
    await this.page.waitForTimeout(300)
  }

  /**
   * Filter files by type
   */
  async filterFilesByType(fileType: string): Promise<void> {
    await this.fileTypeFilter.selectOption(fileType)

    // Wait for filter to apply
    await this.page.waitForTimeout(500)
  }

  /**
   * Get list of all visible files
   */
  async getVisibleFiles(): Promise<FileItem[]> {
    const fileItems = await this.fileList.getByTestId(/file-item-/).all()
    const files: FileItem[] = []

    for (const item of fileItems) {
      const name = await item.getByTestId('file-name').textContent() || ''
      const path = await item.getAttribute('data-file-path') || ''
      const type = (await item.getAttribute('data-file-type')) as 'file' | 'directory'
      const selected = await item.classList.then(classes => 
        classes.includes('selected') || classes.includes('active')
      )

      files.push({ name, path, type, selected })
    }

    return files
  }

  /**
   * Test file upload validation
   */
  async testFileUploadValidation(filePath: string, expectedError: string): Promise<void> {
    try {
      await this.uploadFiles([filePath])
    } catch (error) {
      // Expected to fail
    }

    // Verify validation error message
    await expect(this.page.getByText(expectedError)).toBeVisible()
  }

  /**
   * Test file size limits
   */
  async testFileSizeLimit(): Promise<void> {
    // Get the current size limit
    const sizeLimitText = await this.fileSizeLimit.textContent()
    const sizeLimit = this.parseSizeLimit(sizeLimitText || '')

    console.log(`File size limit: ${sizeLimit} bytes`)

    // This would require creating a test file larger than the limit
    // In a real implementation, you would create or use a large test file
  }

  /**
   * Verify drag and drop indicators
   */
  async verifyDragDropIndicators(): Promise<void> {
    // Verify drag drop zone is visible
    await expect(this.dragDropZone).toBeVisible()

    // Verify drag drop zone has proper styling
    await expect(this.dragDropZone).toHaveAttribute('data-accepts-files', 'true')

    // Test drag over effect (if implemented)
    await this.dragDropZone.dispatchEvent('dragover')
    await expect(this.dragDropZone).toHaveClass(/drag-over|dragging/)

    await this.dragDropZone.dispatchEvent('dragleave')
    await expect(this.dragDropZone).not.toHaveClass(/drag-over|dragging/)
  }

  /**
   * Test keyboard navigation
   */
  async testKeyboardNavigation(): Promise<void> {
    // Focus on first file
    await this.page.keyboard.press('Tab')
    
    const firstFile = this.fileList.getByTestId(/file-item-/).first()
    await expect(firstFile).toBeFocused()

    // Navigate with arrow keys
    await this.page.keyboard.press('ArrowDown')
    
    const secondFile = this.fileList.getByTestId(/file-item-/).nth(1)
    await expect(secondFile).toBeFocused()

    // Select with Space key
    await this.page.keyboard.press('Space')
    await expect(secondFile).toHaveClass(/selected|active/)

    // Multi-select with Ctrl+Space
    await this.page.keyboard.press('ArrowDown')
    await this.page.keyboard.press('Control+Space')
    
    const thirdFile = this.fileList.getByTestId(/file-item-/).nth(2)
    await expect(thirdFile).toHaveClass(/selected|active/)
  }

  /**
   * Test file operations context menu
   */
  async testFileContextMenu(fileName: string): Promise<void> {
    const fileItem = this.fileList.getByTestId(`file-item-${fileName}`)
    
    // Right-click to open context menu
    await fileItem.click({ button: 'right' })

    // Verify context menu appears
    const contextMenu = this.page.getByTestId('file-context-menu')
    await expect(contextMenu).toBeVisible()

    // Verify menu options
    await expect(contextMenu.getByText('Select')).toBeVisible()
    await expect(contextMenu.getByText('Preview')).toBeVisible()
    await expect(contextMenu.getByText('Copy Path')).toBeVisible()

    // Close context menu
    await this.page.keyboard.press('Escape')
    await expect(contextMenu).toBeHidden()
  }

  /**
   * Monitor upload progress
   */
  async monitorUploadProgress(): Promise<{
    started: boolean
    completed: boolean
    progress: number
    speed: string
  }> {
    const progressBar = this.uploadProgress.getByRole('progressbar')
    
    const started = await this.uploadProgress.isVisible()
    const progress = started ? parseInt(await progressBar.getAttribute('aria-valuenow') || '0') : 0
    const speed = started ? await this.uploadProgress.getByTestId('upload-speed').textContent() || '' : ''
    const completed = progress === 100

    return { started, completed, progress, speed }
  }

  /**
   * Test batch file operations
   */
  async testBatchOperations(fileNames: string[], operation: 'select' | 'remove'): Promise<void> {
    // First select all files
    await this.selectMultipleFiles(fileNames)

    switch (operation) {
      case 'select':
        // Verify all are selected
        const selectedCount = await this.getSelectedFilesCount()
        expect(selectedCount).toBe(fileNames.length)
        break

      case 'remove':
        // Remove all selected files
        await this.clearAllSelectedFiles()
        
        // Verify none are selected
        const remainingCount = await this.getSelectedFilesCount()
        expect(remainingCount).toBe(0)
        break
    }
  }

  /**
   * Utility method to determine MIME type from file extension
   */
  private getMimeType(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase()
    
    switch (extension) {
      case 'txt': return 'text/plain'
      case 'pdf': return 'application/pdf'
      case 'jpg': case 'jpeg': return 'image/jpeg'
      case 'png': return 'image/png'
      case 'gif': return 'image/gif'
      case 'json': return 'application/json'
      case 'js': return 'application/javascript'
      case 'css': return 'text/css'
      case 'html': return 'text/html'
      default: return 'application/octet-stream'
    }
  }

  /**
   * Parse size limit string to bytes
   */
  private parseSizeLimit(sizeLimitText: string): number {
    const match = sizeLimitText.match(/(\d+)\s*(KB|MB|GB)/i)
    if (!match) return 0

    const value = parseInt(match[1])
    const unit = match[2].toUpperCase()

    switch (unit) {
      case 'KB': return value * 1024
      case 'MB': return value * 1024 * 1024
      case 'GB': return value * 1024 * 1024 * 1024
      default: return value
    }
  }

  /**
   * Create test files for upload testing
   */
  static createTestFiles(): { path: string; content: string; size: number }[] {
    return [
      {
        path: '/tmp/test-file-1.txt',
        content: 'This is a test file for upload testing.',
        size: 40
      },
      {
        path: '/tmp/test-file-2.json',
        content: '{"test": "data", "purpose": "file upload testing"}',
        size: 55
      },
      {
        path: '/tmp/large-test-file.txt',
        content: 'A'.repeat(1024 * 10), // 10KB file
        size: 1024 * 10
      }
    ]
  }
}