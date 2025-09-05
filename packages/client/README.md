# Promptliano Client

React-based web client for Promptliano, built with TanStack Router, TanStack Query, and shadcn/ui.

## Getting Started

### Development

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Start with specific port
bun run dev -- --port 3000
```

### Building

```bash
# Build for production
bun run build

# Preview production build
bun run preview
```

## E2E Testing with Playwright

### Overview

The client includes comprehensive E2E tests using Playwright, supporting multiple browsers and test configurations.

### Quick Start

```bash
# Install Playwright browsers (first time only)
bunx playwright install

# Run all tests
bun run test:e2e

# Run tests with UI
bun run test:e2e:ui

# Run tests in headed mode (see browser)
bun run test:e2e:headed
```

### Test Scripts

#### Basic Testing

```bash
# Run all E2E tests
bun run test:e2e

# Run tests with Playwright UI
bun run test:e2e:ui

# Debug tests (opens browser, pauses on first test)
bun run test:e2e:debug

# Run tests in headed mode (visible browser)
bun run test:e2e:headed
```

#### Browser-Specific Testing

```bash
# Run tests in Chromium only
bun run test:e2e:chromium

# Run tests in Firefox only
bun run test:e2e:firefox

# Run tests in WebKit (Safari) only
bun run test:e2e:webkit
```

#### Test Configurations

```bash
# Run basic smoke tests only
bun run test:e2e:basic

# Run basic smoke tests with UI
bun run test:e2e:basic:ui

# Run fast subset of tests
bun run test:e2e:fast

# Run CI configuration tests
bun run test:e2e:ci

# Run visual regression tests
bun run test:e2e:visual

# Update visual regression snapshots
bun run test:e2e:visual:update
```

#### Production Build Testing

```bash
# Build client and run tests against production build
bun run test:e2e:production

# Run production tests with browser visible
bun run test:e2e:production:headed

# Debug production tests
bun run test:e2e:production:debug

# Run production tests with existing build (skip rebuild)
bun run test:e2e:production:cached

# Update snapshots for production tests
bun run test:e2e:production:update

# CI-specific production testing
bun run test:e2e:ci:production
```

#### Test Utilities

```bash
# Generate test code using Playwright codegen
bun run test:codegen

# Show HTML test report
bun run test:report

# Pre-build client before tests
bun run test:e2e:prebuild
```

### Running Specific Test Suites

#### Project Tests

```bash
# Run all project tests
bunx playwright test e2e/tests/projects/

# Run navigation tests only
bunx playwright test e2e/tests/projects/projects-navigation.spec.ts

# Run context tab tests
bunx playwright test e2e/tests/projects/projects-context.spec.ts

# Run with specific browser
bunx playwright test e2e/tests/projects/ --project=chromium
```

#### Smoke Tests

```bash
# Run smoke tests only
bunx playwright test --grep="smoke"

# Run smoke tests for specific feature
bunx playwright test --grep="Projects.*smoke"
```

### Advanced Testing Options

#### Parallel Testing

```bash
# Run with specific number of workers
bunx playwright test --workers=4

# Run tests sequentially (no parallel)
bunx playwright test --workers=1
```

#### Filtering Tests

```bash
# Run tests matching pattern
bunx playwright test --grep="should navigate"

# Exclude tests matching pattern
bunx playwright test --grep-invert="flaky"

# Run specific test file
bunx playwright test e2e/tests/chat.spec.ts

# Run tests in specific directory
bunx playwright test e2e/tests/projects/
```

#### Debugging

```bash
# Debug specific test
bunx playwright test --debug e2e/tests/projects/projects-navigation.spec.ts

# Run with verbose output
bunx playwright test --verbose

# Pause on failure
bunx playwright test --headed --timeout=0

# Take screenshots on each step
bunx playwright test --screenshot=on
```

#### Reporting

```bash
# Generate HTML report
bunx playwright test --reporter=html

# Generate JSON report
bunx playwright test --reporter=json --reporter-output=results.json

# Generate multiple reports
bunx playwright test --reporter=html --reporter=json

# Show last HTML report
bunx playwright show-report

# Show specific report
bunx playwright show-report playwright-report
```

### Test Configuration Files

The project includes multiple Playwright configurations for different scenarios:

- `playwright.config.ts` - Default configuration for development
- `playwright-production.config.ts` - Testing against production builds
- `playwright-ci.config.ts` - Optimized for CI environments
- `playwright-fast.config.ts` - Quick subset of critical tests
- `playwright-visual.config.ts` - Visual regression testing
- `playwright-basic.config.ts` - Basic smoke tests only

### Writing Tests

#### Page Object Model

Tests use a simple Page Object Model pattern:

```typescript
// e2e/pages/projects.page.ts
import { ProjectsPage } from '../pages/projects.page'

test('should navigate to projects', async ({ page }) => {
  const projectsPage = new ProjectsPage(page)
  await projectsPage.goto()
  await projectsPage.expectInitializationState()
})
```

#### Test Helpers

Common operations are abstracted into helpers:

```typescript
// e2e/helpers/project-helpers.ts
import { ProjectHelpers } from '../helpers/project-helpers'

test.beforeEach(async ({ page }) => {
  const project = await ProjectHelpers.createTestProject(page, {
    name: 'Test Project',
    path: '/tmp/test'
  })
})
```

#### Test Data Fixtures

Consistent test data is provided through fixtures:

```typescript
// e2e/fixtures/project-data.ts
import { testProjects, testFiles } from '../fixtures/project-data'

test('should create project with files', async ({ page }) => {
  await ProjectHelpers.createTestProject(page, testProjects.simple)
  await ProjectHelpers.createTestFiles(page, 1, testFiles.simple)
})
```

### Environment Variables

```bash
# Set API URL for tests
VITE_API_URL=http://localhost:53147/api bun run test:e2e

# Enable debug output
DEBUG=pw:api bun run test:e2e

# Set specific base URL
VITE_BASE_URL=http://localhost:3000 bun run test:e2e

# Collect performance metrics
COLLECT_METRICS=true bun run test:e2e:production
```

### CI/CD Integration

#### GitHub Actions

```yaml
- name: Install Playwright
  run: bunx playwright install --with-deps

- name: Run E2E Tests
  run: bun run test:e2e:ci

- name: Upload Test Results
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: playwright-report
    path: packages/client/playwright-report/
```

#### Local CI Testing

```bash
# Run tests as they would run in CI
CI=true bun run test:e2e:ci

# Run with CI reporter configuration
CI=true bunx playwright test --reporter=github
```

### Troubleshooting

#### Common Issues

1. **Browser not installed**
   ```bash
   bunx playwright install chromium
   ```

2. **Port already in use**
   ```bash
   # Kill process on port
   lsof -ti:51420 | xargs kill -9
   ```

3. **Tests timing out**
   ```bash
   # Increase timeout
   bunx playwright test --timeout=60000
   ```

4. **Flaky tests**
   ```bash
   # Run with retries
   bunx playwright test --retries=2
   ```

#### Debug Commands

```bash
# Check Playwright version
bunx playwright --version

# List available browsers
bunx playwright install --list

# Open Playwright inspector
bunx playwright inspect

# Record new tests
bunx playwright codegen http://localhost:5173
```

### Performance Testing

```bash
# Run with performance metrics
COLLECT_METRICS=true bun run test:e2e:production

# Run with trace recording
bunx playwright test --trace=on

# View trace
bunx playwright show-trace trace.zip
```

### Best Practices

1. **Test Independence**: Each test should set up its own data and clean up after itself
2. **Use Page Objects**: Encapsulate page interactions in page object classes
3. **Reliable Selectors**: Prefer data-testid over text or CSS selectors
4. **Proper Waits**: Use Playwright's built-in waiting mechanisms
5. **Parallel Execution**: Tests should be able to run in parallel
6. **Clear Assertions**: Use explicit assertions with clear error messages

### Test Directory Structure

```
e2e/
├── fixtures/           # Test data and fixtures
│   ├── auth.json      # Authentication state
│   └── project-data.ts # Sample test data
├── helpers/           # Test utility functions
│   └── project-helpers.ts
├── pages/             # Page Object Models
│   └── projects.page.ts
├── setup/             # Global setup/teardown
│   ├── global-setup.ts
│   └── global-teardown.ts
├── tests/             # Test specifications
│   ├── projects/      # Project feature tests
│   │   ├── projects-navigation.spec.ts
│   │   └── projects-context.spec.ts
│   └── smoke/         # Smoke tests
└── utils/             # Utility functions
```

## Other Scripts

### Type Checking

```bash
# Run TypeScript type checking
bun run typecheck

# Validate types and check database imports
bun run validate-types
```

### Testing

```bash
# Run unit tests
bun run test

# Run unit tests only
bun run test:unit
```

## Environment Configuration

Create a `.env` file for local development:

```env
VITE_API_URL=http://localhost:3147/api
VITE_BASE_URL=http://localhost:5173
```

## Contributing

1. Write tests for new features
2. Ensure all tests pass before submitting PR
3. Update test documentation when adding new test patterns
4. Use consistent test data fixtures
5. Follow the established Page Object Model pattern

## Resources

- [Playwright Documentation](https://playwright.dev)
- [TanStack Router Documentation](https://tanstack.com/router)
- [shadcn/ui Components](https://ui.shadcn.com)
- [Project Documentation](../../README.md)