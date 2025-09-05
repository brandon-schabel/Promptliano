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

export default defineConfig({
  testDir: './e2e/tests',
  timeout: 60 * 1000,
  expect: { timeout: 10000 },

  // Enhanced parallel execution configuration
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : Math.max(1, Math.floor(4)),

  // Test reporting
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results.json' }],
    ['list']
  ],

  // Enhanced global test settings
  use: {
    baseURL: process.env.VITE_BASE_URL || 'http://localhost:53147',
    trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
    headless: !!process.env.CI,
    actionTimeout: 15 * 1000,
    navigationTimeout: 30 * 1000,
    permissions: ['clipboard-read', 'clipboard-write'],
    bypassCSP: true,
    ignoreHTTPSErrors: true
  },

  // Production-like web server configuration
  // NOTE: When using build-and-test.ts script, the server is managed externally
  // This config is for standalone test runs
  webServer: process.env.EXTERNAL_SERVER ? undefined : [
    {
      // Start API server that serves the built client
      // Assumes client is already built (run bun run build:client first)
      command: `cd ../server && PORT=53147 DATABASE_PATH=${testDbPath} NODE_ENV=production SERVE_CLIENT=true bun run start`,
      url: 'http://localhost:53147/api/health',
      reuseExistingServer: !process.env.CI, // Reuse in local dev, restart in CI
      timeout: 120 * 1000, // 2 minutes for server start
      env: {
        NODE_ENV: 'production',
        DATABASE_PATH: testDbPath,
        SERVE_CLIENT: 'true',
        LOG_LEVEL: process.env.CI ? 'error' : 'warn'
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
  globalSetup: './e2e/setup/global-setup-production.ts',
  globalTeardown: './e2e/setup/global-teardown.ts'
})