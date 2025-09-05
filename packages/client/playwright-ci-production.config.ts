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

  // CI optimizations
  fullyParallel: true,
  forbidOnly: true,
  retries: 2,
  workers: 2, // Limited workers for CI

  // Test reporting for CI
  reporter: [
    ['github'], // GitHub Actions annotations
    ['json', { outputFile: 'test-results.json' }],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],

  // CI test settings
  use: {
    baseURL: process.env.VITE_BASE_URL || 'http://localhost:53147',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
    headless: true,
    actionTimeout: 15 * 1000,
    navigationTimeout: 30 * 1000,
    permissions: ['clipboard-read', 'clipboard-write'],
    bypassCSP: true,
    ignoreHTTPSErrors: true
  },

  // CI web server configuration (assumes client is already built)
  webServer: {
    // Start API server with pre-built client
    command: `cd ../server && PORT=53147 DATABASE_PATH=${testDbPath} NODE_ENV=e2e bun run start`,
    url: 'http://localhost:53147/api/health',
    reuseExistingServer: false,
    timeout: 120 * 1000, // Shorter timeout since no build needed
    env: {
      NODE_ENV: 'e2e',
      DATABASE_PATH: testDbPath,
      LOG_LEVEL: 'error' // Minimal logging in CI
    }
  },

  // Test projects for CI (limited browsers)
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
    // Optional: Add Firefox for critical path testing
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    //   dependencies: ['setup']
    // }
  ],

  // Global setup/teardown
  globalSetup: './e2e/setup/global-setup.ts', // Uses regular setup since build is done in CI
  globalTeardown: './e2e/setup/global-teardown.ts'
})