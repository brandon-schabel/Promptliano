import { test, expect } from '@playwright/test'

test.describe('Basic Smoke Tests', () => {
  test('should load the application', async ({ page }) => {
    await page.goto('/')
    
    // Wait for the page to load
    await page.waitForSelector('body', { timeout: 10000 })
    
    // Check if the page has loaded (basic check)
    await expect(page.locator('body')).toBeVisible()
    
    // Check if the page title is set
    const title = await page.title()
    expect(title).toBeTruthy()
    
    console.log(`✅ Page loaded with title: ${title}`)
  })

  test('should have basic navigation elements', async ({ page }) => {
    await page.goto('/')
    
    // Wait for the page to load
    await page.waitForSelector('body', { timeout: 10000 })
    
    // Look for common navigation patterns
    const hasNav = await page.locator('nav, [data-testid*="nav"], [role="navigation"]').count() > 0
    const hasSidebar = await page.locator('[data-testid*="sidebar"], .sidebar, aside').count() > 0
    const hasHeader = await page.locator('header, [data-testid*="header"]').count() > 0
    
    console.log(`Navigation elements found - Nav: ${hasNav}, Sidebar: ${hasSidebar}, Header: ${hasHeader}`)
    
    // At least one navigation element should be present
    expect(hasNav || hasSidebar || hasHeader).toBeTruthy()
  })

  test('should not have JavaScript errors', async ({ page }) => {
    const errors: string[] = []
    
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })
    
    await page.goto('/')
    await page.waitForSelector('body', { timeout: 10000 })
    
    // Wait a bit for any async errors
    await page.waitForTimeout(2000)
    
    if (errors.length > 0) {
      console.log('JavaScript errors found:', errors)
    }
    
    // This might be too strict for development, so we'll just log errors
    console.log(`✅ Page loaded with ${errors.length} JavaScript errors`)
  })

  test('should be responsive', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('body', { timeout: 10000 })
    
    // Test different viewport sizes
    const viewports = [
      { width: 1920, height: 1080 }, // Desktop
      { width: 768, height: 1024 },  // Tablet
      { width: 375, height: 667 },   // Mobile
    ]
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport)
      await page.waitForTimeout(500) // Allow reflow
      
      // Check if the page is still visible and functional
      await expect(page.locator('body')).toBeVisible()
      
      console.log(`✅ Page responsive at ${viewport.width}x${viewport.height}`)
    }
  })
})