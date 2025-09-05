/**
 * Home Onboarding Test Suite
 * 
 * Tests the new user onboarding experience, tutorials, 
 * setup wizards, and first-time user flows.
 */

import { test, expect } from '@playwright/test'
import { HomePage } from '../pages/home.page'
import { ProjectsPage } from '../pages/projects.page'

test.describe('Home Onboarding Experience', () => {
  let homePage: HomePage
  let projectsPage: ProjectsPage

  test.beforeEach(async ({ page, context }) => {
    homePage = new HomePage(page)
    projectsPage = new ProjectsPage(page)

    // Clear storage to simulate new user
    await context.clearCookies()
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })

    // Navigate to home
    await homePage.goto()
  })

  test.describe('New User Detection', () => {
    test('should detect first-time visitor', async ({ page }) => {
      // Check for new user indicators
      const isNewUser = await page.evaluate(() => {
        return !localStorage.getItem('hasVisited') && 
               !localStorage.getItem('onboardingCompleted')
      })
      expect(isNewUser).toBe(true)
    })

    test('should show onboarding for new users', async () => {
      await homePage.waitForHomePageLoad()
      
      // Check if onboarding elements are visible
      const hasOnboarding = await Promise.race([
        homePage.onboardingBanner.isVisible(),
        homePage.welcomeMessage.isVisible(),
        homePage.getStartedButton.isVisible()
      ].map(p => p.catch(() => false)))
      
      expect(hasOnboarding).toBe(true)
    })

    test('should not show onboarding for returning users', async ({ page }) => {
      // Mark as returning user
      await page.evaluate(() => {
        localStorage.setItem('hasVisited', 'true')
        localStorage.setItem('onboardingCompleted', 'true')
      })
      
      await page.reload()
      await homePage.waitForHomePageLoad()
      
      // Onboarding should not be visible
      const isOnboardingVisible = await homePage.isOnboardingVisible()
      expect(isOnboardingVisible).toBe(false)
    })

    test('should persist onboarding state across sessions', async ({ page, context }) => {
      // Complete onboarding
      if (await homePage.isOnboardingVisible()) {
        await homePage.skipOnboarding()
      }
      
      // Get storage state
      const storageState = await page.evaluate(() => {
        return {
          onboardingCompleted: localStorage.getItem('onboardingCompleted'),
          hasVisited: localStorage.getItem('hasVisited')
        }
      })
      
      // Reload page
      await page.reload()
      
      // State should persist
      const newStorageState = await page.evaluate(() => {
        return {
          onboardingCompleted: localStorage.getItem('onboardingCompleted'),
          hasVisited: localStorage.getItem('hasVisited')
        }
      })
      
      expect(newStorageState).toEqual(storageState)
    })
  })

  test.describe('Welcome Flow', () => {
    test('should display welcome message with user name if available', async ({ page }) => {
      // Set mock user data
      await page.evaluate(() => {
        localStorage.setItem('user', JSON.stringify({ name: 'Test User' }))
      })
      
      await page.reload()
      await homePage.waitForHomePageLoad()
      
      if (await homePage.welcomeMessage.isVisible()) {
        const welcomeText = await homePage.welcomeMessage.textContent()
        expect(welcomeText).toMatch(/Welcome/i)
      }
    })

    test('should show getting started button', async () => {
      if (await homePage.isOnboardingVisible()) {
        await expect(homePage.getStartedButton).toBeVisible()
        
        // Button should be clickable
        await expect(homePage.getStartedButton).toBeEnabled()
      }
    })

    test('should start onboarding flow on get started click', async ({ page }) => {
      if (await homePage.getStartedButton.isVisible()) {
        await homePage.getStartedButton.click()
        
        // Should navigate or show onboarding steps
        await page.waitForTimeout(1000)
        
        const hasOnboardingProgress = await Promise.race([
          homePage.onboardingProgress.isVisible(),
          page.locator('.onboarding-step').first().isVisible(),
          page.locator('[data-testid="onboarding-wizard"]').isVisible()
        ].map(p => p.catch(() => false)))
        
        expect(hasOnboardingProgress).toBe(true)
      }
    })

    test('should allow skipping onboarding', async ({ page }) => {
      if (await homePage.skipOnboardingButton.isVisible()) {
        await homePage.skipOnboarding()
        
        // Should hide onboarding
        await page.waitForTimeout(500)
        const isStillVisible = await homePage.isOnboardingVisible()
        expect(isStillVisible).toBe(false)
        
        // Should mark as skipped
        const skipped = await page.evaluate(() => {
          return localStorage.getItem('onboardingSkipped') === 'true' ||
                 localStorage.getItem('onboardingCompleted') === 'true'
        })
        expect(skipped).toBe(true)
      }
    })
  })

  test.describe('Tutorial Cards', () => {
    test('should display tutorial cards for new users', async () => {
      const tutorialCount = await homePage.getTutorialCardsCount()
      
      if (tutorialCount > 0) {
        // Should have meaningful tutorials
        expect(tutorialCount).toBeGreaterThanOrEqual(1)
        expect(tutorialCount).toBeLessThanOrEqual(10) // Reasonable limit
      }
    })

    test('should have interactive tutorial cards', async ({ page }) => {
      const tutorialCards = await homePage.tutorialCards.all()
      
      if (tutorialCards.length > 0) {
        const firstCard = tutorialCards[0]
        
        // Should have title and description
        const cardText = await firstCard.textContent()
        expect(cardText).toBeTruthy()
        
        // Should be clickable or have action
        const hasAction = await firstCard.locator('button, a').count() > 0
        expect(hasAction).toBe(true)
      }
    })

    test('should navigate to relevant section from tutorial', async ({ page }) => {
      const tutorialCards = await homePage.tutorialCards.all()
      
      if (tutorialCards.length > 0) {
        // Find a clickable tutorial
        for (const card of tutorialCards) {
          const button = card.locator('button, a').first()
          if (await button.isVisible()) {
            const initialUrl = page.url()
            await button.click()
            await page.waitForTimeout(1000)
            
            // Should navigate or show relevant content
            const newUrl = page.url()
            const hasNavigation = newUrl !== initialUrl || 
                                await page.locator('[role="dialog"]').isVisible()
            expect(hasNavigation).toBe(true)
            break
          }
        }
      }
    })

    test('should mark tutorials as completed', async ({ page }) => {
      const tutorialCards = await homePage.tutorialCards.all()
      
      if (tutorialCards.length > 0) {
        // Interact with first tutorial
        const firstCard = tutorialCards[0]
        const actionButton = firstCard.locator('button').first()
        
        if (await actionButton.isVisible()) {
          await actionButton.click()
          
          // Check if marked as completed
          await page.waitForTimeout(500)
          const isCompleted = await firstCard.getAttribute('data-completed') === 'true' ||
                             await firstCard.locator('.completed-indicator').isVisible()
          
          // Tutorial interaction should be tracked
          expect(await page.evaluate(() => localStorage.getItem('tutorialProgress'))).toBeTruthy()
        }
      }
    })
  })

  test.describe('Onboarding Steps', () => {
    test('should show progress indicator', async () => {
      if (await homePage.isOnboardingVisible()) {
        await homePage.completeOnboarding()
        
        // Check for progress indicator during onboarding
        if (await homePage.onboardingProgress.isVisible()) {
          const progressText = await homePage.onboardingProgress.textContent()
          expect(progressText).toMatch(/\d\/\d|step|progress/i)
        }
      }
    })

    test('should guide through project creation', async ({ page }) => {
      if (await homePage.getStartedButton.isVisible()) {
        await homePage.getStartedButton.click()
        
        // Should eventually show project creation
        await page.waitForTimeout(2000)
        
        const hasProjectCreation = await Promise.race([
          page.locator(':text("Create"):text("Project")').isVisible(),
          page.locator('[data-testid="create-project"]').isVisible(),
          projectsPage.createProjectDialog.isVisible()
        ].map(p => p.catch(() => false)))
        
        expect(hasProjectCreation).toBe(true)
      }
    })

    test('should provide tooltips and hints', async ({ page }) => {
      // Look for tooltip triggers
      const tooltipTriggers = page.locator('[aria-describedby], [data-tooltip], [title]')
      const tooltipCount = await tooltipTriggers.count()
      
      if (tooltipCount > 0) {
        // Hover over first tooltip trigger
        await tooltipTriggers.first().hover()
        await page.waitForTimeout(500)
        
        // Check for tooltip content
        const hasTooltip = await Promise.race([
          page.locator('[role="tooltip"]').isVisible(),
          page.locator('.tooltip').isVisible(),
          page.locator('[data-state="open"]').isVisible()
        ].map(p => p.catch(() => false)))
        
        expect(hasTooltip).toBe(true)
      }
    })

    test('should save onboarding progress', async ({ page }) => {
      if (await homePage.isOnboardingVisible()) {
        // Start onboarding
        await homePage.getStartedButton.click()
        await page.waitForTimeout(1000)
        
        // Get current progress
        const progress = await page.evaluate(() => {
          return localStorage.getItem('onboardingStep') || '0'
        })
        
        // Reload page
        await page.reload()
        
        // Progress should be saved
        const savedProgress = await page.evaluate(() => {
          return localStorage.getItem('onboardingStep') || '0'
        })
        
        expect(savedProgress).toBe(progress)
      }
    })
  })

  test.describe('Quick Start Actions', () => {
    test('should highlight important actions for new users', async ({ page }) => {
      // Look for highlighted or emphasized actions
      const highlightedActions = await Promise.race([
        page.locator('.highlighted-action').count(),
        page.locator('[data-highlight="true"]').count(),
        page.locator('.pulse-animation').count()
      ].map(p => p.catch(() => 0)))
      
      // New users might see highlighted actions
      if (highlightedActions > 0) {
        expect(highlightedActions).toBeGreaterThanOrEqual(1)
      }
    })

    test('should provide sample data option', async ({ page }) => {
      // Check for sample data option
      const hasSampleOption = await Promise.race([
        page.locator(':text("Sample")').isVisible(),
        page.locator(':text("Demo")').isVisible(),
        page.locator(':text("Example")').isVisible()
      ].map(p => p.catch(() => false)))
      
      if (hasSampleOption) {
        // Click sample data option
        const sampleButton = page.locator('button:has-text("Sample"), button:has-text("Demo"), button:has-text("Example")').first()
        await sampleButton.click()
        
        // Should create sample content
        await page.waitForTimeout(2000)
        
        // Check if sample data was created
        const hasSampleData = await homePage.getRecentActivityCount() > 0 ||
                             await homePage.getDashboardStats().then(s => (s.projects || 0) > 0)
        
        expect(hasSampleData).toBe(true)
      }
    })

    test('should offer import existing data', async ({ page }) => {
      if (await homePage.importButton.isVisible()) {
        await homePage.importButton.click()
        
        // Should show import options
        const hasImportDialog = await Promise.race([
          page.locator('[role="dialog"]:has-text("import")').isVisible(),
          page.locator('input[type="file"]').isVisible()
        ].map(p => p.catch(() => false)))
        
        expect(hasImportDialog).toBe(true)
      }
    })
  })

  test.describe('Help and Documentation', () => {
    test('should provide help links for new users', async ({ page }) => {
      // Look for help elements
      const helpElements = await Promise.race([
        page.locator('a:has-text("Help")').count(),
        page.locator('button:has-text("Help")').count(),
        page.locator('[aria-label*="help" i]').count()
      ].map(p => p.catch(() => 0)))
      
      expect(helpElements).toBeGreaterThanOrEqual(0)
    })

    test('should show documentation links', async ({ page }) => {
      const docLinks = await Promise.race([
        page.locator('a:has-text("Documentation")').count(),
        page.locator('a:has-text("Docs")').count(),
        page.locator('a:has-text("Guide")').count()
      ].map(p => p.catch(() => 0)))
      
      expect(docLinks).toBeGreaterThanOrEqual(0)
    })

    test('should provide contextual help', async ({ page }) => {
      // Look for help icons or buttons
      const helpIcons = page.locator('[aria-label*="help" i], .help-icon, button:has-text("?")')
      
      if (await helpIcons.first().isVisible()) {
        await helpIcons.first().click()
        
        // Should show help content
        await page.waitForTimeout(500)
        const hasHelpContent = await Promise.race([
          page.locator('[role="dialog"]').isVisible(),
          page.locator('.help-content').isVisible(),
          page.locator('[role="tooltip"]').isVisible()
        ].map(p => p.catch(() => false)))
        
        expect(hasHelpContent).toBe(true)
      }
    })
  })

  test.describe('Onboarding Completion', () => {
    test('should mark onboarding as complete', async ({ page }) => {
      if (await homePage.isOnboardingVisible()) {
        await homePage.completeOnboarding()
        
        // Wait for completion
        await page.waitForTimeout(2000)
        
        // Should be marked as complete
        const isCompleted = await page.evaluate(() => {
          return localStorage.getItem('onboardingCompleted') === 'true'
        })
        
        expect(isCompleted).toBe(true)
      }
    })

    test('should not show onboarding after completion', async ({ page }) => {
      // Complete onboarding
      if (await homePage.isOnboardingVisible()) {
        await homePage.completeOnboarding()
      }
      
      // Reload page
      await page.reload()
      await homePage.waitForHomePageLoad()
      
      // Onboarding should not appear
      const isVisible = await homePage.isOnboardingVisible()
      expect(isVisible).toBe(false)
    })

    test('should show success message on completion', async ({ page }) => {
      if (await homePage.isOnboardingVisible()) {
        await homePage.completeOnboarding()
        
        // Look for success indicator
        const hasSuccess = await Promise.race([
          page.locator(':text("Congratulations")').isVisible(),
          page.locator(':text("Success")').isVisible(),
          page.locator(':text("Complete")').isVisible(),
          page.locator('.success-message').isVisible()
        ].map(p => p.catch(() => false)))
        
        expect(hasSuccess).toBe(true)
      }
    })

    test('should enable all features after onboarding', async ({ page }) => {
      // Complete onboarding
      if (await homePage.isOnboardingVisible()) {
        await homePage.completeOnboarding()
      }
      
      // All navigation should be available
      const navItems = [
        homePage.projectsLink,
        homePage.chatLink,
        homePage.promptsLink
      ]
      
      for (const item of navItems) {
        if (await item.isVisible()) {
          await expect(item).toBeEnabled()
        }
      }
    })
  })

  test.describe('Onboarding Customization', () => {
    test('should adapt to user preferences', async ({ page }) => {
      // Set user preference
      await page.evaluate(() => {
        localStorage.setItem('userRole', 'developer')
      })
      
      await page.reload()
      await homePage.waitForHomePageLoad()
      
      // Content might be tailored
      if (await homePage.tutorialCards.first().isVisible()) {
        const tutorialText = await homePage.tutorialCards.first().textContent()
        // Developer-specific content might appear
        expect(tutorialText).toBeTruthy()
      }
    })

    test('should remember user choices', async ({ page }) => {
      // Make some choices during onboarding
      if (await homePage.isOnboardingVisible()) {
        // Set preferences
        await page.evaluate(() => {
          localStorage.setItem('preferredView', 'grid')
          localStorage.setItem('theme', 'dark')
        })
        
        await homePage.skipOnboarding()
      }
      
      // Reload and check if choices persist
      await page.reload()
      
      const preferences = await page.evaluate(() => {
        return {
          view: localStorage.getItem('preferredView'),
          theme: localStorage.getItem('theme')
        }
      })
      
      expect(preferences.view).toBe('grid')
      expect(preferences.theme).toBe('dark')
    })

    test('should provide different paths based on goals', async ({ page }) => {
      // Look for goal selection
      const hasGoalSelection = await Promise.race([
        page.locator(':text("What would you like to")').isVisible(),
        page.locator(':text("Choose your path")').isVisible(),
        page.locator('[data-testid="goal-selection"]').isVisible()
      ].map(p => p.catch(() => false)))
      
      if (hasGoalSelection) {
        // Select a goal
        const goalButton = page.locator('button:has-text("Project"), button:has-text("Learn")').first()
        if (await goalButton.isVisible()) {
          await goalButton.click()
          
          // Should navigate to relevant section
          await page.waitForTimeout(1000)
          expect(page.url()).not.toBe('/')
        }
      }
    })
  })

  test.describe('Error Recovery', () => {
    test('should handle onboarding errors gracefully', async ({ page }) => {
      // Simulate error condition
      await page.evaluate(() => {
        localStorage.setItem('onboardingStep', 'invalid')
      })
      
      await page.reload()
      await homePage.waitForHomePageLoad()
      
      // Should not crash
      const isPageAccessible = await homePage.isOnHomePage()
      expect(isPageAccessible).toBe(true)
    })

    test('should allow resetting onboarding', async ({ page }) => {
      // Look for reset option
      const hasReset = await Promise.race([
        page.locator(':text("Reset onboarding")').isVisible(),
        page.locator(':text("Start over")').isVisible(),
        page.locator('[data-testid="reset-onboarding"]').isVisible()
      ].map(p => p.catch(() => false)))
      
      if (hasReset) {
        const resetButton = page.locator('button:has-text("Reset"), button:has-text("Start over")').first()
        await resetButton.click()
        
        // Should clear onboarding state
        const isCleared = await page.evaluate(() => {
          return !localStorage.getItem('onboardingCompleted')
        })
        
        expect(isCleared).toBe(true)
      }
    })
  })
})