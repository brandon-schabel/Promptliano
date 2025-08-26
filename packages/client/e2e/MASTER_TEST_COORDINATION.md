# Master Test Coordination Guide

## Overview
This document provides comprehensive coordination guidelines for running Playwright tests in parallel across all Promptliano application pages and features. It ensures consistent setup, proper data management, and reliable test execution.

## Current Test Infrastructure Analysis

### Test Statistics
- **Total Test Files**: 23 existing spec files
- **Test Configuration Files**: 5 configurations (main, basic, minimal, fast, CI)
- **Browser Coverage**: Chrome, Firefox, Safari, Mobile Chrome, Mobile Safari
- **Page Object Models**: 10+ specialized page classes
- **Test Utilities**: MCP integration, API helpers, data factories

### Architecture Strengths
- ✅ Comprehensive Page Object Model pattern
- ✅ Robust test data factories with realistic templates
- ✅ Advanced MCP (Model Context Protocol) integration with graceful fallbacks
- ✅ Multi-browser and mobile testing support
- ✅ Sophisticated API mocking and error handling
- ✅ Performance and visual regression testing capabilities

## Prerequisites for Parallel Test Execution

### 1. Environment Setup
```bash
# Required servers must be running
bun run dev                    # Frontend development server (port 1420)
cd packages/server && bun run dev  # Backend API server (port 3147)

# Verify servers are responding
curl http://localhost:1420/health  # Frontend health check
curl http://localhost:3147/health  # Backend API health check
```

### 2. Database State Management
```bash
# Clean database state before test runs
rm -f /Users/brandon/Programming/promptliano/data/promptliano.db*

# Or use test database isolation
export NODE_ENV=test
export DATABASE_PATH=":memory:"
```

### 3. MCP Server Status
```bash
# Check MCP server availability (optional - tests handle graceful fallbacks)
curl http://localhost:3147/mcp/health
```

## Test Execution Strategies

### 1. Full Test Suite (Recommended for CI)
```bash
# Complete test run across all browsers
bun run test:e2e

# Configuration: packages/client/playwright.config.ts
# - 5 browser projects (Chrome, Firefox, Safari, Mobile Chrome, Mobile Safari)
# - Parallel execution with worker management
# - Comprehensive reporting (HTML, JSON, traces)
```

### 2. Fast Feedback Loop (Development)
```bash
# Quick smoke tests for rapid iteration
bun run test:e2e:basic

# Configuration: packages/client/playwright-basic.config.ts
# - Single browser (Chrome)
# - Essential functionality only
# - No backend dependencies required
```

### 3. Specific Browser Testing
```bash
# Target specific browsers
bun run test:e2e:chromium
bun run test:e2e:firefox
bun run test:e2e:webkit
```

### 4. Debug Mode
```bash
# Interactive debugging with UI
bun run test:e2e:debug
```

## Data Management Strategy

### Test Data Isolation
```typescript
// Each test file uses isolated data scopes
test.beforeEach(async ({ page }) => {
  dataManager = new TestDataManager(page)
  // Creates isolated test data namespace
})

test.afterEach(async () => {
  await dataManager.cleanup()
  // Ensures complete cleanup of test data
})
```

### Database Isolation Patterns
```typescript
// Memory database for complete isolation
const testConfig = {
  databasePath: ':memory:',
  autoMigrate: true,
  cleanupOnExit: true
}

// Transactional tests with rollback
test.beforeEach(async ({ page }) => {
  await page.evaluate(() => db.transaction.begin())
})

test.afterEach(async ({ page }) => {
  await page.evaluate(() => db.transaction.rollback())
})
```

## Shared Test Data Setup

### Global Test Data (Available to All Tests)
```typescript
// Location: e2e/fixtures/shared-test-data.ts
export const SharedTestData = {
  defaultProject: TestDataFactory.createProject({
    name: 'Shared Test Project',
    path: '/tmp/shared-project'
  }),
  
  commonPrompts: TestDataFactory.createPromptSet(),
  
  testQueues: [
    TestDataFactory.createQueue({ name: 'Features' }),
    TestDataFactory.createQueue({ name: 'Bugs' }),
    TestDataFactory.createQueue({ name: 'Improvements' })
  ]
}
```

### Test-Specific Data Factories
```typescript
// Each test creates its own isolated data
const projectData = TestDataFactory.createProject({
  name: `Test-${testInfo.title}-${Date.now()}`
})
```

## Parallel Execution Considerations

### 1. Resource Management
- **Database Connections**: Use connection pooling with limits
- **File System**: Use unique temporary directories per test
- **Network Ports**: Avoid hardcoded ports, use dynamic allocation
- **Browser Instances**: Managed automatically by Playwright

### 2. Test Independence
```typescript
// Each test must be completely independent
test('feature X', async ({ page }) => {
  // ✅ Create own test data
  const data = TestDataFactory.createProject()
  
  // ✅ Use isolated selectors
  await page.getByTestId(`project-${data.name}`)
  
  // ❌ Avoid shared selectors
  await page.getByTestId('first-project') // Could conflict
})
```

### 3. MCP Integration Safety
```typescript
// Tests handle MCP availability gracefully
await MCPTestHelpers.testMCPIntegrationSafely(page, 'project creation', async (mcpAvailable) => {
  if (mcpAvailable) {
    // Test with real MCP integration
  } else {
    // Test with mocked MCP functionality
  }
})
```

## Configuration Management

### Environment Variables
```bash
# Test environment configuration
export NODE_ENV=test
export VITE_BASE_URL=http://localhost:1420
export API_BASE_URL=http://localhost:3147
export DATABASE_PATH=":memory:"
export MCP_SERVER_URL=http://localhost:3147/mcp
```

### Test Configuration Matrix

| Config File | Purpose | Browser Count | MCP Required | Backend Required |
|-------------|---------|---------------|--------------|------------------|
| `playwright.config.ts` | Production testing | 5 | No (graceful fallback) | Yes |
| `playwright-basic.config.ts` | Smoke testing | 1 | No | No |
| `playwright-minimal.config.ts` | Development/Debug | 1 | No | Yes |
| `playwright-fast.config.ts` | Quick validation | 1 | No | Yes |
| `playwright-ci.config.ts` | CI/CD pipeline | 4 | No | Yes |

## Error Handling and Recovery

### 1. Flaky Test Patterns
```typescript
// Built-in retry mechanisms
test('flaky operation', async ({ page }) => {
  await test.step('with retry logic', async () => {
    await expect(async () => {
      await page.getByTestId('dynamic-content').click()
      await expect(page.getByText('Success')).toBeVisible()
    }).toPass({ timeout: 15000, intervals: [1000] })
  })
})
```

### 2. Network Failure Recovery
```typescript
// Network request mocking and fallbacks
await page.route('**/api/**', async route => {
  try {
    await route.continue()
  } catch (error) {
    // Provide fallback response
    await route.fulfill({ status: 200, body: JSON.stringify(mockData) })
  }
})
```

### 3. MCP Connection Issues
```typescript
// Automatic fallback to mocked MCP functionality
const mcpEnv = await MCPTestHelpers.createMCPTestEnvironment(page, {
  enableMocks: true,
  requireReal: false
})
```

## Execution Order Recommendations

### 1. Critical Path First
1. **Basic Smoke Tests** - Ensure app loads and navigates
2. **Authentication Setup** - Verify user session management
3. **Core Navigation** - Test sidebar and routing
4. **Project Management** - CRUD operations and file handling

### 2. Feature Testing
1. **Project Page Integration** - File trees, prompts, context
2. **Chat System** - Provider integration and messaging
3. **Prompt Management** - Template creation and organization
4. **Flow Integration** - Tickets, queues, and task management

### 3. Advanced Features
1. **Provider Configuration** - API key management
2. **Settings Management** - Global application settings
3. **Performance Testing** - Large data sets and responsiveness
4. **Visual Regression** - UI consistency across browsers

## Monitoring and Reporting

### 1. Test Artifacts
```bash
# Generated after test runs
playwright-report/           # HTML report with screenshots
test-results/               # Raw test results and traces
test-results.json          # Machine-readable results
```

### 2. Performance Metrics
```typescript
// Built into test utilities
const performanceMetrics = await TestHelpers.measurePageLoad(page)
expect(performanceMetrics.loadTime).toBeLessThan(3000)
```

### 3. Visual Regression Detection
```typescript
// Automated screenshot comparison
await expect(page).toHaveScreenshot('page-layout.png')
```

## Troubleshooting Common Issues

### 1. Port Conflicts
```bash
# Check for port conflicts
lsof -i :1420  # Frontend
lsof -i :3147  # Backend

# Use alternative ports if needed
export VITE_DEV_PORT=1421
export API_DEV_PORT=3148
```

### 2. Database Lock Issues
```bash
# Clear database locks
rm -f data/*.db-wal data/*.db-shm

# Or use memory database
export DATABASE_PATH=":memory:"
```

### 3. Test Timeout Issues
```typescript
// Increase timeouts for slower operations
test.setTimeout(60000) // 1 minute for complex tests

// Or per-operation timeouts
await expect(element).toBeVisible({ timeout: 15000 })
```

### 4. MCP Server Not Available
Tests automatically handle MCP unavailability with graceful degradation:
```typescript
// Tests work with or without MCP
const mcpStatus = await MCPTestHelpers.checkMCPAvailability(page)
if (!mcpStatus.connected) {
  console.log('Using mocked MCP functionality')
}
```

## Best Practices Summary

### Test Design
- ✅ Use Page Object Model for UI interactions
- ✅ Create isolated test data with factories
- ✅ Implement proper cleanup in `afterEach`
- ✅ Handle async operations with proper waits
- ✅ Use semantic selectors (getByRole, getByLabel)

### Performance
- ✅ Run tests in parallel when possible
- ✅ Use efficient selectors and waits
- ✅ Mock external dependencies
- ✅ Implement retry logic for flaky operations

### Maintainability
- ✅ Keep tests focused and atomic
- ✅ Use descriptive test names and structure
- ✅ Maintain consistent naming conventions
- ✅ Document complex test scenarios

## Next Steps

This master coordination document supports the individual test plans for:
- Project Page (with Prompt management, File Tree, Flow Features)
- Chat Page (AI provider integration and messaging)
- Prompt Management Page (Template CRUD and organization)
- Provider Page (API configuration and testing)
- Manage Project Modal (Project creation and import)
- Global Settings Page (Application configuration)

Each page-specific test plan builds upon this coordination framework to ensure reliable, maintainable, and comprehensive test coverage.