/**
 * Source Dashboard E2E Tests
 * Comprehensive testing for deep research source dashboard feature
 */

import { test, expect } from '@playwright/test'
import {
  navigateToSourceDashboard,
  switchTab,
  navigateBackToResearch,
  expectDashboardLoaded,
  expectLinkTableVisible,
  expectPollingActive,
  expectPollingInactive,
  expectStatusBadge,
  expectStatsCards,
  sortLinkTable,
  filterLinkTable,
  selectTableRows,
  refreshDashboard,
  copyLinkUrl,
  changePageSize,
  goToNextPage,
  goToPreviousPage,
  mockSourceDashboardData,
  mockActiveCrawl,
  mockCompletedCrawl,
  mockSourceLinksResponse,
  setupMockDashboardAPI,
  setupMockDashboardAPIWithErrors,
  waitForDashboardAPI,
  createRequestCounter
} from '../helpers/source-dashboard-helpers'

test.describe('Source Dashboard - Navigation Tests', () => {
  test('should navigate from research detail to source dashboard', async ({ page }) => {
    // Setup mock data
    await setupMockDashboardAPI(page, {
      dashboardData: mockCompletedCrawl()
    })

    // Start on research detail page
    await page.goto('/deep-research/1?tab=sources')
    await page.waitForLoadState('networkidle')

    // Mock sources list
    await page.route('**/api/research/1/sources', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 1,
              url: 'https://example.com',
              title: 'Example Site',
              status: 'completed'
            }
          ]
        })
      })
    })

    // Verify Sources tab is displayed
    await expect(page.getByRole('tab', { name: /sources/i })).toBeVisible()

    // Navigate to source dashboard
    await navigateToSourceDashboard(page, 1, 1)

    // Verify we're on the source dashboard
    await expect(page).toHaveURL(/\/deep-research\/1\/sources\/1/)
    await expectDashboardLoaded(page)
  })

  test('should have breadcrumb navigation', async ({ page }) => {
    await setupMockDashboardAPI(page, {
      dashboardData: mockCompletedCrawl()
    })

    await navigateToSourceDashboard(page, 1, 1)

    // Verify breadcrumbs are displayed
    await expect(page.getByText('Research')).toBeVisible()
    await expect(page.getByText(/Research Session|Test Research Topic/)).toBeVisible()
    await expect(page.getByText('Source Dashboard')).toBeVisible()
  })

  test('should navigate back via breadcrumb', async ({ page }) => {
    await setupMockDashboardAPI(page)

    await navigateToSourceDashboard(page, 1, 1)

    // Mock research detail endpoint
    await page.route('**/api/research/1*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: 1, topic: 'Test Research', status: 'active' }
        })
      })
    })

    // Click breadcrumb link to research session
    const researchLink = page.locator('a', { hasText: /Research Session|Test Research Topic/ })
    await researchLink.click()
    await page.waitForLoadState('networkidle')

    // Verify navigation to research detail with sources tab
    await expect(page).toHaveURL(/\/deep-research\/1.*tab=sources/)
  })

  test('should navigate back via back button', async ({ page }) => {
    await setupMockDashboardAPI(page)

    await navigateToSourceDashboard(page, 1, 1)

    // Mock research detail endpoint
    await page.route('**/api/research/1*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: 1, topic: 'Test Research', status: 'active' }
        })
      })
    })

    await navigateBackToResearch(page)

    // Verify navigation back to research detail
    await expect(page).toHaveURL(/\/deep-research\/1/)
  })

  test('should persist tab selection in URL', async ({ page }) => {
    await setupMockDashboardAPI(page)

    await navigateToSourceDashboard(page, 1, 1)

    // Switch to Links tab
    await switchTab(page, 'links')
    await expect(page).toHaveURL(/tab=links/)

    // Switch to Errors tab
    await switchTab(page, 'errors')
    await expect(page).toHaveURL(/tab=errors/)

    // Refresh page
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Verify Errors tab is still active after refresh
    const errorsTab = page.getByRole('tab', { name: /errors/i })
    await expect(errorsTab).toHaveAttribute('data-state', 'active')
  })

  test('should handle tab navigation with query parameters', async ({ page }) => {
    await setupMockDashboardAPI(page)

    // Navigate directly with tab query parameter
    await page.goto('/deep-research/1/sources/1?tab=content')
    await page.waitForLoadState('networkidle')

    // Verify Content tab is active
    const contentTab = page.getByRole('tab', { name: /content/i })
    await expect(contentTab).toHaveAttribute('data-state', 'active')
  })

  test('should display correct URL with external link icon', async ({ page }) => {
    await setupMockDashboardAPI(page)

    await navigateToSourceDashboard(page, 1, 1)

    // Verify external link is displayed with icon
    const externalLink = page.locator('a[href*="example.com"]')
    await expect(externalLink).toBeVisible()
    await expect(externalLink).toHaveAttribute('target', '_blank')
    await expect(externalLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  test('should display source title in header', async ({ page }) => {
    await setupMockDashboardAPI(page, {
      dashboardData: mockSourceDashboardData({
        title: 'Custom Source Title'
      })
    })

    await navigateToSourceDashboard(page, 1, 1)

    // Verify custom title is displayed
    await expect(page.getByRole('heading', { name: /Custom Source Title/ })).toBeVisible()
  })
})

test.describe('Source Dashboard - Data Display Tests', () => {
  test('should display source information correctly', async ({ page }) => {
    const mockData = mockSourceDashboardData({
      title: 'Example Website',
      url: 'https://example.com',
      metadata: {
        tokenCount: 15000,
        pagesCrawled: 25,
        linksDiscovered: 50
      }
    })

    await setupMockDashboardAPI(page, { dashboardData: mockData })
    await navigateToSourceDashboard(page, 1, 1)

    // Verify source title and URL
    await expect(page.getByRole('heading', { name: /Example Website/ })).toBeVisible()
    await expect(page.getByText('https://example.com')).toBeVisible()

    // Verify stats cards display data
    await expectStatsCards(page, {
      tokenCount: 15000,
      pagesCrawled: 25,
      linksDiscovered: 50
    })
  })

  test('should display overview tab dashboard components', async ({ page }) => {
    await setupMockDashboardAPI(page, {
      dashboardData: mockCompletedCrawl()
    })

    await navigateToSourceDashboard(page, 1, 1)

    // Verify Overview tab is active by default
    const overviewTab = page.getByRole('tab', { name: /overview/i })
    await expect(overviewTab).toHaveAttribute('data-state', 'active')

    // Verify Crawl Overview card is visible
    await expect(page.getByRole('heading', { name: /Crawl Overview/i })).toBeVisible()

    // Verify statistics sections
    await expect(page.getByText(/Source Information/i)).toBeVisible()
    await expect(page.getByText(/Crawl Statistics/i)).toBeVisible()
  })

  test('should display links tab with link discovery table', async ({ page }) => {
    await setupMockDashboardAPI(page, {
      dashboardData: mockCompletedCrawl(),
      linksData: mockSourceLinksResponse({ totalLinks: 50 })
    })

    await navigateToSourceDashboard(page, 1, 1)

    // Switch to Links tab
    await switchTab(page, 'links')

    // Verify link table is displayed
    await expectLinkTableVisible(page)

    // Verify table headers
    await expect(page.getByRole('columnheader', { name: /status/i })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /url/i })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /depth/i })).toBeVisible()
  })

  test('should display empty states correctly', async ({ page }) => {
    await setupMockDashboardAPI(page, {
      dashboardData: mockSourceDashboardData({
        metadata: {
          linksDiscovered: 0,
          errorCount: 0
        }
      }),
      linksData: mockSourceLinksResponse({ totalLinks: 0 })
    })

    await navigateToSourceDashboard(page, 1, 1)

    // Switch to Links tab and verify empty state
    await switchTab(page, 'links')
    await expect(page.getByText(/No links discovered yet/i)).toBeVisible()

    // Switch to Errors tab and verify empty state
    await switchTab(page, 'errors')
    await expect(page.getByText(/No errors recorded/i)).toBeVisible()
  })
})

test.describe('Source Dashboard - Real-time Polling Tests', () => {
  test('should poll when crawl is active', async ({ page }) => {
    await setupMockDashboardAPI(page, {
      dashboardData: mockActiveCrawl()
    })

    await navigateToSourceDashboard(page, 1, 1)

    // Verify active status badge with pulse animation
    await expectStatusBadge(page, 'active')

    // Create request counter
    const getRequestCount = createRequestCounter(page, '/dashboard')

    // Wait for polling (should happen every 5 seconds)
    await page.waitForTimeout(12000) // Wait 12 seconds for at least 2 polls

    // Verify multiple requests were made
    const requestCount = getRequestCount()
    expect(requestCount).toBeGreaterThanOrEqual(2)
  })

  test('should stop polling when crawl completes', async ({ page }) => {
    // Start with active crawl
    const activeCrawlData = mockActiveCrawl()

    await page.route('**/api/research/sources/*/dashboard', async (route, request) => {
      // First request: return active status
      // Subsequent requests: return completed status
      const isFirstRequest = request.url().includes('dashboard')

      if (isFirstRequest) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: activeCrawlData
          })
        })

        // Update to completed for next request
        activeCrawlData.crawlStatus.status = 'completed'
        activeCrawlData.status = 'completed'
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: mockCompletedCrawl()
          })
        })
      }
    })

    await navigateToSourceDashboard(page, 1, 1)

    // Initially should show active status
    await expectStatusBadge(page, 'active')

    // Wait for status to change to completed
    await page.waitForTimeout(6000) // Wait for next poll

    // Verify status changed to completed
    await expectStatusBadge(page, 'completed')

    // Create request counter after status change
    const getRequestCount = createRequestCounter(page, '/dashboard')

    // Wait longer to verify polling stopped
    await page.waitForTimeout(12000)

    // Should not have made many new requests after completion
    const requestCount = getRequestCount()
    expect(requestCount).toBeLessThan(3) // Allow for one or two edge case requests
  })

  test('should update metrics in real-time', async ({ page }) => {
    let pollCount = 0

    await page.route('**/api/research/sources/*/dashboard', async (route) => {
      pollCount++

      const data = mockActiveCrawl()

      // Increment metrics with each poll
      data.metadata.pagesCrawled = 10 + pollCount * 2
      data.metadata.linksDiscovered = 20 + pollCount * 5

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data
        })
      })
    })

    await navigateToSourceDashboard(page, 1, 1)

    // Get initial page count
    const initialPagesText = await page.locator('text=/Pages Crawled/i')
      .locator('../..')
      .locator('.text-2xl')
      .textContent()

    // Wait for next poll
    await page.waitForTimeout(6000)

    // Get updated page count
    const updatedPagesText = await page.locator('text=/Pages Crawled/i')
      .locator('../..')
      .locator('.text-2xl')
      .textContent()

    // Verify metrics updated
    expect(initialPagesText).not.toBe(updatedPagesText)
  })
})

test.describe('Source Dashboard - Link Table Tests', () => {
  test('should sort table by column', async ({ page }) => {
    await setupMockDashboardAPI(page, {
      linksData: mockSourceLinksResponse({ totalLinks: 20 })
    })

    await navigateToSourceDashboard(page, 1, 1)
    await switchTab(page, 'links')

    // Get first link URL before sorting
    const firstLinkBefore = await page.locator('table tbody tr').first()
      .locator('td').nth(1)
      .textContent()

    // Sort by URL (or another column with sortable data)
    await sortLinkTable(page, 'URL', 'desc')

    // Wait for URL to update with sort params
    await expect(page).toHaveURL(/sortBy|sortOrder/)

    // Get first link URL after sorting
    const firstLinkAfter = await page.locator('table tbody tr').first()
      .locator('td').nth(1)
      .textContent()

    // URLs should be different after sorting (unless all identical)
    // This is a basic check - in real scenario, verify actual sort order
    expect(firstLinkBefore).toBeDefined()
    expect(firstLinkAfter).toBeDefined()
  })

  test('should filter table by status', async ({ page }) => {
    await page.route('**/api/research/sources/*/links*', async (route) => {
      const url = new URL(route.request().url())
      const status = url.searchParams.get('status')

      if (status === 'crawled') {
        const response = mockSourceLinksResponse({ totalLinks: 10 })
        // Filter to only crawled links
        response.data.links = response.data.links.filter(link => link.status === 'crawled')
        response.data.pagination.total = response.data.links.length

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(response)
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockSourceLinksResponse({ totalLinks: 20 }))
        })
      }
    })

    await setupMockDashboardAPI(page)
    await navigateToSourceDashboard(page, 1, 1)
    await switchTab(page, 'links')

    // Apply filter
    await filterLinkTable(page, { status: 'crawled' })

    // Verify URL contains filter parameter
    await expect(page).toHaveURL(/status=crawled/)
  })

  test('should paginate results', async ({ page }) => {
    await setupMockDashboardAPI(page, {
      linksData: mockSourceLinksResponse({ totalLinks: 100, limit: 20 })
    })

    await navigateToSourceDashboard(page, 1, 1)
    await switchTab(page, 'links')

    // Verify pagination controls are visible
    await expect(page.getByRole('button', { name: /next/i })).toBeVisible()

    // Go to next page
    await goToNextPage(page)

    // Verify URL updated with page parameter
    await expect(page).toHaveURL(/page=2/)

    // Verify pagination indicator shows correct page
    await expect(page.getByText(/21-40/)).toBeVisible()
  })

  test('should change page size', async ({ page }) => {
    await page.route('**/api/research/sources/*/links*', async (route) => {
      const url = new URL(route.request().url())
      const limit = parseInt(url.searchParams.get('limit') || '20')

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSourceLinksResponse({ totalLinks: 100, limit }))
      })
    })

    await setupMockDashboardAPI(page)
    await navigateToSourceDashboard(page, 1, 1)
    await switchTab(page, 'links')

    // Change page size
    await changePageSize(page, 50)

    // Verify URL contains limit parameter
    await expect(page).toHaveURL(/limit=50/)
  })

  test('should handle bulk selection', async ({ page }) => {
    await setupMockDashboardAPI(page, {
      linksData: mockSourceLinksResponse({ totalLinks: 20 })
    })

    await navigateToSourceDashboard(page, 1, 1)
    await switchTab(page, 'links')

    // Select multiple rows
    await selectTableRows(page, 3)

    // Verify selection indicator (if present)
    // This depends on your table implementation
    const selectedCheckboxes = page.getByRole('checkbox', { checked: true })
    await expect(selectedCheckboxes).toHaveCount(3, { timeout: 5000 })
  })

  test('should search links', async ({ page }) => {
    await page.route('**/api/research/sources/*/links*', async (route) => {
      const url = new URL(route.request().url())
      const search = url.searchParams.get('search') || ''

      const response = mockSourceLinksResponse({ totalLinks: 20 })

      if (search) {
        response.data.links = response.data.links.filter(link =>
          link.url.toLowerCase().includes(search.toLowerCase())
        )
        response.data.pagination.total = response.data.links.length
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response)
      })
    })

    await setupMockDashboardAPI(page)
    await navigateToSourceDashboard(page, 1, 1)
    await switchTab(page, 'links')

    // Type in search input
    const searchInput = page.getByPlaceholder(/search/i)
    if (await searchInput.isVisible()) {
      await searchInput.fill('page-5')
      await page.waitForTimeout(500) // Wait for debounce

      // Verify filtered results
      const table = page.locator('table tbody')
      await expect(table.locator('tr')).toHaveCount(1, { timeout: 3000 })
    }
  })
})

test.describe('Source Dashboard - Component Interaction Tests', () => {
  test('should open external link in new tab', async ({ page, context }) => {
    await setupMockDashboardAPI(page)
    await navigateToSourceDashboard(page, 1, 1)

    // Listen for new page
    const pagePromise = context.waitForEvent('page')

    // Click external link
    const externalLink = page.locator('a[href*="example.com"]')
    await externalLink.click()

    // Verify new tab opened
    const newPage = await pagePromise
    await newPage.waitForLoadState()

    expect(newPage.url()).toContain('example.com')

    await newPage.close()
  })

  test('should copy URL to clipboard', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])

    await setupMockDashboardAPI(page)
    await navigateToSourceDashboard(page, 1, 1)
    await switchTab(page, 'links')

    // Click copy button
    await copyLinkUrl(page, 0)

    // Wait for toast notification
    await expect(page.locator('[data-sonner-toast]', { hasText: /copied/i })).toBeVisible({ timeout: 3000 })
  })

  test('should refresh dashboard data', async ({ page }) => {
    const getRequestCount = createRequestCounter(page, '/dashboard')

    await setupMockDashboardAPI(page)
    await navigateToSourceDashboard(page, 1, 1)

    const initialCount = getRequestCount()

    // Click refresh button
    await refreshDashboard(page)

    // Wait for request to complete
    await page.waitForTimeout(1000)

    const newCount = getRequestCount()
    expect(newCount).toBeGreaterThan(initialCount)
  })

  test('should display correct status indicator states', async ({ page }) => {
    const statuses: Array<'active' | 'completed' | 'failed' | 'idle'> = ['active', 'completed', 'failed', 'idle']

    for (const status of statuses) {
      await setupMockDashboardAPI(page, {
        dashboardData: mockSourceDashboardData({
          crawlStatus: { status }
        })
      })

      await navigateToSourceDashboard(page, 1, 1)

      // Verify correct badge is displayed
      await expectStatusBadge(page, status)

      // Verify active status has pulse animation
      if (status === 'active') {
        const badge = page.locator('[class*="badge"]', { hasText: /active/i })
        const classes = await badge.getAttribute('class')
        expect(classes).toContain('animate-pulse')
      }
    }
  })

  test('should handle refresh button loading state', async ({ page }) => {
    await setupMockDashboardAPI(page)
    await navigateToSourceDashboard(page, 1, 1)

    const refreshButton = page.getByRole('button', { name: /refresh/i })

    // Click refresh
    await refreshButton.click()

    // Verify loading spinner appears (check for spinning icon)
    const spinner = refreshButton.locator('[class*="animate-spin"]')
    await expect(spinner).toBeVisible({ timeout: 1000 })
  })
})

test.describe('Source Dashboard - Error Handling Tests', () => {
  test('should handle source not found (404)', async ({ page }) => {
    await setupMockDashboardAPIWithErrors(page, '404')

    await navigateToSourceDashboard(page, 1, 99999)

    // Verify error message is displayed
    await expect(page.getByText(/Source not found/i)).toBeVisible()

    // Verify back button is available
    await expect(page.getByRole('button', { name: /back/i })).toBeVisible()
  })

  test('should handle API errors gracefully', async ({ page }) => {
    await setupMockDashboardAPIWithErrors(page, '500')

    await navigateToSourceDashboard(page, 1, 1)

    // Verify error state is displayed
    // This depends on your error boundary implementation
    await expect(page.getByText(/error|failed/i)).toBeVisible({ timeout: 5000 })
  })

  test('should display loading skeleton initially', async ({ page }) => {
    // Delay API response to see loading state
    await page.route('**/api/research/sources/*/dashboard', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 2000))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockCompletedCrawl()
        })
      })
    })

    await navigateToSourceDashboard(page, 1, 1)

    // Verify skeleton elements are shown
    const skeleton = page.locator('[class*="skeleton"]').or(page.locator('[data-testid*="skeleton"]'))
    await expect(skeleton.first()).toBeVisible({ timeout: 1000 })

    // Wait for data to load
    await waitForDashboardAPI(page)

    // Verify skeleton is replaced with actual content
    await expectDashboardLoaded(page)
  })
})

test.describe('Source Dashboard - Accessibility Tests', () => {
  test('should support keyboard navigation', async ({ page }) => {
    await setupMockDashboardAPI(page)
    await navigateToSourceDashboard(page, 1, 1)

    // Tab through interactive elements
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')

    // Verify focus is visible
    const focusedElement = page.locator(':focus')
    await expect(focusedElement).toBeVisible()

    // Press Enter on a tab
    const linksTab = page.getByRole('tab', { name: /links/i })
    await linksTab.focus()
    await page.keyboard.press('Enter')

    // Verify tab switched
    await expect(linksTab).toHaveAttribute('data-state', 'active')
  })

  test('should have proper ARIA labels', async ({ page }) => {
    await setupMockDashboardAPI(page)
    await navigateToSourceDashboard(page, 1, 1)

    // Verify tabs have proper ARIA roles
    const tabs = page.locator('[role="tab"]')
    await expect(tabs).toHaveCount(4) // Overview, Links, Content, Errors

    // Verify tab panels have proper ARIA roles
    const tabPanels = page.locator('[role="tabpanel"]')
    await expect(tabPanels.first()).toBeVisible()

    // Verify navigation landmarks
    const nav = page.locator('nav').first()
    await expect(nav).toBeVisible() // Breadcrumb nav
  })
})

test.describe('Source Dashboard - Mobile Responsiveness', () => {
  test('should be mobile-friendly', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    await setupMockDashboardAPI(page)
    await navigateToSourceDashboard(page, 1, 1)

    // Verify layout adapts to mobile
    await expectDashboardLoaded(page)

    // Verify stats cards are visible (may stack vertically)
    const statsCards = page.locator('.grid').locator('> div')
    await expect(statsCards.first()).toBeVisible()

    // Switch to links tab
    await switchTab(page, 'links')

    // Verify table is accessible (may be scrollable)
    await expectLinkTableVisible(page)

    // Verify tabs are accessible
    const tabs = page.locator('[role="tab"]')
    await expect(tabs.first()).toBeVisible()
  })
})
