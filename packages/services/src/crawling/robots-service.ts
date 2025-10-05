/**
 * Robots.txt Service
 * Handles parsing, caching, and validation of robots.txt files
 */

import { domainRepository, type Domain } from '@promptliano/database'
import { CrawlErrorFactory } from './errors'
import { createServiceLogger } from '../utils/service-logger'

const logger = createServiceLogger('RobotsTxtService')

export interface RobotsTxtServiceDeps {
  repository?: typeof domainRepository
  logger?: ReturnType<typeof createServiceLogger>
  userAgent?: string
}

export interface RobotsTxtRules {
  allowed: boolean
  crawlDelay: number // milliseconds
  sitemaps: string[]
}

/**
 * Parse User-Agent specific rules from robots.txt
 */
function parseRobotsTxt(robotsTxt: string, userAgent: string = '*'): RobotsTxtRules {
  const lines = robotsTxt.split('\n').map(line => line.trim())
  const rules: RobotsTxtRules = {
    allowed: true,
    crawlDelay: 1000, // Default 1 second
    sitemaps: []
  }

  let inUserAgentSection = false
  let currentUserAgent = ''

  for (const line of lines) {
    if (!line || line.startsWith('#')) continue

    const [key, ...valueParts] = line.split(':').map(part => part.trim())
    if (!key) continue // Skip if no key found

    const value = valueParts.join(':').trim()

    if (key.toLowerCase() === 'user-agent') {
      currentUserAgent = value.toLowerCase()
      inUserAgentSection = currentUserAgent === '*' || currentUserAgent === userAgent.toLowerCase()
      continue
    }

    if (!inUserAgentSection) continue

    if (key.toLowerCase() === 'disallow') {
      if (value === '/' || value === '') {
        rules.allowed = false
      }
    }

    if (key.toLowerCase() === 'allow') {
      rules.allowed = true
    }

    if (key.toLowerCase() === 'crawl-delay') {
      const delay = parseFloat(value)
      if (!isNaN(delay)) {
        rules.crawlDelay = Math.max(delay * 1000, 1000) // Convert to ms, minimum 1s
      }
    }

    if (key.toLowerCase() === 'sitemap') {
      rules.sitemaps.push(value)
    }
  }

  return rules
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname
  } catch (error) {
    throw CrawlErrorFactory.invalidUrl(url, 'Invalid URL format')
  }
}

/**
 * Fetch robots.txt from domain
 */
async function fetchRobotsTxt(domain: string): Promise<string | null> {
  try {
    const robotsUrl = `https://${domain}/robots.txt`
    logger.info('Fetching robots.txt', { domain, url: robotsUrl })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

    const response = await fetch(robotsUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Promptliano-WebCrawler/1.0'
      }
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      if (response.status === 404) {
        logger.info('No robots.txt found', { domain })
        return null
      }
      throw CrawlErrorFactory.fetchFailed(robotsUrl, response.status, response.statusText)
    }

    const text = await response.text()
    logger.info('Robots.txt fetched successfully', { domain, length: text.length })
    return text
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.warn('Robots.txt fetch timed out', { domain })
      return null
    }
    logger.error('Failed to fetch robots.txt', { domain, error })
    return null
  }
}

/**
 * Create Robots.txt Service
 */
export function createRobotsTxtService(deps: RobotsTxtServiceDeps = {}) {
  const { repository = domainRepository, userAgent = 'Promptliano-WebCrawler' } = deps
  const serviceLogger = deps.logger || logger

  return {
    /**
     * Check if URL can be crawled according to robots.txt
     */
    async canCrawl(url: string): Promise<boolean> {
      const domain = extractDomain(url)
      const domainData = await repository.getByDomain(domain)

      // No robots.txt cached - fetch it
      if (!domainData || !domainData.robotsTxt) {
        const robotsTxt = await fetchRobotsTxt(domain)
        if (robotsTxt) {
          await repository.updateRobotsTxt(domain, robotsTxt)
          const rules = parseRobotsTxt(robotsTxt, userAgent)
          return rules.allowed
        }
        // No robots.txt found - allow crawling
        return true
      }

      // Parse cached robots.txt
      const rules = parseRobotsTxt(domainData.robotsTxt, userAgent)
      return rules.allowed
    },

    /**
     * Get crawl delay for domain (in milliseconds)
     */
    async getCrawlDelay(domain: string): Promise<number> {
      const domainData = await repository.getByDomain(domain)

      if (!domainData || !domainData.robotsTxt) {
        const robotsTxt = await fetchRobotsTxt(domain)
        if (robotsTxt) {
          await repository.updateRobotsTxt(domain, robotsTxt)
          const rules = parseRobotsTxt(robotsTxt, userAgent)
          return rules.crawlDelay
        }
        return 1000 // Default 1 second
      }

      const rules = parseRobotsTxt(domainData.robotsTxt, userAgent)
      return rules.crawlDelay
    },

    /**
     * Update robots.txt for domain
     */
    async updateRobotsTxt(domain: string): Promise<Domain> {
      const robotsTxt = await fetchRobotsTxt(domain)
      return await repository.updateRobotsTxt(domain, robotsTxt)
    },

    /**
     * Get sitemaps from robots.txt
     */
    async getSitemaps(domain: string): Promise<string[]> {
      const domainData = await repository.getByDomain(domain)

      if (!domainData || !domainData.robotsTxt) {
        const robotsTxt = await fetchRobotsTxt(domain)
        if (robotsTxt) {
          await repository.updateRobotsTxt(domain, robotsTxt)
          const rules = parseRobotsTxt(robotsTxt, userAgent)
          return rules.sitemaps
        }
        return []
      }

      const rules = parseRobotsTxt(domainData.robotsTxt, userAgent)
      return rules.sitemaps
    },

    /**
     * Validate URL against robots.txt or throw error
     */
    async validateOrThrow(url: string): Promise<void> {
      const allowed = await this.canCrawl(url)
      if (!allowed) {
        throw CrawlErrorFactory.robotsBlocked(url, 'Disallowed by robots.txt')
      }
    }
  }
}

export const robotsTxtService = createRobotsTxtService()
