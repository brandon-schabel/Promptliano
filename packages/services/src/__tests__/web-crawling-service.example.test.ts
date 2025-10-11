/**
 * Web Crawling Service - Example Tests
 * Demonstrates usage patterns and integration testing
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import { createWebCrawlingService, type WebCrawlingService } from '../web-crawling-service'

describe('Web Crawling Service - Example Usage', () => {
  let service: WebCrawlingService
  let mockUrlRepo: any
  let mockDomainRepo: any
  let mockContentRepo: any

  beforeEach(() => {
    // Create mock repositories
    mockUrlRepo = {
      upsert: mock(async (data: any) => ({
        id: 1,
        url: data.url,
        urlHash: 'hash123',
        domain: 'example.com',
        status: 'pending',
        httpStatus: null,
        lastCrawledAt: null,
        nextCrawlAt: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
      })),
      getAll: mock(async () => [
        {
          id: 1,
          url: 'https://example.com',
          urlHash: 'hash123',
          domain: 'example.com',
          status: 'pending',
          httpStatus: null,
          lastCrawledAt: null,
          nextCrawlAt: null,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ]),
      markUrlCrawled: mock(async (id: number, httpStatus: number) => ({
        id,
        url: 'https://example.com',
        urlHash: 'hash123',
        domain: 'example.com',
        status: 'crawled',
        httpStatus,
        lastCrawledAt: Date.now(),
        nextCrawlAt: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
      })),
      markUrlFailed: mock(async (id: number, httpStatus?: number) => ({
        id,
        url: 'https://example.com',
        urlHash: 'hash123',
        domain: 'example.com',
        status: 'failed',
        httpStatus: httpStatus ?? null,
        lastCrawledAt: Date.now(),
        nextCrawlAt: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }))
    }

    mockDomainRepo = {
      upsert: mock(async (data: any) => ({
        id: 1,
        domain: data.domain,
        robotsTxt: data.robotsTxt,
        crawlDelay: data.crawlDelay,
        lastCrawlAt: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
      })),
      getDomain: mock(async (domain: string) => null),
      updateRobotsTxt: mock(async (domain: string, robotsTxt: string | null) => ({
        id: 1,
        domain,
        robotsTxt,
        crawlDelay: 1000,
        lastCrawlAt: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }))
    }

    mockContentRepo = {
      upsertForUrl: mock(async (urlId: number, data: any) => ({
        id: 1,
        urlId,
        title: data.title,
        cleanContent: data.cleanContent,
        rawHtml: data.rawHtml,
        summary: null,
        metadata: data.metadata ?? {},
        links: data.links ?? [],
        crawledAt: data.crawledAt ?? Date.now()
      })),
      getByUrlId: mock(async (urlId: number) => ({
        id: 1,
        urlId,
        title: 'Example Page',
        cleanContent: 'Example content',
        rawHtml: '<html><body>Example</body></html>',
        summary: null,
        metadata: {},
        links: ['https://example.com/page1', 'https://example.com/page2'],
        crawledAt: Date.now()
      }))
    }

    service = createWebCrawlingService({
      urlRepository: mockUrlRepo,
      domainRepository: mockDomainRepo,
      contentRepository: mockContentRepo
    })
  })

  test('should start a crawl session', async () => {
    const result = await service.startCrawl('https://example.com/docs')

    expect(result.crawlId).toBeDefined()
    expect(result.seedDomain).toBe('example.com')
    expect(result.initialUrl).toBeDefined()
    expect(mockDomainRepo.upsert).toHaveBeenCalled()
    expect(mockUrlRepo.upsert).toHaveBeenCalled()
  })

  test('should get crawl progress', async () => {
    const { crawlId } = await service.startCrawl('https://example.com')
    const progress = await service.getCrawlProgress(crawlId)

    expect(progress).toBeDefined()
    expect(progress.status).toBe('running')
    expect(progress.urlsCrawled).toBe(0)
    expect(progress.urlsPending).toBe(1)
  })

  test('should pause and resume crawl', async () => {
    const { crawlId } = await service.startCrawl('https://example.com')

    await service.pauseCrawl(crawlId)
    let progress = await service.getCrawlProgress(crawlId)
    expect(progress.status).toBe('paused')

    await service.resumeCrawl(crawlId)
    progress = await service.getCrawlProgress(crawlId)
    expect(progress.status).toBe('running')
  })

  test('should cancel crawl', async () => {
    const { crawlId } = await service.startCrawl('https://example.com')

    await service.cancelCrawl(crawlId)

    // Should throw error when trying to get progress of cancelled session
    await expect(service.getCrawlProgress(crawlId)).rejects.toThrow()
  })

  test('should extract links from HTML', async () => {
    const html = `
      <html>
        <body>
          <a href="https://example.com/page1">Page 1</a>
          <a href="/page2">Page 2</a>
          <a href="mailto:test@example.com">Email</a>
        </body>
      </html>
    `

    const links = await service.extractLinks(html, 'https://example.com')

    expect(links).toContain('https://example.com/page1')
    expect(links).toContain('https://example.com/page2') // Resolved relative URL
    expect(links).not.toContain('mailto:test@example.com') // Filtered out
  })

  test('should process HTML content', async () => {
    const html = `
      <html>
        <head><title>Example Page</title></head>
        <body>
          <h1>Main Heading</h1>
          <p>This is example content with <a href="/link1">a link</a>.</p>
        </body>
      </html>
    `

    const result = await service.processHtmlContent(html, 'https://example.com')

    expect(result.title).toBeDefined()
    expect(result.cleanContent).toContain('Main Heading')
    expect(result.links).toBeArray()
    expect(result.metadata).toBeDefined()
  })

  test('should fetch and parse robots.txt', async () => {
    // This test would need network access or mocking fetch
    // Example: const result = await service.fetchRobotsTxt('example.com')
    // expect(result.rules).toBeDefined()
    // expect(result.disallowedPaths).toBeArray()
  })

  test('should handle crawl options', async () => {
    const { crawlId } = await service.startCrawl('https://example.com', {
      maxDepth: 2,
      maxPages: 10,
      respectRobotsTxt: false,
      crawlDelay: 500,
      userAgent: 'CustomBot/1.0',
      timeout: 15000,
      sameDomainOnly: true
    })

    const progress = await service.getCrawlProgress(crawlId)
    expect(progress).toBeDefined()
  })
})

/**
 * Example: Integration with Deep Research
 */
describe('Web Crawling Integration - Deep Research Example', () => {
  test('example usage flow', async () => {
    const service = createWebCrawlingService()

    // 1. Start crawl for research source
    const { crawlId, initialUrl } = await service.startCrawl('https://example.com/article', {
      maxDepth: 1,
      maxPages: 5
    })

    // 2. Execute crawl (in real scenario, this would crawl pages)
    // await service.executeCrawl(crawlId)

    // 3. Get crawled content for AI processing
    // const content = await crawledContentRepository.getByUrlId(initialUrl.id)

    // 4. Process with Deep Research Service
    // const processedData = await deepResearchService.processSourceData({
    //   content: content.cleanContent,
    //   markdown: content.markdown,
    //   title: content.title
    // })

    expect(crawlId).toBeDefined()
  })
})
