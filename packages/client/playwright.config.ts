import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Skip E2E tests in CI unless explicitly enabled
if (process.env.CI === 'true' && process.env.FORCE_E2E !== 'true') {
  console.log('⚠️  Skipping E2E tests in CI. Set FORCE_E2E=true to run them.')
  process.exit(0)
}

export default defineConfig({
  testDir: './e2e/tests',
  timeout: 30 * 1000,
  expect: { timeout: 5000 },

  // Parallel execution for faster testing
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Test reporting
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results.json' }],
    ['list']
  ],

  // Global test settings
  use: {
    baseURL: process.env.VITE_BASE_URL || 'http://localhost:1420',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
    headless: !!process.env.CI,
    actionTimeout: 10 * 1000 // 10 seconds for actions
  },

  // Start dev servers before running tests
  // Local: run server + Vite dev. CI can reuse external orchestration.
  webServer: [
    {
      // Start API server with a local DB path inside the repo to avoid sandbox issues
      command: process.env.CI
        ? 'cd ../server && PORT=3147 bun run start'
        : 'cd ../server && PORT=3147 DATABASE_PATH=../database/data/playwright-test.db bun run start',
      url: 'http://localhost:3147/api/health',
      reuseExistingServer: true,
      timeout: 120 * 1000
    },
    {
      // Start client dev server on 1420 for tests
      command: 'bun run dev -- --port 1420',
      url: 'http://localhost:1420',
      reuseExistingServer: true,
      timeout: 120 * 1000
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
