/**
 * AI Link Relevance Service - Usage Examples
 *
 * Demonstrates practical integration patterns with the web crawling system
 */

import { createAiLinkRelevanceService } from './ai-link-relevance-service'
import { createWebCrawlingService } from './web-crawling-service'

// ============================================
// Example 1: Basic URL Filtering
// ============================================

async function basicUrlFiltering() {
  const aiLinkService = createAiLinkRelevanceService()
  const webCrawler = createWebCrawlingService()

  // Crawl a seed page
  const seedPage = await webCrawler.processUrl('https://example.com/ai-overview')

  // Extract discovered links
  const discoveredLinks = await webCrawler.extractLinks(seedPage.html || '')

  // Evaluate relevance
  const evaluation = await aiLinkService.evaluateBatch(discoveredLinks, {
    topic: 'Artificial Intelligence Ethics',
    threshold: 0.6
  })

  console.log(`Total links discovered: ${discoveredLinks.length}`)
  console.log(`Relevant links: ${evaluation.aboveThreshold}`)
  console.log(`Average relevance: ${evaluation.averageScore.toFixed(3)}`)

  // Get URLs to crawl next
  const relevantUrls = evaluation.results.filter((r) => r.shouldCrawl).map((r) => r.url)

  console.log('\nTop 5 URLs to crawl:')
  const ranked = aiLinkService.rankUrls(evaluation.results)
  ranked
    .filter((r) => r.shouldCrawl)
    .slice(0, 5)
    .forEach((r, i) => {
      console.log(`${i + 1}. ${r.url} (score: ${r.relevanceScore}, priority: ${r.priority})`)
      console.log(`   Reasoning: ${r.reasoning}`)
    })

  return relevantUrls
}

// ============================================
// Example 2: Context-Aware Crawling
// ============================================

async function contextAwareCrawling() {
  const aiLinkService = createAiLinkRelevanceService()
  const webCrawler = createWebCrawlingService()

  const researchTopic = 'Machine Learning in Healthcare'
  let crawledPages: Array<{ url: string; content: string }> = []
  let pendingUrls = ['https://example.com/ml-healthcare-overview']

  for (let depth = 0; depth < 3 && pendingUrls.length > 0; depth++) {
    console.log(`\n=== Crawl Depth ${depth + 1} ===`)

    // Get next best URLs based on what we've crawled
    const suggestions = await aiLinkService.suggestNextUrls(
      pendingUrls,
      crawledPages,
      researchTopic,
      5 // Top 5 suggestions
    )

    console.log(`Suggestions: ${suggestions.length}`)

    // Crawl suggested URLs
    for (const suggestion of suggestions) {
      console.log(`Crawling: ${suggestion.url} (priority: ${suggestion.priority})`)

      try {
        const page = await webCrawler.processUrl(suggestion.url)

        crawledPages.push({
          url: suggestion.url,
          content: page.text?.slice(0, 500) || '' // First 500 chars as summary
        })

        // Extract new links
        if (page.html) {
          const newLinks = await webCrawler.extractLinks(page.html)
          pendingUrls.push(...newLinks)
        }

        // Remove duplicates
        pendingUrls = [...new Set(pendingUrls)]

        // Remove already-crawled URLs
        pendingUrls = pendingUrls.filter((url) => !crawledPages.some((p) => p.url === url))
      } catch (error) {
        console.error(`Failed to crawl ${suggestion.url}:`, error)
      }
    }

    console.log(`Crawled: ${crawledPages.length} pages`)
    console.log(`Pending: ${pendingUrls.length} URLs`)
  }

  return crawledPages
}

// ============================================
// Example 3: Cost-Optimized Progressive Filtering
// ============================================

async function costOptimizedFiltering() {
  const aiLinkService = createAiLinkRelevanceService()
  const webCrawler = createWebCrawlingService()

  // Extract many links
  const seedPage = await webCrawler.processUrl('https://example.com/directory')
  const allLinks = await webCrawler.extractLinks(seedPage.html || '')

  console.log(`Total links extracted: ${allLinks.length}`)

  // Step 1: Quick heuristic pre-filter (no AI cost)
  const heuristicFiltered = allLinks.filter((url) => {
    // Filter out obviously irrelevant URLs
    const urlLower = url.toLowerCase()
    return (
      !urlLower.includes('/tag/') &&
      !urlLower.includes('/category/') &&
      !urlLower.includes('/author/') &&
      !urlLower.includes('/page/') &&
      !urlLower.endsWith('/feed')
    )
  })

  console.log(`After heuristic filtering: ${heuristicFiltered.length}`)
  console.log(`Removed ${allLinks.length - heuristicFiltered.length} obviously irrelevant URLs`)

  // Step 2: AI evaluation of reduced set
  const aiEvaluation = await aiLinkService.evaluateBatch(heuristicFiltered, {
    topic: 'Deep Learning Architectures',
    threshold: 0.6,
    maxLinksToEvaluate: 20 // Batch size
  })

  console.log(`\nAI Evaluation Results:`)
  console.log(`Total evaluated: ${aiEvaluation.totalEvaluated}`)
  console.log(`Above threshold: ${aiEvaluation.aboveThreshold}`)
  console.log(`Below threshold: ${aiEvaluation.belowThreshold}`)
  console.log(`Average relevance: ${aiEvaluation.averageScore.toFixed(3)}`)

  // Calculate cost savings
  const aiCalls = Math.ceil(heuristicFiltered.length / 20)
  const savedCalls = allLinks.length - aiCalls

  console.log(`\nCost Analysis:`)
  console.log(`AI calls required: ${aiCalls}`)
  console.log(`Saved API calls: ${savedCalls}`)
  console.log(`Cost reduction: ${((savedCalls / allLinks.length) * 100).toFixed(1)}%`)

  return aiEvaluation.results.filter((r) => r.shouldCrawl)
}

// ============================================
// Example 4: Smart Depth Control
// ============================================

async function smartDepthControl() {
  const aiLinkService = createAiLinkRelevanceService()
  const webCrawler = createWebCrawlingService()

  const urlToEvaluate = 'https://example.com/advanced-ml-concepts'

  // Evaluate URL relevance
  const evaluation = await aiLinkService.evaluateUrl(urlToEvaluate, {
    topic: 'Machine Learning Fundamentals',
    threshold: 0.5
  })

  // Determine crawl depth based on relevance
  let maxDepth = 1
  let crawlJustification = 'Low relevance - shallow crawl'

  if (evaluation.relevanceScore > 0.8) {
    maxDepth = 3
    crawlJustification = 'Highly relevant - deep crawl'
  } else if (evaluation.relevanceScore > 0.6) {
    maxDepth = 2
    crawlJustification = 'Moderately relevant - medium crawl'
  }

  console.log(`\nURL: ${urlToEvaluate}`)
  console.log(`Relevance Score: ${evaluation.relevanceScore}`)
  console.log(`Reasoning: ${evaluation.reasoning}`)
  console.log(`Crawl Depth: ${maxDepth}`)
  console.log(`Justification: ${crawlJustification}`)

  // Crawl with appropriate depth
  const crawlResult = await webCrawler.executeCrawl(urlToEvaluate, {
    maxDepth,
    respectRobotsTxt: true
  })

  return crawlResult
}

// ============================================
// Example 5: Batch Research Source Discovery
// ============================================

async function batchResearchSourceDiscovery() {
  const aiLinkService = createAiLinkRelevanceService()

  // Multiple research topics
  const researchProjects = [
    { topic: 'Neural Network Architectures', seedUrls: ['https://arxiv.org/list/cs.NE/recent'] },
    { topic: 'Natural Language Processing', seedUrls: ['https://aclweb.org/anthology/'] },
    { topic: 'Computer Vision', seedUrls: ['https://paperswithcode.com/area/computer-vision'] }
  ]

  const results = []

  for (const project of researchProjects) {
    console.log(`\n=== ${project.topic} ===`)

    // Evaluate seed URLs
    const evaluation = await aiLinkService.evaluateBatch(project.seedUrls, {
      topic: project.topic,
      threshold: 0.7
    })

    const topSources = aiLinkService
      .rankUrls(evaluation.results)
      .filter((r) => r.shouldCrawl)
      .slice(0, 3)

    console.log(`Top sources for ${project.topic}:`)
    topSources.forEach((source, i) => {
      console.log(`${i + 1}. ${source.url}`)
      console.log(`   Score: ${source.relevanceScore}, Priority: ${source.priority}`)
    })

    results.push({
      topic: project.topic,
      sources: topSources
    })
  }

  return results
}

// ============================================
// Example 6: Real-Time Crawl Guidance
// ============================================

async function realTimeCrawlGuidance() {
  const aiLinkService = createAiLinkRelevanceService()
  const webCrawler = createWebCrawlingService()

  const researchTopic = 'Reinforcement Learning Applications'
  let crawledCount = 0
  let pendingUrls = ['https://example.com/rl-applications']
  let crawledPages: Array<{ url: string; content: string }> = []

  while (crawledCount < 20 && pendingUrls.length > 0) {
    // Get next best URL
    const suggestions = await aiLinkService.suggestNextUrls(
      pendingUrls,
      crawledPages,
      researchTopic,
      1 // Just one at a time
    )

    if (suggestions.length === 0) {
      console.log('No more relevant URLs found')
      break
    }

    const nextUrl = suggestions[0]
    console.log(`\n[${crawledCount + 1}/20] Crawling: ${nextUrl.url}`)
    console.log(`Relevance: ${nextUrl.relevanceScore}, Priority: ${nextUrl.priority}`)
    console.log(`Reasoning: ${nextUrl.reasoning}`)

    try {
      const page = await webCrawler.processUrl(nextUrl.url)

      crawledPages.push({
        url: nextUrl.url,
        content: page.text?.slice(0, 300) || ''
      })

      crawledCount++

      // Extract and add new links
      if (page.html) {
        const newLinks = await webCrawler.extractLinks(page.html)

        // Filter by context before adding to pending
        const relevantLinks = await aiLinkService.filterByContext(newLinks, crawledPages, researchTopic)

        pendingUrls.push(...relevantLinks)
        pendingUrls = [...new Set(pendingUrls)]
        pendingUrls = pendingUrls.filter((url) => !crawledPages.some((p) => p.url === url))

        console.log(`Added ${relevantLinks.length} relevant links to pending queue`)
      }
    } catch (error) {
      console.error(`Failed: ${error}`)
      pendingUrls = pendingUrls.filter((url) => url !== nextUrl.url)
    }

    console.log(`Queue: ${pendingUrls.length} pending, ${crawledCount} crawled`)
  }

  console.log(`\n=== Final Statistics ===`)
  console.log(`Total crawled: ${crawledPages.length}`)
  console.log(`Remaining in queue: ${pendingUrls.length}`)

  return crawledPages
}

// ============================================
// Export Examples
// ============================================

export const examples = {
  basicUrlFiltering,
  contextAwareCrawling,
  costOptimizedFiltering,
  smartDepthControl,
  batchResearchSourceDiscovery,
  realTimeCrawlGuidance
}

// Example CLI runner
if (import.meta.main) {
  const exampleName = process.argv[2] || 'basicUrlFiltering'

  if (exampleName in examples) {
    console.log(`Running example: ${exampleName}\n`)
    examples[exampleName as keyof typeof examples]()
      .then(() => {
        console.log('\n✅ Example completed successfully')
      })
      .catch((error) => {
        console.error('\n❌ Example failed:', error)
        process.exit(1)
      })
  } else {
    console.error(`Unknown example: ${exampleName}`)
    console.log('Available examples:', Object.keys(examples).join(', '))
    process.exit(1)
  }
}
