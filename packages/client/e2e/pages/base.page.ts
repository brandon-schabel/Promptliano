import { Page } from '@playwright/test'

/**
 * Simple base page for backward compatibility
 * New tests should NOT extend this - use direct Page object instead
 */
export class BasePage {
  constructor(protected readonly page: Page) {}

  async goto(path: string = '/') {
    await this.page.goto(path)
    await this.page.waitForLoadState('networkidle')
  }

  async waitForPageReady() {
    await this.page.waitForLoadState('networkidle')
  }

  async reload() {
    await this.page.reload()
    await this.page.waitForLoadState('networkidle')
  }

  async screenshot(name: string) {
    return await this.page.screenshot({ path: `screenshots/${name}.png`, fullPage: true })
  }
}