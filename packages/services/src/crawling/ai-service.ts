/**
 * AI Service for Web Crawling
 * Uses Vercel AI SDK to summarize and analyze crawled content
 */

import { generateObject } from 'ai'
import { z } from 'zod'
import { createServiceLogger } from '../utils/service-logger'
import { CrawlErrorFactory } from './errors'
import type { ContentForAI } from './content-extractor'

const logger = createServiceLogger('CrawlAIService')

/**
 * AI-generated summary schema
 */
export const ContentSummarySchema = z.object({
  title: z.string().describe('Clean title of the content'),
  briefSummary: z.string().describe('1-2 sentence summary of the main point'),
  keyPoints: z.array(z.string()).describe('3-5 key takeaways or main points'),
  detailedSummary: z.string().describe('Comprehensive summary in 2-3 paragraphs'),
  category: z.string().optional().describe('Content category (e.g., tutorial, news, documentation)'),
  entities: z
    .array(
      z.object({
        name: z.string(),
        type: z.enum(['person', 'organization', 'technology', 'concept', 'product'])
      })
    )
    .optional()
    .describe('Important entities mentioned')
})

export type ContentSummary = z.infer<typeof ContentSummarySchema>

/**
 * Token usage tracking
 */
export interface AIUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

/**
 * AI summary result with cost tracking
 */
export interface AISummaryResult {
  summary: ContentSummary
  usage: AIUsage
  cost: number
  model: string
}

export interface AIServiceDeps {
  model?: any // AI SDK model instance
  apiKey?: string
  logger?: ReturnType<typeof createServiceLogger>
}

/**
 * Calculate cost based on usage
 * Rough estimates for common models
 */
function calculateCost(usage: AIUsage, model: string): number {
  const modelCosts: Record<string, { input: number; output: number }> = {
    // Costs per 1M tokens
    'gpt-4o': { input: 2.5, output: 10.0 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
    'gpt-4-turbo': { input: 10.0, output: 30.0 },
    'claude-3-5-sonnet': { input: 3.0, output: 15.0 },
    'claude-3-5-haiku': { input: 0.8, output: 4.0 },
    'claude-3-opus': { input: 15.0, output: 75.0 }
  }

  const costs = modelCosts[model] || { input: 1.0, output: 3.0 } // Default fallback

  const inputCost = (usage.promptTokens / 1_000_000) * costs.input
  const outputCost = (usage.completionTokens / 1_000_000) * costs.output

  return inputCost + outputCost
}

/**
 * Create AI Service for content summarization
 */
export function createAIService(deps: AIServiceDeps = {}) {
  const { apiKey, logger: serviceLogger = logger } = deps

  if (!apiKey && !deps.model) {
    throw new Error('AI service requires either apiKey or model instance')
  }

  return {
    /**
     * Summarize web content using AI
     */
    async summarizeContent(content: ContentForAI, url: string): Promise<AISummaryResult> {
      if (!deps.model) {
        throw new Error('Model instance required for summarization')
      }

      try {
        serviceLogger.info('Generating AI summary', {
          url,
          contentLength: content.content.length,
          truncated: content.truncated
        })

        const prompt = `Analyze and summarize the following web content from ${url}:

Title: ${content.title}
${content.metadata.author ? `Author: ${content.metadata.author}` : ''}
${content.metadata.siteName ? `Site: ${content.metadata.siteName}` : ''}
${content.metadata.excerpt ? `Excerpt: ${content.metadata.excerpt}` : ''}

Content:
${content.content}

${content.truncated ? '\n(Note: Content was truncated for processing)' : ''}

Provide a comprehensive analysis and summary.`

        const result = await generateObject({
          model: deps.model,
          schema: ContentSummarySchema,
          prompt,
          temperature: 0.3 // Lower temperature for more consistent summaries
        })

        const usage: AIUsage = {
          promptTokens: result.usage?.inputTokens || 0,
          completionTokens: result.usage?.outputTokens || 0,
          totalTokens: result.usage?.totalTokens || 0
        }

        const modelName = deps.model.modelId || 'unknown'
        const cost = calculateCost(usage, modelName)

        serviceLogger.info('AI summary generated', {
          url,
          usage,
          cost,
          model: modelName
        })

        return {
          summary: result.object,
          usage,
          cost,
          model: modelName
        }
      } catch (error) {
        serviceLogger.error('Failed to generate AI summary', { url, error })
        throw CrawlErrorFactory.general(
          `Failed to generate AI summary for ${url}`,
          error instanceof Error ? error.message : error
        )
      }
    },

    /**
     * Calculate estimated cost for content
     */
    calculateEstimatedCost(contentLength: number, model: string = 'gpt-4o-mini'): number {
      // Rough estimate: ~4 chars per token
      const estimatedTokens = Math.ceil(contentLength / 4)
      const usage: AIUsage = {
        promptTokens: estimatedTokens,
        completionTokens: Math.ceil(estimatedTokens * 0.1), // Assume summary is ~10% of input
        totalTokens: estimatedTokens * 1.1
      }
      return calculateCost(usage, model)
    }
  }
}
