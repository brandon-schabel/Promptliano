# E2E Test Completion Research - Real Server & Database Integration

## Executive Summary

This document outlines the remaining work needed to achieve fully functional end-to-end tests using real server, database, and minimal mocking for the Promptliano application.

## Current State ✅

### Successfully Implemented
- **Test Infrastructure**
  - Dedicated test database (`playwright-test.db`) with proper isolation
  - Separate test ports (Client: 51420, Server: 53147)
  - Database migrations run automatically during test setup
  - Proper cleanup after each test run

- **API Integration**
  - `ApiTestHelpers` class for creating real test data
  - Real API endpoints for projects, queues, tickets, tasks, prompts, and files
  - No API mocking - all requests go to real server
  - Proper error handling and response validation

- **Test Data Management**
  - `createCompleteTestScenario()` creates full test environment
  - Projects created with unique names and paths
  - Automatic cleanup via API after tests

## Issues Requiring Resolution 🔴

### 1. Project Navigation Failure
**Problem**: Created projects return "Not Found" when navigating to `/projects/{id}`

**Symptoms**:
- Project successfully created via API (returns valid ID)
- Navigation to `/projects/{id}` shows "Not Found" page
- Server appears to receive the request but routing fails

**Research Needed**:
- Verify client-side routing configuration for project pages
- Check if project ID format matches expected routing pattern
- Investigate potential authentication/session issues
- Validate that database contains project after creation

**Debugging Steps**:
```typescript
// Add to test to debug:
const projectResponse = await request.get(`http://localhost:53147/api/projects/${testData.project.id}`)
console.log('Project exists in DB:', await projectResponse.json())

// Check client-side routing
console.log('Navigating to URL:', `/projects/${testData.project.id}`)
```

### 2. localStorage Security Errors
**Problem**: Tests encounter `SecurityError: Failed to read the 'localStorage' property`

**Context**:
- Occurs during test cleanup
- Related to MCP connection and API session cleanup
- Non-fatal but creates noise in test output

**Research Needed**:
- Investigate browser context security settings in Playwright
- Determine if localStorage access needs special permissions
- Consider alternative cleanup strategies that don't require localStorage

**Potential Solutions**:
```typescript
// Option 1: Configure browser context with proper permissions
context = await browser.newContext({
  permissions: ['storage-access'],
  storageState: authFile
})

// Option 2: Skip localStorage cleanup for tests
if (process.env.NODE_ENV !== 'test') {
  // localStorage cleanup code
}
```

### 3. Database Write Permissions
**Problem**: Intermittent "disk I/O error" when creating projects

**Symptoms**:
- Sometimes works, sometimes fails with disk I/O error
- Suggests permission or locking issues with SQLite

**Research Needed**:
- Verify file permissions on test database
- Check for SQLite WAL mode configuration
- Investigate concurrent access issues
- Ensure proper database connection pooling

**Debugging Commands**:
```bash
# Check database file permissions
ls -la packages/database/data/playwright-test.db*

# Monitor database locks during tests
lsof | grep playwright-test.db

# Verify SQLite configuration
sqlite3 packages/database/data/playwright-test.db "PRAGMA journal_mode; PRAGMA synchronous;"
```

### 4. Test Data Visibility
**Problem**: Created test data may not be visible in UI even when in database

**Potential Causes**:
- Session/authentication mismatch between API and UI
- Data filtering based on user context
- Cache invalidation issues
- Timezone/timestamp problems

**Research Needed**:
- Verify authentication state consistency
- Check if UI queries include proper filters
- Investigate React Query cache behavior
- Validate data timestamps and filtering logic

### 5. Page Load Timing Issues
**Problem**: `waitForProjectPageLoad()` fails to find expected elements

**Current Implementation**:
```typescript
await expect(this.contextTab.or(this.fileTree).or(this.promptsContainer))
  .toBeVisible({ timeout: 10000 })
```

**Research Needed**:
- Identify correct selectors for project page elements
- Determine if page structure has changed
- Add more granular waiting strategies
- Consider progressive enhancement approach

## Recommended Investigation Plan 📋

### Phase 1: Database & Server Verification (2-3 hours)
1. **Verify Database State**
   ```typescript
   // Add test helper to verify database state
   async verifyProjectInDatabase(projectId: number) {
     const db = new Database(testDbPath)
     const project = db.query('SELECT * FROM projects WHERE id = ?').get(projectId)
     console.log('Database project:', project)
     db.close()
     return project
   }
   ```

2. **Trace API Requests**
   ```typescript
   // Enable request logging
   page.on('request', request => {
     if (request.url().includes('/api/')) {
       console.log('API Request:', request.method(), request.url())
     }
   })
   
   page.on('response', response => {
     if (response.url().includes('/api/')) {
       console.log('API Response:', response.status(), response.url())
     }
   })
   ```

3. **Validate Server Routes**
   - Test project endpoint directly: `curl http://localhost:53147/api/projects/1`
   - Verify route registration in server logs
   - Check for middleware interference

### Phase 2: Client-Side Routing Investigation (2-3 hours)
1. **TanStack Router Configuration**
   - Verify route definitions in `packages/client/src/routes`
   - Check route parameters and validation
   - Test navigation programmatically vs URL

2. **Authentication State**
   ```typescript
   // Verify auth consistency
   const cookies = await context.cookies()
   console.log('Auth cookies:', cookies)
   
   const localStorage = await page.evaluate(() => {
     return Object.keys(window.localStorage)
   })
   console.log('LocalStorage keys:', localStorage)
   ```

3. **React Query Cache**
   ```typescript
   // Check cache state
   await page.evaluate(() => {
     const queryClient = window.__REACT_QUERY_CLIENT__
     console.log('Cache state:', queryClient?.getQueryCache().getAll())
   })
   ```

### Phase 3: Test Stability Improvements (3-4 hours)
1. **Implement Retry Logic**
   ```typescript
   async function createProjectWithRetry(apiHelper, options, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await apiHelper.createTestProject(options)
       } catch (error) {
         if (i === maxRetries - 1) throw error
         await new Promise(resolve => setTimeout(resolve, 1000))
       }
     }
   }
   ```

2. **Add Health Checks**
   ```typescript
   async function waitForServerReady() {
     const maxAttempts = 30
     for (let i = 0; i < maxAttempts; i++) {
       try {
         const response = await fetch('http://localhost:53147/api/health')
         if (response.ok) return true
       } catch {}
       await new Promise(resolve => setTimeout(resolve, 1000))
     }
     throw new Error('Server failed to become ready')
   }
   ```

3. **Improve Element Waiting**
   ```typescript
   async function waitForProjectPageWithFallback(page: Page) {
     const selectors = [
       '[data-testid="project-context-tab"]',
       '[data-testid="project-board"]',
       '[data-testid="project-content"]',
       '.project-page',
       'main'
     ]
     
     for (const selector of selectors) {
       try {
         await page.waitForSelector(selector, { timeout: 5000 })
         return selector
       } catch {}
     }
     throw new Error('No project page elements found')
   }
   ```

## Testing Strategy Recommendations 🎯

### 1. Progressive Test Implementation
Start with simpler tests and gradually add complexity:
- Level 1: Project CRUD operations via API only
- Level 2: Navigation and page loads
- Level 3: Interactive features (drag & drop, forms)
- Level 4: Complex workflows (multi-step processes)

### 2. Separate Test Suites
```typescript
// api.spec.ts - Test API without UI
test('API: Create and retrieve project', async ({ request }) => {
  const apiHelper = createApiTestHelper(request)
  const project = await apiHelper.createTestProject()
  expect(project.id).toBeGreaterThan(0)
})

// navigation.spec.ts - Test routing without data
test('Navigation: Project route loads', async ({ page }) => {
  await page.goto('/projects/1')
  await expect(page).not.toHaveURL('/404')
})

// integration.spec.ts - Full E2E tests
test('E2E: Create project and navigate', async ({ page, request }) => {
  // Full workflow test
})
```

### 3. Debug Mode Helper
```typescript
class E2EDebugHelper {
  constructor(private page: Page, private request: APIRequestContext) {}
  
  async captureDebugInfo(label: string) {
    const debugInfo = {
      label,
      timestamp: new Date().toISOString(),
      url: this.page.url(),
      localStorage: await this.captureLocalStorage(),
      cookies: await this.page.context().cookies(),
      consoleErrors: this.consoleErrors,
      networkErrors: this.networkErrors
    }
    
    await this.page.screenshot({ 
      path: `debug-${label}-${Date.now()}.png` 
    })
    
    console.log('Debug Info:', JSON.stringify(debugInfo, null, 2))
  }
}
```

## Success Criteria ✅

The E2E tests will be considered fully functional when:

1. **All API operations work without mocking**
   - Projects, queues, tickets, tasks can be created/read/updated/deleted
   - No mock responses needed

2. **UI navigation works consistently**
   - Created projects can be navigated to and displayed
   - All page elements load correctly
   - No "Not Found" errors for valid resources

3. **Test isolation is complete**
   - Each test run starts with clean database
   - No test affects another test
   - Cleanup is automatic and reliable

4. **Tests run reliably**
   - >95% pass rate without flaky failures
   - Clear error messages when failures occur
   - Fast execution (<30 seconds per test)

5. **Developer experience is good**
   - Easy to add new tests
   - Clear debugging output
   - Good documentation

## Next Steps 🚀

1. **Immediate Priority**: Fix project navigation issue
   - This blocks all UI tests
   - Likely a simple routing configuration issue

2. **Quick Wins**: 
   - Add debug logging to identify exact failure point
   - Implement health check before tests start
   - Add retry logic for database operations

3. **Long-term Improvements**:
   - Create test fixture system for common scenarios
   - Add visual regression testing
   - Implement performance benchmarks

## Questions for Investigation 🤔

1. Does the project page require specific authentication or session state?
2. Are there any feature flags or environment variables affecting routing?
3. Is there a minimum data requirement for project pages to render?
4. Are there any race conditions between project creation and navigation?
5. Does the client-side router cache route definitions?

## Resources & References 📚

- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [SQLite WAL Mode](https://www.sqlite.org/wal.html)
- [TanStack Router Docs](https://tanstack.com/router/latest)
- [Hono Testing Guide](https://hono.dev/guides/testing)

---

*This research document should be updated as issues are resolved and new challenges are discovered.*