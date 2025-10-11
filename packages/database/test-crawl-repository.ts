/**
 * Test script for crawl repository
 * Demonstrates all repository operations for web crawling
 */

import {
  domainRepository,
  urlRepository,
  crawledContentRepository,
  crawlUtils
} from './src/repositories/crawl-repository'

async function main() {
  console.log('🕷️  Web Crawl Repository Test\n')

  // ============================================================================
  // CLEANUP FIRST (in case previous test failed)
  // ============================================================================
  console.log('=== Initial Cleanup ===\n')

  // Try to delete any existing test data
  const existingDomain = await domainRepository.getDomain('example.com')
  if (existingDomain) {
    // Get all URLs for this domain and delete their content first
    const existingUrls = await urlRepository.getByDomain('example.com', 100)
    for (const url of existingUrls) {
      const content = await crawledContentRepository.getByUrlId(url.id)
      if (content) {
        await crawledContentRepository.delete(content.id)
      }
      await urlRepository.delete(url.id)
    }
    await domainRepository.delete(existingDomain.id)
    console.log('✅ Cleaned up existing test data')
  } else {
    console.log('✅ No existing test data to clean up')
  }
  console.log()

  // ============================================================================
  // UTILITY FUNCTIONS TEST
  // ============================================================================
  console.log('=== Testing Utility Functions ===\n')

  const testUrl = 'https://example.com/path/to/page?b=2&a=1#fragment'
  console.log('Original URL:', testUrl)

  const normalized = crawlUtils.normalizeUrl(testUrl)
  console.log('Normalized URL:', normalized)

  const hash = crawlUtils.generateUrlHash(testUrl)
  console.log('URL Hash:', hash)

  const domain = crawlUtils.extractDomain(testUrl)
  console.log('Extracted Domain:', domain)
  console.log()

  // ============================================================================
  // DOMAIN REPOSITORY TEST
  // ============================================================================
  console.log('=== Testing Domain Repository ===\n')

  // Create domain
  const domainRecord = await domainRepository.createDomain({
    domain: 'example.com',
    robotsTxt: 'User-agent: *\nAllow: /',
    crawlDelay: 1000
  })
  console.log('✅ Created domain:', domainRecord)

  // Get domain by name
  const foundDomain = await domainRepository.getDomain('example.com')
  console.log('✅ Found domain:', foundDomain)

  // Get domain by URL
  const domainByUrl = await domainRepository.getDomainByUrl('https://example.com/page')
  console.log('✅ Domain by URL:', domainByUrl)

  // Update robots.txt
  await domainRepository.updateRobotsTxt('example.com', 'User-agent: *\nDisallow: /private/')
  console.log('✅ Updated robots.txt')

  // Update last crawl
  await domainRepository.updateLastCrawl('example.com')
  console.log('✅ Updated last crawl timestamp')
  console.log()

  // ============================================================================
  // URL REPOSITORY TEST
  // ============================================================================
  console.log('=== Testing URL Repository ===\n')

  // Create URL (automatic hash generation)
  const urlRecord = await urlRepository.createUrl({
    url: 'https://example.com/page1',
    status: 'pending'
  })
  console.log('✅ Created URL:', urlRecord)

  // Check if URL exists
  const exists = await urlRepository.existsByHash(urlRecord.urlHash)
  console.log('✅ URL exists:', exists)

  // Get URL by hash
  const foundUrl = await urlRepository.getUrlByHash(urlRecord.urlHash)
  console.log('✅ Found URL by hash:', foundUrl)

  // Get URL by full URL string
  const urlByString = await urlRepository.getByUrl('https://example.com/page1')
  console.log('✅ Found URL by string:', urlByString)

  // Get pending URLs
  const pendingUrls = await urlRepository.getPendingUrls(10)
  console.log('✅ Pending URLs:', pendingUrls.length)

  // Get pending URLs by domain
  const pendingByDomain = await urlRepository.getPendingUrlsByDomain('example.com', 10)
  console.log('✅ Pending URLs for example.com:', pendingByDomain.length)

  // Mark URL as crawled
  const crawled = await urlRepository.markUrlCrawled(urlRecord.id, 200)
  console.log('✅ Marked URL as crawled:', crawled)

  // Create another URL for testing
  const failedUrl = await urlRepository.createUrl({
    url: 'https://example.com/page2',
    status: 'pending'
  })

  // Mark URL as failed
  const failed = await urlRepository.markUrlFailed(failedUrl.id, 404)
  console.log('✅ Marked URL as failed:', failed)

  // Get URLs by domain
  const urlsByDomain = await urlRepository.getByDomain('example.com', 100)
  console.log('✅ URLs for example.com:', urlsByDomain.length)

  // Get stale URLs (URLs that need re-crawling)
  const staleUrls = await urlRepository.getStaleUrls(1000, 10) // 1 second TTL for testing
  console.log('✅ Stale URLs:', staleUrls.length)
  console.log()

  // ============================================================================
  // CRAWLED CONTENT REPOSITORY TEST
  // ============================================================================
  console.log('=== Testing Crawled Content Repository ===\n')

  // Create content for URL
  const content = await crawledContentRepository.createContent({
    urlId: urlRecord.id,
    title: 'Example Page',
    cleanContent: 'This is the clean content extracted from the page.',
    rawHtml: '<html><body>This is the clean content extracted from the page.</body></html>',
    summary: 'AI-generated summary of the page content.',
    metadata: {
      author: 'John Doe',
      date: '2025-10-10',
      publishedTime: '2025-10-10T10:00:00Z',
      siteName: 'Example Site',
      excerpt: 'A brief excerpt',
      lang: 'en'
    },
    links: [
      'https://example.com/page3',
      'https://example.com/page4',
      'https://external.com/page'
    ]
  })
  console.log('✅ Created content:', content)

  // Get content by URL ID
  const foundContent = await crawledContentRepository.getContentByUrl(urlRecord.id)
  console.log('✅ Found content by URL ID:', foundContent ? 'Yes' : 'No')

  // Get latest content
  const latestContent = await crawledContentRepository.getLatestContent(5)
  console.log('✅ Latest content count:', latestContent.length)

  // Get content with links
  const contentWithLinks = await crawledContentRepository.getWithLinks(urlRecord.id)
  console.log('✅ Content with links:', contentWithLinks?.links?.length || 0, 'links')

  // Upsert content (update existing)
  const upserted = await crawledContentRepository.upsertForUrl(urlRecord.id, {
    title: 'Updated Example Page',
    cleanContent: 'Updated clean content.',
    rawHtml: '<html><body>Updated clean content.</body></html>',
    summary: 'Updated AI-generated summary.',
    metadata: {
      author: 'Jane Doe',
      date: '2025-10-10',
      lang: 'en'
    },
    links: ['https://example.com/page5']
  })
  console.log('✅ Upserted content:', upserted)

  // Delete old content (older than 1 day)
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000)
  const deletedCount = await crawledContentRepository.deleteOldContent(oneDayAgo)
  console.log('✅ Deleted old content:', deletedCount, 'records')
  console.log()

  // ============================================================================
  // CLEANUP
  // ============================================================================
  console.log('=== Cleanup ===\n')

  // Delete test content
  await crawledContentRepository.delete(content.id)
  console.log('✅ Deleted content')

  // Delete test URLs
  await urlRepository.delete(urlRecord.id)
  await urlRepository.delete(failedUrl.id)
  console.log('✅ Deleted URLs')

  // Delete test domain
  await domainRepository.delete(domainRecord.id)
  console.log('✅ Deleted domain')

  console.log('\n✨ All tests completed successfully!')
}

// Run the test
main().catch((error) => {
  console.error('❌ Test failed:', error)
  process.exit(1)
})
