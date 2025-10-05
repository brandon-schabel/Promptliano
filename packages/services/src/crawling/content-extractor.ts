/**
 * Content Extraction Service
 * Uses @mozilla/readability + linkedom for clean content extraction
 * Prepares content for AI processing with smart truncation
 */

import { parseHTML } from 'linkedom'
import * as cheerio from 'cheerio'
import { CrawlErrorFactory } from './errors'
import { createServiceLogger } from '../utils/service-logger'

const logger = createServiceLogger('ContentExtractor')

export interface ExtractedContent {
  title: string
  content: string
  textContent: string
  excerpt: string
  byline?: string
  siteName?: string
  publishedTime?: string
  author?: string
  lang?: string
  length: number
}

export interface ExtractedMetadata {
  author?: string
  date?: string
  publishedTime?: string
  siteName?: string
  excerpt?: string
  lang?: string
}

export interface ContentForAI {
  title: string
  summary: string
  content: string
  metadata: ExtractedMetadata
  truncated: boolean
  originalLength: number
}

/**
 * Extract clean content from HTML using Cheerio
 * This is a simpler approach without linkedom/readability dependencies
 */
function extractWithCheerio(html: string, url: string): ExtractedContent | null {
  try {
    const $ = cheerio.load(html)

    // Remove unwanted elements
    $('script, style, nav, header, footer, aside, .ad, .ads, .advertisement').remove()

    // Extract title
    const title = $('title').text() || $('h1').first().text() || 'Untitled'

    // Extract main content
    const mainContent =
      $('article').text() ||
      $('main').text() ||
      $('.content').text() ||
      $('#content').text() ||
      $('body').text()

    const textContent = mainContent.trim()

    // Extract excerpt
    const excerpt =
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      textContent.substring(0, 200)

    return {
      title: title.trim(),
      content: textContent,
      textContent,
      excerpt: excerpt.trim(),
      byline: undefined,
      siteName: undefined,
      publishedTime: undefined,
      length: textContent.length,
      lang: $('html').attr('lang')
    }
  } catch (error) {
    logger.error('Content extraction failed', { url, error })
    return null
  }
}

/**
 * Extract metadata from HTML head
 */
function extractMetadata(html: string): ExtractedMetadata {
  const $ = cheerio.load(html)
  const metadata: ExtractedMetadata = {}

  // OpenGraph metadata
  metadata.siteName = $('meta[property="og:site_name"]').attr('content')
  metadata.publishedTime = $('meta[property="article:published_time"]').attr('content')

  // Author
  metadata.author =
    $('meta[name="author"]').attr('content') ||
    $('meta[property="article:author"]').attr('content') ||
    $('meta[property="og:author"]').attr('content')

  // Date
  metadata.date =
    $('meta[name="date"]').attr('content') ||
    $('meta[property="article:published"]').attr('content') ||
    metadata.publishedTime

  // Description/Excerpt
  metadata.excerpt =
    $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content')

  // Language
  metadata.lang = $('html').attr('lang') || $('meta[property="og:locale"]').attr('content')

  return metadata
}

/**
 * Extract all links from HTML
 */
function extractLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html)
  const links = new Set<string>()

  $('a[href]').each((_, elem) => {
    const href = $(elem).attr('href')
    if (!href) return

    try {
      const absoluteUrl = new URL(href, baseUrl).href
      if (absoluteUrl.startsWith('http://') || absoluteUrl.startsWith('https://')) {
        links.add(absoluteUrl)
      }
    } catch (error) {
      // Skip invalid URLs
    }
  })

  return Array.from(links)
}

/**
 * Smart truncation for AI processing
 * Preserves meaningful content while staying under token limits
 */
function prepareForAI(
  content: string,
  title: string,
  metadata: ExtractedMetadata,
  maxChars: number = 50000
): ContentForAI {
  const originalLength = content.length

  if (content.length <= maxChars) {
    return {
      title,
      summary: metadata.excerpt || content.substring(0, 500),
      content,
      metadata,
      truncated: false,
      originalLength
    }
  }

  // Smart truncation: take beginning and end
  const headChars = Math.floor(maxChars * 0.7)
  const tailChars = Math.floor(maxChars * 0.3)

  const head = content.substring(0, headChars)
  const tail = content.substring(content.length - tailChars)

  const truncatedContent = `${head}\n\n[... content truncated ...]\n\n${tail}`

  return {
    title,
    summary: metadata.excerpt || content.substring(0, 500),
    content: truncatedContent,
    metadata,
    truncated: true,
    originalLength
  }
}

/**
 * Create Content Extractor Service
 */
export function createContentExtractor() {
  return {
    /**
     * Extract clean, readable content from HTML
     */
    extractCleanContent(html: string, url: string): ExtractedContent {
      const extracted = extractWithCheerio(html, url)

      if (!extracted) {
        throw CrawlErrorFactory.extractionFailed(url, 'Could not parse content')
      }

      return extracted
    },

    /**
     * Extract metadata from HTML
     */
    extractMetadata(html: string): ExtractedMetadata {
      return extractMetadata(html)
    },

    /**
     * Extract all links from HTML
     */
    extractLinks(html: string, baseUrl: string): string[] {
      return extractLinks(html, baseUrl)
    },

    /**
     * Prepare content for AI processing with smart truncation
     */
    prepareForAI(
      content: string,
      title: string,
      metadata: ExtractedMetadata,
      maxChars?: number
    ): ContentForAI {
      return prepareForAI(content, title, metadata, maxChars)
    },

    /**
     * Extract everything from HTML in one call
     */
    extractAll(html: string, url: string) {
      const cleanContent = this.extractCleanContent(html, url)
      const metadata = this.extractMetadata(html)
      const links = this.extractLinks(html, url)

      return {
        content: cleanContent,
        metadata: {
          ...metadata,
          author: metadata.author || cleanContent.byline,
          siteName: metadata.siteName || cleanContent.siteName,
          publishedTime: metadata.publishedTime || cleanContent.publishedTime,
          lang: metadata.lang || cleanContent.lang
        },
        links
      }
    }
  }
}

export const contentExtractor = createContentExtractor()
