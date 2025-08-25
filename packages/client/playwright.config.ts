import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

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
    ['list'],
  ],

  // Global test settings
  use: {
    baseURL: process.env.VITE_BASE_URL || 'http://localhost:1420',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
    headless: !!process.env.CI,
    actionTimeout: 10 * 1000, // 10 seconds for actions
  },

  // Start dev servers before running tests - disabled for now
  // Use existing running servers instead
  // webServer: [
  //   {
  //     command: process.env.CI ? 'bun run preview' : 'cd ../server && bun run dev',
  //     url: 'http://localhost:3147',
  //     reuseExistingServer: !process.env.CI,
  //     timeout: 120 * 1000,
  //     env: {
  //       NODE_ENV: 'test',
  //       DATABASE_PATH: ':memory:',
  //     }
  //   },
  //   {
  //     command: process.env.CI ? 'bun run preview' : 'bun run dev',
  //     url: 'http://localhost:1420',
  //     reuseExistingServer: !process.env.CI,
  //     timeout: 120 * 1000,
  //   },
  // ],

  // Test projects for different browsers
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
      dependencies: ['setup'],
    },
  ],

  // Global setup/teardown
  globalSetup: './e2e/setup/global-setup.ts',
  globalTeardown: './e2e/setup/global-teardown.ts',
})