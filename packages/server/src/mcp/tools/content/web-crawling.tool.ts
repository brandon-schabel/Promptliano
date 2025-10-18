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
  createWebCrawlingService,
  type CrawlArtifactsOptions,
  type CrawlOptions,
  type CrawlProgress
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

        const crawler = createWebCrawlingService()

        switch (action) {
          case WebCrawlingAction.CRAWL_WEBPAGE: {
            const url = validateDataField<string>(
              data,
              'url',
              'string',
              '"https://example.com/article"'
            )

            const { crawlId } = await crawler.startCrawl(url, {
              maxDepth: 1,
              maxPages: 1,
              respectRobotsTxt: (data?.respectRobotsTxt as boolean) !== false,
              crawlDelay: data?.crawlDelay as number | undefined,
              userAgent: data?.userAgent as string | undefined,
              timeout: data?.timeout as number | undefined,
              sameDomainOnly: true
            })

            await crawler.executeCrawl(crawlId)
            const content = await crawler.getCrawlArtifacts(crawlId, { limit: 1 })
            const page = content.records[0]

            const response = page
              ? `**${page.title ?? 'Untitled'}**\nURL: ${page.url}\nStatus: ${page.status ?? 'unknown'}`
              : `No content retrieved from ${url}`

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

            const { crawlId } = await crawler.startCrawl(url, {
              maxDepth: Math.min(Math.max((data?.maxDepth as number) || 2, 1), 3),
              maxPages: Math.min((data?.maxPages as number) || 50, 100),
              respectRobotsTxt: (data?.respectRobotsTxt as boolean) !== false,
              crawlDelay: data?.crawlDelay as number | undefined,
              userAgent: data?.userAgent as string | undefined,
              timeout: data?.timeout as number | undefined,
              sameDomainOnly: (data?.followExternalLinks as boolean) !== true
            })

            await crawler.executeCrawl(crawlId)
            const pages = await crawler.getCrawlArtifacts(crawlId, {
              limit: Math.min((data?.maxPages as number) || 50, 20)
            })

            let response = `**Website Crawl Complete**\n\n`
            response += `Starting URL: ${url}\n`
            response += `Pages crawled: ${pages.records.length}\n`
            response += `Max depth: ${Math.min(Math.max((data?.maxDepth as number) || 2, 1), 3)}\n\n`
            response += `**Pages:**\n\n`

            pages.records.forEach((page, index) => {
              response += `${index + 1}. **${page.title ?? 'Untitled'}**\n`
              response += `   URL: ${page.url}\n`
              response += `   Status: ${page.status ?? 'unknown'}\n`
              response += `   HTTP: ${page.httpStatus ?? 'n/a'}\n`
              response += `   Depth: ${page.depth ?? 0}\n\n`
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

            const options: CrawlArtifactsOptions = {
              limit: Math.min(Math.max((data?.limit as number) || 10, 1), 20)
            }

            const results = await crawler.getCrawlArtifacts(query, options)

            if (results.records.length === 0) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `No cached results found for query: "${query}"`
                  }
                ]
              }
            }

            let response = `**Cached Search Results** (${results.records.length} matches)\n\n`
            response += `Query: "${query}"\n\n`

            results.records.forEach((item, index) => {
              response += `${index + 1}. **${item.title ?? 'Untitled'}**\n`
              response += `   URL: ${item.url}\n`
              response += `   Status: ${item.status ?? 'unknown'}\n`
              response += `   Crawled At: ${item.crawledAt ? new Date(item.crawledAt).toISOString() : 'n/a'}\n\n`
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
            const history = await crawler.getCrawlArtifacts('history', { limit })

            if (history.records.length === 0) {
              return {
                content: [
                  {
                    type: 'text',
                    text: 'No crawl history available'
                  }
                ]
              }
            }

            let response = `**Crawl History** (${history.records.length} entries)\n\n`

            history.records.forEach((entry, index) => {
              response += `${index + 1}. ${entry.url}\n`
              response += `   Status: ${entry.status ?? 'unknown'}\n`
              response += `   Crawled At: ${entry.crawledAt ? new Date(entry.crawledAt).toISOString() : 'n/a'}\n\n`
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
