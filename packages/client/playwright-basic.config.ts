import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e/tests',
  timeout: 10 * 1000, // Shorter timeout for basic tests
  expect: { timeout: 3000 },

  fullyParallel: false, // Run sequentially for stability
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report-basic', open: 'never' }],
  ],

  use: {
    baseURL: process.env.VITE_BASE_URL || 'http://localhost:1420',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
    headless: true,
    actionTimeout: 5 * 1000,
  },

  // Just basic browser testing
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Basic global setup - no authentication required
  globalSetup: './e2e/setup/global-setup.ts',
  globalTeardown: './e2e/setup/global-teardown.ts',
})