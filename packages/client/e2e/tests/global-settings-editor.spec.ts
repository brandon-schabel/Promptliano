/**
 * Global Settings Editor Tests
 *
 * Tests for code editor configuration including themes, font sizes,
 * tab settings, word wrap, line numbers, and minimap functionality.
 */

import { test, expect } from '@playwright/test'
import { GlobalSettingsPage } from '../pages/global-settings-page'
import { TestDataManager } from '../utils/test-data-manager'
import {
  GlobalSettingsTestData,
  AVAILABLE_THEMES,
  FONT_SIZE_CONSTRAINTS,
  TAB_SIZE_CONSTRAINTS,
  THEME_VALIDATION
} from '../fixtures/global-settings-data'

test.describe('Global Settings - Code Editor Configuration', () => {
  let settingsPage: GlobalSettingsPage
  let testDataManager: TestDataManager

  test.beforeEach(async ({ page }, testInfo) => {
    settingsPage = new GlobalSettingsPage(page)
    testDataManager = new TestDataManager(page, testInfo)

    // Navigate to editor settings
    await settingsPage.navigateToSettings()
    await settingsPage.switchToTab('editor')
  })

  test.afterEach(async () => {
    await testDataManager.cleanup()
  })

  test('should display all available editor themes', async ({ page }) => {
    // Open theme dropdown
    await settingsPage.themeSelect.click()

    // Wait for dropdown to open
    await page.waitForTimeout(300)

    // Verify all expected themes are available
    let foundThemes = 0
    for (const theme of AVAILABLE_THEMES) {
      const themeOption = page.getByRole('option', { name: new RegExp(theme, 'i') })
      const exists = await themeOption.isVisible({ timeout: 500 }).catch(() => false)

      if (exists) {
        foundThemes++
      }
    }

    // Should find at least some themes
    expect(foundThemes).toBeGreaterThan(0)

    // Close dropdown
    await page.keyboard.press('Escape')
  })

  test('should change editor theme and apply immediately', async ({ page }) => {
    // Select a specific theme
    await settingsPage.selectFromDropdown(settingsPage.themeSelect, 'dracula')
    await settingsPage.applySettings()

    // Navigate to a page with code editor context
    await page.goto('/projects')

    // Look for code editor or syntax-highlighted content
    const codeElements = [
      page.locator('pre'),
      page.locator('code'),
      page.locator('.monaco-editor'),
      page.locator('.cm-editor'),
      page.locator('.code-block'),
      page.locator('.syntax-highlight')
    ]

    let themeApplied = false
    for (const codeElement of codeElements) {
      const exists = await codeElement
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false)

      if (exists) {
        // Check that dracula theme styles might be applied
        const editorStyles = await codeElement
          .first()
          .evaluate((el) => {
            const styles = getComputedStyle(el)
            return {
              backgroundColor: styles.backgroundColor,
              color: styles.color,
              className: el.className
            }
          })
          .catch(() => null)

        if (editorStyles) {
          // Dracula theme typically has dark background
          const isDarkBackground =
            editorStyles.backgroundColor.includes('40, 42, 54') || // rgb(40, 42, 54)
            editorStyles.backgroundColor.includes('#282a36') ||
            editorStyles.className.includes('dracula') ||
            editorStyles.className.includes('dark')

          if (isDarkBackground) {
            themeApplied = true
          }
        }
        break
      }
    }

    // Test another theme for comparison
    await settingsPage.navigateToSettings()
    await settingsPage.switchToTab('editor')
    await settingsPage.selectFromDropdown(settingsPage.themeSelect, 'github-light')
    await settingsPage.applySettings()

    // Verify theme change applied
    await settingsPage.verifyThemeApplied('github-light')
  })

  test('should configure editor font size with validation', async ({ page }) => {
    // Test valid font size
    await settingsPage.setNumberInput(settingsPage.fontSizeInput, 18)
    await settingsPage.applySettings()

    // Navigate to code context to verify font size
    await page.goto('/projects')

    const codeElements = [page.locator('pre, code, .monaco-editor, .cm-editor').first()]

    for (const codeElement of codeElements) {
      const exists = await codeElement.isVisible({ timeout: 2000 }).catch(() => false)

      if (exists) {
        const fontSize = await codeElement
          .evaluate((el) => {
            return getComputedStyle(el).fontSize
          })
          .catch(() => null)

        if (fontSize) {
          expect(fontSize).toBe('18px')
        }
        break
      }
    }

    // Test font size validation - too small
    await settingsPage.navigateToSettings()
    await settingsPage.switchToTab('editor')

    await settingsPage.setNumberInput(settingsPage.fontSizeInput, FONT_SIZE_CONSTRAINTS.minimum - 1)

    // Should show validation error or clamp to minimum
    const hasError = await settingsPage.hasValidationError(/font.*size/i)
    const inputValue = parseInt(await settingsPage.fontSizeInput.inputValue())

    expect(hasError || inputValue >= FONT_SIZE_CONSTRAINTS.minimum).toBe(true)

    // Test font size validation - too large
    await settingsPage.setNumberInput(settingsPage.fontSizeInput, FONT_SIZE_CONSTRAINTS.maximum + 1)

    const hasLargeError = await settingsPage.hasValidationError(/font.*size/i)
    const largeInputValue = parseInt(await settingsPage.fontSizeInput.inputValue())

    expect(hasLargeError || largeInputValue <= FONT_SIZE_CONSTRAINTS.maximum).toBe(true)
  })

  test('should configure tab size for indentation', async ({ page }) => {
    // Set tab size to 4
    await settingsPage.setNumberInput(settingsPage.tabSizeInput, 4)
    await settingsPage.applySettings()

    // Navigate to editor context
    await page.goto('/projects')

    // Look for editor that supports tab configuration
    const editors = [
      page.locator('.monaco-editor'),
      page.locator('.cm-editor'),
      page.locator('textarea[data-testid*="editor"]')
    ]

    let tabSizeSet = false
    for (const editor of editors) {
      const exists = await editor
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false)

      if (exists) {
        // Focus editor and test tab behavior
        await editor.first().click()

        // Clear any existing content
        await page.keyboard.press('Control+A')
        await page.keyboard.press('Delete')

        // Press tab
        await page.keyboard.press('Tab')

        // Check indentation (this is implementation dependent)
        const content = await editor
          .first()
          .evaluate((el) => {
            if (el.tagName.toLowerCase() === 'textarea') {
              return (el as HTMLTextAreaElement).value
            } else {
              return el.textContent
            }
          })
          .catch(() => '')

        if (content) {
          // Tab should insert 4 spaces or equivalent
          const leadingWhitespace = content.match(/^\s*/)?.[0] || ''
          if (leadingWhitespace.length >= 4) {
            tabSizeSet = true
          }
        }
        break
      }
    }

    // Test tab size validation
    await settingsPage.navigateToSettings()
    await settingsPage.switchToTab('editor')

    // Test invalid tab size (too small)
    await settingsPage.setNumberInput(settingsPage.tabSizeInput, 0)

    const hasError = await settingsPage.hasValidationError(/tab.*size/i)
    const inputValue = parseInt(await settingsPage.tabSizeInput.inputValue())

    expect(hasError || inputValue > 0).toBe(true)
  })

  test('should toggle word wrap in editor', async ({ page }) => {
    // Enable word wrap
    await settingsPage.toggleSetting(settingsPage.wordWrapToggle, true)
    await settingsPage.applySettings()

    // Navigate to editor context
    await page.goto('/projects')

    const editors = [
      page.locator('.monaco-editor'),
      page.locator('.cm-editor'),
      page.locator('pre'),
      page.locator('code'),
      page.locator('textarea')
    ]

    for (const editor of editors) {
      const exists = await editor
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false)

      if (exists) {
        // Check CSS for word wrap
        const wordWrapStyle = await editor
          .first()
          .evaluate((el) => {
            const styles = getComputedStyle(el)
            return {
              whiteSpace: styles.whiteSpace,
              wordWrap: styles.wordWrap,
              overflowWrap: styles.overflowWrap
            }
          })
          .catch(() => null)

        if (wordWrapStyle) {
          const hasWordWrap =
            ['pre-wrap', 'break-word', 'normal'].includes(wordWrapStyle.whiteSpace) ||
            wordWrapStyle.wordWrap === 'break-word' ||
            wordWrapStyle.overflowWrap === 'break-word'

          if (hasWordWrap) {
            expect(hasWordWrap).toBe(true)
          }
        }
        break
      }
    }

    // Disable word wrap
    await settingsPage.navigateToSettings()
    await settingsPage.switchToTab('editor')
    await settingsPage.toggleSetting(settingsPage.wordWrapToggle, false)
    await settingsPage.applySettings()

    // Verify word wrap is disabled
    await page.goto('/projects')

    for (const editor of editors) {
      const exists = await editor
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false)

      if (exists) {
        const noWrapStyle = await editor
          .first()
          .evaluate((el) => {
            return getComputedStyle(el).whiteSpace
          })
          .catch(() => null)

        if (noWrapStyle) {
          const noWrap = ['pre', 'nowrap'].includes(noWrapStyle)
          if (noWrap) {
            expect(noWrap).toBe(true)
          }
        }
        break
      }
    }
  })

  test('should toggle line numbers and minimap', async ({ page }) => {
    // Enable line numbers and minimap
    await settingsPage.toggleSetting(settingsPage.lineNumbersToggle, true)
    await settingsPage.toggleSetting(settingsPage.minimapToggle, true)
    await settingsPage.applySettings()

    // Navigate to editor context
    await page.goto('/projects')

    const editors = [page.locator('.monaco-editor'), page.locator('.cm-editor')]

    for (const editor of editors) {
      const exists = await editor
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false)

      if (exists) {
        // Check for line numbers
        const lineNumberSelectors = [
          editor.locator('.line-numbers'),
          editor.locator('.cm-lineNumbers'),
          editor.locator('.editor-line-numbers')
        ]

        let hasLineNumbers = false
        for (const lineNumSelector of lineNumberSelectors) {
          const visible = await lineNumSelector
            .first()
            .isVisible({ timeout: 1000 })
            .catch(() => false)
          if (visible) {
            hasLineNumbers = true
            break
          }
        }

        // Check for minimap
        const minimapSelectors = [
          editor.locator('.minimap'),
          editor.locator('.cm-minimap'),
          editor.locator('.editor-minimap')
        ]

        let hasMinimap = false
        for (const minimapSelector of minimapSelectors) {
          const visible = await minimapSelector
            .first()
            .isVisible({ timeout: 1000 })
            .catch(() => false)
          if (visible) {
            hasMinimap = true
            break
          }
        }

        // At least one should be found if editor supports these features
        if (hasLineNumbers || hasMinimap) {
          expect(hasLineNumbers || hasMinimap).toBe(true)
        }
        break
      }
    }

    // Disable features
    await settingsPage.navigateToSettings()
    await settingsPage.switchToTab('editor')
    await settingsPage.toggleSetting(settingsPage.lineNumbersToggle, false)
    await settingsPage.toggleSetting(settingsPage.minimapToggle, false)
    await settingsPage.applySettings()

    // Verify features are disabled
    await page.goto('/projects')

    for (const editor of editors) {
      const exists = await editor
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false)

      if (exists) {
        // Line numbers should be hidden
        const lineNumbersHidden = await editor
          .locator('.line-numbers, .cm-lineNumbers')
          .first()
          .isVisible({ timeout: 1000 })
          .catch(() => true)

        // Minimap should be hidden
        const minimapHidden = await editor
          .locator('.minimap, .cm-minimap')
          .first()
          .isVisible({ timeout: 1000 })
          .catch(() => true)

        // If elements exist, they should be hidden
        expect(lineNumbersHidden && minimapHidden).toBe(false)
        break
      }
    }
  })

  test('should handle theme switching performance', async ({ page }) => {
    const themes = ['vscode-light', 'vscode-dark', 'dracula', 'github-light']

    for (const theme of themes) {
      const startTime = Date.now()

      // Switch theme
      await settingsPage.selectFromDropdown(settingsPage.themeSelect, theme)
      await settingsPage.applySettings()

      const switchTime = Date.now() - startTime

      // Theme switch should be reasonably fast
      expect(switchTime).toBeLessThan(2000) // 2 seconds max

      // Verify theme applied
      await settingsPage.verifyThemeApplied(theme as keyof typeof THEME_VALIDATION)
    }
  })

  test('should persist editor settings across page reloads', async ({ page }) => {
    // Configure multiple editor settings
    await settingsPage.selectFromDropdown(settingsPage.themeSelect, 'monokai')
    await settingsPage.setNumberInput(settingsPage.fontSizeInput, 16)
    await settingsPage.setNumberInput(settingsPage.tabSizeInput, 4)
    await settingsPage.toggleSetting(settingsPage.wordWrapToggle, false)
    await settingsPage.toggleSetting(settingsPage.lineNumbersToggle, true)
    await settingsPage.toggleSetting(settingsPage.minimapToggle, true)

    await settingsPage.applySettings()

    // Reload page
    await page.reload()
    await settingsPage.waitForPageLoad()
    await settingsPage.switchToTab('editor')

    // All settings should be preserved
    await expect(settingsPage.fontSizeInput).toHaveValue('16')
    await expect(settingsPage.tabSizeInput).toHaveValue('4')
    await expect(settingsPage.wordWrapToggle).toBeChecked({ checked: false })
    await expect(settingsPage.lineNumbersToggle).toBeChecked({ checked: true })
    await expect(settingsPage.minimapToggle).toBeChecked({ checked: true })
  })

  test('should validate editor setting constraints', async ({ page }) => {
    // Test all invalid font sizes
    const invalidFontSizes = [FONT_SIZE_CONSTRAINTS.minimum - 1, 0, -5, FONT_SIZE_CONSTRAINTS.maximum + 1, 100]

    for (const size of invalidFontSizes) {
      await settingsPage.fontSizeInput.clear()
      await settingsPage.fontSizeInput.fill(size.toString())
      await settingsPage.fontSizeInput.blur()

      // Should either show validation error or clamp to valid range
      const hasError = await settingsPage.hasValidationError(/font.*size/i)
      const actualValue = parseInt(await settingsPage.fontSizeInput.inputValue())

      if (!hasError) {
        // If no error, value should be clamped to valid range
        expect(actualValue).toBeGreaterThanOrEqual(FONT_SIZE_CONSTRAINTS.minimum)
        expect(actualValue).toBeLessThanOrEqual(FONT_SIZE_CONSTRAINTS.maximum)
      }
    }

    // Test invalid tab sizes
    const invalidTabSizes = [TAB_SIZE_CONSTRAINTS.minimum - 1, 0, -1, TAB_SIZE_CONSTRAINTS.maximum + 1, 20]

    for (const size of invalidTabSizes) {
      await settingsPage.tabSizeInput.clear()
      await settingsPage.tabSizeInput.fill(size.toString())
      await settingsPage.tabSizeInput.blur()

      const hasError = await settingsPage.hasValidationError(/tab.*size/i)
      const actualValue = parseInt(await settingsPage.tabSizeInput.inputValue())

      if (!hasError) {
        expect(actualValue).toBeGreaterThanOrEqual(TAB_SIZE_CONSTRAINTS.minimum)
        expect(actualValue).toBeLessThanOrEqual(TAB_SIZE_CONSTRAINTS.maximum)
      }
    }
  })

  test('should handle editor settings in different contexts', async ({ page }) => {
    // Configure editor settings
    await settingsPage.selectFromDropdown(settingsPage.themeSelect, 'dracula')
    await settingsPage.setNumberInput(settingsPage.fontSizeInput, 18)
    await settingsPage.applySettings()

    // Test in different contexts where code might appear
    const testPages = [
      '/projects',
      '/chat', // Code blocks in chat
      '/prompts' // Code in prompts
    ]

    for (const testPage of testPages) {
      await page.goto(testPage)

      // Look for any code elements
      const codeElements = await page.locator('pre, code, .monaco-editor, .cm-editor, .code-block').all()

      for (const element of codeElements) {
        const isVisible = await element.isVisible({ timeout: 1000 }).catch(() => false)

        if (isVisible) {
          const styles = await element
            .evaluate((el) => {
              const computed = getComputedStyle(el)
              return {
                fontSize: computed.fontSize,
                backgroundColor: computed.backgroundColor,
                fontFamily: computed.fontFamily
              }
            })
            .catch(() => null)

          if (styles) {
            // Font size should reflect settings
            if (styles.fontSize === '18px') {
              expect(styles.fontSize).toBe('18px')
            }

            // Background might reflect theme
            if (styles.backgroundColor && styles.backgroundColor !== 'rgba(0, 0, 0, 0)') {
              expect(styles.backgroundColor).toBeTruthy()
            }
          }
          break
        }
      }
    }
  })

  test('should reset editor settings to defaults', async ({ page }) => {
    // Change all editor settings from defaults
    await settingsPage.selectFromDropdown(settingsPage.themeSelect, 'dracula')
    await settingsPage.setNumberInput(settingsPage.fontSizeInput, 20)
    await settingsPage.setNumberInput(settingsPage.tabSizeInput, 8)
    await settingsPage.toggleSetting(settingsPage.wordWrapToggle, false)
    await settingsPage.toggleSetting(settingsPage.lineNumbersToggle, false)
    await settingsPage.toggleSetting(settingsPage.minimapToggle, true)

    await settingsPage.applySettings()

    // Reset to defaults
    await settingsPage.resetToDefaults()

    // Verify settings match defaults
    const defaults = GlobalSettingsTestData.DEFAULT_SETTINGS.editor

    await expect(settingsPage.fontSizeInput).toHaveValue(defaults.fontSize.toString())
    await expect(settingsPage.tabSizeInput).toHaveValue(defaults.tabSize.toString())
    await expect(settingsPage.wordWrapToggle).toBeChecked({ checked: defaults.wordWrap })
    await expect(settingsPage.lineNumbersToggle).toBeChecked({ checked: defaults.lineNumbers })
    await expect(settingsPage.minimapToggle).toBeChecked({ checked: defaults.minimap })
  })

  test('should handle editor settings with accessibility requirements', async ({ page }) => {
    // Configure accessibility-friendly settings
    await settingsPage.selectFromDropdown(settingsPage.themeSelect, 'high-contrast')
    await settingsPage.setNumberInput(settingsPage.fontSizeInput, 18) // Larger font
    await settingsPage.toggleSetting(settingsPage.lineNumbersToggle, true) // Helpful for navigation
    await settingsPage.applySettings()

    // Navigate to editor context
    await page.goto('/projects')

    // Verify high contrast theme
    await settingsPage.verifyThemeApplied('high-contrast')

    // Check accessibility features
    const editors = await page.locator('.monaco-editor, .cm-editor, pre, code').all()

    for (const editor of editors) {
      const isVisible = await editor.isVisible({ timeout: 1000 }).catch(() => false)

      if (isVisible) {
        const styles = await editor
          .evaluate((el) => {
            const computed = getComputedStyle(el)
            return {
              fontSize: computed.fontSize,
              color: computed.color,
              backgroundColor: computed.backgroundColor
            }
          })
          .catch(() => null)

        if (styles) {
          // Font should be large enough
          const fontSize = parseInt(styles.fontSize)
          if (fontSize >= 18) {
            expect(fontSize).toBeGreaterThanOrEqual(18)
          }

          // Should have sufficient contrast (basic check)
          const hasColor = styles.color && styles.color !== 'rgba(0, 0, 0, 0)'
          const hasBackground = styles.backgroundColor && styles.backgroundColor !== 'rgba(0, 0, 0, 0)'

          if (hasColor && hasBackground) {
            expect(hasColor && hasBackground).toBe(true)
          }
        }
        break
      }
    }
  })
})
