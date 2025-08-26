# Prompt Management E2E Testing Guide

This guide provides comprehensive documentation for the Prompt Management Page E2E test suite, including usage instructions, architecture overview, and best practices.

## 📋 Table of Contents

- [Overview](#overview)
- [Test Suite Architecture](#test-suite-architecture)
- [Running Tests](#running-tests)
- [Test Data Management](#test-data-management)
- [Page Object Model](#page-object-model)
- [Test Categories](#test-categories)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## 🎯 Overview

The Prompt Management test suite provides comprehensive E2E testing coverage for all prompt management functionality including:

- **Import Functionality**: Markdown file import with validation and error handling
- **CRUD Operations**: Create, read, update, delete prompts with full validation
- **Search & Filtering**: Text search, category filters, tag-based filtering
- **Sorting & Organization**: Sort by title, date, token count with persistence
- **Bulk Operations**: Multi-select, bulk export, bulk delete operations
- **Performance**: Large dataset handling, memory management, response times
- **Accessibility**: Keyboard navigation, ARIA compliance, screen reader support
- **Error Handling**: Network errors, validation errors, edge cases

## 🏗️ Test Suite Architecture

### File Structure

```
packages/client/e2e/
├── fixtures/
│   └── prompt-management-data.ts          # Test data definitions
├── pages/
│   ├── prompt-management-page.ts          # Main page object model
│   └── prompts.page.ts                    # Legacy page object (updated)
├── tests/
│   ├── prompt-management-comprehensive.spec.ts  # Core functionality tests
│   ├── prompt-management-advanced.spec.ts       # Advanced scenarios
│   └── prompts.spec.ts                         # Basic integration tests
├── utils/
│   └── prompt-test-data-manager.ts        # Test data management utility
├── configs/
│   └── prompt-management-test-config.ts   # Test configuration
└── docs/
    └── PROMPT_MANAGEMENT_TESTING_GUIDE.md # This guide
```

### Key Components

1. **Test Data Fixtures**: Comprehensive test data for all scenarios
2. **Page Object Model**: Encapsulated UI interactions and element selectors
3. **Test Data Manager**: Database state management and file operations
4. **Test Configuration**: Environment-specific settings and strategies

## 🚀 Running Tests

### Quick Start

```bash
# Run all prompt management tests
npm run test:e2e -- --grep "Prompt Management"

# Run specific test categories
npm run test:e2e:prompts                    # All prompt tests
npm run test:e2e:prompts:import             # Import functionality only
npm run test:e2e:prompts:performance        # Performance tests only
npm run test:e2e:prompts:accessibility      # Accessibility tests only
```

### Test Execution Strategies

#### 1. Comprehensive Testing

```bash
# Full test suite (recommended for CI/CD)
npm run test:e2e -- --config=prompt-comprehensive
```

#### 2. Development Testing

```bash
# Interactive development with slower execution
npm run test:e2e:dev -- --grep "Prompt Management"
```

#### 3. Smoke Testing

```bash
# Quick validation of core functionality
npm run test:e2e:smoke -- --grep "should display.*should create.*should import"
```

#### 4. Performance Testing

```bash
# Performance and load testing
npm run test:e2e:performance -- --grep "@performance"
```

### Browser-Specific Testing

```bash
# Test across all browsers
npm run test:e2e:prompts:cross-browser

# Specific browsers
npm run test:e2e:prompts -- --project=chromium
npm run test:e2e:prompts -- --project=firefox
npm run test:e2e:prompts -- --project=webkit
```

## 📊 Test Data Management

### Test Data Structure

The test suite uses structured test data defined in `prompt-management-data.ts`:

```typescript
interface PromptTestData {
  title: string
  content: string
  tags: string[]
  category: string
  tokenCount: number
}
```

### Data Factories

```typescript
// Create unique test data
const prompt = PromptManagementDataFactory.createUniquePrompt({
  title: 'Custom Test Prompt',
  tags: ['testing', 'custom']
})

// Create test datasets
const prompts = PromptManagementDataFactory.createMultiplePrompts(10)
const searchPrompts = PromptManagementDataFactory.createSearchTestPrompts()
const largeDataset = PromptManagementDataFactory.createLargeDataset(1000)
```

### File Operations

```typescript
// Create temporary markdown files for import testing
const testFiles = await dataManager.createImportTestFiles()
const complexFile = await dataManager.createComplexMarkdownFile()
const largeFile = await dataManager.createLargeImportFile(100)
```

### Data Isolation

Each test automatically gets isolated test data:

```typescript
test('should create prompt', async ({ page }) => {
  const dataManager = await PromptTestDataManager.createForStandardTests(page, 'test-name')
  // Test has isolated data scope
  // Automatic cleanup after test completion
})
```

## 🎭 Page Object Model

The `PromptManagementPage` class provides comprehensive interaction methods:

### Navigation & Setup

```typescript
const promptPage = new PromptManagementPage(page)
await promptPage.goto()
await promptPage.waitForPromptsLoaded()
```

### Import Operations

```typescript
await promptPage.openImportDialog()
await promptPage.selectPromptFiles(['file1.md', 'file2.md'])
await promptPage.executeImport()
```

### CRUD Operations

```typescript
// Create
await promptPage.createNewPrompt({
  title: 'New Prompt',
  content: 'Prompt content with {{variables}}',
  tags: ['tag1', 'tag2']
})

// Edit
await promptPage.editPrompt('Old Title', {
  title: 'Updated Title',
  content: 'Updated content'
})

// Delete
await promptPage.deletePrompt('Prompt Title')
```

### Search & Filter

```typescript
await promptPage.searchPrompts('query')
await promptPage.sortPrompts('title', 'asc')
await promptPage.clearSearch()
```

### Bulk Operations

```typescript
await promptPage.selectPromptCard('Title 1')
await promptPage.selectPromptCard('Title 2')
await promptPage.bulkExportSelected()
await promptPage.bulkDeleteSelected()
```

## 📚 Test Categories

### 1. Import Functionality Tests

- File selection and validation
- Single and multi-file import
- Error handling (malformed, unsupported files)
- Progress tracking for large files
- Metadata preservation

### 2. Cards Display and Interaction

- Card layout and responsive design
- Token count display
- Content preview truncation
- Menu actions (copy, edit, export, delete)
- Empty state handling

### 3. Search and Filtering

- Text search across titles and content
- Boolean operators (AND, OR, NOT)
- Tag and category-specific search
- Search debouncing and performance
- Special character handling

### 4. Sorting and Organization

- Sort by title, date, token count
- Ascending/descending order
- Sort persistence across page reloads
- Combined sorting and filtering

### 5. Create/Edit Modal

- Form validation and error messages
- Live token counting
- Tag input with Enter key support
- Markdown preview functionality
- Cancel/save operations

### 6. Bulk Operations

- Multi-selection with checkboxes
- Select all functionality
- Bulk export (ZIP/markdown)
- Bulk delete with confirmation
- Selection state management

### 7. Performance Tests

- Large dataset handling (1000+ prompts)
- Memory usage monitoring
- Search performance optimization
- Pagination/virtual scrolling
- Concurrent operation handling

### 8. Accessibility Tests

- Keyboard navigation support
- ARIA labels and roles
- Screen reader compatibility
- Focus management
- Color contrast validation

### 9. Error Handling

- Network error recovery
- Validation error display
- Import error feedback
- Graceful degradation
- User-friendly error messages

### 10. Advanced Integration

- Browser navigation (back/forward)
- Window resize responsiveness
- XSS prevention validation
- Memory pressure handling
- Concurrent user actions

## ⚙️ Configuration

### Environment Configuration

```typescript
import { PromptTestConfigManager } from '../configs/prompt-management-test-config'

// Development environment
const devConfig = PromptTestConfigManager.getEnvironmentConfig('development')

// CI environment
const ciConfig = PromptTestConfigManager.getEnvironmentConfig('ci')

// Performance testing
const perfConfig = PromptTestConfigManager.getEnvironmentConfig('performance')
```

### Test Strategies

```typescript
// Get configuration for specific test strategy
const importConfig = PromptTestConfigManager.getStrategyConfig('import_only')
const performanceConfig = PromptTestConfigManager.getStrategyConfig('performance_only')
const accessibilityConfig = PromptTestConfigManager.getStrategyConfig('accessibility_only')
```

### Custom Configuration

```typescript
const customConfig = PromptTestConfigManager.mergeConfig({
  timeout: 60000,
  retries: 1,
  headless: false,
  screenshot: 'on'
})
```

## 🔧 Troubleshooting

### Common Issues

#### 1. Import Tests Failing

```bash
# Check file permissions
ls -la /tmp/playwright-prompt-tests/

# Clear temp files
rm -rf /tmp/playwright-prompt-tests/

# Run with debug output
DEBUG=pw:api npm run test:e2e:prompts:import
```

#### 2. Performance Tests Timing Out

```bash
# Increase timeout for performance tests
npm run test:e2e:prompts:performance -- --timeout=120000

# Run performance tests individually
npm run test:e2e -- --grep "should handle large number of prompts"
```

#### 3. Accessibility Tests Failing

```bash
# Run with visible browser for debugging
npm run test:e2e:prompts:accessibility -- --headed --slow-mo=1000
```

#### 4. Memory Issues

```bash
# Monitor memory usage
npm run test:e2e:prompts:performance -- --reporter=json > test-results.json

# Reduce dataset size
export PROMPT_TEST_MAX_SIZE=100
npm run test:e2e:prompts:performance
```

### Debug Mode

```bash
# Run with Playwright inspector
npm run test:e2e:debug -- --grep "Prompt Management"

# Generate trace files
npm run test:e2e:prompts -- --trace=on

# View trace
npx playwright show-trace test-results/trace.zip
```

### Test Data Issues

```bash
# Clear test databases
rm -rf /tmp/playwright-test-*

# Reset API mocks
npm run test:e2e:prompts -- --reset-mocks

# Validate test data
npm run validate:test-data
```

## ✅ Best Practices

### 1. Test Organization

- Group related tests in describe blocks
- Use descriptive test names that explain expected behavior
- Keep tests focused and atomic
- Avoid interdependent tests

### 2. Data Management

- Use data factories for consistent test data
- Implement proper cleanup in afterEach hooks
- Isolate test data to prevent conflicts
- Use realistic test data that mirrors production

### 3. Page Interactions

- Wait for elements to be visible before interacting
- Use web-first assertions with auto-retry
- Handle async operations properly
- Verify state changes after actions

### 4. Performance Testing

- Monitor memory usage during long operations
- Set appropriate timeouts for performance tests
- Use realistic data volumes
- Test edge cases and stress scenarios

### 5. Error Handling

- Test both happy path and error scenarios
- Verify user-friendly error messages
- Test recovery from error states
- Handle network and timeout errors

### 6. Accessibility

- Test keyboard navigation paths
- Verify ARIA attributes and roles
- Test with screen reader simulation
- Validate color contrast and focus indicators

### 7. Maintenance

- Keep page objects up to date with UI changes
- Review and update test data regularly
- Monitor test execution times
- Update selectors when UI structure changes

## 📈 Continuous Improvement

### Metrics to Monitor

- Test execution time trends
- Flaky test rates
- Coverage metrics
- Performance benchmark results

### Regular Reviews

- Weekly review of test failures
- Monthly performance metrics analysis
- Quarterly test suite architecture review
- Annual accessibility audit

### Contributing

When adding new tests:

1. Follow existing patterns and conventions
2. Update page objects for new UI elements
3. Add appropriate test data fixtures
4. Document new test scenarios
5. Ensure proper cleanup and isolation

---

This comprehensive test suite ensures the Prompt Management page is thoroughly validated across all functional areas, providing confidence in feature reliability and user experience quality.
