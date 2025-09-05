/**
 * FileTreePage - Dedicated page object for File Tree functionality
 * Covers file selection, folder operations, context menus, and Git integration
 */

import { type Page, type Locator, expect } from '@playwright/test'
import { BasePage } from './base.page'

export interface FileNodeInfo {
  name: string
  path: string
  type: 'file' | 'folder'
  selected?: boolean
  gitStatus?: 'modified' | 'staged' | 'untracked' | 'deleted' | 'conflicted'
  size?: number
  tokenCount?: number
  lastModified?: string
}

export interface ContextMenuOptions {
  // File operations
  copyRelativePath?: boolean
  copyAbsolutePath?: boolean
  copyFileContents?: boolean
  openInEditor?: boolean
  
  // Folder operations
  copyFolderContents?: boolean
  copyFolderSummaries?: boolean
  copyFolderTree?: boolean
  
  // Git operations
  stageFile?: boolean
  unstageFile?: boolean
  copyPreviousVersion?: boolean
  copyDiff?: boolean
}

export class FileTreePage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  // ========================================
  // MAIN FILE TREE ELEMENTS
  // ========================================

  get fileTreeContainer() {
    return this.page.getByTestId('file-tree-container')
  }

  get fileTree() {
    return this.page.getByTestId('file-tree')
  }

  get fileTreeLoading() {
    return this.page.getByTestId('file-tree-loading')
  }

  get fileTreeEmpty() {
    return this.page.getByTestId('file-tree-empty')
  }

  get fileTreeError() {
    return this.page.getByTestId('file-tree-error')
  }

  get refreshTreeButton() {
    return this.page.getByTestId('refresh-tree-button')
  }

  get expandAllButton() {
    return this.page.getByTestId('expand-all-button')
  }

  get collapseAllButton() {
    return this.page.getByTestId('collapse-all-button')
  }

  get selectAllFilesCheckbox() {
    return this.page.getByTestId('select-all-files-checkbox')
  }

  // ========================================
  // FILE AND FOLDER NODE ELEMENTS
  // ========================================

  get fileNodes() {
    return this.fileTree.getByTestId('file-node')
  }

  get folderNodes() {
    return this.fileTree.getByTestId('folder-node')
  }

  /**
   * Get specific file node by name
   */
  fileNode(fileName: string): Locator {
    return this.fileNodes.filter({ hasText: fileName }).first()
  }

  /**
   * Get specific folder node by name
   */
  folderNode(folderName: string): Locator {
    return this.folderNodes.filter({ hasText: folderName }).first()
  }

  /**
   * Get file/folder node by path
   */
  nodeByPath(path: string): Locator {
    return this.page.getByTestId('tree-node').filter({ has: this.page.locator(`[data-path="${path}"]`) })
  }

  /**
   * Get checkbox for a file node
   */
  fileCheckbox(nodeLocator: Locator): Locator {
    return nodeLocator.getByTestId('file-checkbox')
  }

  /**
   * Get folder expand/collapse toggle
   */
  folderToggle(nodeLocator: Locator): Locator {
    return nodeLocator.getByTestId('folder-toggle')
  }

  /**
   * Get git status indicator for a node
   */
  gitStatusIndicator(nodeLocator: Locator): Locator {
    return nodeLocator.getByTestId('git-status-indicator')
  }

  /**
   * Get token count display for a file
   */
  fileTokenCount(nodeLocator: Locator): Locator {
    return nodeLocator.getByTestId('file-token-count')
  }

  /**
   * Get file size display
   */
  fileSize(nodeLocator: Locator): Locator {
    return nodeLocator.getByTestId('file-size')
  }

  // ========================================
  // CONTEXT MENU ELEMENTS
  // ========================================

  get fileContextMenu() {
    return this.page.getByTestId('file-context-menu')
  }

  get folderContextMenu() {
    return this.page.getByTestId('folder-context-menu')
  }

  // File context menu items
  get menuCopyRelativePath() {
    return this.fileContextMenu.getByRole('menuitem', { name: /copy relative path/i })
  }

  get menuCopyAbsolutePath() {
    return this.fileContextMenu.getByRole('menuitem', { name: /copy absolute path/i })
  }

  get menuOpenInEditor() {
    return this.fileContextMenu.getByRole('menuitem', { name: /open in editor/i })
  }

  get menuCopyFileContents() {
    return this.fileContextMenu.getByRole('menuitem', { name: /copy file contents/i })
  }

  // Git-specific file menu items
  get menuStageFile() {
    return this.fileContextMenu.getByRole('menuitem', { name: /stage file/i })
  }

  get menuUnstageFile() {
    return this.fileContextMenu.getByRole('menuitem', { name: /unstage file/i })
  }

  get menuCopyPreviousVersion() {
    return this.fileContextMenu.getByRole('menuitem', { name: /copy previous version/i })
  }

  get menuCopyDiff() {
    return this.fileContextMenu.getByRole('menuitem', { name: /copy diff/i })
  }

  // Folder context menu items
  get menuCopyFolderContents() {
    return this.folderContextMenu.getByRole('menuitem', { name: /copy folder contents/i })
  }

  get menuCopyFolderSummaries() {
    return this.folderContextMenu.getByRole('menuitem', { name: /copy folder summaries/i })
  }

  get menuCopyFolderTree() {
    return this.folderContextMenu.getByRole('menuitem', { name: /copy folder tree/i })
  }

  // ========================================
  // SELECTED FILES SECTION
  // ========================================

  get selectedFilesSection() {
    return this.page.getByTestId('selected-files-section')
  }

  get selectedFilesList() {
    return this.selectedFilesSection.getByTestId('selected-files-list')
  }

  get selectedFileItems() {
    return this.selectedFilesList.getByTestId('selected-file-item')
  }

  get selectedFilesTokenCount() {
    return this.selectedFilesSection.getByTestId('selected-files-token-count')
  }

  get clearSelectedFilesButton() {
    return this.selectedFilesSection.getByTestId('clear-selected-files')
  }

  // ========================================
  // BASIC NAVIGATION AND SETUP
  // ========================================

  /**
   * Wait for file tree to load
   */
  async waitForFileTreeLoad() {
    await expect(this.fileTreeLoading).toBeHidden({ timeout: 15000 })
    await expect(this.fileTree).toBeVisible()
  }

  /**
   * Refresh the file tree
   */
  async refreshFileTree() {
    await this.refreshTreeButton.click()
    await this.waitForFileTreeLoad()
  }

  /**
   * Get total number of visible files
   */
  async getVisibleFileCount(): Promise<number> {
    await this.waitForFileTreeLoad()
    return await this.fileNodes.count()
  }

  /**
   * Get total number of visible folders
   */
  async getVisibleFolderCount(): Promise<number> {
    await this.waitForFileTreeLoad()
    return await this.folderNodes.count()
  }

  // ========================================
  // FILE SELECTION METHODS
  // ========================================

  /**
   * Select/unselect a file by clicking its checkbox
   */
  async toggleFileSelection(fileName: string) {
    const fileNode = this.fileNode(fileName)
    await expect(fileNode).toBeVisible()
    
    const checkbox = this.fileCheckbox(fileNode)
    await checkbox.click()
    
    // Wait for selection state to update
    await this.page.waitForTimeout(200)
  }

  /**
   * Select multiple files at once
   */
  async selectMultipleFiles(fileNames: string[]) {
    for (const fileName of fileNames) {
      const fileNode = this.fileNode(fileName)
      const checkbox = this.fileCheckbox(fileNode)
      
      const isChecked = await checkbox.isChecked()
      if (!isChecked) {
        await this.toggleFileSelection(fileName)
      }
    }
  }

  /**
   * Unselect multiple files at once
   */
  async unselectMultipleFiles(fileNames: string[]) {
    for (const fileName of fileNames) {
      const fileNode = this.fileNode(fileName)
      const checkbox = this.fileCheckbox(fileNode)
      
      const isChecked = await checkbox.isChecked()
      if (isChecked) {
        await this.toggleFileSelection(fileName)
      }
    }
  }

  /**
   * Select all files using the select all checkbox
   */
  async selectAllFiles() {
    await this.selectAllFilesCheckbox.click()
    await this.page.waitForTimeout(500) // Wait for bulk selection
  }

  /**
   * Clear all selected files
   */
  async clearAllSelectedFiles() {
    await this.clearSelectedFilesButton.click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Check if a file is selected
   */
  async isFileSelected(fileName: string): Promise<boolean> {
    const fileNode = this.fileNode(fileName)
    const checkbox = this.fileCheckbox(fileNode)
    return await checkbox.isChecked()
  }

  /**
   * Get list of all selected files
   */
  async getSelectedFilesList(): Promise<string[]> {
    const selectedItems = await this.selectedFileItems.all()
    const files: string[] = []

    for (const item of selectedItems) {
      const fileName = await item.getByTestId('selected-file-name').textContent()
      if (fileName) files.push(fileName.trim())
    }

    return files
  }

  /**
   * Get selected files count
   */
  async getSelectedFilesCount(): Promise<number> {
    return await this.selectedFileItems.count()
  }

  // ========================================
  // FOLDER OPERATIONS
  // ========================================

  /**
   * Expand a folder
   */
  async expandFolder(folderName: string) {
    const folderNode = this.folderNode(folderName)
    await expect(folderNode).toBeVisible()
    
    const toggle = this.folderToggle(folderNode)
    const isExpanded = await folderNode.getAttribute('aria-expanded') === 'true'
    
    if (!isExpanded) {
      await toggle.click()
      await this.page.waitForTimeout(300)
    }
  }

  /**
   * Collapse a folder
   */
  async collapseFolder(folderName: string) {
    const folderNode = this.folderNode(folderName)
    await expect(folderNode).toBeVisible()
    
    const toggle = this.folderToggle(folderNode)
    const isExpanded = await folderNode.getAttribute('aria-expanded') === 'true'
    
    if (isExpanded) {
      await toggle.click()
      await this.page.waitForTimeout(300)
    }
  }

  /**
   * Toggle folder expand/collapse state
   */
  async toggleFolder(folderName: string) {
    const folderNode = this.folderNode(folderName)
    const toggle = this.folderToggle(folderNode)
    await toggle.click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Select all files in a folder by clicking folder checkbox
   */
  async selectFolderContents(folderName: string) {
    const folderNode = this.folderNode(folderName)
    const checkbox = this.fileCheckbox(folderNode) // Folders can have checkboxes too
    
    if (await checkbox.isVisible()) {
      await checkbox.click()
      await this.page.waitForTimeout(500) // Wait for bulk selection
    }
  }

  /**
   * Expand all folders
   */
  async expandAllFolders() {
    await this.expandAllButton.click()
    await this.page.waitForTimeout(1000) // Wait for expansion to complete
  }

  /**
   * Collapse all folders
   */
  async collapseAllFolders() {
    await this.collapseAllButton.click()
    await this.page.waitForTimeout(500)
  }

  // ========================================
  // CONTEXT MENU OPERATIONS
  // ========================================

  /**
   * Right-click on a file to open context menu
   */
  async rightClickFile(fileName: string) {
    const fileNode = this.fileNode(fileName)
    await expect(fileNode).toBeVisible()
    
    await fileNode.click({ button: 'right' })
    await expect(this.fileContextMenu).toBeVisible()
  }

  /**
   * Right-click on a folder to open context menu
   */
  async rightClickFolder(folderName: string) {
    const folderNode = this.folderNode(folderName)
    await expect(folderNode).toBeVisible()
    
    await folderNode.click({ button: 'right' })
    await expect(this.folderContextMenu).toBeVisible()
  }

  /**
   * Close any open context menu
   */
  async closeContextMenu() {
    await this.page.keyboard.press('Escape')
    await expect(this.fileContextMenu).toBeHidden()
    await expect(this.folderContextMenu).toBeHidden()
  }

  // ========================================
  // FILE CONTEXT MENU ACTIONS
  // ========================================

  /**
   * Copy file relative path
   */
  async copyFileRelativePath(fileName: string) {
    await this.rightClickFile(fileName)
    await this.menuCopyRelativePath.click()
    await this.waitForToast(/relative path.*copied/i)
    await expect(this.fileContextMenu).toBeHidden()
  }

  /**
   * Copy file absolute path
   */
  async copyFileAbsolutePath(fileName: string) {
    await this.rightClickFile(fileName)
    await this.menuCopyAbsolutePath.click()
    await this.waitForToast(/absolute path.*copied/i)
    await expect(this.fileContextMenu).toBeHidden()
  }

  /**
   * Open file in editor
   */
  async openFileInEditor(fileName: string) {
    await this.rightClickFile(fileName)
    await this.menuOpenInEditor.click()
    
    // Wait for editor modal/dialog to open
    const editorDialog = this.page.getByTestId('file-editor-dialog')
    await expect(editorDialog).toBeVisible({ timeout: 5000 })
    await expect(this.fileContextMenu).toBeHidden()
  }

  /**
   * Copy file contents
   */
  async copyFileContents(fileName: string) {
    await this.rightClickFile(fileName)
    await this.menuCopyFileContents.click()
    await this.waitForToast(/file contents.*copied/i)
    await expect(this.fileContextMenu).toBeHidden()
  }

  // ========================================
  // FOLDER CONTEXT MENU ACTIONS
  // ========================================

  /**
   * Copy folder contents
   */
  async copyFolderContents(folderName: string) {
    await this.rightClickFolder(folderName)
    await this.menuCopyFolderContents.click()
    await this.waitForToast(/folder contents.*copied/i)
    await expect(this.folderContextMenu).toBeHidden()
  }

  /**
   * Copy folder summaries
   */
  async copyFolderSummaries(folderName: string) {
    await this.rightClickFolder(folderName)
    await this.menuCopyFolderSummaries.click()
    await this.waitForToast(/folder summaries.*copied/i)
    await expect(this.folderContextMenu).toBeHidden()
  }

  /**
   * Copy folder tree structure
   */
  async copyFolderTree(folderName: string) {
    await this.rightClickFolder(folderName)
    await this.menuCopyFolderTree.click()
    await this.waitForToast(/folder tree.*copied/i)
    await expect(this.folderContextMenu).toBeHidden()
  }

  // ========================================
  // GIT INTEGRATION METHODS
  // ========================================

  /**
   * Stage a file
   */
  async stageFile(fileName: string) {
    await this.rightClickFile(fileName)
    await this.menuStageFile.click()
    await this.waitForToast(/file.*staged/i)
    await expect(this.fileContextMenu).toBeHidden()
  }

  /**
   * Unstage a file
   */
  async unstageFile(fileName: string) {
    await this.rightClickFile(fileName)
    await this.menuUnstageFile.click()
    await this.waitForToast(/file.*unstaged/i)
    await expect(this.fileContextMenu).toBeHidden()
  }

  /**
   * Copy previous version of file
   */
  async copyFilePreviousVersion(fileName: string) {
    await this.rightClickFile(fileName)
    await this.menuCopyPreviousVersion.click()
    await this.waitForToast(/previous version.*copied/i)
    await expect(this.fileContextMenu).toBeHidden()
  }

  /**
   * Copy file diff
   */
  async copyFileDiff(fileName: string) {
    await this.rightClickFile(fileName)
    await this.menuCopyDiff.click()
    await this.waitForToast(/diff.*copied/i)
    await expect(this.fileContextMenu).toBeHidden()
  }

  /**
   * Get git status of a file
   */
  async getFileGitStatus(fileName: string): Promise<string | null> {
    const fileNode = this.fileNode(fileName)
    const gitIndicator = this.gitStatusIndicator(fileNode)
    
    if (await gitIndicator.isVisible()) {
      return await gitIndicator.getAttribute('data-git-status')
    }
    
    return null
  }

  /**
   * Get all files with specific git status
   */
  async getFilesByGitStatus(status: 'modified' | 'staged' | 'untracked' | 'deleted'): Promise<string[]> {
    const allFiles = await this.fileNodes.all()
    const filesWithStatus: string[] = []
    
    for (const fileNode of allFiles) {
      const gitIndicator = this.gitStatusIndicator(fileNode)
      
      if (await gitIndicator.isVisible()) {
        const fileStatus = await gitIndicator.getAttribute('data-git-status')
        if (fileStatus === status) {
          const fileName = await fileNode.getByTestId('file-name').textContent()
          if (fileName) filesWithStatus.push(fileName.trim())
        }
      }
    }
    
    return filesWithStatus
  }

  /**
   * Verify git status indicators are displayed correctly
   */
  async verifyGitStatusIndicators(expectedStatuses: Record<string, string>) {
    for (const [fileName, expectedStatus] of Object.entries(expectedStatuses)) {
      const actualStatus = await this.getFileGitStatus(fileName)
      expect(actualStatus).toBe(expectedStatus)
    }
  }

  // ========================================
  // NODE INFORMATION METHODS
  // ========================================

  /**
   * Get complete information about a file node
   */
  async getFileNodeInfo(fileName: string): Promise<FileNodeInfo> {
    const fileNode = this.fileNode(fileName)
    await expect(fileNode).toBeVisible()

    const name = await fileNode.getByTestId('file-name').textContent() || fileName
    const path = await fileNode.getAttribute('data-path') || ''
    const selected = await this.isFileSelected(fileName)
    const gitStatus = await this.getFileGitStatus(fileName)

    // Get token count if available
    const tokenCountEl = this.fileTokenCount(fileNode)
    const tokenCount = await tokenCountEl.isVisible() 
      ? parseInt((await tokenCountEl.textContent())?.match(/(\d+)/)?.[1] || '0')
      : undefined

    // Get file size if available
    const fileSizeEl = this.fileSize(fileNode)
    const size = await fileSizeEl.isVisible() 
      ? parseInt((await fileSizeEl.textContent())?.match(/(\d+)/)?.[1] || '0')
      : undefined

    return {
      name: name.trim(),
      path,
      type: 'file',
      selected,
      gitStatus: gitStatus as any,
      tokenCount,
      size
    }
  }

  /**
   * Get complete information about a folder node
   */
  async getFolderNodeInfo(folderName: string): Promise<FileNodeInfo> {
    const folderNode = this.folderNode(folderName)
    await expect(folderNode).toBeVisible()

    const name = await folderNode.getByTestId('folder-name').textContent() || folderName
    const path = await folderNode.getAttribute('data-path') || ''

    return {
      name: name.trim(),
      path,
      type: 'folder'
    }
  }

  /**
   * Get all visible file nodes information
   */
  async getAllFileNodesInfo(): Promise<FileNodeInfo[]> {
    const fileNodes = await this.fileNodes.all()
    const filesInfo: FileNodeInfo[] = []

    for (const node of fileNodes) {
      const name = await node.getByTestId('file-name').textContent()
      if (name) {
        const info = await this.getFileNodeInfo(name.trim())
        filesInfo.push(info)
      }
    }

    return filesInfo
  }

  // ========================================
  // TOKEN COUNTING AND PERFORMANCE
  // ========================================

  /**
   * Get total token count for selected files
   */
  async getSelectedFilesTokenCount(): Promise<number> {
    const tokenText = await this.selectedFilesTokenCount.textContent()
    const match = tokenText?.match(/(\d+)/)
    return match ? parseInt(match[1]) : 0
  }

  /**
   * Wait for token count to update after file selection
   */
  async waitForTokenCountUpdate() {
    // Wait for token counting to complete
    await this.page.waitForFunction(
      () => {
        const tokenEl = document.querySelector('[data-testid="selected-files-token-count"]')
        return tokenEl && !tokenEl.textContent?.includes('Counting')
      },
      { timeout: 10000 }
    )
  }

  /**
   * Test performance of large file selection
   */
  async testBulkFileSelectionPerformance(): Promise<{ timeMs: number, filesSelected: number }> {
    const startTime = Date.now()
    
    await this.selectAllFiles()
    await this.waitForTokenCountUpdate()
    
    const endTime = Date.now()
    const filesSelected = await this.getSelectedFilesCount()
    
    return {
      timeMs: endTime - startTime,
      filesSelected
    }
  }

  // ========================================
  // VALIDATION AND TESTING HELPERS
  // ========================================

  /**
   * Verify file tree structure matches expected
   */
  async verifyFileTreeStructure(expectedFiles: string[], expectedFolders: string[]) {
    // Check files
    for (const fileName of expectedFiles) {
      await expect(this.fileNode(fileName)).toBeVisible()
    }

    // Check folders
    for (const folderName of expectedFolders) {
      await expect(this.folderNode(folderName)).toBeVisible()
    }
  }

  /**
   * Verify context menu options are available for file type
   */
  async verifyFileContextMenuOptions(fileName: string, expectedOptions: ContextMenuOptions) {
    await this.rightClickFile(fileName)

    if (expectedOptions.copyRelativePath) {
      await expect(this.menuCopyRelativePath).toBeVisible()
    }

    if (expectedOptions.copyAbsolutePath) {
      await expect(this.menuCopyAbsolutePath).toBeVisible()
    }

    if (expectedOptions.copyFileContents) {
      await expect(this.menuCopyFileContents).toBeVisible()
    }

    if (expectedOptions.openInEditor) {
      await expect(this.menuOpenInEditor).toBeVisible()
    }

    if (expectedOptions.stageFile) {
      await expect(this.menuStageFile).toBeVisible()
    }

    if (expectedOptions.unstageFile) {
      await expect(this.menuUnstageFile).toBeVisible()
    }

    if (expectedOptions.copyPreviousVersion) {
      await expect(this.menuCopyPreviousVersion).toBeVisible()
    }

    if (expectedOptions.copyDiff) {
      await expect(this.menuCopyDiff).toBeVisible()
    }

    await this.closeContextMenu()
  }

  /**
   * Verify folder context menu options
   */
  async verifyFolderContextMenuOptions(folderName: string, expectedOptions: ContextMenuOptions) {
    await this.rightClickFolder(folderName)

    if (expectedOptions.copyFolderContents) {
      await expect(this.menuCopyFolderContents).toBeVisible()
    }

    if (expectedOptions.copyFolderSummaries) {
      await expect(this.menuCopyFolderSummaries).toBeVisible()
    }

    if (expectedOptions.copyFolderTree) {
      await expect(this.menuCopyFolderTree).toBeVisible()
    }

    await this.closeContextMenu()
  }

  /**
   * Test complete file selection workflow
   */
  async testFileSelectionWorkflow(files: string[]) {
    // Clear any existing selections
    await this.clearAllSelectedFiles()
    expect(await this.getSelectedFilesCount()).toBe(0)

    // Select files individually
    for (const fileName of files) {
      await this.toggleFileSelection(fileName)
      expect(await this.isFileSelected(fileName)).toBe(true)
    }

    // Verify all selected
    const selectedFiles = await this.getSelectedFilesList()
    expect(selectedFiles.sort()).toEqual(files.sort())

    // Unselect all
    await this.clearAllSelectedFiles()
    expect(await this.getSelectedFilesCount()).toBe(0)
  }

  /**
   * Take screenshot of file tree
   */
  async takeFileTreeScreenshot(name: string = 'file-tree') {
    await this.fileTreeContainer.screenshot({
      path: `e2e/screenshots/file-tree-${name}-${Date.now()}.png`
    })
  }
}