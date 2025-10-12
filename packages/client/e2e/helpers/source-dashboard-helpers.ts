/**
 * Source Dashboard E2E Test Helpers
 * Provides mock data generators, navigation helpers, and assertion utilities
 */

import { type Page, expect } from '@playwright/test'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface SourceDashboard {
  id: number
  researchId: number
  researchTopic?: string
  url: string
  title?: string
  sourceType: string
  status: string
  createdAt: number
  updatedAt: number
  errorMessage?: string
  crawlStatus: {
    status: 'idle' | 'active' | 'completed' | 'failed' | 'queued'
    startedAt?: number
    completedAt?: number
    errorMessage?: string
  }
  metadata: {
    tokenCount?: number
    pagesCrawled?: number
    linksDiscovered?: number
    lastCrawlTime?: number
    maxDepth?: number
    currentDepth?: number
    avgResponseTime?: number
    totalRequests?: number
    successfulRequests?: number
    errorCount?: number
  }
}

export interface SourceLink {
  id: number
  sourceId: number
  url: string
  title?: string
  status: 'discovered' | 'crawled' | 'pending' | 'failed'
  depth: number
  discoveredAt: number
  crawledAt?: number
  parentUrl?: string
  statusCode?: number
  contentType?: string
}

export interface SourceLinksResponse {
  success: boolean
  data: {
    links: SourceLink[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }
}

export interface LinkFilters {
  status?: 'discovered' | 'crawled' | 'pending' | 'failed'
  depth?: number
  search?: string
}

// ============================================================================
// MOCK DATA GENERATORS
// ============================================================================

/**
 * Generate mock source dashboard data
 */
export function mockSourceDashboardData(overrides: Partial<SourceDashboard> = {}): SourceDashboard {
  const baseData: SourceDashboard = {
    id: 1,
    researchId: 1,
    researchTopic: 'Test Research Topic',
    url: 'https://example.com',
    title: 'Example Website',
    sourceType: 'web',
    status: 'active',
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now(),
    crawlStatus: {
      status: 'completed',
      startedAt: Date.now() - 1800000,
      completedAt: Date.now() - 60000
    },
    metadata: {
      tokenCount: 15000,
      pagesCrawled: 25,
      linksDiscovered: 50,
      lastCrawlTime: Date.now() - 60000,
      maxDepth: 3,
      currentDepth: 2,
      avgResponseTime: 450,
      totalRequests: 30,
      successfulRequests: 28,
      errorCount: 2
    }
  }

  return {
    ...baseData,
    ...overrides,
    crawlStatus: { ...baseData.crawlStatus, ...overrides.crawlStatus },
    metadata: { ...baseData.metadata, ...overrides.metadata }
  }
}

/**
 * Generate mock active crawl dashboard data
 */
export function mockActiveCrawl(): SourceDashboard {
  return mockSourceDashboardData({
    status: 'active',
    crawlStatus: {
      status: 'active',
      startedAt: Date.now() - 300000 // 5 minutes ago
    },
    metadata: {
      tokenCount: 8000,
      pagesCrawled: 12,
      linksDiscovered: 30,
      lastCrawlTime: Date.now() - 5000,
      currentDepth: 1,
      totalRequests: 15,
      successfulRequests: 14,
      errorCount: 1
    }
  })
}

/**
 * Generate mock completed crawl dashboard data
 */
export function mockCompletedCrawl(): SourceDashboard {
  return mockSourceDashboardData({
    status: 'completed',
    crawlStatus: {
      status: 'completed',
      startedAt: Date.now() - 1800000,
      completedAt: Date.now() - 60000
    },
    metadata: {
      tokenCount: 25000,
      pagesCrawled: 50,
      linksDiscovered: 100,
      lastCrawlTime: Date.now() - 60000,
      maxDepth: 3,
      currentDepth: 3,
      avgResponseTime: 380,
      totalRequests: 55,
      successfulRequests: 52,
      errorCount: 3
    }
  })
}

/**
 * Generate mock source links
 */
export function mockSourceLinks(count: number = 20): SourceLink[] {
  const statuses: SourceLink['status'][] = ['discovered', 'crawled', 'pending', 'failed']

  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    sourceId: 1,
    url: `https://example.com/page-${i + 1}`,
    title: `Page ${i + 1}`,
    status: statuses[i % statuses.length],
    depth: Math.floor(i / 10),
    discoveredAt: Date.now() - (count - i) * 60000,
    crawledAt: i % 2 === 0 ? Date.now() - (count - i) * 30000 : undefined,
    parentUrl: i > 0 ? `https://example.com/page-${Math.floor(i / 2)}` : undefined,
    statusCode: i % 4 === 3 ? 404 : 200,
    contentType: 'text/html'
  }))
}

/**
 * Generate mock links response with pagination
 */
export function mockSourceLinksResponse(options: {
  page?: number
  limit?: number
  totalLinks?: number
  status?: string
} = {}): SourceLinksResponse {
  const page = options.page || 1
  const limit = options.limit || 20
  const totalLinks = options.totalLinks || 100

  const allLinks = mockSourceLinks(totalLinks)
  const filteredLinks = options.status
    ? allLinks.filter(link => link.status === options.status)
    : allLinks

  const startIndex = (page - 1) * limit
  const endIndex = startIndex + limit
  const paginatedLinks = filteredLinks.slice(startIndex, endIndex)

  return {
    success: true,
    data: {
      links: paginatedLinks,
      pagination: {
        page,
        limit,
        total: filteredLinks.length,
        totalPages: Math.ceil(filteredLinks.length / limit)
      }
    }
  }
}

// ============================================================================
// NAVIGATION HELPERS
// ============================================================================

/**
 * Navigate to source dashboard page
 */
export async function navigateToSourceDashboard(
  page: Page,
  researchId: number | string,
  sourceId: number | string
) {
  await page.goto(`/deep-research/${researchId}/sources/${sourceId}`)
  await page.waitForLoadState('networkidle')
}

/**
 * Switch to a specific tab in the dashboard
 */
export async function switchTab(
  page: Page,
  tabName: 'overview' | 'links' | 'content' | 'errors'
) {
  const tabTrigger = page.getByRole('tab', { name: new RegExp(tabName, 'i') })
  await tabTrigger.click()
  await page.waitForTimeout(300) // Wait for tab transition
}

/**
 * Navigate back to research detail page
 */
export async function navigateBackToResearch(page: Page) {
  const backButton = page.getByRole('button', { name: /back/i }).first()
  await backButton.click()
  await page.waitForLoadState('networkidle')
}

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

/**
 * Assert that the dashboard has loaded successfully
 */
export async function expectDashboardLoaded(page: Page) {
  // Check for key dashboard elements
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('link', { name: /example\.com|http/i })).toBeVisible()

  // Check for stats cards
  const statsCards = page.locator('.grid').locator('> div')
  await expect(statsCards.first()).toBeVisible()
}

/**
 * Assert that the link discovery table is visible
 */
export async function expectLinkTableVisible(page: Page) {
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.getByRole('columnheader', { name: /url/i })).toBeVisible()
}

/**
 * Assert that polling is active (multiple requests within time window)
 */
export async function expectPollingActive(page: Page, endpoint: string = '/dashboard') {
  const requests: string[] = []

  page.on('request', (request) => {
    if (request.url().includes(endpoint)) {
      requests.push(request.url())
    }
  })

  // Wait for multiple requests
  await page.waitForTimeout(12000) // Wait 12 seconds for 2+ polls at 5s interval

  expect(requests.length).toBeGreaterThanOrEqual(2)
}

/**
 * Assert that polling has stopped
 */
export async function expectPollingInactive(page: Page, endpoint: string = '/dashboard') {
  let requestCount = 0

  page.on('request', (request) => {
    if (request.url().includes(endpoint)) {
      requestCount++
    }
  })

  // Wait and verify no new requests
  await page.waitForTimeout(7000) // Wait 7 seconds (should have 1+ poll if active)

  expect(requestCount).toBeLessThan(2) // Allow for 1 initial request
}

/**
 * Assert that a specific status badge is displayed
 */
export async function expectStatusBadge(
  page: Page,
  status: 'active' | 'completed' | 'failed' | 'idle' | 'queued'
) {
  const badge = page.locator('[class*="badge"]', { hasText: new RegExp(status, 'i') })
  await expect(badge).toBeVisible()
}

/**
 * Assert that stats cards show expected values
 */
export async function expectStatsCards(page: Page, expectedStats: {
  tokenCount?: number
  pagesCrawled?: number
  linksDiscovered?: number
}) {
  if (expectedStats.tokenCount !== undefined) {
    await expect(
      page.locator('text=/Token Count/i').locator('../..').locator('text=/\\d+/')
    ).toBeVisible()
  }

  if (expectedStats.pagesCrawled !== undefined) {
    await expect(
      page.locator('text=/Pages Crawled/i').locator('../..').locator('text=/\\d+/')
    ).toBeVisible()
  }

  if (expectedStats.linksDiscovered !== undefined) {
    await expect(
      page.locator('text=/Links Discovered/i').locator('../..').locator('text=/\\d+/')
    ).toBeVisible()
  }
}

// ============================================================================
// INTERACTION HELPERS
// ============================================================================

/**
 * Sort link table by column
 */
export async function sortLinkTable(
  page: Page,
  column: string,
  order: 'asc' | 'desc' = 'asc'
) {
  const columnHeader = page.getByRole('columnheader', { name: new RegExp(column, 'i') })

  // Click once for ascending
  await columnHeader.click()
  await page.waitForTimeout(300)

  // Click again for descending if needed
  if (order === 'desc') {
    await columnHeader.click()
    await page.waitForTimeout(300)
  }
}

/**
 * Filter link table
 */
export async function filterLinkTable(page: Page, filters: LinkFilters) {
  // Open filters if there's a filter button
  const filterButton = page.getByRole('button', { name: /filter/i })
  if (await filterButton.isVisible()) {
    await filterButton.click()
    await page.waitForTimeout(200)
  }

  // Apply status filter
  if (filters.status) {
    const statusSelect = page.getByLabel(/status/i)
    await statusSelect.selectOption(filters.status)
  }

  // Apply search filter
  if (filters.search) {
    const searchInput = page.getByPlaceholder(/search/i)
    await searchInput.fill(filters.search)
    await page.waitForTimeout(500) // Debounce
  }

  // Apply filters
  const applyButton = page.getByRole('button', { name: /apply/i })
  if (await applyButton.isVisible()) {
    await applyButton.click()
    await page.waitForTimeout(300)
  }
}

/**
 * Select table rows
 */
export async function selectTableRows(page: Page, count: number) {
  const checkboxes = page.getByRole('checkbox').filter({ hasNotText: /select all/i })

  for (let i = 0; i < Math.min(count, await checkboxes.count()); i++) {
    await checkboxes.nth(i).check()
    await page.waitForTimeout(100)
  }
}

/**
 * Refresh dashboard data
 */
export async function refreshDashboard(page: Page) {
  const refreshButton = page.getByRole('button', { name: /refresh/i })
  await refreshButton.click()
  await page.waitForTimeout(500)
}

/**
 * Click copy URL button for a link
 */
export async function copyLinkUrl(page: Page, linkIndex: number = 0) {
  // Find all copy buttons in the table
  const copyButtons = page.getByRole('button', { name: /copy/i })
  await copyButtons.nth(linkIndex).click()
  await page.waitForTimeout(200)
}

/**
 * Change pagination page size
 */
export async function changePageSize(page: Page, pageSize: number) {
  const pageSizeSelect = page.getByLabel(/items per page|page size/i)
  await pageSizeSelect.selectOption(pageSize.toString())
  await page.waitForTimeout(300)
}

/**
 * Navigate to next page in pagination
 */
export async function goToNextPage(page: Page) {
  const nextButton = page.getByRole('button', { name: /next/i })
  await nextButton.click()
  await page.waitForTimeout(300)
}

/**
 * Navigate to previous page in pagination
 */
export async function goToPreviousPage(page: Page) {
  const prevButton = page.getByRole('button', { name: /previous|prev/i })
  await prevButton.click()
  await page.waitForTimeout(300)
}

// ============================================================================
// MOCK API SETUP HELPERS
// ============================================================================

/**
 * Setup mock API routes for source dashboard
 */
export async function setupMockDashboardAPI(
  page: Page,
  options: {
    dashboardData?: SourceDashboard
    linksData?: SourceLinksResponse
    simulatePolling?: boolean
  } = {}
) {
  const dashboardData = options.dashboardData || mockSourceDashboardData()
  const linksData = options.linksData || mockSourceLinksResponse()

  // Mock dashboard endpoint
  await page.route('**/api/research/sources/*/dashboard', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: dashboardData
      })
    })
  })

  // Mock links endpoint with pagination support
  await page.route('**/api/research/sources/*/links*', async (route) => {
    const url = new URL(route.request().url())
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const status = url.searchParams.get('status')

    const response = mockSourceLinksResponse({
      page,
      limit,
      totalLinks: linksData.data.pagination.total,
      status: status || undefined
    })

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response)
    })
  })
}

/**
 * Setup mock API for error scenarios
 */
export async function setupMockDashboardAPIWithErrors(
  page: Page,
  errorType: '404' | '500' | 'timeout'
) {
  if (errorType === '404') {
    await page.route('**/api/research/sources/*/dashboard', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Source not found'
        })
      })
    })
  } else if (errorType === '500') {
    await page.route('**/api/research/sources/*/dashboard', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Internal server error'
        })
      })
    })
  } else if (errorType === 'timeout') {
    await page.route('**/api/research/sources/*/dashboard', async (route) => {
      // Delay response to simulate timeout
      await new Promise(resolve => setTimeout(resolve, 35000))
      await route.fulfill({
        status: 408,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Request timeout'
        })
      })
    })
  }
}

/**
 * Wait for API request to complete
 */
export async function waitForDashboardAPI(page: Page) {
  await page.waitForResponse(
    (response) => response.url().includes('/dashboard') && response.status() === 200,
    { timeout: 10000 }
  )
}

/**
 * Count API requests to a specific endpoint
 */
export function createRequestCounter(page: Page, endpoint: string): () => number {
  let count = 0

  page.on('request', (request) => {
    if (request.url().includes(endpoint)) {
      count++
    }
  })

  return () => count
}
