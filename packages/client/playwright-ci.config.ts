import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

/**
 * CI-Optimized Playwright Configuration
 * 
 * This configuration is specifically tuned for CI environments with:
 * - Single worker for stable resource usage
 * - Test sharding support
 * - Minimal retries but proper error reporting
 * - Resource-conscious browser settings
 */
export default defineConfig({
  testDir: './e2e/tests',
  timeout: 45 * 1000, // Increased timeout for CI
  expect: { timeout: 8000 }, // Increased expect timeout

  // CI-specific execution settings
  fullyParallel: false, // Disabled for CI stability
  forbidOnly: true, // Prevent .only in CI
  retries: 3, // More retries in CI due to flakiness
  workers: 1, // Single worker for resource management

  // Enhanced reporting for CI
  reporter: [
    ['html', { outputFolder: 'playwright-report-ci', open: 'never' }],
    ['json', { outputFile: 'test-results-ci.json' }],
    ['junit', { outputFile: 'test-results-junit.xml' }],
    ['github'], // GitHub Actions integration
    ['list'],
  ],

  // CI-optimized settings
  use: {
    baseURL: process.env.VITE_BASE_URL || 'http://localhost:1420',
    trace: 'retain-on-failure', // More comprehensive tracing in CI
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
    headless: true, // Always headless in CI
    actionTimeout: 15 * 1000, // Longer actions timeout for CI
    
    // Resource management for CI
    launchOptions: {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    }
  },

  // Simplified project setup for CI
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium-ci',
      use: { 
        ...devices['Desktop Chrome'],
        // CI-specific browser settings
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security'
          ]
        }
      },
      dependencies: ['setup'],
    }
  ],

  // Global setup/teardown
  globalSetup: './e2e/setup/global-setup.ts',
  globalTeardown: './e2e/setup/global-teardown.ts',

  // Enhanced error handling for CI
  reportSlowTests: {
    max: 5,
    threshold: 30 * 1000
  },

  // Test output directory
  outputDir: 'test-results-ci/',
})