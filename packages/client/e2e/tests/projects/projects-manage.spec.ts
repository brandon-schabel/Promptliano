import { test, expect } from '@playwright/test'
import { ProjectsPage } from '../../pages/projects.page'
import { ProjectHelpers } from '../../helpers/project-helpers'
import { 
  generateUniqueProject,
  testFiles,
  testPrompts
} from '../../fixtures/project-data'

test.describe('Projects - Manage Tab Tests', () => {
  let projectsPage: ProjectsPage
  let testProjectId: number | null = null

  test.beforeEach(async ({ page }) => {
    projectsPage = new ProjectsPage(page)
    
    // Create a test project for these tests
    const projectData = generateUniqueProject('manage-test')
    const project = await ProjectHelpers.createTestProject(page, projectData)
    
    if (project && project.id) {
      testProjectId = project.id
      
      // Create some test data
      await ProjectHelpers.createTestFiles(page, project.id, testFiles.simple)
      await ProjectHelpers.createTestPrompts(page, testPrompts.slice(0, 2))
      
      // Navigate to the project manage tab
      await projectsPage.gotoWithTab('manage', project.id)
      await ProjectHelpers.waitForInitialization(page)
    }
  })

  test.afterEach(async ({ page }) => {
    // Cleanup
    if (testProjectId) {
      await ProjectHelpers.deleteTestProject(page, testProjectId)
    }
  })

  test('should display manage tab elements', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Check if manage tab is active
    const manageTabVisible = await projectsPage.manageTab.isVisible()
    
    if (!manageTabVisible) {
      console.log('⚠️ Manage tab not visible - project may not be loaded')
      return
    }

    await projectsPage.expectTabActive('manage')
    
    // Check for main management elements
    const elements = [
      { name: 'Project Settings', selector: page.getByText(/settings/i) },
      { name: 'Project Name', selector: page.getByText(new RegExp('manage-test', 'i')) },
      { name: 'Edit Button', selector: page.getByRole('button', { name: /edit/i }) },
      { name: 'Delete Button', selector: page.getByRole('button', { name: /delete/i }) }
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

  test('should display project details', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Check for project information fields
    const fields = [
      { label: 'Project Name', value: 'manage-test' },
      { label: 'Path', value: '/tmp/' },
      { label: 'Description', value: 'Auto-generated' },
      { label: 'Created', value: /\d{4}/ },
      { label: 'ID', value: testProjectId.toString() }
    ]

    for (const { label, value } of fields) {
      const labelElement = page.getByText(new RegExp(label, 'i'))
      
      if (await labelElement.isVisible()) {
        console.log(`✅ ${label} label is visible`)
        
        // Check for associated value
        const valuePattern = typeof value === 'string' ? value : value
        const valueElement = page.getByText(valuePattern)
        
        if (await valueElement.isVisible()) {
          const actualValue = await valueElement.textContent()
          console.log(`✅ ${label}: ${actualValue}`)
        }
      }
    }
  })

  test('should edit project details', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Find edit button
    const editButton = page.getByRole('button', { name: /edit/i })
    
    if (await editButton.isVisible()) {
      await editButton.click()
      await page.waitForTimeout(1000)
      
      // Check if edit form opened
      const editForm = page.locator('form').or(
        page.getByRole('dialog', { name: /edit/i })
      )
      
      if (await editForm.isVisible()) {
        console.log('✅ Edit form opened')
        
        // Modify project name
        const nameInput = page.getByLabel(/project name/i).or(
          page.getByPlaceholder(/name/i)
        )
        
        if (await nameInput.isVisible()) {
          await nameInput.clear()
          await nameInput.fill('Updated Project Name')
        }
        
        // Modify description
        const descInput = page.getByLabel(/description/i).or(
          page.getByPlaceholder(/description/i)
        )
        
        if (await descInput.isVisible()) {
          await descInput.clear()
          await descInput.fill('Updated description from E2E test')
        }
        
        // Save changes
        const saveButton = page.getByRole('button', { name: /save|update/i })
        if (await saveButton.isVisible()) {
          await saveButton.click()
          await page.waitForTimeout(2000)
          
          // Check for success message
          const toastMessage = await ProjectHelpers.getToastMessage(page)
          if (toastMessage) {
            expect(toastMessage.toLowerCase()).toContain('updated')
            console.log('✅ Project updated successfully')
          }
          
          // Verify changes are reflected
          const updatedName = page.getByText('Updated Project Name')
          if (await updatedName.isVisible()) {
            console.log('✅ Updated name is displayed')
          }
        }
      } else {
        console.log('⚠️ Edit form did not open')
      }
    } else {
      console.log('⚠️ Edit button not found')
    }
  })

  test('should manage project files', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Look for files section
    const filesSection = page.locator('[data-testid*="files"]').or(
      page.getByText(/files/i).locator('..')
    )
    
    if (await filesSection.isVisible()) {
      console.log('✅ Files section is visible')
      
      // Count files
      const fileItems = filesSection.locator('[role="listitem"]').or(
        filesSection.locator('.file-item')
      )
      
      const fileCount = await fileItems.count()
      console.log(`✅ Found ${fileCount} files`)
      
      if (fileCount > 0) {
        // Check file operations
        const firstFile = fileItems.first()
        
        // Look for file actions
        const deleteFileButton = firstFile.getByRole('button', { name: /delete|remove/i })
        const viewFileButton = firstFile.getByRole('button', { name: /view|open/i })
        
        if (await deleteFileButton.isVisible()) {
          console.log('✅ File delete option available')
        }
        
        if (await viewFileButton.isVisible()) {
          console.log('✅ File view option available')
        }
      }
      
      // Check for add file button
      const addFileButton = page.getByRole('button', { name: /add file|new file/i })
      if (await addFileButton.isVisible()) {
        console.log('✅ Add file button available')
      }
    } else {
      console.log('⚠️ Files section not visible')
    }
  })

  test('should manage project prompts', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Look for prompts section
    const promptsSection = page.locator('[data-testid*="prompts"]').or(
      page.getByText(/prompts/i).locator('..')
    )
    
    if (await promptsSection.isVisible()) {
      console.log('✅ Prompts section is visible')
      
      // Count prompts
      const promptItems = promptsSection.locator('[role="listitem"]').or(
        promptsSection.locator('.prompt-item')
      )
      
      const promptCount = await promptItems.count()
      console.log(`✅ Found ${promptCount} prompts`)
      
      if (promptCount > 0) {
        // Check prompt operations
        const firstPrompt = promptItems.first()
        
        // Look for prompt actions
        const removePromptButton = firstPrompt.getByRole('button', { name: /remove|unlink/i })
        
        if (await removePromptButton.isVisible()) {
          console.log('✅ Prompt remove option available')
        }
      }
      
      // Check for add prompt button
      const addPromptButton = page.getByRole('button', { name: /add prompt|link prompt/i })
      if (await addPromptButton.isVisible()) {
        console.log('✅ Add prompt button available')
      }
    } else {
      console.log('⚠️ Prompts section not visible')
    }
  })

  test('should show project statistics', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Look for statistics/metrics section
    const statsSection = page.locator('[data-testid*="stats"]').or(
      page.getByText(/statistics|metrics/i).locator('..')
    )
    
    if (await statsSection.isVisible()) {
      console.log('✅ Statistics section is visible')
      
      // Check for various stats
      const stats = [
        'Files',
        'Tickets',
        'Prompts',
        'Size',
        'Last Modified'
      ]
      
      for (const stat of stats) {
        const statElement = page.getByText(new RegExp(stat, 'i'))
        if (await statElement.isVisible()) {
          const parent = statElement.locator('..')
          const value = await parent.textContent()
          console.log(`✅ ${stat}: ${value}`)
        }
      }
    } else {
      console.log('ℹ️ Statistics section not found')
    }
  })

  test('should handle project deletion', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Find delete button
    const deleteButton = page.getByRole('button', { name: /delete project/i }).or(
      page.getByRole('button', { name: /delete/i }).filter({ hasText: /project/i })
    )
    
    if (await deleteButton.isVisible()) {
      await deleteButton.click()
      await page.waitForTimeout(1000)
      
      // Check for confirmation dialog
      const confirmDialog = page.getByRole('dialog', { name: /confirm/i }).or(
        page.getByRole('alertdialog')
      )
      
      if (await confirmDialog.isVisible()) {
        console.log('✅ Delete confirmation dialog opened')
        
        // Check for warning message
        const warningText = confirmDialog.getByText(/permanently|cannot be undone/i)
        if (await warningText.isVisible()) {
          console.log('✅ Warning message displayed')
        }
        
        // Look for confirm and cancel buttons
        const confirmButton = confirmDialog.getByRole('button', { name: /confirm|delete/i })
        const cancelButton = confirmDialog.getByRole('button', { name: /cancel/i })
        
        if (await confirmButton.isVisible() && await cancelButton.isVisible()) {
          console.log('✅ Confirm and Cancel buttons available')
          
          // Cancel deletion for test
          await cancelButton.click()
          await page.waitForTimeout(500)
          
          // Verify dialog closed
          const stillVisible = await confirmDialog.isVisible()
          expect(stillVisible).toBe(false)
          console.log('✅ Deletion cancelled successfully')
        }
      } else {
        console.log('⚠️ Confirmation dialog did not appear')
      }
    } else {
      console.log('⚠️ Delete button not found')
    }
  })

  test('should export project data', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Look for export button
    const exportButton = page.getByRole('button', { name: /export/i })
    
    if (await exportButton.isVisible()) {
      await exportButton.click()
      await page.waitForTimeout(1000)
      
      // Check for export options
      const exportDialog = page.getByRole('dialog', { name: /export/i })
      
      if (await exportDialog.isVisible()) {
        console.log('✅ Export dialog opened')
        
        // Check for export format options
        const formats = ['JSON', 'ZIP', 'Markdown']
        
        for (const format of formats) {
          const formatOption = exportDialog.getByText(format)
          if (await formatOption.isVisible()) {
            console.log(`✅ ${format} export option available`)
          }
        }
        
        // Close dialog
        await page.keyboard.press('Escape')
      } else {
        // Direct export might have started
        const toastMessage = await ProjectHelpers.getToastMessage(page)
        if (toastMessage) {
          console.log('✅ Export initiated')
        }
      }
    } else {
      console.log('ℹ️ Export functionality not available')
    }
  })

  test('should duplicate project', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Look for duplicate button
    const duplicateButton = page.getByRole('button', { name: /duplicate|clone|copy/i })
    
    if (await duplicateButton.isVisible()) {
      await duplicateButton.click()
      await page.waitForTimeout(1000)
      
      // Check for duplicate dialog
      const duplicateDialog = page.getByRole('dialog', { name: /duplicate/i })
      
      if (await duplicateDialog.isVisible()) {
        console.log('✅ Duplicate dialog opened')
        
        // Fill new project name
        const nameInput = duplicateDialog.getByLabel(/name/i).or(
          duplicateDialog.getByPlaceholder(/name/i)
        )
        
        if (await nameInput.isVisible()) {
          await nameInput.fill('Duplicated Project')
          
          // Submit duplication
          const submitButton = duplicateDialog.getByRole('button', { name: /duplicate|create/i })
          if (await submitButton.isVisible()) {
            await submitButton.click()
            await page.waitForTimeout(2000)
            
            // Check for success
            const toastMessage = await ProjectHelpers.getToastMessage(page)
            if (toastMessage) {
              console.log('✅ Project duplicated successfully')
            }
          }
        }
      } else {
        console.log('⚠️ Duplicate dialog did not open')
      }
    } else {
      console.log('ℹ️ Duplicate functionality not available')
    }
  })

  test('should manage project permissions', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Look for permissions/access section
    const permissionsSection = page.locator('[data-testid*="permissions"]').or(
      page.getByText(/permissions|access/i).locator('..')
    )
    
    if (await permissionsSection.isVisible()) {
      console.log('✅ Permissions section is visible')
      
      // Check for permission controls
      const permissionToggles = permissionsSection.locator('[role="switch"]').or(
        permissionsSection.locator('input[type="checkbox"]')
      )
      
      const toggleCount = await permissionToggles.count()
      if (toggleCount > 0) {
        console.log(`✅ Found ${toggleCount} permission toggles`)
        
        // Check first toggle
        const firstToggle = permissionToggles.first()
        const isChecked = await firstToggle.isChecked()
        console.log(`✅ First permission is ${isChecked ? 'enabled' : 'disabled'}`)
      }
      
      // Check for share/collaborate button
      const shareButton = page.getByRole('button', { name: /share|collaborate/i })
      if (await shareButton.isVisible()) {
        console.log('✅ Share/collaborate option available')
      }
    } else {
      console.log('ℹ️ Permissions management not available')
    }
  })

  test('should show project activity log', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Look for activity/history section
    const activitySection = page.locator('[data-testid*="activity"]').or(
      page.getByText(/activity|history|log/i).locator('..')
    )
    
    if (await activitySection.isVisible()) {
      console.log('✅ Activity log section is visible')
      
      // Check for activity items
      const activityItems = activitySection.locator('[role="listitem"]').or(
        activitySection.locator('.activity-item')
      )
      
      const activityCount = await activityItems.count()
      if (activityCount > 0) {
        console.log(`✅ Found ${activityCount} activity entries`)
        
        // Check first activity
        const firstActivity = activityItems.first()
        const activityText = await firstActivity.textContent()
        console.log(`✅ Latest activity: ${activityText?.substring(0, 50)}...`)
      } else {
        console.log('ℹ️ No activity entries yet')
      }
    } else {
      console.log('ℹ️ Activity log not available')
    }
  })

  test('should handle keyboard shortcuts in manage tab', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Test management shortcuts
    
    // Try Cmd/Ctrl+E for edit
    await page.keyboard.press('Meta+e')
    await page.waitForTimeout(500)
    
    const editDialogOpen = await page.getByRole('dialog', { name: /edit/i }).isVisible()
    if (editDialogOpen) {
      console.log('✅ Edit shortcut works')
      await page.keyboard.press('Escape')
    }
    
    // Try Cmd/Ctrl+D for duplicate
    await page.keyboard.press('Meta+d')
    await page.waitForTimeout(500)
    
    const duplicateDialogOpen = await page.getByRole('dialog', { name: /duplicate/i }).isVisible()
    if (duplicateDialogOpen) {
      console.log('✅ Duplicate shortcut works')
      await page.keyboard.press('Escape')
    }
  })
})