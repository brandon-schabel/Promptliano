# Promptliano E2E Test Expansion Plan

## Executive Summary

This document outlines a comprehensive plan to expand the simplified E2E testing approach (Page Object Model with simple helpers and fixtures) to all pages in the Promptliano application. The plan follows the successful pattern established for the Projects page tests.

## Testing Architecture

### Core Principles
1. **Simple Page Object Model** - Flat structure, no complex inheritance
2. **Helper Functions** - API-first with UI fallback for common operations
3. **Test Data Fixtures** - Consistent, isolated test data
4. **Comprehensive Coverage** - Multiple test suites per page covering different aspects
5. **Graceful Error Handling** - Clear logging and error recovery

### File Structure
```
packages/client/e2e/
├── pages/                    # Page Object Models
│   ├── base.page.ts          # Base page class (existing)
│   ├── app.page.ts           # App-wide navigation (existing)
│   ├── projects.page.ts      # Projects page (existing)
│   ├── chat.page.ts          # Chat page (new)
│   ├── prompts.page.ts       # Prompts page (new)
│   ├── providers.page.ts     # Providers page (new)
│   ├── settings.page.ts      # Settings page (new)
│   └── home.page.ts          # Home/Dashboard page (new)
├── utils/                     # Helper utilities
│   ├── test-helpers.ts       # Common test utilities (existing)
│   ├── chat-helper.ts        # Chat-specific helpers (new)
│   ├── prompt-helper.ts      # Prompt-specific helpers (new)
│   ├── provider-helper.ts    # Provider-specific helpers (new)
│   ├── settings-helper.ts    # Settings-specific helpers (new)
│   └── integration-helper.ts # Cross-page workflow helpers (new)
├── fixtures/                  # Test data and fixtures
│   ├── test-data.ts          # Base test data factory (existing)
│   └── shared-test-data.ts   # Extended fixtures (enhance)
└── tests/                     # Test suites
    ├── chat/                  # Chat page tests
    ├── prompts/               # Prompts page tests
    ├── providers/             # Providers page tests
    ├── settings/              # Settings page tests
    ├── home/                  # Home page tests
    └── integration/           # Cross-page integration tests
```

## Implementation Tickets

### Ticket #9: Implement E2E Tests for Chat Page
**Priority**: High  
**Estimated Total Hours**: 18

#### Tasks:
1. **Create chat.page.ts Page Object Model** (2h)
   - Locators for chat list, message area, input field
   - Model selector, settings panel, action buttons
   
2. **Create chat-helper.ts utility functions** (2h)
   - API methods for creating/managing chats
   - Message sending and verification helpers
   - Session management utilities
   
3. **Create chat test data fixtures** (1h)
   - Sample conversations and system prompts
   - Model configurations and message templates
   
4. **Implement chat-basic.spec.ts** (3h)
   - Chat CRUD operations
   - List navigation and search
   - Empty state handling
   
5. **Implement chat-conversation.spec.ts** (4h)
   - Message sending/receiving
   - History and context preservation
   - Message editing and forking
   
6. **Implement chat-models.spec.ts** (3h)
   - Model selection and switching
   - Parameter adjustments
   - API error handling
   
7. **Implement chat-advanced.spec.ts** (3h)
   - File attachments and code snippets
   - Markdown rendering
   - Performance with long conversations

### Ticket #10: Implement E2E Tests for Prompts Page
**Priority**: High  
**Estimated Total Hours**: 14

#### Tasks:
1. **Create prompts.page.ts Page Object Model** (2h)
   - Prompt list, create/edit dialogs
   - Category filters, search functionality
   
2. **Create prompt-helper.ts utilities** (2h)
   - API methods for prompt management
   - Import/export helpers
   - Project association utilities
   
3. **Create prompt test fixtures** (1h)
   - Various prompt types and templates
   - Category structures
   
4. **Implement prompts-crud.spec.ts** (3h)
   - Create, read, update, delete operations
   - Validation and error handling
   
5. **Implement prompts-organization.spec.ts** (3h)
   - Categorization and filtering
   - Search and sorting
   - Bulk operations
   
6. **Implement prompts-integration.spec.ts** (3h)
   - Project associations
   - Chat integration
   - Import/export functionality

### Ticket #11: Implement E2E Tests for Providers Page
**Priority**: High  
**Estimated Total Hours**: 14

#### Tasks:
1. **Create providers.page.ts Page Object Model** (2h)
   - Provider cards and configuration forms
   - API key inputs and test buttons
   
2. **Create provider-helper.ts utilities** (2h)
   - Secure API key management
   - Connection testing helpers
   - Provider status verification
   
3. **Create provider test fixtures** (1h)
   - Mock API keys and configurations
   - Test connection responses
   
4. **Implement providers-configuration.spec.ts** (3h)
   - Adding and updating API keys
   - Provider removal
   - Invalid key handling
   
5. **Implement providers-testing.spec.ts** (3h)
   - Connection testing
   - Model availability checks
   - Error handling and retries
   
6. **Implement providers-security.spec.ts** (2h)
   - API key masking
   - Secure storage verification
   - Access control

### Ticket #12: Implement E2E Tests for Settings Page
**Priority**: Normal  
**Estimated Total Hours**: 11

#### Tasks:
1. **Create settings.page.ts Page Object Model** (2h)
   - Settings tabs and form fields
   - Toggle switches and buttons
   
2. **Create settings-helper.ts utilities** (2h)
   - Settings update via API
   - Export/import helpers
   - Reset functionality
   
3. **Implement settings-general.spec.ts** (2h)
   - Application preferences
   - Theme and language settings
   
4. **Implement settings-data.spec.ts** (3h)
   - Export/import operations
   - Backup and restore
   - Cache management
   
5. **Implement settings-persistence.spec.ts** (2h)
   - Cross-session persistence
   - Refresh survival
   - Browser restart handling

### Ticket #13: Implement E2E Tests for Home/Index Page
**Priority**: Normal  
**Estimated Total Hours**: 9

#### Tasks:
1. **Create home.page.ts Page Object Model** (2h)
   - Dashboard widgets and quick actions
   - Recent activity and navigation tiles
   
2. **Implement home-dashboard.spec.ts** (2h)
   - Widget display and statistics
   - Recent activity updates
   
3. **Implement home-onboarding.spec.ts** (3h)
   - First-time setup
   - Tutorial flows
   - Getting started guides
   
4. **Implement home-navigation.spec.ts** (2h)
   - Quick actions
   - Command palette
   - Keyboard shortcuts

### Ticket #14: Implement Cross-Page Integration Tests
**Priority**: High  
**Estimated Total Hours**: 21

#### Tasks:
1. **Create integration-helper.ts utilities** (3h)
   - Cross-page navigation helpers
   - State verification utilities
   - Workflow orchestration
   
2. **Implement project-to-chat-workflow.spec.ts** (4h)
   - Project creation → prompt addition → chat context
   
3. **Implement provider-configuration-workflow.spec.ts** (3h)
   - Provider setup → model selection → chat verification
   
4. **Implement prompt-template-workflow.spec.ts** (3h)
   - Template creation → project association → chat usage
   
5. **Implement settings-persistence-workflow.spec.ts** (3h)
   - Settings configuration → export → reset → import
   
6. **Implement complete-user-journey.spec.ts** (5h)
   - End-to-end new user experience

## Implementation Guidelines

### Page Object Model Pattern
```typescript
export class ChatPage extends BasePage {
  // Simple, flat locators
  get chatList() { return this.page.locator('[data-testid="chat-list"]') }
  get messageInput() { return this.page.locator('[data-testid="message-input"]') }
  
  // Straightforward action methods
  async sendMessage(text: string) {
    await this.messageInput.fill(text)
    await this.messageInput.press('Enter')
    await this.waitForResponse()
  }
  
  // Clear verification methods
  async verifyMessageExists(text: string): Promise<boolean> {
    const message = this.page.locator(`text="${text}"`)
    return await message.isVisible()
  }
}
```

### Helper Function Pattern
```typescript
export class ChatTestHelpers {
  constructor(private page: Page) {}
  
  // API-first approach
  async createChatViaAPI(data: ChatData): Promise<Chat> {
    const response = await this.page.request.post('/api/chats', { data })
    return response.json()
  }
  
  // UI fallback when needed
  async createChatViaUI(data: ChatData): Promise<void> {
    const chatPage = new ChatPage(this.page)
    await chatPage.createNewChat()
    await chatPage.fillChatDetails(data)
    await chatPage.saveChat()
  }
}
```

### Test Suite Pattern
```typescript
test.describe('Chat Management', () => {
  let chatPage: ChatPage
  let chatHelpers: ChatTestHelpers
  let testData: TestDataManager
  
  test.beforeEach(async ({ page }) => {
    chatPage = new ChatPage(page)
    chatHelpers = new ChatTestHelpers(page)
    testData = new TestDataManager(page)
    
    await chatPage.goto()
    await chatPage.waitForPageReady()
  })
  
  test.afterEach(async () => {
    await testData.cleanup()
  })
  
  test('should create a new chat', async () => {
    const chatData = TestDataFactory.createChat()
    await chatHelpers.createChatViaAPI(chatData)
    
    await chatPage.goto() // Refresh to see new chat
    expect(await chatPage.chatExists(chatData.name)).toBe(true)
  })
})
```

## Testing Best Practices

### 1. Test Isolation
- Each test should be independent
- Use unique test data per test
- Clean up after each test
- Don't rely on test execution order

### 2. API-First Approach
- Use API for setup/teardown when possible
- Faster and more reliable than UI operations
- Reserve UI testing for UI-specific functionality

### 3. Error Handling
- Implement retry mechanisms for flaky operations
- Provide clear error messages
- Log important state on failure
- Handle both expected and unexpected errors

### 4. Performance Considerations
- Set reasonable timeouts
- Use waitFor patterns instead of fixed delays
- Parallelize where possible
- Monitor test execution times

### 5. Maintainability
- Keep selectors in page objects
- Use data-testid attributes
- Avoid complex inheritance
- Document complex test scenarios

## Success Metrics

### Coverage Goals
- **Page Coverage**: 100% of main pages tested
- **Feature Coverage**: Core features per page covered
- **Integration Coverage**: Major user workflows tested
- **Error Scenarios**: Common error cases handled

### Performance Targets
- **Test Execution**: < 5 minutes for page suites
- **Setup/Teardown**: < 2 seconds per test
- **Flakiness Rate**: < 1% failure rate
- **Parallel Execution**: Support for 4+ workers

### Quality Indicators
- **Code Reuse**: 60%+ helper/fixture usage
- **Maintenance Time**: < 2 hours per sprint
- **Bug Detection**: 90%+ regression catch rate
- **Documentation**: All complex scenarios documented

## Timeline

### Phase 1: High Priority Pages (Week 1-2)
- Chat page implementation
- Prompts page implementation
- Providers page implementation
- Integration tests setup

### Phase 2: Supporting Pages (Week 3)
- Settings page implementation
- Home page implementation
- Additional integration tests

### Phase 3: Polish & Optimization (Week 4)
- Performance optimization
- Flaky test fixes
- Documentation completion
- CI/CD integration enhancements

## Risk Mitigation

### Technical Risks
- **Flaky Tests**: Implement retry mechanisms and better wait strategies
- **Performance Issues**: Use parallel execution and optimize selectors
- **Maintenance Burden**: Keep tests simple and well-documented

### Process Risks
- **Scope Creep**: Stick to defined test scenarios per ticket
- **Timeline Delays**: Prioritize critical paths first
- **Resource Constraints**: Leverage existing patterns and helpers

## Conclusion

This comprehensive plan provides a structured approach to expanding E2E test coverage across all Promptliano pages. By following the established patterns and maintaining consistency, we can achieve robust test coverage while keeping the tests maintainable and reliable.

The modular approach allows for parallel development and incremental delivery, ensuring continuous value delivery throughout the implementation process.