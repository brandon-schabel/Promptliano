# Playwright E2E Testing for Promptliano Client

This directory contains comprehensive end-to-end (E2E) tests for the Promptliano client application using Playwright. The tests cover all major functionality including project management, prompt creation, ticket workflows, queue processing, and MCP (Model Context Protocol) integration.

## 📁 Project Structure

```
e2e/
├── tests/                      # Test specifications
│   ├── projects.spec.ts        # Project management tests
│   ├── prompts.spec.ts         # Prompt creation and management tests
│   ├── tickets-queues.spec.ts  # Ticket and queue workflow tests
│   ├── mcp-integration.spec.ts # MCP tool integration tests
│   └── auth.setup.ts           # Authentication setup for tests
├── pages/                      # Page Object Model classes
│   ├── base.page.ts           # Base page with common functionality
│   ├── app.page.ts            # Main application wrapper
│   ├── projects.page.ts       # Projects page interactions
│   ├── prompts.page.ts        # Prompts page interactions
│   ├── tickets.page.ts        # Tickets page interactions
│   └── queue.page.ts          # Queue management interactions
├── fixtures/                   # Test data and utilities
│   ├── test-data.ts           # Test data factories and templates
│   └── .auth/                 # Authentication state files
├── utils/                      # Test utilities and helpers
│   └── test-helpers.ts        # Assertions, API helpers, and utilities
├── setup/                      # Global test setup
│   ├── global-setup.ts        # Global test initialization
│   └── global-teardown.ts     # Global test cleanup
└── README.md                  # This documentation
```

## 🚀 Quick Start

### Prerequisites

- **Bun**: Latest version installed
- **Node.js**: Version 20 or higher
- **Playwright**: Will be installed automatically via package.json

### Installation

1. **Install dependencies** (from the client package directory):

   ```bash
   cd packages/client
   bun install
   ```

2. **Install Playwright browsers**:

   ```bash
   bunx playwright install --with-deps
   ```

3. **Start the development servers** (in separate terminals):

   ```bash
   # Terminal 1: Start API server
   cd packages/server
   bun run dev

   # Terminal 2: Start client dev server
   cd packages/client
   bun run dev
   ```

### Running Tests

#### Local Development

```bash
# Run all E2E tests
bun run test:e2e

# Run tests with UI (interactive mode)
bun run test:e2e:ui

# Run tests in debug mode
bun run test:e2e:debug

# Run tests in headed mode (see browser)
bun run test:e2e:headed

# Run specific browser tests
bun run test:e2e:chromium
bun run test:e2e:firefox
bun run test:e2e:webkit

# Generate test code using Playwright codegen
bun run test:codegen

# View test reports
bun run test:report
```

#### Specific Test Categories

```bash
# Run only project management tests
bunx playwright test projects.spec.ts

# Run only MCP integration tests
bunx playwright test mcp-integration.spec.ts

# Run tests matching a pattern
bunx playwright test --grep "should create"

# Run tests with specific tags
bunx playwright test --grep "@smoke"
```

## 🧪 Test Categories

### 1. Project Management Tests (`projects.spec.ts`)

Tests the complete project lifecycle:

- **Project Creation**: Creating new projects with validation
- **Project Management**: Editing, deleting, and organizing projects
- **Project List**: Searching, filtering, and sorting projects
- **MCP Integration**: Project operations via MCP tools
- **Error Handling**: Network errors, validation errors, permission errors
- **Performance**: Load times and large dataset handling

**Key Test Scenarios:**

```typescript
test('should create a new project with valid data', async () => {
  const projectData = TestDataFactory.createProject({
    name: 'E2E Test Project',
    path: '/tmp/e2e-test-project',
    description: 'A test project created via E2E tests'
  })

  await projectsPage.createProject(projectData)
  expect(await projectsPage.projectExists(projectData.name)).toBe(true)
})
```

### 2. Prompt Management Tests (`prompts.spec.ts`)

Comprehensive prompt creation and management:

- **Prompt Creation**: Creating prompts with content, categories, and tags
- **Prompt Organization**: Filtering by category, searching, and tagging
- **Import/Export**: Markdown import/export functionality
- **MCP Integration**: Prompt operations via MCP tools
- **Editor Features**: Variable placeholders, code syntax highlighting
- **Performance**: Large content handling and efficient loading

**Key Test Scenarios:**

```typescript
test('should create prompt with variable placeholders', async () => {
  const promptData = TestDataFactory.createPrompt({
    name: 'Variable Test Prompt',
    content: 'Hello {{name}}, please help with {{task}}.'
  })

  await promptsPage.createPrompt(promptData)
  expect(await promptsPage.promptExists(promptData.name)).toBe(true)
})
```

### 3. Tickets and Queue Tests (`tickets-queues.spec.ts`)

End-to-end workflow testing:

- **Ticket Management**: Creating tickets with tasks, priorities, and assignments
- **Queue Processing**: Creating queues, adding items, processing workflows
- **Kanban Workflows**: Drag-and-drop operations, status updates
- **Integration Flows**: Ticket-to-queue workflows, project associations
- **MCP Integration**: Ticket and queue operations via MCP tools
- **Performance**: Large ticket sets and queue processing efficiency

**Key Test Scenarios:**

```typescript
test('should complete full development workflow', async () => {
  const scenario = TestDataFactory.createWorkflowScenario()

  // Create project, prompts, tickets, and queue
  // Process items through queue
  // Verify completion status
})
```

### 4. MCP Integration Tests (`mcp-integration.spec.ts`)

Model Context Protocol integration testing:

- **MCP Server Connection**: Verifying MCP client availability
- **Tool Registration**: Listing and verifying available MCP tools
- **Cross-Tool Workflows**: Complete workflows using multiple MCP tools
- **Data Synchronization**: Ensuring consistency between UI and MCP operations
- **Error Handling**: Graceful handling of MCP tool failures
- **Performance**: MCP operation response times

**Key Test Scenarios:**

```typescript
test('should create complete workflow via MCP tools', async () => {
  // Create project via project_manager MCP tool
  // Create prompts via prompt_manager MCP tool
  // Create tickets via ticket_manager MCP tool
  // Process via queue_processor MCP tool
  // Verify all operations completed successfully
})
```

## 📋 Page Object Model

The test suite uses the Page Object Model (POM) pattern for maintainable and reusable test code.

### Base Page (`base.page.ts`)

Provides common functionality used across all pages:

```typescript
export class BasePage {
  async goto(path: string = '/') {
    /* navigation */
  }
  async waitForPageLoad() {
    /* loading states */
  }
  async waitForElement(selector: string) {
    /* element waiting */
  }
  async takeScreenshot(name: string) {
    /* screenshots */
  }
  async waitForAPIResponse(urlPattern: string) {
    /* API monitoring */
  }
  // ... more common utilities
}
```

### Feature-Specific Pages

Each major feature has its own page object:

- **ProjectsPage**: Project creation, editing, deletion, and list management
- **PromptsPage**: Prompt creation, categorization, and search functionality
- **TicketsPage**: Ticket management, task handling, and filtering
- **QueuePage**: Queue creation, item management, and processing
- **AppPage**: Global navigation, sidebar, and app-wide functionality

### Usage Example

```typescript
test('example test', async ({ page }) => {
  const projectsPage = new ProjectsPage(page)
  const projectData = TestDataFactory.createProject()

  await projectsPage.goto()
  await projectsPage.createProject(projectData)
  expect(await projectsPage.projectExists(projectData.name)).toBe(true)
})
```

## 🏭 Test Data Management

### Test Data Factories

The `TestDataFactory` class provides consistent test data generation:

```typescript
// Create realistic project data
const projectData = TestDataFactory.createProject({
  name: 'My Test Project',
  path: '/custom/path'
})

// Create prompt with variables
const promptData = TestDataFactory.createPrompt({
  content: 'Hello {{name}}, help with {{task}}'
})

// Create complete workflow scenario
const scenario = TestDataFactory.createWorkflowScenario()
```

### Test Data Templates

Pre-defined templates for common scenarios:

```typescript
// Use realistic project templates
const webApp = TestDataTemplates.projects.webApp
const mobileApp = TestDataTemplates.projects.mobileApp

// Use common prompt templates
const codePrompt = TestDataTemplates.prompts.codeGeneration
const docsPrompt = TestDataTemplates.prompts.documentationWriter

// Use ticket templates
const bugFix = TestDataTemplates.tickets.bugFix
const feature = TestDataTemplates.tickets.feature
```

### Data Cleanup

The `TestDataManager` automatically tracks and cleans up test data:

```typescript
test.beforeEach(async ({ page }) => {
  dataManager = new TestDataManager(page)
})

test.afterEach(async () => {
  await dataManager.cleanup() // Automatically removes created test data
})
```

## 🛠️ Test Utilities

### Assertions (`TestAssertions`)

Custom assertions for common test patterns:

```typescript
// API response assertions
await TestAssertions.assertSuccessfulAPIResponse(page, /\/api\/projects/, 'POST')

// UI state assertions
await TestAssertions.assertToastMessage(page, 'Project created successfully')
await TestAssertions.assertNoErrors(page)

// Navigation assertions
await TestAssertions.assertNavigation(page, /\/projects\/\d+/)
```

### MCP Helpers (`MCPTestHelpers`)

Utilities for testing MCP integration:

```typescript
// Test MCP tool availability
const tools = await MCPTestHelpers.verifyMCPToolsAvailable(page)

// Call MCP tools directly
const result = await MCPTestHelpers.testProjectManagerTool(page, 'create', data)

// Test specific MCP operations
await MCPTestHelpers.testQueueProcessorTool(page, 'process_queue', { queueId })
```

### API Helpers (`APITestHelpers`)

Direct API interaction for test setup:

```typescript
// Create test data via API
const project = await APITestHelpers.createTestProject(page, projectData)

// Make direct API calls
const response = await APITestHelpers.makeAPICall(page, '/api/tickets', 'POST', data)
```

## ⚙️ Configuration

### Playwright Configuration (`playwright.config.ts`)

Key configuration settings:

```typescript
export default defineConfig({
  testDir: './e2e/tests',
  timeout: 30 * 1000,

  // Multi-browser testing
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ],

  // Web server integration
  webServer: [
    {
      command: 'cd ../server && bun run dev',
      url: 'http://localhost:3147',
      port: 3147
    },
    {
      command: 'bun run dev',
      url: 'http://localhost:1420',
      port: 1420
    }
  ]
})
```

### Environment Variables

Configure test behavior:

```bash
# Basic configuration
CI=true                    # Enable CI mode
NODE_ENV=test             # Set test environment

# Database configuration
DATABASE_PATH=:memory:    # Use in-memory database for tests

# API configuration
VITE_API_URL=http://localhost:3147

# MCP configuration
MCP_SERVER_URL=http://localhost:8080
SKIP_MCP_TESTS=true      # Skip MCP tests if server unavailable

# Test behavior
HEADLESS=true            # Run in headless mode
DEBUG_TESTS=true         # Enable debug output
SLOW_TESTS=false         # Skip slow performance tests
```

## 🚀 CI/CD Integration

### GitHub Actions Workflow

The project includes a comprehensive GitHub Actions workflow (`.github/workflows/playwright-e2e.yml`) that:

- **Runs tests in parallel** across 4 shards for faster execution
- **Tests multiple browsers** (Chromium, Firefox, WebKit)
- **Handles test artifacts** (reports, screenshots, videos)
- **Provides test result summaries** and deployment to GitHub Pages
- **Supports different triggers** (push, PR, manual)

### CI Configuration

```yaml
strategy:
  matrix:
    shard: [1, 2, 3, 4] # Parallel execution across 4 shards

steps:
  - name: Run Playwright tests
    run: bunx playwright test --shard=${{ matrix.shard }}/4
```

### Artifact Management

- **HTML Reports**: Comprehensive test reports with screenshots and traces
- **Test Results**: JSON test result files for analysis
- **Screenshots**: Failure screenshots for debugging
- **Videos**: Test execution videos (on failure)

## 🐛 Debugging and Troubleshooting

### Local Debugging

1. **Interactive Debug Mode**:

   ```bash
   bun run test:e2e:debug
   ```

2. **Using `page.pause()`** in tests:

   ```typescript
   test('debug example', async ({ page }) => {
     await page.goto('/')
     await page.pause() // Opens Playwright Inspector
     // ... rest of test
   })
   ```

3. **Headed Mode** to see browser:
   ```bash
   bun run test:e2e:headed
   ```

### Common Issues and Solutions

#### Issue: Tests timing out

**Solution**: Check if servers are running and accessible:

```bash
# Verify API server
curl http://localhost:3147/health

# Verify client server
curl http://localhost:1420
```

#### Issue: MCP tests failing

**Solution**: MCP tests are designed to gracefully handle unavailable MCP servers:

```bash
# Skip MCP tests
SKIP_MCP_TESTS=true bun run test:e2e

# Or run only MCP tests to debug
bunx playwright test mcp-integration.spec.ts
```

#### Issue: Database conflicts

**Solution**: Tests use isolated databases, but you can force cleanup:

```bash
# Clear test database
rm -rf /tmp/playwright-test-*

# Reset database state
cd packages/database && bun run db:reset
```

#### Issue: Port conflicts

**Solution**: Configure different ports:

```bash
# Use different ports
VITE_PORT=1421 API_PORT=3148 bun run test:e2e
```

### Test Debugging Tools

1. **Playwright Inspector**: Interactive debugging
2. **Trace Viewer**: Timeline view of test execution
3. **Report Viewer**: HTML reports with full context
4. **Screenshots**: Automatic failure screenshots
5. **Console Logs**: Browser console output capture

### Performance Monitoring

Tests include performance assertions:

```typescript
test('should load page within acceptable time', async ({ page }) => {
  const startTime = Date.now()
  await page.goto('/projects')
  const endTime = Date.now()

  expect(endTime - startTime).toBeLessThan(3000) // 3 second limit
})
```

## 📈 Best Practices

### Writing Effective E2E Tests

1. **Use Page Object Model**: Encapsulate page interactions
2. **Test User Journeys**: Focus on complete workflows
3. **Isolate Test Data**: Each test should have independent data
4. **Handle Async Operations**: Wait for loading states and API calls
5. **Assert Meaningful States**: Verify actual user-visible changes

### Test Organization

1. **Group Related Tests**: Use `describe` blocks for feature grouping
2. **Use Descriptive Names**: Test names should describe the scenario
3. **Order Tests Logically**: From basic functionality to complex workflows
4. **Share Setup Code**: Use `beforeEach` for common test setup

### Maintainability

1. **Keep Tests Simple**: One test should verify one main scenario
2. **Abstract Complex Operations**: Use page object methods for complex interactions
3. **Use Test Data Factories**: Consistent and realistic test data
4. **Regular Cleanup**: Remove obsolete tests and update selectors

### Performance Considerations

1. **Parallel Execution**: Run tests in parallel when possible
2. **Selective Testing**: Use tags to run subsets of tests
3. **Resource Management**: Clean up test data and close connections
4. **CI Optimization**: Use sharding and caching in CI environments

## 📚 Additional Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Page Object Model Guide](https://playwright.dev/docs/test-pom)
- [CI/CD Integration Guide](https://playwright.dev/docs/ci-intro)
- [Debugging Tests](https://playwright.dev/docs/debug)

## 🤝 Contributing

When adding new E2E tests:

1. **Follow the existing patterns** in the test suite
2. **Use the Page Object Model** for new page interactions
3. **Add test data factories** for new data types
4. **Include error handling tests** for new functionality
5. **Update documentation** for new test categories
6. **Test cross-browser compatibility** for critical user journeys

### Adding New Tests

1. Create new test files in `e2e/tests/`
2. Add corresponding page objects in `e2e/pages/`
3. Extend test data factories if needed
4. Add CI/CD configuration updates if required
5. Update this README with new test categories

---

**Happy Testing! 🎭**

The E2E test suite ensures Promptliano delivers a reliable and robust user experience across all major features and workflows.
