import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

/**
 * Visual Regression Testing Configuration
 * 
 * Specialized configuration for visual testing with:
 * - Optimized screenshot settings
 * - Consistent viewport sizes
 * - Visual comparison thresholds
 * - Cross-browser visual testing
 */
export default defineConfig({
  testDir: './e2e/tests',
  testMatch: /.*\.visual\.spec\.ts/, // Only run visual tests
  timeout: 60 * 1000, // Longer timeout for visual tests
  expect: { 
    timeout: 10000,
    // Visual comparison settings
    toHaveScreenshot: {
      threshold: 0.1,
      maxDiffPixels: 100,
      animations: 'disabled' // Consistent screenshots
    }
  },

  // Sequential execution for consistent results
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0, // Fewer retries for visual tests
  workers: 1, // Single worker for consistent screenshots

  // Visual testing specific reporting
  reporter: [
    ['html', { 
      outputFolder: 'playwright-report-visual', 
      open: 'never',
      attachmentsBaseURL: './screenshots/'
    }],
    ['json', { outputFile: 'visual-test-results.json' }],
    ['list'],
  ],

  // Optimized settings for visual testing
  use: {
    baseURL: process.env.VITE_BASE_URL || 'http://localhost:1420',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Consistent viewport for screenshots
    viewport: { width: 1280, height: 720 },
    headless: true,
    actionTimeout: 10 * 1000,
    
    // Visual testing specific settings
    ignoreHTTPSErrors: true,
    // Disable animations globally for consistent screenshots
    extraHTTPHeaders: {
      'prefers-reduced-motion': 'reduce'
    }
  },

  // Multiple browser projects for cross-browser visual testing
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'visual-chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Force consistent rendering
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',
            '--disable-renderer-backgrounding',
            '--disable-backgrounding-occluded-windows',
            '--disable-field-trial-config',
            '--force-color-profile=srgb'
          ]
        }
      },
      dependencies: ['setup'],
    },
    {
      name: 'visual-firefox',
      use: { 
        ...devices['Desktop Firefox'],
        // Firefox specific settings
        launchOptions: {
          firefoxUserPrefs: {
            'gfx.canvas.willReadFrequently.enable': true,
            'image.animation_mode': 'none' // Disable gif animations
          }
        }
      },
      dependencies: ['setup'],
    },
    {
      name: 'visual-webkit',
      use: { 
        ...devices['Desktop Safari'],
      },
      dependencies: ['setup'],
    },
    {
      name: 'visual-mobile',
      use: { 
        ...devices['iPhone 12'],
        viewport: { width: 375, height: 667 } // Consistent mobile viewport
      },
      dependencies: ['setup'],
    }
  ],

  // Global setup/teardown
  globalSetup: './e2e/setup/global-setup.ts',
  globalTeardown: './e2e/setup/global-teardown.ts',

  // Visual test specific output
  outputDir: 'visual-test-results/',
  
  // Screenshot storage configuration
  snapshotDir: './e2e/visual-snapshots',
  
  // Update snapshots in non-CI environments
  updateSnapshots: process.env.CI ? 'none' : 'missing',
})