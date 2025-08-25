import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

/**
 * Fast Development Playwright Configuration
 * 
 * Optimized for rapid development cycles with:
 * - Maximum parallelization
 * - Chromium only for speed
 * - Reduced timeouts
 * - Minimal reporting overhead
 */
export default defineConfig({
  testDir: './e2e/tests',
  timeout: 20 * 1000, // Reduced for fast iteration
  expect: { timeout: 3000 },

  // Maximum speed settings
  fullyParallel: true,
  forbidOnly: false, // Allow .only in dev
  retries: 0, // No retries for fast feedback
  workers: '75%', // Use most available cores

  // Minimal reporting
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report-fast', open: 'on-failure' }]
  ],

  // Fast execution settings
  use: {
    baseURL: process.env.VITE_BASE_URL || 'http://localhost:1420',
    trace: 'off', // Disabled for speed
    screenshot: 'off', // Disabled for speed
    video: 'off', // Disabled for speed
    viewport: { width: 1280, height: 720 },
    headless: true,
    actionTimeout: 5 * 1000, // Faster action timeout
  },

  // Chromium only for speed
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium-fast',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    }
  ],

  // Global setup/teardown
  globalSetup: './e2e/setup/global-setup.ts',
  globalTeardown: './e2e/setup/global-teardown.ts',

  // Fast output directory
  outputDir: 'test-results-fast/',
})