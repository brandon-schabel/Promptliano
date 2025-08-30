import { test, expect } from '@playwright/test'

test.describe('Debug Chat Page', () => {
  test('should debug chat page elements', async ({ page }) => {
    // Navigate to chat page
    await page.goto('/chat')

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Take a screenshot to see what's on the page
    await page.screenshot({ path: 'debug-chat-page.png', fullPage: true })

    // Log what elements are actually present
    const bodyContent = await page.locator('body').innerHTML()
    console.log('Body content (first 1000 chars):', bodyContent.substring(0, 1000))

    // Check if basic elements exist
    const hasRoot = await page.locator('#root').count()
    const hasMain = await page.locator('main').count()
    const hasHeader = await page.locator('header').count()
    const hasNavigation = await page.locator('nav').count()

    console.log('Element counts:', { hasRoot, hasMain, hasHeader, hasNavigation })

    // Check for our expected chat elements
    const chatElements = {
      chatHeader: await page.getByTestId('chat-header').count(),
      userInputArea: await page.getByTestId('user-input-area').count(),
      messageInput: await page.getByTestId('message-input').count(),
      sendButton: await page.getByTestId('send-button').count(),
      messagesContainer: await page.getByTestId('messages-container').count()
    }

    console.log('Chat elements:', chatElements)

    // Try to find any input elements
    const inputs = await page.locator('input').count()
    const textareas = await page.locator('textarea').count()
    const buttons = await page.locator('button').count()

    console.log('Form elements:', { inputs, textareas, buttons })

    // Look for the actual message input
    const messageInputSelectors = [
      'input[placeholder*="message"]',
      'textarea[placeholder*="message"]',
      'input[placeholder*="Type"]',
      'textarea[placeholder*="Type"]'
    ]

    for (const selector of messageInputSelectors) {
      const count = await page.locator(selector).count()
      if (count > 0) {
        const placeholder = await page.locator(selector).getAttribute('placeholder')
        console.log(`Found input with selector "${selector}": placeholder="${placeholder}"`)
      }
    }

    // Look for send button
    const sendButtonSelectors = [
      'button:has-text("Send")',
      'button[type="submit"]',
      'button:last-child',
      'button[aria-label*="send"]'
    ]

    for (const selector of sendButtonSelectors) {
      const count = await page.locator(selector).count()
      if (count > 0) {
        const text = await page.locator(selector).first().textContent()
        const ariaLabel = await page.locator(selector).first().getAttribute('aria-label')
        console.log(`Found button with selector "${selector}": text="${text}", aria-label="${ariaLabel}"`)
      }
    }

    // Look for the empty state message
    const emptyStateText = await page.getByText('No messages yet').count()
    const emptyStateSubtext = await page.getByText('Start the conversation by typing').count()
    console.log('Empty state elements:', { emptyStateText, emptyStateSubtext })

    // Check provider display
    const providerText = await page.getByText(/Using:.*openai.*gpt/i).count()
    console.log('Provider display:', providerText)

    // Check if we're on the right URL
    const currentUrl = page.url()
    console.log('Current URL:', currentUrl)

    // Get page title
    const title = await page.title()
    console.log('Page title:', title)

    // This test is just for debugging, so we'll pass regardless
    expect(true).toBe(true)
  })
})
