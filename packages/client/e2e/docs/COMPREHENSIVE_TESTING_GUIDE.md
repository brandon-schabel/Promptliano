# Comprehensive E2E Testing Guide for Promptliano

This guide covers the enhanced Playwright E2E testing infrastructure for Promptliano, including custom fixtures, advanced utilities, and best practices for testing complex UI interactions.

## 🏗️ Architecture Overview

The testing infrastructure is built on several key components:

1. **Custom Fixtures** - Provide isolated test environments with database, API, and authentication
2. **Advanced Utilities** - Specialized tools for Monaco editor, token counting, git integration
3. **Enhanced Page Objects** - Comprehensive coverage of all UI components and interactions
4. **Test Data Builders** - Fluent API for creating complex, realistic test scenarios
5. **Smart Wait Strategies** - Robust waiting mechanisms for complex async operations

## 📦 Core Components

### Custom Fixtures (`test-isolation-fixtures.ts`)

The custom fixtures provide complete test isolation and common testing utilities:

```typescript
import { test, expect, authenticatedTest, testWithSampleData } from '../fixtures/test-isolation-fixtures'

test('my test', async ({ 
  database,        // Isolated database operations
  apiClient,       // Authenticated API client
  authHelper,      // Authentication management
  testContext,     // Test scenario management
  waitUtils,       // Smart waiting strategies
  customAssertions,// Enhanced assertions
  pageObjects     // All page objects
}) => {
  // Your test code here
})
```

### Advanced Test Utilities (`advanced-test-utilities.ts`)

Specialized utilities for complex UI interactions:

```typescript
import { PromptlianoTestUtils } from '../utils/advanced-test-utilities'

test('advanced features', async ({ page }) => {
  const testUtils = new PromptlianoTestUtils(page)
  
  // Monaco editor interactions
  await testUtils.monaco.typeInMonaco('[data-testid="editor"]', 'console.log("Hello")')
  await testUtils.monaco.expectMonacoContent('[data-testid="editor"]', /Hello/)
  
  // Token counting
  await testUtils.tokenCounting.expectTokenCountIncrease(
    '[data-testid="token-count"]',
    async () => { /* action that adds content */ }
  )
  
  // Git operations
  await testUtils.git.stageFiles(['file1.js', 'file2.js'])
  await testUtils.git.expectGitStatus({ staged: ['file1.js'] })
  
  // Advanced UI interactions
  await testUtils.ui.dragAndDropWithValidation(
    '[data-testid="source"]',
    '[data-testid="target"]'
  )
})
```

### Enhanced Test Builders (`enhanced-test-builders.ts`)

Fluent API for creating realistic test scenarios:

```typescript
import { createProject, createPrompt, createScenario, PredefinedScenarios } from '../fixtures/enhanced-test-builders'

test('with custom scenario', async ({ database }) => {
  // Build custom scenario
  const scenario = createScenario('web_dev')
    .withProject(p => p.asWebApp())
    .withPrompts(
      p => p.asCodeReview(),
      p => p.asTesting()
    )
    .withTickets(
      t => t.asFeature().title('User Authentication'),
      t => t.asBugFix().title('Login Issue')
    )
    .build()
  
  // Or use predefined scenarios
  const fullStackScenario = PredefinedScenarios.fullStack().build()
})
```

## 🚀 Getting Started

### 1. Basic Test Structure

```typescript
import { test, expect } from '../fixtures/test-isolation-fixtures'
import { PromptlianoTestUtils } from '../utils/advanced-test-utilities'

test.describe('Feature Name', () => {
  let testUtils: PromptlianoTestUtils

  test.beforeEach(async ({ 
    page, 
    authHelper, 
    testContext,
    waitUtils 
  }) => {
    testUtils = new PromptlianoTestUtils(page)
    await testUtils.setupAdvancedTesting()
    
    // Authenticate and prepare data
    await authHelper.authenticate()
    await testContext.sampleState()
    
    // Navigate to test page
    await page.goto('/projects/1')
    await waitUtils.waitForReactReady()
  })

  test.afterEach(async () => {
    await testUtils.cleanupAdvancedTesting()
  })

  test('should perform specific functionality', async ({ 
    pageObjects, 
    customAssertions 
  }) => {
    // Test implementation
  })
})
```

### 2. Using Authenticated Tests

```typescript
import { authenticatedTest } from '../fixtures/test-isolation-fixtures'

authenticatedTest('authenticated feature', async ({ 
  page, 
  pageObjects 
}) => {
  // User is already authenticated
  await pageObjects.projectPage.gotoProject(1)
  // ... test implementation
})
```

### 3. Using Pre-populated Data

```typescript
import { testWithSampleData } from '../fixtures/test-isolation-fixtures'

testWithSampleData('test with data', async ({ 
  page, 
  testContext, 
  pageObjects 
}) => {
  // Sample data is already loaded
  const { project, prompts, tickets } = testContext.scenario
  
  await pageObjects.projectPage.gotoProject(project.id)
  // ... test implementation
})
```

## 🎯 Testing Specific Features

### Project Context Tab

```typescript
test('project context features', async ({ 
  pageObjects, 
  customAssertions, 
  waitUtils 
}) => {
  const { projectPage } = pageObjects
  
  // Navigate to context tab
  await projectPage.contextTab.click()
  
  // Test user input with token counting
  await testUtils.tokenCounting.expectTokenCountIncrease(
    '[data-testid="token-count"]',
    async () => {
      await projectPage.fillUserInput('Help me implement authentication')
    },
    10 // Expected token increase
  )
  
  // Test file suggestions
  await projectPage.searchFiles()
  await waitUtils.waitForModal('[data-testid="file-suggestions-dialog"]')
  await projectPage.selectFileSuggestion(0)
  
  // Test prompt suggestions
  await projectPage.suggestPrompts()
  await projectPage.selectPromptSuggestion(0)
  
  // Test copy to chat
  await projectPage.copyToChat()
  await waitUtils.waitForURL(/.*\/chat/)
})
```

### Prompt Management with Hover Actions

```typescript
test('prompt hover actions', async ({ 
  pageObjects, 
  customAssertions 
}) => {
  const { projectPage } = pageObjects
  
  const promptTitle = 'Code Review Prompt'
  
  // Test hover behavior
  await testUtils.ui.preciseHover(
    `[data-testid="prompt-card"]:has-text("${promptTitle}")`,
    { duration: 300 }
  )
  
  // Test copy icon
  await projectPage.promptCardCopyIcon(promptTitle).click()
  await customAssertions.expectToast(/copied to clipboard/i)
  
  // Test 3-dot menu actions
  await projectPage.viewPrompt(promptTitle)
  await expect(projectPage.promptViewDialog).toBeVisible()
  
  await projectPage.editPrompt(promptTitle)
  await testUtils.monaco.waitForMonacoReady()
  
  // Edit in Monaco
  await testUtils.monaco.typeInMonaco(
    '[data-testid="prompt-editor"]', 
    '\n\nAdditional instructions'
  )
  
  // Export as markdown
  const download = await projectPage.exportPromptAsMarkdown(promptTitle)
  expect(download.suggestedFilename()).toContain('.md')
})
```

### File Tree Operations

```typescript
test('file tree interactions', async ({ 
  pageObjects, 
  customAssertions 
}) => {
  const { projectPage } = pageObjects
  
  // Multi-select files with token counting
  await testUtils.tokenCounting.expectTokenCountIncrease(
    '[data-testid="selected-files-token-count"]',
    async () => {
      await testUtils.ui.multiSelectWithCheckboxes(
        '[data-testid="file-tree"]',
        [
          '[data-testid="file-node"]:has-text("package.json")',
          '[data-testid="file-node"]:has-text("README.md")'
        ]
      )
    }
  )
  
  // Context menu operations
  await projectPage.copyFileRelativePath('package.json')
  await customAssertions.expectClipboard(/package\.json/)
  
  await projectPage.copyFileContents('package.json')
  await customAssertions.expectClipboard(/"name":\s*"/)
})
```

### Git Integration

```typescript
test('git operations', async ({ 
  pageObjects, 
  waitUtils 
}) => {
  const { projectPage } = pageObjects
  
  // Check git status
  const gitStatuses = await testUtils.git.getGitFileStatuses()
  
  if (gitStatuses.modified.length > 0) {
    const testFile = gitStatuses.modified[0]
    
    // Stage file
    await projectPage.stageFile(testFile)
    await waitUtils.waitForToast(/staged successfully/i)
    
    // Verify git status
    await testUtils.git.expectGitStatus({
      staged: [testFile]
    })
    
    // Open diff
    await testUtils.git.openGitDiff(testFile)
    await expect(page.getByTestId('git-diff-dialog')).toBeVisible()
  }
  
  // Bulk operations
  if (gitStatuses.modified.length >= 2) {
    await testUtils.git.bulkGitOperation('stage', gitStatuses.modified.slice(0, 2))
  }
})
```

### Monaco Editor Interactions

```typescript
test('monaco editor features', async ({ page }) => {
  await testUtils.monaco.waitForMonacoReady()
  
  const editorSelector = '[data-testid="code-editor"]'
  
  // Type code
  await testUtils.monaco.typeInMonaco(editorSelector, 'const greeting = "Hello World"')
  
  // Verify content
  await testUtils.monaco.expectMonacoContent(editorSelector, /Hello World/)
  
  // Test language detection
  await testUtils.monaco.expectMonacoLanguage(editorSelector, 'javascript')
  
  // Trigger actions
  await testUtils.monaco.triggerMonacoAction(editorSelector, 'editor.action.formatDocument')
  
  // Advanced editing
  await testUtils.monaco.typeInMonaco(editorSelector, '\nconsole.log(greeting)', {
    line: 2,
    column: 1
  })
})
```

## 🛠️ Configuration

### Playwright Config Enhancements

The enhanced configuration includes:

- **Increased timeouts** for complex operations
- **Optimized worker count** based on available CPU cores
- **Enhanced permissions** for clipboard and other browser features
- **Test isolation** with separate database per test run
- **Better retry strategies** for flaky tests

### Environment Variables

```bash
# Test database isolation
DATABASE_PATH=../database/data/playwright-test.db

# API configuration
VITE_API_URL=http://localhost:3147/api

# Test environment
NODE_ENV=test
LOG_LEVEL=warn
```

## 📊 Best Practices

### 1. Test Isolation

Always use the custom fixtures to ensure test isolation:

```typescript
// ✅ Good - Uses isolated fixtures
import { test } from '../fixtures/test-isolation-fixtures'

test('isolated test', async ({ database, authHelper }) => {
  const project = await database.createProject()
  // Test is completely isolated
})

// ❌ Bad - No isolation
import { test } from '@playwright/test'

test('non-isolated test', async ({ page }) => {
  // Might interfere with other tests
})
```

### 2. Smart Waiting

Use appropriate wait strategies for different scenarios:

```typescript
// ✅ Good - Smart waiting
await waitUtils.waitForReactReady()
await waitUtils.waitForAPIResponse(/\/api\/projects/)
await waitUtils.waitForToast(/success/i)

// ❌ Bad - Fixed timeouts
await page.waitForTimeout(5000)
```

### 3. Comprehensive Assertions

Use custom assertions for better test reliability:

```typescript
// ✅ Good - Custom assertions
await customAssertions.expectClipboard(/expected content/)
await customAssertions.expectToast(/operation completed/i)
await customAssertions.expectGitStatus('staged', ['file1.js'])

// ❌ Bad - Basic assertions only
expect(await page.textContent('.toast')).toContain('success')
```

### 4. Realistic Test Data

Use test builders for realistic scenarios:

```typescript
// ✅ Good - Realistic data
const scenario = PredefinedScenarios.webDevelopment().build()
const project = createProject().asWebApp().build()

// ❌ Bad - Minimal data
const project = { name: 'test', path: '/tmp' }
```

### 5. Proper Cleanup

Always clean up test resources:

```typescript
test.beforeEach(async () => {
  await testUtils.setupAdvancedTesting()
})

test.afterEach(async () => {
  await testUtils.cleanupAdvancedTesting()
})
```

## 🔍 Debugging

### Screenshots and Videos

The enhanced configuration automatically captures:
- Screenshots on failure
- Videos for failed tests
- Traces for debugging

### Test Artifacts

```bash
# View HTML report
bun run test:report

# View specific test trace
npx playwright show-trace test-results/trace.zip

# Debug mode with browser
bun run test:e2e:debug
```

### Common Issues

1. **Monaco Editor Not Ready**
   ```typescript
   // Always wait for Monaco
   await testUtils.monaco.waitForMonacoReady()
   ```

2. **Token Count Not Updated**
   ```typescript
   // Wait for token count updates
   await testUtils.tokenCounting.waitForTokenCountUpdate('[data-testid="token-count"]')
   ```

3. **Git Operations Timing**
   ```typescript
   // Wait for git operations to complete
   await testUtils.git.waitForGitOperation()
   ```

4. **React Hydration Issues**
   ```typescript
   // Ensure React is ready
   await waitUtils.waitForReactReady()
   ```

## 📈 Performance Considerations

### Parallel Execution

The configuration optimizes parallel execution:
- **Local**: Uses CPU core count / 2
- **CI**: Limited to 2 workers for stability

### Test Sharding

For large test suites, use sharding:

```bash
# Run tests in 4 shards
npx playwright test --shard=1/4
npx playwright test --shard=2/4
npx playwright test --shard=3/4
npx playwright test --shard=4/4
```

### Resource Management

- Each test gets an isolated database
- Cleanup happens automatically after each test
- Memory usage is optimized through proper fixture cleanup

## 🎉 Conclusion

This comprehensive testing infrastructure provides:

- **Complete test isolation** with custom fixtures
- **Advanced utilities** for complex UI testing
- **Realistic test data** generation
- **Smart waiting strategies** for reliability
- **Enhanced debugging** capabilities
- **Performance optimization** for large test suites

The infrastructure supports testing all Promptliano features including:
- Project context management
- Prompt hover actions and menus
- File tree operations with token counting
- Git integration and diff viewing  
- Monaco editor interactions
- Drag-and-drop functionality
- Responsive design
- Keyboard navigation
- Accessibility features

Follow the patterns and best practices outlined in this guide to create robust, maintainable E2E tests for Promptliano.