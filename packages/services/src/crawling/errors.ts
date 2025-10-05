/**
 * Custom Error Types for Web Crawling
 * Follows Promptliano error patterns with ApiError
 */

import { ApiError } from '@promptliano/shared'

/**
 * Base crawl error class
 */
export class CrawlError extends ApiError {
  constructor(message: string, code: string = 'CRAWL_ERROR', details?: unknown) {
    super(500, message, code, details)
    this.name = 'CrawlError'
  }
}

/**
 * Rate limit exceeded error
 */
export class RateLimitError extends ApiError {
  constructor(domain: string, retryAfter?: number) {
    super(429, `Rate limit exceeded for domain: ${domain}`, 'RATE_LIMIT_EXCEEDED', { domain, retryAfter })
    this.name = 'RateLimitError'
  }
}

/**
 * Robots.txt violation error
 */
export class RobotsTxtError extends ApiError {
  constructor(url: string, reason: string) {
    super(403, `Crawling blocked by robots.txt: ${reason}`, 'ROBOTS_TXT_VIOLATION', { url, reason })
    this.name = 'RobotsTxtError'
  }
}

/**
 * Content extraction error
 */
export class ContentExtractionError extends ApiError {
  constructor(url: string, reason: string) {
    super(500, `Failed to extract content from ${url}: ${reason}`, 'CONTENT_EXTRACTION_FAILED', { url, reason })
    this.name = 'ContentExtractionError'
  }
}

/**
 * Network/fetch error
 */
export class FetchError extends ApiError {
  constructor(url: string, status?: number, message?: string) {
    super(
      status || 500,
      message || `Failed to fetch URL: ${url}`,
      'FETCH_ERROR',
      { url, httpStatus: status }
    )
    this.name = 'FetchError'
  }
}

/**
 * Invalid URL error
 */
export class InvalidUrlError extends ApiError {
  constructor(url: string, reason: string) {
    super(400, `Invalid URL: ${url} - ${reason}`, 'INVALID_URL', { url, reason })
    this.name = 'InvalidUrlError'
  }
}

/**
 * Helper to create crawl-specific API errors
 */
export const CrawlErrorFactory = {
  rateLimitExceeded: (domain: string, retryAfter?: number) => new RateLimitError(domain, retryAfter),

  robotsBlocked: (url: string, reason: string) => new RobotsTxtError(url, reason),

  fetchFailed: (url: string, status?: number, message?: string) => new FetchError(url, status, message),

  extractionFailed: (url: string, reason: string) => new ContentExtractionError(url, reason),

  invalidUrl: (url: string, reason: string) => new InvalidUrlError(url, reason),

  timeout: (url: string, timeoutMs: number) =>
    new CrawlError(`Request timed out after ${timeoutMs}ms: ${url}`, 'CRAWL_TIMEOUT', { url, timeoutMs }),

  tooLarge: (url: string, sizeBytes: number, maxSizeBytes: number) =>
    new CrawlError(
      `Content too large: ${sizeBytes} bytes (max: ${maxSizeBytes})`,
      'CONTENT_TOO_LARGE',
      { url, sizeBytes, maxSizeBytes }
    ),

  general: (message: string, details?: unknown) => new CrawlError(message, 'CRAWL_ERROR', details)
}
