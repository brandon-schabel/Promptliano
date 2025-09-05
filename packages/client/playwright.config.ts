import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Load environment variables
dotenv.config()

// Define test database path
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const testDbPath = path.join(__dirname, '../../database/data/playwright-test.db')
// Skip E2E tests in CI unless explicitly enabled
if (process.env.CI === 'true' && process.env.FORCE_E2E !== 'true') {
  console.log('⚠️  Skipping E2E tests in CI. Set FORCE_E2E=true to run them.')
  process.exit(0)
}

export default defineConfig({
  testDir: './e2e/tests',
  timeout: 60 * 1000, // Increased for comprehensive tests
  expect: { timeout: 10000 }, // Increased for complex UI interactions

  // Enhanced parallel execution configuration
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1, // One retry locally for flaky tests
  workers: process.env.CI ? 2 : Math.max(1, Math.floor(4)), // Optimized worker count (4 workers for local)

  // Test reporting
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results.json' }],
    ['list']
  ],

  // Enhanced global test settings
  use: {
    baseURL: process.env.VITE_BASE_URL || 'http://localhost:51420',
    trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
    headless: !!process.env.CI,
    actionTimeout: 15 * 1000, // Increased for complex interactions
    navigationTimeout: 30 * 1000, // Increased for navigation
    // Enable permissions for clipboard and other features
    permissions: ['clipboard-read', 'clipboard-write'],
    // Optimize for testing
    bypassCSP: true,
    ignoreHTTPSErrors: true
  },

  // Enhanced web server configuration for test isolation
  webServer: [
    {
      // Start API server with isolated test database
      command: process.env.CI
        ? `cd ../server && PORT=53147 DATABASE_PATH=${testDbPath} NODE_ENV=e2e bun run start`
        : `cd ../server && PORT=53147 DATABASE_PATH=${testDbPath} NODE_ENV=e2e bun run start`,
      url: 'http://localhost:53147/api/health',
      reuseExistingServer: !process.env.CI, // Always restart in CI for isolation
      timeout: 180 * 1000, // Increased timeout for complex setups
      env: {
        NODE_ENV: 'e2e', // Use e2e instead of test to avoid in-memory db
        DATABASE_PATH: testDbPath,
        LOG_LEVEL: process.env.CI ? 'error' : 'warn' // Reduce noise in tests
      }
    },
    {
      // Start client dev server with test configuration
      command: 'bun run dev -- --port 51420 --host localhost',
      url: 'http://localhost:51420',
      reuseExistingServer: !process.env.CI,
      timeout: 180 * 1000,
      env: {
        NODE_ENV: 'e2e',
        VITE_API_URL: 'http://localhost:53147/api'
      }
    }
  ],

  // Test projects for different browsers
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup']
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['setup']
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      dependencies: ['setup']
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      dependencies: ['setup']
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
      dependencies: ['setup']
    }
  ],

  // Global setup/teardown
  globalSetup: './e2e/setup/global-setup.ts',
  globalTeardown: './e2e/setup/global-teardown.ts'
})
