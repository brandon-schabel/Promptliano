/**
 * Content Filter Service
 *
 * Enhanced file suggestion service that:
 * 1. Extracts keywords from user queries
 * 2. Uses ripgrep to search file contents
 * 3. Extracts context around matches
 * 4. Uses AI to rank files considering content relevance and file type penalties
 * 5. Returns ranked file suggestions with confidence scores
 *
 * @module ContentFilterService
 */

import { generateObject } from 'ai'
import { ErrorFactory } from '@promptliano/shared'
import { searchWithRipgrep, type RipgrepOptions } from '../file-services/backends/file-search-rg'
import { extractKeywords } from './utils/suggestion-utils'
import { generateStructuredData } from '../gen-ai-services'
import { modelConfigService } from '../model-config-service'
import type { Project, File as ProjectFile } from '@promptliano/database'
import { getProjectFiles } from '../project-service'
import type { ModelOptionsWithProvider } from '@promptliano/config'
import { nullToUndefined } from '../utils/file-utils'

// ============================================
// Types & Interfaces
// ============================================

export interface ContentFilterOptions {
  /** Maximum number of files to return */
  maxFiles?: number
  /** Include context lines around matches */
  includeContext?: boolean
  /** Number of context lines before/after match */
  contextLines?: number
  /** File type penalty multipliers (0-1, lower = more penalty) */
  fileTypePenalties?: Record<string, number>
  /** Use AI ranking (default: true) */
  useAI?: boolean
  /** AI model tier to use */
  aiModel?: 'high' | 'medium'
  /** User context for better AI ranking */
  userContext?: string
}

export interface ContentMatchResult {
  /** File ID from database */
  fileId: string
  /** Relative file path */
  filePath: string
  /** Matched content snippets */
  matches: Array<{
    line: number
    text: string
    context?: string[]
  }>
  /** AI-generated relevance score (0-1) */
  aiScore?: number
  /** AI reasoning for the score */
  aiReason?: string
  /** Applied penalties */
  penalties: {
    fileType: number
    path: number
  }
}

export interface ContentFilterResult {
  /** Ranked file results */
  results: ContentMatchResult[]
  /** Processing metadata */
  metadata: {
    totalMatches: number
    grepTime: number
    aiRankingTime: number
    keywords: string[]
    strategy: 'grep-only' | 'grep-ai'
  }
}

export interface ContentFilterServiceDeps {
  /** AI model provider override */
  modelProvider?: any
}

// ============================================
// AI Ranking Schema
// ============================================

import { z } from 'zod'

const FileRankingSchema = z.object({
  rankings: z.array(
    z.object({
      fileId: z.string().describe('The file ID'),
      confidence: z.number().min(0).max(1).describe('Relevance confidence score (0-1)'),
      reason: z.string().describe('Brief explanation for the score')
    })
  )
})

type FileRanking = z.infer<typeof FileRankingSchema>

// ============================================
// File Type Penalties
// ============================================

/**
 * Default file type penalties
 * Lower values = more penalty (less relevant by default)
 */
const DEFAULT_FILE_TYPE_PENALTIES: Record<string, number> = {
  // High penalty files (0.2-0.4)
  test: 0.3,
  spec: 0.3,
  migration: 0.25,
  fixture: 0.2,
  mock: 0.25,
  seed: 0.2,

  // Medium penalty files (0.5-0.7)
  config: 0.6,
  doc: 0.5,
  readme: 0.5,
  workflow: 0.4,

  // Low penalty files (0.8-1.0)
  service: 1.0,
  route: 1.0,
  api: 1.0,
  component: 0.95,
  hook: 0.95,
  util: 0.9,
  helper: 0.9
}

/**
 * Query-specific file type boosts
 * If query mentions these keywords, reduce penalties
 */
const QUERY_TYPE_OVERRIDES: Record<string, string[]> = {
  test: ['test', 'spec', 'testing', 'e2e'],
  migration: ['migration', 'migrate', 'database', 'db', 'schema'],
  config: ['config', 'configuration', 'setup', 'settings'],
  doc: ['doc', 'docs', 'documentation', 'readme'],
  workflow: ['workflow', 'ci', 'deploy', 'release', 'action', 'github']
}

// ============================================
// Service Factory
// ============================================

export function createContentFilterService(deps: ContentFilterServiceDeps = {}) {
  /**
   * Filter and rank files based on content matches
   * Main entry point that searches file contents with grep and ranks with AI
   */
  async function filterByContent(
    projectId: number,
    userQuery: string,
    options: ContentFilterOptions = {}
  ): Promise<ContentFilterResult> {
    const startTime = Date.now()

    // Extract configuration
    const {
      maxFiles = 20,
      includeContext = true,
      contextLines = 3,
      fileTypePenalties = DEFAULT_FILE_TYPE_PENALTIES,
      useAI = true,
      aiModel = 'medium',
      userContext = ''
    } = options

    try {
      // Step 1: Get project files to build path -> fileId mapping
      const allFiles = (await getProjectFiles(projectId)) as ProjectFile[]
      if (!allFiles || allFiles.length === 0) {
        return emptyResult([])
      }

      // Build file lookup maps
      const fileById = new Map(allFiles.map((f) => [f.id, f]))
      const fileByPath = new Map<string, ProjectFile>()
      const projectPath = allFiles[0]?.path?.split('/').slice(0, -1).join('/') || '.'

      for (const file of allFiles) {
        if (file.path) {
          // Store with relative path (remove project base)
          const relativePath = file.path.replace(projectPath + '/', '')
          fileByPath.set(relativePath, file)
          fileByPath.set(file.path, file) // Also store full path
        }
      }

      // Step 2: Extract keywords from query
      const keywords = extractKeywords(userQuery)

      if (keywords.length === 0) {
        return emptyResult(keywords)
      }

      // Step 3: Search file contents with ripgrep
      const grepStart = Date.now()
      const grepResults = await performGrepSearch(projectPath, keywords, {
        limit: maxFiles * 5, // Get more results for AI filtering
        includeContext,
        contextLines
      })
      const grepTime = Date.now() - grepStart

      if (grepResults.length === 0) {
        return {
          results: [],
          metadata: {
            totalMatches: 0,
            grepTime,
            aiRankingTime: 0,
            keywords,
            strategy: 'grep-only'
          }
        }
      }

      // Step 4: Map paths to file records and apply penalties
      const matchResults: ContentMatchResult[] = []
      for (const grepResult of grepResults) {
        const file = fileByPath.get(grepResult.path)
        if (!file) continue // Skip files not in database

        const penalties = calculatePenalties(grepResult.path, keywords, fileTypePenalties)

        matchResults.push({
          fileId: file.id,
          filePath: grepResult.path,
          matches: grepResult.matches.map((m) => ({
            line: m.line,
            text: m.text,
            context: m.context
          })),
          penalties
        })
      }

      // Step 5: AI ranking (if enabled)
      let aiRankingTime = 0
      let rankedResults = matchResults

      if (useAI && matchResults.length > 0) {
        const aiStart = Date.now()
        rankedResults = await rankWithAI(matchResults, userQuery, keywords, userContext, aiModel)
        aiRankingTime = Date.now() - aiStart
      } else {
        // Sort by match count and penalties if AI is disabled
        rankedResults = matchResults
          .map((r) => ({
            ...r,
            aiScore: calculateBasicScore(r)
          }))
          .sort((a, b) => (b.aiScore ?? 0) - (a.aiScore ?? 0))
      }

      // Step 6: Return top results
      const finalResults = rankedResults.slice(0, maxFiles)

      return {
        results: finalResults,
        metadata: {
          totalMatches: matchResults.length,
          grepTime,
          aiRankingTime,
          keywords,
          strategy: useAI ? 'grep-ai' : 'grep-only'
        }
      }
    } catch (error) {
      throw ErrorFactory.operationFailed('content filtering', String(error), {
        query: userQuery,
        projectId
      })
    }
  }

  function emptyResult(keywords: string[]) {
    return {
      results: [],
      metadata: {
        totalMatches: 0,
        grepTime: 0,
        aiRankingTime: 0,
        keywords,
        strategy: 'grep-only' as const
      }
    }
  }

  return {
    filterByContent
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Perform ripgrep search with multiple keywords
 */
async function performGrepSearch(
  projectPath: string,
  keywords: string[],
  options: { limit: number; includeContext: boolean; contextLines: number }
): Promise<
  Array<{
    path: string
    matches: Array<{
      line: number
      text: string
      context?: string[]
    }>
  }>
> {
  // Build regex pattern that matches any keyword
  const pattern = keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')

  const rgOptions: RipgrepOptions = {
    caseSensitive: false,
    regex: true,
    limit: options.limit,
    excludeGlobs: [
      '!**/node_modules/**',
      '!**/.git/**',
      '!**/dist/**',
      '!**/build/**',
      '!**/.next/**',
      '!**/coverage/**',
      '!**/*.log',
      '!**/*.tmp'
    ]
  }

  const results = await searchWithRipgrep(projectPath, pattern, rgOptions)

  // Extract context if requested
  if (options.includeContext) {
    return results.map((r) => ({
      path: r.path,
      matches: r.matches.map((m) => ({
        line: m.line,
        text: m.text,
        context: [] // Context extraction would require re-reading files
      }))
    }))
  }

  return results.map((r) => ({
    path: r.path,
    matches: r.matches.map((m) => ({
      line: m.line,
      text: m.text
    }))
  }))
}

/**
 * Calculate file type and path penalties
 */
function calculatePenalties(
  filePath: string,
  queryKeywords: string[],
  penalties: Record<string, number>
): { fileType: number; path: number } {
  const normalized = filePath.toLowerCase()
  let fileTypePenalty = 1.0 // No penalty by default
  let pathPenalty = 0

  // Check for file type matches
  for (const [fileType, penaltyValue] of Object.entries(penalties)) {
    if (normalized.includes(fileType)) {
      // Check if query mentions this file type
      const queryMentions = QUERY_TYPE_OVERRIDES[fileType]?.some((keyword) => queryKeywords.includes(keyword))

      if (!queryMentions) {
        // Apply penalty only if query doesn't mention this file type
        fileTypePenalty = Math.min(fileTypePenalty, penaltyValue)
      }
    }
  }

  // Path-based penalties
  if (normalized.includes('/.github/workflows/')) pathPenalty += 0.3
  if (normalized.includes('/__tests__/')) pathPenalty += 0.2
  if (normalized.endsWith('.sql')) pathPenalty += 0.2
  if (normalized.endsWith('.md') && !queryKeywords.includes('doc')) pathPenalty += 0.15

  return {
    fileType: fileTypePenalty,
    path: pathPenalty
  }
}

/**
 * Calculate basic score without AI (match count + penalties)
 */
function calculateBasicScore(result: ContentMatchResult): number {
  const matchScore = Math.min(result.matches.length / 10, 1.0) // Normalize to 0-1
  const penaltyMultiplier = result.penalties.fileType * (1 - result.penalties.path)
  return matchScore * penaltyMultiplier
}

/**
 * Rank files using AI based on content relevance
 */
async function rankWithAI(
  results: ContentMatchResult[],
  userQuery: string,
  keywords: string[],
  userContext: string,
  modelTier: 'high' | 'medium'
): Promise<ContentMatchResult[]> {
  try {
    // Prepare compact file representations
    const fileDescriptions = results.map((r, i) => {
      const snippets = r.matches
        .slice(0, 3)
        .map((m) => `L${m.line}: ${m.text.trim().slice(0, 100)}`)
        .join('\n')

      return {
        index: i,
        fileId: r.fileId,
        path: r.filePath,
        snippets,
        matchCount: r.matches.length,
        fileTypePenalty: r.penalties.fileType,
        pathPenalty: r.penalties.path
      }
    })

    // Build prompt for AI ranking
    const prompt = buildAiRankingPrompt(userQuery, keywords, userContext, fileDescriptions)

    // Get model configuration
    const modelConfig = await modelConfigService.getPresetConfig(modelTier === 'high' ? 'high' : 'medium')
    const modelOptions: ModelOptionsWithProvider = {
      provider: modelConfig.provider as ModelOptionsWithProvider['provider'],
      model: modelConfig.model,
      temperature: nullToUndefined(modelConfig.temperature) ?? 0.3,
      maxTokens: nullToUndefined(modelConfig.maxTokens) ?? 2000,
      topP: nullToUndefined(modelConfig.topP),
      frequencyPenalty: nullToUndefined(modelConfig.frequencyPenalty),
      presencePenalty: nullToUndefined(modelConfig.presencePenalty),
      topK: nullToUndefined(modelConfig.topK)
    }

    // Generate structured ranking with AI SDK
    const response = await generateStructuredData({
      schema: FileRankingSchema,
      systemMessage:
        'You are an expert code analyzer ranking files by relevance to a developer query. Consider content matches, file types, and development context.',
      prompt,
      options: modelOptions
    })

    // Type-safe access to response object
    const rankings = (response.object as FileRanking).rankings

    if (!rankings || rankings.length === 0) {
      throw new Error('AI returned empty rankings')
    }

    // Merge AI scores with original results
    const rankingMap = new Map(rankings.map((r) => [r.fileId, r]))

    return results
      .map((r) => {
        const ranking = rankingMap.get(r.fileId)
        return {
          ...r,
          aiScore: ranking?.confidence ?? 0.5,
          aiReason: ranking?.reason ?? 'No AI ranking provided'
        }
      })
      .sort((a, b) => (b.aiScore ?? 0) - (a.aiScore ?? 0))
  } catch (error) {
    // Fallback to basic scoring if AI fails
    console.warn('AI ranking failed, using basic scoring:', error)
    return results
      .map((r) => ({
        ...r,
        aiScore: calculateBasicScore(r),
        aiReason: 'AI ranking unavailable, using basic scoring'
      }))
      .sort((a, b) => (b.aiScore ?? 0) - (a.aiScore ?? 0))
  }
}

/**
 * Build AI ranking prompt with file descriptions
 */
function buildAiRankingPrompt(
  userQuery: string,
  keywords: string[],
  userContext: string,
  files: Array<{
    index: number
    fileId: string
    path: string
    snippets: string
    matchCount: number
    fileTypePenalty: number
    pathPenalty: number
  }>
): string {
  const contextSection = userContext ? `\n\nUser Context:\n${userContext}` : ''

  return `User Query: "${userQuery}"
Extracted Keywords: ${keywords.join(', ')}${contextSection}

Files with Content Matches:
${files
  .map(
    (f) =>
      `${f.index + 1}. ${f.path}
   - Matches: ${f.matchCount}
   - File Type Penalty: ${f.fileTypePenalty.toFixed(2)} (${f.fileTypePenalty < 0.5 ? 'high penalty' : f.fileTypePenalty < 0.8 ? 'medium penalty' : 'low penalty'})
   - Path Penalty: ${f.pathPenalty.toFixed(2)}
   - Content Snippets:
${f.snippets
  .split('\n')
  .map((line) => `     ${line}`)
  .join('\n')}`
  )
  .join('\n\n')}

Ranking Instructions:
1. PRIMARY: Content relevance to the user query and intent
2. Consider match quality and context (not just count)
3. Apply file type context:
   - Test files (*.test.*, *.spec.*) → LOWER priority UNLESS query mentions "test"
   - Migration files (migrations/, *.sql) → LOWER priority UNLESS query mentions "migration" or "database"
   - Config files → LOWER priority UNLESS query mentions "config"
   - Documentation (*.md) → LOWER priority UNLESS query mentions "doc"
   - Source code (src/, routes/, services/) → HIGHER priority for feature queries
4. Path relevance: Core code paths (src/, routes/, services/, components/) rank higher

Confidence Scoring (0-1):
- 0.9-1.0: Perfect match, directly relevant to query intent
- 0.7-0.8: Strong match, highly relevant
- 0.5-0.6: Good match, relevant with context
- 0.3-0.4: Weak match, tangentially relevant
- 0.0-0.2: Poor match, minimal relevance

Return rankings for ALL files with confidence scores and brief reasons.`
}

// ============================================
// Exports
// ============================================

export type ContentFilterService = ReturnType<typeof createContentFilterService>
export const contentFilterService = createContentFilterService()