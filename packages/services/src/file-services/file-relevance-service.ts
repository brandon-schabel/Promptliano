import type { File as ProjectFile, Ticket, TicketTask } from '@promptliano/database'
import ErrorFactory, { withErrorContext } from '@promptliano/shared/src/error/error-factory'
import { getProjectFiles } from '../project-service'
import { createFileService, createFileFilter, createFileCache, type FileServiceConfig } from './file-service-factory'

export interface RelevanceConfig {
  weights: {
    keyword: number
    path: number
    type: number
    recency: number
    import: number
  }
  maxFiles: number
  minScore: number
}

export interface RelevanceScoreResult {
  fileId: string
  totalScore: number
  keywordScore: number
  pathScore: number
  typeScore: number
  recencyScore: number
  importScore: number
}

export interface FileRelevanceServiceDeps {
  config?: FileServiceConfig & { relevance?: RelevanceConfig }
  cache?: ReturnType<typeof createFileCache>
}

const DEFAULT_RELEVANCE_CONFIG: RelevanceConfig = {
  weights: {
    keyword: 0.4,
    path: 0.2,
    type: 0.15,
    recency: 0.15,
    import: 0.1
  },
  maxFiles: 100,
  minScore: 0.1
}

export function createFileRelevanceService(deps: FileRelevanceServiceDeps = {}) {
  const service = createFileService('FileRelevanceService', deps.config)
  const fileFilter = createFileFilter()
  const cache = deps.cache || createFileCache({ ttl: 10 * 60 * 1000, maxSize: 500 }) // 10 minute cache

  let relevanceConfig = { ...DEFAULT_RELEVANCE_CONFIG, ...deps.config?.relevance }

  const stopWords = new Set([
    'the',
    'is',
    'at',
    'which',
    'on',
    'and',
    'a',
    'an',
    'as',
    'are',
    'was',
    'were',
    'been',
    'be',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'must',
    'shall',
    'to',
    'of',
    'in',
    'for',
    'with',
    'by',
    'from',
    'up',
    'about',
    'into',
    'through',
    'during',
    'before',
    'after',
    'above',
    'below',
    'between',
    'under',
    'again',
    'further',
    'then',
    'once'
  ])

  async function scoreFilesForTicket(
    ticket: Ticket,
    projectId: number,
    userContext?: string
  ): Promise<RelevanceScoreResult[]> {
    const text = `${ticket.title} ${ticket.overview} ${userContext || ''}`
    return scoreFilesForText(text, projectId)
  }

  async function scoreFilesForTask(
    task: TicketTask,
    ticket: Ticket,
    projectId: number
  ): Promise<RelevanceScoreResult[]> {
    const text = `${task.content} ${task.description} ${ticket.title}`
    return scoreFilesForText(text, projectId)
  }

  async function scoreFilesForText(text: string, projectId: number): Promise<RelevanceScoreResult[]> {
    return service.withErrorContext<RelevanceScoreResult[]>(
      async (): Promise<RelevanceScoreResult[]> => {
        // Check cache first
        const cacheKey = `relevance:${projectId}:${hashText(text)}`
        const cached = cache.get(cacheKey)
        if (cached && Array.isArray(cached)) return cached

        const files = await getProjectFiles(projectId)
        if (!files || files.length === 0) return []

        const keywords = extractKeywords(text)
        const scores: RelevanceScoreResult[] = []

        // Use streaming processor for large file sets
        if (files.length > 1000) {
          const processor = service.createStreamProcessor(async (file: ProjectFile) => {
            // Skip files that should be ignored
            if (shouldSkipFile(file)) return null

            const score = calculateFileRelevance(file, keywords, files)
            return score.totalScore >= relevanceConfig.minScore ? score : null
          })

          for await (const result of processor.processStream(files)) {
            if ('item' in result && result.item) {
              scores.push(result.item)
            }
          }
        } else {
          // Process normally for smaller sets
          for (const file of files) {
            if (shouldSkipFile(file)) continue

            const score = calculateFileRelevance(file, keywords, files)
            if (score.totalScore >= relevanceConfig.minScore) {
              scores.push(score)
            }
          }
        }

        // Sort by total score descending and limit results
        const results = scores.sort((a, b) => b.totalScore - a.totalScore).slice(0, relevanceConfig.maxFiles)

        // Cache results
        cache.set(cacheKey, results)
        return results
      },
      { action: 'score-files-for-text', id: projectId }
    )
  }

  function calculateFileRelevance(
    file: ProjectFile,
    keywords: string[],
    allFiles: ProjectFile[]
  ): RelevanceScoreResult {
    const keywordScore = calculateKeywordScore(file, keywords)
    const pathScore = calculatePathScore(file, keywords)
    const typeScore = calculateTypeScore(file, keywords)
    const recencyScore = calculateRecencyScore(file)
    const importScore = calculateImportScore(file, allFiles)

    const totalScore =
      keywordScore * relevanceConfig.weights.keyword +
      pathScore * relevanceConfig.weights.path +
      typeScore * relevanceConfig.weights.type +
      recencyScore * relevanceConfig.weights.recency +
      importScore * relevanceConfig.weights.import

    return {
      fileId: file.id,
      totalScore,
      keywordScore,
      pathScore,
      typeScore,
      recencyScore,
      importScore
    }
  }

  function calculateKeywordScore(file: ProjectFile, keywords: string[]): number {
    if (keywords.length === 0) return 0

    let matchCount = 0
    const fileText = `${file.name} ${file.content || ''}`.toLowerCase()

    // Direct keyword matches
    for (const keyword of keywords) {
      if (fileText.includes(keyword.toLowerCase())) {
        matchCount++
      }
    }

    // Partial matches in content
    const contentWords = tokenize(fileText)
    for (const keyword of keywords) {
      for (const word of contentWords) {
        if (word.includes(keyword) || keyword.includes(word)) {
          matchCount += 0.5
        }
      }
    }

    return Math.min(matchCount / keywords.length, 1)
  }

  function calculatePathScore(file: ProjectFile, keywords: string[]): number {
    const pathParts = file.path.toLowerCase().split(/[\/\\.-_]/)
    let score = 0

    for (const keyword of keywords) {
      for (const part of pathParts) {
        if (part === keyword) {
          score += 1
        } else if (part.includes(keyword) || keyword.includes(part)) {
          score += 0.5
        }
      }
    }

    return Math.min(score / keywords.length, 1)
  }

  function calculateTypeScore(file: ProjectFile, keywords: string[]): number {
    const ext = getFileExtension(file.path).toLowerCase()

    // Map keywords to likely file types
    const typeAssociations: Record<string, string[]> = {
      component: ['tsx', 'jsx', 'vue', 'svelte'],
      style: ['css', 'scss', 'sass', 'less'],
      test: ['test.ts', 'test.js', 'spec.ts', 'spec.js'],
      config: ['json', 'yaml', 'yml', 'toml', 'env'],
      api: ['ts', 'js', 'py', 'go'],
      route: ['ts', 'js', 'tsx', 'jsx'],
      service: ['ts', 'js'],
      hook: ['ts', 'tsx', 'js', 'jsx'],
      schema: ['ts', 'zod.ts'],
      model: ['ts', 'js', 'py'],
      database: ['sql', 'prisma', 'ts'],
      documentation: ['md', 'mdx', 'txt']
    }

    let score = 0
    for (const keyword of keywords) {
      const associations = typeAssociations[keyword.toLowerCase()]
      if (associations && associations.some((a) => file.path.endsWith(a))) {
        score += 1
      }
    }

    return Math.min(score / keywords.length, 1)
  }

  function calculateRecencyScore(file: ProjectFile): number {
    if (!file.updatedAt) return 0.5

    const now = Date.now()
    const fileAge = now - file.updatedAt
    const dayInMs = 24 * 60 * 60 * 1000

    // Files modified in the last day get highest score
    if (fileAge < dayInMs) return 1
    // Linear decay over 30 days
    if (fileAge < 30 * dayInMs) return 1 - (fileAge / (30 * dayInMs)) * 0.5
    // Older files get baseline score
    return 0.5
  }

  function calculateImportScore(file: ProjectFile, allFiles: ProjectFile[]): number {
    if (!file.imports || file.imports.length === 0) return 0

    // Count how many other files import this file
    let importCount = 0
    for (const otherFile of allFiles) {
      if (otherFile.id === file.id) continue
      if (otherFile.imports?.some((imp) => imp.source.includes(file.name))) {
        importCount++
      }
    }

    // Normalize by total files (files imported by many others are likely important)
    return Math.min(importCount / Math.max(allFiles.length * 0.1, 1), 1)
  }

  function extractKeywords(text: string): string[] {
    const words = tokenize(text)
    const wordFreq = new Map<string, number>()

    for (const word of words) {
      if (word.length < 3 || stopWords.has(word)) continue
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1)
    }

    // Sort by frequency and take top keywords
    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word]) => word)
  }

  function tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 0)
  }

  function shouldSkipFile(file: ProjectFile): boolean {
    // Use the file filter utility
    return fileFilter.shouldSkipFile(file)
  }

  function getFileExtension(filePath: string): string {
    return filePath.split('.').pop() || ''
  }

  function updateConfig(config: Partial<RelevanceConfig>): void {
    relevanceConfig = { ...relevanceConfig, ...config }
  }

  function hashText(text: string): string {
    let hash = 0
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString()
  }

  // Batch processing for multiple files/queries
  async function batchScoreFiles(
    queries: Array<{ text: string; projectId: number }>,
    options: { maxConcurrency?: number } = {}
  ): Promise<Map<string, RelevanceScoreResult[]>> {
    const processor = service.createParallelProcessor(
      async (batch: Array<{ text: string; projectId: number; index: number }>) => {
        return Promise.all(
          batch.map(async ({ text, projectId, index }) => {
            const results = await scoreFilesForText(text, projectId)
            return { index, results }
          })
        )
      }
    )

    const indexedQueries = queries.map((query, index) => ({ ...query, index }))
    const batchResult = await processor.processBatch(indexedQueries)

    const results = new Map<string, RelevanceScoreResult[]>()
    for (const { index, results: scores } of batchResult.successful) {
      const query = queries[index]
      if (query) {
        results.set(`${query.projectId}:${hashText(query.text)}`, scores)
      }
    }

    return results
  }

  return {
    // Core functionality
    scoreFilesForTicket,
    scoreFilesForTask,
    scoreFilesForText,
    batchScoreFiles,
    updateConfig,

    // Service metadata
    serviceName: service.serviceName,
    config: service.config,

    // Cleanup
    destroy: () => {
      cache.destroy()
      service.destroy()
    }
  }
}

// Export types
export type FileRelevanceService = ReturnType<typeof createFileRelevanceService>

// Export singleton for backward compatibility
export const fileRelevanceService = createFileRelevanceService()

// Export individual functions for tree-shaking
export const { scoreFilesForTicket, scoreFilesForTask, scoreFilesForText, updateConfig } = fileRelevanceService
