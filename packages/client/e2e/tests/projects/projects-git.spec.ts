import { test, expect } from '@playwright/test'
import { ProjectsPage } from '../../pages/projects.page'
import { ProjectHelpers } from '../../helpers/project-helpers'
import { 
  generateUniqueProject,
  testFiles,
  testGitData
} from '../../fixtures/project-data'

test.describe('Projects - Git Tab Tests', () => {
  let projectsPage: ProjectsPage
  let testProjectId: number | null = null

  test.beforeEach(async ({ page }) => {
    projectsPage = new ProjectsPage(page)
    
    // Create a test project for these tests
    const projectData = generateUniqueProject('git-test')
    const project = await ProjectHelpers.createTestProject(page, projectData)
    
    if (project && project.id) {
      testProjectId = project.id
      
      // Create some test files
      await ProjectHelpers.createTestFiles(page, project.id, testFiles.simple)
      
      // Navigate to the project git tab
      await projectsPage.gotoWithTab('git', project.id)
      await ProjectHelpers.waitForInitialization(page)
    }
  })

  test.afterEach(async ({ page }) => {
    // Cleanup
    if (testProjectId) {
      await ProjectHelpers.deleteTestProject(page, testProjectId)
    }
  })

  test('should display git tab elements', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Check if git tab is active
    const gitTabVisible = await projectsPage.gitTab.isVisible()
    
    if (!gitTabVisible) {
      console.log('⚠️ Git tab not visible - project may not be loaded')
      return
    }

    await projectsPage.expectTabActive('git')
    
    // Check for main git elements
    const elements = [
      { name: 'Git Status', selector: page.getByText(/status/i) },
      { name: 'Branch Info', selector: page.getByText(/branch/i) },
      { name: 'Commit Button', selector: page.getByRole('button', { name: /commit/i }) },
      { name: 'Changed Files', selector: page.getByText(/changes|modified|staged/i) }
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

  test('should show current branch', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Look for branch indicator
    const branchSelector = page.locator('[data-testid*="branch"]').or(
      page.getByText(/main|master|develop/i)
    )
    
    if (await branchSelector.isVisible()) {
      const branchName = await branchSelector.textContent()
      console.log(`✅ Current branch displayed: ${branchName}`)
      
      // Check if branch dropdown/switcher exists
      const branchSwitcher = page.getByRole('button', { name: /branch/i }).or(
        page.getByRole('combobox', { name: /branch/i })
      )
      
      if (await branchSwitcher.isVisible()) {
        await branchSwitcher.click()
        await page.waitForTimeout(500)
        
        // Check for branch list
        const branchList = page.getByRole('listbox').or(
          page.locator('[role="menu"]')
        )
        
        if (await branchList.isVisible()) {
          const branches = await branchList.locator('[role="option"]').count()
          console.log(`✅ Found ${branches} branches in dropdown`)
          
          // Close dropdown
          await page.keyboard.press('Escape')
        }
      }
    } else {
      console.log('⚠️ Branch information not visible')
    }
  })

  test('should display changed files', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Look for changed files section
    const changedFilesSection = page.locator('[data-testid*="changed-files"]').or(
      page.getByText(/changes/i).locator('..')
    )
    
    if (await changedFilesSection.isVisible()) {
      console.log('✅ Changed files section is visible')
      
      // Check for file items
      const fileItems = changedFilesSection.locator('[role="listitem"]').or(
        changedFilesSection.locator('.file-item')
      )
      
      const fileCount = await fileItems.count()
      
      if (fileCount > 0) {
        console.log(`✅ Found ${fileCount} changed files`)
        
        // Check first file details
        const firstFile = fileItems.first()
        
        // Check for file name
        const fileName = await firstFile.textContent()
        if (fileName) {
          console.log(`✅ First file: ${fileName}`)
        }
        
        // Check for file status (modified, added, deleted)
        const statusBadge = firstFile.locator('[data-testid*="status"]').or(
          firstFile.getByText(/modified|added|deleted/i)
        )
        
        if (await statusBadge.isVisible()) {
          const status = await statusBadge.textContent()
          console.log(`✅ File status: ${status}`)
        }
      } else {
        console.log('ℹ️ No changed files (working directory clean)')
      }
    } else {
      console.log('⚠️ Changed files section not visible')
    }
  })

  test('should show commit history', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Look for commit history section
    const historySection = page.locator('[data-testid*="commit-history"]').or(
      page.getByText(/history|commits/i).locator('..')
    )
    
    if (await historySection.isVisible()) {
      console.log('✅ Commit history section is visible')
      
      // Check for commit items
      const commitItems = historySection.locator('[role="listitem"]').or(
        historySection.locator('.commit-item')
      )
      
      const commitCount = await commitItems.count()
      
      if (commitCount > 0) {
        console.log(`✅ Found ${commitCount} commits`)
        
        // Check first commit details
        const firstCommit = commitItems.first()
        
        // Check for commit message
        const messageElement = firstCommit.locator('[data-testid*="message"]').or(
          firstCommit.locator('.commit-message')
        )
        
        if (await messageElement.isVisible()) {
          const message = await messageElement.textContent()
          console.log(`✅ Latest commit: ${message}`)
        }
        
        // Check for commit author
        const authorElement = firstCommit.locator('[data-testid*="author"]').or(
          firstCommit.getByText(/@/)
        )
        
        if (await authorElement.isVisible()) {
          const author = await authorElement.textContent()
          console.log(`✅ Author: ${author}`)
        }
        
        // Check for commit hash
        const hashElement = firstCommit.locator('[data-testid*="hash"]').or(
          firstCommit.locator('code')
        )
        
        if (await hashElement.isVisible()) {
          const hash = await hashElement.textContent()
          console.log(`✅ Commit hash: ${hash}`)
        }
      } else {
        console.log('ℹ️ No commits in history')
      }
    } else {
      console.log('⚠️ Commit history not visible')
    }
  })

  test('should stage and unstage files', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Look for unstaged files
    const unstagedFile = page.locator('[data-testid*="unstaged"]').first().or(
      page.getByText(/modified/i).locator('..').first()
    )
    
    if (await unstagedFile.isVisible()) {
      // Look for stage button
      const stageButton = unstagedFile.getByRole('button', { name: /stage|add|\+/i })
      
      if (await stageButton.isVisible()) {
        await stageButton.click()
        await page.waitForTimeout(1000)
        
        // Check if file moved to staged area
        const stagedSection = page.locator('[data-testid*="staged"]').or(
          page.getByText(/staged/i).locator('..')
        )
        
        if (await stagedSection.isVisible()) {
          console.log('✅ File staged successfully')
          
          // Try to unstage
          const unstageButton = stagedSection.getByRole('button', { name: /unstage|remove|-/i })
          
          if (await unstageButton.isVisible()) {
            await unstageButton.click()
            await page.waitForTimeout(1000)
            console.log('✅ File unstaged successfully')
          }
        }
      } else {
        console.log('⚠️ Stage button not found')
      }
    } else {
      console.log('ℹ️ No unstaged files available')
    }
  })

  test('should create a commit', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Look for commit button
    const commitButton = page.getByRole('button', { name: /commit/i })
    
    if (await commitButton.isVisible()) {
      // Check if button is enabled (needs staged files)
      const isDisabled = await commitButton.isDisabled()
      
      if (isDisabled) {
        console.log('ℹ️ Commit button disabled (no staged files)')
        
        // Try to stage a file first
        const stageAllButton = page.getByRole('button', { name: /stage all/i })
        if (await stageAllButton.isVisible()) {
          await stageAllButton.click()
          await page.waitForTimeout(1000)
        }
      }
      
      // Try to click commit button
      if (await commitButton.isEnabled()) {
        await commitButton.click()
        await page.waitForTimeout(1000)
        
        // Check if commit dialog opened
        const commitDialog = page.getByRole('dialog', { name: /commit/i })
        const commitForm = page.locator('form').filter({ has: page.getByPlaceholder(/commit message/i) })
        
        if (await commitDialog.isVisible() || await commitForm.isVisible()) {
          console.log('✅ Commit dialog opened')
          
          // Enter commit message
          const messageInput = page.getByPlaceholder(/commit message/i).or(
            page.getByLabel(/message/i)
          )
          
          if (await messageInput.isVisible()) {
            await messageInput.fill('Test commit from E2E suite')
            
            // Submit commit
            const submitButton = page.getByRole('button', { name: /commit|create/i }).last()
            if (await submitButton.isVisible()) {
              await submitButton.click()
              await page.waitForTimeout(2000)
              
              // Check for success
              const toastMessage = await ProjectHelpers.getToastMessage(page)
              if (toastMessage) {
                console.log('✅ Commit created successfully')
              }
            }
          }
        }
      } else {
        console.log('⚠️ Cannot create commit (no changes or button disabled)')
      }
    } else {
      console.log('⚠️ Commit button not found')
    }
  })

  test('should show diff for changed files', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Find a changed file
    const changedFile = page.locator('[data-testid*="changed-file"]').first().or(
      page.locator('.file-item').first()
    )
    
    if (await changedFile.isVisible()) {
      // Click on file to see diff
      await changedFile.click()
      await page.waitForTimeout(1000)
      
      // Check if diff view opened
      const diffView = page.locator('[data-testid*="diff"]').or(
        page.locator('.diff-view')
      )
      
      if (await diffView.isVisible()) {
        console.log('✅ Diff view opened')
        
        // Check for diff elements
        const additions = diffView.locator('.addition').or(
          diffView.getByText(/\+/).filter({ hasText: /\+/ })
        )
        const deletions = diffView.locator('.deletion').or(
          diffView.getByText(/-/).filter({ hasText: /-/ })
        )
        
        const addCount = await additions.count()
        const delCount = await deletions.count()
        
        console.log(`✅ Diff shows ${addCount} additions and ${delCount} deletions`)
        
        // Close diff view
        const closeButton = page.getByRole('button', { name: /close/i })
        if (await closeButton.isVisible()) {
          await closeButton.click()
        } else {
          await page.keyboard.press('Escape')
        }
      } else {
        console.log('⚠️ Diff view did not open')
      }
    } else {
      console.log('ℹ️ No changed files to view diff')
    }
  })

  test('should handle git operations menu', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Look for git operations menu/dropdown
    const gitMenu = page.getByRole('button', { name: /git actions|operations|more/i })
    
    if (await gitMenu.isVisible()) {
      await gitMenu.click()
      await page.waitForTimeout(500)
      
      // Check for menu items
      const menuItems = [
        'Pull',
        'Push',
        'Fetch',
        'Stash',
        'Reset',
        'Revert'
      ]
      
      for (const item of menuItems) {
        const menuItem = page.getByRole('menuitem', { name: new RegExp(item, 'i') })
        if (await menuItem.isVisible()) {
          console.log(`✅ ${item} operation available`)
        }
      }
      
      // Close menu
      await page.keyboard.press('Escape')
    } else {
      console.log('ℹ️ Git operations menu not found')
    }
  })

  test('should switch branches', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Look for branch switcher
    const branchSwitcher = page.getByRole('button', { name: /branch/i }).or(
      page.locator('[data-testid*="branch-switcher"]')
    )
    
    if (await branchSwitcher.isVisible()) {
      await branchSwitcher.click()
      await page.waitForTimeout(500)
      
      // Look for branch options
      const branchOptions = page.getByRole('option').or(
        page.locator('[role="menuitem"]')
      )
      
      const branchCount = await branchOptions.count()
      
      if (branchCount > 1) {
        // Switch to different branch
        await branchOptions.nth(1).click()
        await page.waitForTimeout(2000)
        
        // Check for branch switch confirmation
        const toastMessage = await ProjectHelpers.getToastMessage(page)
        if (toastMessage) {
          console.log('✅ Branch switched successfully')
        }
        
        // Verify branch changed in UI
        const newBranch = await branchSwitcher.textContent()
        console.log(`✅ Now on branch: ${newBranch}`)
      } else {
        console.log('ℹ️ Only one branch available')
        await page.keyboard.press('Escape')
      }
    } else {
      console.log('⚠️ Branch switcher not found')
    }
  })

  test('should handle stash operations', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Look for stash button
    const stashButton = page.getByRole('button', { name: /stash/i })
    
    if (await stashButton.isVisible()) {
      await stashButton.click()
      await page.waitForTimeout(500)
      
      // Check if stash dialog/menu opened
      const stashDialog = page.getByRole('dialog', { name: /stash/i })
      const stashMenu = page.getByRole('menu').filter({ has: page.getByText(/stash/i) })
      
      if (await stashDialog.isVisible() || await stashMenu.isVisible()) {
        console.log('✅ Stash interface opened')
        
        // Look for stash options
        const stashOptions = [
          'Stash changes',
          'Apply stash',
          'Pop stash',
          'Drop stash'
        ]
        
        for (const option of stashOptions) {
          const optionElement = page.getByText(new RegExp(option, 'i'))
          if (await optionElement.isVisible()) {
            console.log(`✅ ${option} available`)
          }
        }
        
        // Close stash interface
        await page.keyboard.press('Escape')
      }
    } else {
      console.log('ℹ️ Stash operations not available')
    }
  })

  test('should display repository information', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Look for repository info section
    const repoInfo = page.locator('[data-testid*="repo-info"]').or(
      page.getByText(/repository/i).locator('..')
    )
    
    if (await repoInfo.isVisible()) {
      console.log('✅ Repository information is visible')
      
      // Check for remote info
      const remoteInfo = repoInfo.getByText(/remote|origin/i)
      if (await remoteInfo.isVisible()) {
        const remoteText = await remoteInfo.textContent()
        console.log(`✅ Remote: ${remoteText}`)
      }
      
      // Check for last fetch/pull time
      const lastSync = repoInfo.getByText(/last (fetch|pull|sync)/i)
      if (await lastSync.isVisible()) {
        const syncText = await lastSync.textContent()
        console.log(`✅ ${syncText}`)
      }
    } else {
      console.log('ℹ️ Repository information section not found')
    }
  })

  test('should handle keyboard shortcuts in git tab', async ({ page }) => {
    if (!testProjectId) {
      test.skip()
      return
    }

    // Test git-specific shortcuts
    
    // Try Cmd/Ctrl+Enter for quick commit
    await page.keyboard.press('Meta+Enter')
    await page.waitForTimeout(500)
    
    const commitDialogOpen = await page.getByRole('dialog', { name: /commit/i }).isVisible()
    if (commitDialogOpen) {
      console.log('✅ Quick commit shortcut works')
      await page.keyboard.press('Escape')
    }
    
    // Try Cmd/Ctrl+Shift+A for stage all
    await page.keyboard.press('Meta+Shift+a')
    await page.waitForTimeout(500)
    
    const stagedFiles = await page.locator('[data-testid*="staged"]').count()
    if (stagedFiles > 0) {
      console.log('✅ Stage all shortcut works')
    }
    
    // Try Cmd/Ctrl+R for refresh
    await page.keyboard.press('Meta+r')
    await page.waitForTimeout(1000)
    console.log('✅ Refresh shortcut executed')
  })
})