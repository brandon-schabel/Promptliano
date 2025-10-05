/**
 * Web Crawling MCP Tool
 *
 * Provides AI agents with web crawling capabilities including:
 * - Single webpage crawling with clean content extraction
 * - Multi-page website crawling
 * - Content caching and search
 * - robots.txt compliance checking
 * - AI-powered summarization
 */

import { z } from '@hono/zod-openapi'
import type { MCPToolDefinition, MCPToolResponse } from '../../tools-registry'
import {
  createTrackedHandler,
  validateDataField,
  createMCPError,
  MCPError,
  MCPErrorCode,
  formatMCPErrorResponse,
  WebCrawlingAction,
  WebCrawlingSchema
} from '../shared'
import {
  crawlWebpage,
  crawlWebsite,
  searchCached,
  getCrawlHistory,
  checkRobotsTxt,
  type CrawlWebpageOptions,
  type CrawlWebsiteOptions,
  type SearchCachedOptions
} from '@promptliano/services'

export const webCrawlingTool: MCPToolDefinition = {
  name: 'web_crawling',
  description: `Web crawling and content extraction tool. Actions: crawl_webpage (fetch and extract clean content from a single page), crawl_website (crawl multiple pages starting from a URL, max depth 1-3), search_cached (search previously crawled content), get_history (retrieve crawl history), check_robots (verify robots.txt compliance).

Examples:
- crawl_webpage: Extract article content with optional AI summary
- crawl_website: Crawl documentation sites or blogs with depth control
- search_cached: Find previously crawled content without re-fetching
- check_robots: Verify crawling permissions before starting`,

  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The action to perform',
        enum: Object.values(WebCrawlingAction)
      },
      data: {
        type: 'object',
        description: `Action-specific data:
- crawl_webpage: { url: "https://example.com/article", summarize?: boolean }
- crawl_website: { url: "https://example.com", maxDepth?: 1-3 (default 2), maxPages?: number (default 50), summarize?: boolean, followExternalLinks?: boolean (default false) }
- search_cached: { query: "search term", limit?: 1-20 (default 10) }
- get_history: { limit?: number (default 50) }
- check_robots: { url: "https://example.com" }`,
        additionalProperties: true
      }
    },
    required: ['action']
  },

  handler: createTrackedHandler(
    'web_crawling',
    async (args: z.infer<typeof WebCrawlingSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, data } = args

        switch (action) {
          case WebCrawlingAction.CRAWL_WEBPAGE: {
            const url = validateDataField<string>(
              data,
              'url',
              'string',
              '"https://example.com/article"'
            )

            const options: CrawlWebpageOptions = {
              summarize: (data?.summarize as boolean) || false
            }

            const result = await crawlWebpage(url, options)

            let response = `**${result.title}**\n\n`
            if (result.byline) response += `By ${result.byline}\n`
            if (result.siteName) response += `Site: ${result.siteName}\n`
            if (result.publishedTime) response += `Published: ${result.publishedTime}\n`
            response += `\nLength: ${result.length} characters\n`
            response += `Excerpt: ${result.excerpt}\n\n`

            if (result.summary) {
              response += `**Summary:**\n${result.summary}\n\n`
            }

            response += `**Content:**\n${result.textContent.slice(0, 5000)}${result.textContent.length > 5000 ? '...' : ''}`

            return {
              content: [
                {
                  type: 'text',
                  text: response
                }
              ]
            }
          }

          case WebCrawlingAction.CRAWL_WEBSITE: {
            const url = validateDataField<string>(
              data,
              'url',
              'string',
              '"https://example.com"'
            )

            const maxDepth = Math.min(Math.max((data?.maxDepth as number) || 2, 1), 3)
            const maxPages = Math.min((data?.maxPages as number) || 50, 100)

            const options: CrawlWebsiteOptions = {
              maxDepth,
              maxPages,
              summarize: (data?.summarize as boolean) || false,
              followExternalLinks: (data?.followExternalLinks as boolean) || false,
              respectRobotsTxt: (data?.respectRobotsTxt as boolean) !== false
            }

            const results = await crawlWebsite(url, options)

            let response = `**Website Crawl Complete**\n\n`
            response += `Starting URL: ${url}\n`
            response += `Pages crawled: ${results.length}\n`
            response += `Max depth: ${maxDepth}\n\n`
            response += `**Pages:**\n\n`

            results.forEach((page, index) => {
              response += `${index + 1}. **${page.title}**\n`
              response += `   URL: ${page.url}\n`
              response += `   Length: ${page.length} characters\n`
              if (page.summary) {
                response += `   Summary: ${page.summary}\n`
              }
              response += `   Excerpt: ${page.excerpt.slice(0, 150)}...\n\n`
            })

            return {
              content: [
                {
                  type: 'text',
                  text: response
                }
              ]
            }
          }

          case WebCrawlingAction.SEARCH_CACHED: {
            const query = validateDataField<string>(
              data,
              'query',
              'string',
              '"search term"'
            )

            const options: SearchCachedOptions = {
              limit: Math.min(Math.max((data?.limit as number) || 10, 1), 20)
            }

            const results = searchCached(query, options)

            if (results.length === 0) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `No cached results found for query: "${query}"`
                  }
                ]
              }
            }

            let response = `**Cached Search Results** (${results.length} matches)\n\n`
            response += `Query: "${query}"\n\n`

            results.forEach((item, index) => {
              const age = Math.floor((Date.now() - item.crawledAt) / (1000 * 60))
              response += `${index + 1}. **${item.title}**\n`
              response += `   URL: ${item.url}\n`
              response += `   Cached: ${age} minutes ago\n`
              if (item.summary) {
                response += `   Summary: ${item.summary}\n`
              }
              response += `   Excerpt: ${item.excerpt}\n\n`
            })

            return {
              content: [
                {
                  type: 'text',
                  text: response
                }
              ]
            }
          }

          case WebCrawlingAction.GET_HISTORY: {
            const limit = Math.min((data?.limit as number) || 50, 100)
            const history = getCrawlHistory(limit)

            if (history.length === 0) {
              return {
                content: [
                  {
                    type: 'text',
                    text: 'No crawl history available'
                  }
                ]
              }
            }

            let response = `**Crawl History** (${history.length} entries)\n\n`

            history.forEach((entry, index) => {
              const age = Math.floor((Date.now() - entry.crawledAt) / (1000 * 60))
              response += `${index + 1}. ${entry.url}\n`
              response += `   Crawled: ${age} minutes ago\n`
              if (entry.pageCount) {
                response += `   Pages: ${entry.pageCount}\n`
              }
              if (entry.depth) {
                response += `   Depth: ${entry.depth}\n`
              }
              response += '\n'
            })

            return {
              content: [
                {
                  type: 'text',
                  text: response
                }
              ]
            }
          }

          case WebCrawlingAction.CHECK_ROBOTS: {
            const url = validateDataField<string>(
              data,
              'url',
              'string',
              '"https://example.com"'
            )

            const result = await checkRobotsTxt(url)

            let response = `**robots.txt Check**\n\n`
            response += `URL: ${url}\n`
            response += `Can crawl: ${result.canCrawl ? '✅ Yes' : '❌ No'}\n`

            if (result.crawlDelay) {
              response += `Crawl delay: ${result.crawlDelay} seconds\n`
            }

            if (result.disallowedPaths.length > 0) {
              response += `\n**Disallowed paths:**\n`
              result.disallowedPaths.slice(0, 10).forEach(path => {
                response += `- ${path}\n`
              })
              if (result.disallowedPaths.length > 10) {
                response += `... and ${result.disallowedPaths.length - 10} more\n`
              }
            }

            if (result.sitemap && result.sitemap.length > 0) {
              response += `\n**Sitemaps:**\n`
              result.sitemap.forEach(sitemap => {
                response += `- ${sitemap}\n`
              })
            }

            return {
              content: [
                {
                  type: 'text',
                  text: response
                }
              ]
            }
          }

          default:
            throw createMCPError(
              MCPErrorCode.UNKNOWN_ACTION,
              `Unknown action: ${action}`,
              {
                action,
                validActions: Object.values(WebCrawlingAction)
              }
            )
        }
      } catch (error) {
        const mcpError =
          error instanceof MCPError
            ? error
            : MCPError.fromError(error, {
                tool: 'web_crawling',
                action: args.action
              })

        return await formatMCPErrorResponse(mcpError)
      }
    }
  )
}
