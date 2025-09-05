# API Client Test Improvement Plan

## Executive Summary

This document outlines a comprehensive plan to fix and expand the API client test suite for Promptliano. Currently, 15 test files exist but most are failing due to infrastructure issues. This plan will transform the test suite from broken to comprehensive, achieving 90%+ coverage with reliable, fast, and maintainable tests.

## Current State Analysis

### Test Coverage Status
- **Total test files**: 15 existing
- **Passing tests**: 0 (due to infrastructure issues)
- **Test execution**: Failing at startup
- **Coverage**: Unknown (tests not running)

### Critical Issues Identified

1. **Missing Generated Files**
   - `/generated` directory doesn't exist
   - TypeSafeApiClient not available
   - API types not generated

2. **Server Infrastructure Problems**
   - Test server references non-existent `@promptliano/storage`
   - No isolated test environment setup
   - Server not starting for tests
   - Connection refused errors on all API calls

3. **Import Path Issues**
   - Broken imports in multiple test files
   - Missing module references
   - Incorrect relative paths

4. **Test Configuration Problems**
   - No centralized test environment setup
   - Missing test utilities and helpers
   - No automatic cleanup mechanisms
   - No retry logic for server startup

## Implementation Phases

### Phase 1: Infrastructure Fixes (Immediate - 2 hours)

#### 1.1 Generate API Client Files
```bash
cd packages/api-client
bun run generate
```
- Creates `/generated` directory
- Generates TypeSafeApiClient
- Creates API type definitions
- Ensures OpenAPI spec is current

#### 1.2 Fix Test Server Setup
Create new `test-environment.ts`:
- Isolated server instances per test suite
- In-memory database option for speed
- Dynamic port allocation
- Automatic cleanup on test completion
- Remove `@promptliano/storage` dependency

#### 1.3 Fix Import Paths
Files to fix:
- `system-api.test.ts`: Change `../../api-client` to `@promptliano/api-client`
- `flow-integration.test.ts`: Remove `@promptliano/storage` reference
- All test files: Ensure correct import paths

### Phase 2: Repair Existing Tests (Day 1 - 4 hours)

#### 2.1 Core Test Files (Priority 1)
1. **projects-api.test.ts**
   - Add proper server startup
   - Implement cleanup hooks
   - Fix project CRUD tests
   - Add file management tests

2. **tickets-api.test.ts**
   - Fix ticket creation/update tests
   - Add task management tests
   - Implement queue integration tests
   - Add workflow completion tests

3. **chat-api.test.ts**
   - Update for new API structure
   - Add streaming response tests
   - Implement message history tests
   - Add AI integration tests

4. **prompt-api.test.ts**
   - Fix project dependency handling
   - Add markdown import/export tests
   - Implement prompt suggestion tests
   - Add validation tests

5. **queues-api.test.ts**
   - Implement queue CRUD operations
   - Add item enqueue/dequeue tests
   - Test priority handling
   - Add concurrent processing tests

#### 2.2 Integration Test Files (Priority 2)
6. **git-api.test.ts**
   - Add comprehensive git operations
   - Test branch management
   - Implement commit/push/pull tests
   - Add worktree tests

7. **mcp-api.test.ts**
   - Test MCP tool integration
   - Add configuration tests
   - Implement execution tests
   - Add analytics tests

8. **provider-key-api.test.ts**
   - Fix encryption/decryption tests
   - Add provider validation tests
   - Implement health check tests
   - Add batch testing

9. **ai-endpoints.test.ts**
   - Add LMStudio availability checks
   - Implement completion tests
   - Add streaming tests
   - Create mock responses for CI

10. **flow-integration.test.ts**
    - Update for new flow service
    - Add end-to-end workflow tests
    - Implement state transition tests
    - Add error recovery tests

#### 2.3 Utility Test Files (Priority 3)
11. **hook-factory-integration.test.ts**
    - Test React Query hooks
    - Add optimistic update tests
    - Implement cache invalidation tests
    - Add prefetching tests

12. **markdown-api.test.ts**
    - Test markdown import/export
    - Add bulk operations tests
    - Implement validation tests
    - Add format conversion tests

13. **performance-load.test.ts**
    - Add load testing scenarios
    - Implement concurrent user tests
    - Add stress testing
    - Create performance benchmarks

14. **system-api.test.ts**
    - Fix import issues
    - Add health check tests
    - Implement directory browsing tests
    - Add system status tests

15. **test-infrastructure.test.ts**
    - Verify test setup itself
    - Add environment detection tests
    - Implement cleanup verification
    - Add isolation tests

### Phase 3: Add Missing Tests (Day 2 - 6 hours)

#### 3.1 New Core Functionality Tests

**model-config-api.test.ts**
- Model configuration CRUD
- Preset management
- Import/export functionality
- Default configuration tests

**active-tab-api.test.ts**
- Tab state management
- Multi-client coordination
- Metadata handling
- Cleanup on disconnect

**file-management-api.test.ts**
- File listing and filtering
- File content retrieval
- Summary generation
- Batch operations

**search-api.test.ts**
- Project search
- Ticket/task search
- Prompt search
- Full-text search capabilities

**auth-api.test.ts**
- Authentication flows
- Token management
- Permission checks
- Session handling

#### 3.2 Integration Test Suites

**workflow-integration.test.ts**
- Complete project setup flow
- Ticket creation to completion
- AI-assisted development flow
- Git workflow integration

**concurrent-access.test.ts**
- Multi-user scenarios
- Race condition handling
- Optimistic locking tests
- Cache consistency

**error-recovery.test.ts**
- Network failure handling
- Timeout scenarios
- Partial failure recovery
- Retry mechanisms

**data-consistency.test.ts**
- Transaction testing
- Rollback scenarios
- Data integrity checks
- Cascade operations

**performance-suite.test.ts**
- Response time benchmarks
- Throughput testing
- Memory usage monitoring
- Database query optimization

### Phase 4: Test Infrastructure Enhancements (Day 3 - 4 hours)

#### 4.1 Test Utilities Development

**test-helpers.ts**
```typescript
export const factories = {
  createProjectData: (overrides = {}) => ({ /* ... */ }),
  createTicketData: (overrides = {}) => ({ /* ... */ }),
  createTaskData: (overrides = {}) => ({ /* ... */ }),
  createQueueData: (overrides = {}) => ({ /* ... */ }),
  createChatData: (overrides = {}) => ({ /* ... */ }),
  createPromptData: (overrides = {}) => ({ /* ... */ }),
  // ... more factories
}

export const assertions = {
  assertSuccessResponse: (response, expected?) => { /* ... */ },
  assertErrorResponse: (response, error) => { /* ... */ },
  assertValidEntity: (entity, requiredFields) => { /* ... */ },
  assertArrayOfItems: (array, expectedLength?) => { /* ... */ },
  assertValidAIResponse: (response) => { /* ... */ },
  // ... more assertions
}

export class TestDataManager {
  constructor(client: PromptlianoClient) { /* ... */ }
  async createProject(data?) { /* ... */ }
  async createTicket(projectId, data?) { /* ... */ }
  async cleanup() { /* ... */ }
  // ... more methods
}
```

**test-environment.ts**
```typescript
export interface TestEnvironmentConfig {
  useIsolatedServer?: boolean
  database?: {
    useMemory?: boolean
    path?: string
  }
  execution?: {
    logLevel?: 'silent' | 'error' | 'warn' | 'info' | 'debug'
    apiTimeout?: number
  }
  ai?: {
    useMocks?: boolean
    lmstudioUrl?: string
  }
}

export async function createTestEnvironment(
  config?: TestEnvironmentConfig
): Promise<TestEnvironment> {
  // Implementation
}
```

#### 4.2 CI/CD Optimizations

**CI Configuration**
- Use in-memory database for all tests
- Skip AI tests (use mocks instead)
- Enable parallel test execution
- Implement test result caching
- Add coverage reporting

**Local Development**
- Support for LMStudio testing
- File-based database option
- Debug logging capabilities
- Interactive test runner

#### 4.3 Performance Improvements

**Test Execution Speed**
- Target: <30 seconds locally
- Target: <15 seconds in CI
- Parallel test execution
- Shared setup optimization
- Smart test selection

**Resource Management**
- Automatic cleanup
- Memory leak detection
- Database connection pooling
- Server instance reuse

## Test Coverage Goals

### Coverage Metrics
- **Line Coverage**: 90%+
- **Branch Coverage**: 85%+
- **Function Coverage**: 95%+
- **API Endpoint Coverage**: 100%

### Test Categories
| Category | Current | Target | Files |
|----------|---------|--------|-------|
| Unit Tests | 0% | 80% | 20 |
| Integration Tests | 0% | 90% | 15 |
| E2E Tests | 0% | 70% | 5 |
| Performance Tests | 0% | 100% | 3 |
| Total | 0% | 85% | 43 |

## Implementation Timeline

### Week 1: Foundation
- **Day 1**: Infrastructure fixes (2 hours)
- **Day 2**: Fix critical test files (4 hours)
- **Day 3**: Fix remaining test files (4 hours)

### Week 2: Expansion
- **Day 4**: Add core functionality tests (3 hours)
- **Day 5**: Add integration tests (3 hours)
- **Day 6**: Test utilities development (2 hours)
- **Day 7**: CI/CD setup (2 hours)

### Week 3: Polish
- **Day 8**: Performance optimization
- **Day 9**: Documentation
- **Day 10**: Final validation

## Success Criteria

### Must Have
- ✅ All 15 existing tests passing
- ✅ Test server starts reliably
- ✅ No import errors
- ✅ Cleanup works properly
- ✅ Tests run in CI

### Should Have
- ✅ 25+ test files total
- ✅ 90%+ code coverage
- ✅ <30 second execution time
- ✅ Zero flaky tests
- ✅ Parallel execution support

### Nice to Have
- ✅ Visual test reporter
- ✅ Performance benchmarks
- ✅ Test selection by tags
- ✅ Watch mode for development
- ✅ Automatic retry on failure

## Risk Mitigation

### Technical Risks
1. **Server startup failures**
   - Mitigation: Retry logic with exponential backoff
   - Fallback: Use mock server for unit tests

2. **Database conflicts**
   - Mitigation: Isolated databases per test suite
   - Fallback: In-memory database only

3. **AI service unavailability**
   - Mitigation: Mock responses for CI
   - Fallback: Skip AI tests when unavailable

4. **Performance degradation**
   - Mitigation: Parallel execution
   - Fallback: Test sharding across multiple runners

### Process Risks
1. **Scope creep**
   - Mitigation: Strict prioritization
   - Fallback: Focus on critical path only

2. **Breaking changes**
   - Mitigation: Incremental improvements
   - Fallback: Feature flags for new tests

## Maintenance Plan

### Daily
- Monitor test execution times
- Review failed tests
- Update test data as needed

### Weekly
- Review coverage reports
- Update test documentation
- Refactor slow tests

### Monthly
- Performance benchmark review
- Test infrastructure updates
- Dependency updates

## Appendix A: File Structure

```
packages/api-client/
├── src/
│   ├── generated/           # Auto-generated files
│   │   ├── api-types.ts
│   │   ├── type-safe-client.ts
│   │   └── index.ts
│   ├── tests/
│   │   ├── core/           # Core functionality tests
│   │   │   ├── projects-api.test.ts
│   │   │   ├── tickets-api.test.ts
│   │   │   ├── chat-api.test.ts
│   │   │   └── ...
│   │   ├── integration/    # Integration tests
│   │   │   ├── workflow-integration.test.ts
│   │   │   ├── concurrent-access.test.ts
│   │   │   └── ...
│   │   ├── performance/    # Performance tests
│   │   │   ├── load-testing.test.ts
│   │   │   ├── stress-testing.test.ts
│   │   │   └── ...
│   │   ├── utils/          # Test utilities
│   │   │   ├── test-environment.ts
│   │   │   ├── test-helpers.ts
│   │   │   ├── test-factories.ts
│   │   │   └── test-assertions.ts
│   │   └── test-config.ts  # Test configuration
│   └── index.ts            # Main exports
├── scripts/
│   ├── generate-client.ts  # Client generation
│   └── run-tests.ts        # Test runner
├── package.json
└── tsconfig.json
```

## Appendix B: Test Execution Commands

```bash
# Generate API client
bun run generate

# Run all tests
bun test

# Run specific test file
bun test src/tests/projects-api.test.ts

# Run tests with coverage
bun test --coverage

# Run tests in watch mode
bun test --watch

# Run tests in CI mode
CI=true bun test

# Run performance tests
bun test:performance

# Run integration tests
bun test:integration

# Debug specific test
DEBUG=true bun test src/tests/tickets-api.test.ts
```

## Appendix C: Environment Variables

```bash
# Test Configuration
NODE_ENV=test
TEST_DB_PATH=/tmp/test.db
TEST_DB_MEMORY=true
TEST_PORT=3147
TEST_LOG_LEVEL=silent

# AI Configuration
SKIP_AI_TESTS=false
LMSTUDIO_BASE_URL=http://localhost:1234
AI_USE_MOCKS=true
AI_TEST_TIMEOUT=30000

# Performance Configuration
TEST_CONCURRENT_USERS=10
TEST_REQUEST_RATE=100
TEST_DURATION=60

# CI Configuration
CI=true
GITHUB_ACTIONS=true
TEST_SHARD_INDEX=1
TEST_SHARD_TOTAL=4
```

## Conclusion

This comprehensive plan will transform the Promptliano API client test suite from its current broken state to a robust, maintainable, and comprehensive testing framework. By following this structured approach, we will achieve:

1. **100% test reliability** - No flaky tests
2. **90%+ code coverage** - Comprehensive testing
3. **Fast execution** - <30 seconds locally, <15 seconds in CI
4. **Easy maintenance** - Clear structure and utilities
5. **Scalability** - Easy to add new tests

The investment in proper test infrastructure will pay dividends in:
- Reduced bugs in production
- Faster development cycles
- Confident refactoring
- Better documentation through tests
- Improved code quality

With this plan implemented, the API client will have a solid foundation for continued development and maintenance.