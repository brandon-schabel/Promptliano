import type { File, Ticket } from '@promptliano/database'
import { ApiError } from '@promptliano/shared'
import { rawDb } from '@promptliano/database'
import { ErrorFactory, withErrorContext } from '@promptliano/shared'
import type { Database, Statement } from 'bun:sqlite'
import { getProjectFiles } from '../project-service'
import { createFileService, createFileCache, createFileFilter, type FileServiceConfig } from './file-service-factory'

export interface SearchOptions {
  query: string
  searchType?: 'exact' | 'fuzzy' | 'semantic' | 'regex'
  fileTypes?: string[]
  limit?: number
  offset?: number
  includeContext?: boolean
  contextLines?: number
  scoringMethod?: 'relevance' | 'recency' | 'frequency'
  caseSensitive?: boolean
}

export interface SearchResult {
  file: File
  score: number
  matches: Array<{
    line: number
    column: number
    text: string
    context?: string
  }>
  keywords?: string[]
  snippet?: string
}

export interface SearchStats {
  totalResults: number
  searchTime: number
  cached: boolean
  indexCoverage: number
}

export interface FileSearchServiceDeps {
  database?: Database
  fileIndexingService?: any
  cache?: ReturnType<typeof createFileCache>
  config?: FileServiceConfig
}

export function createFileSearchService(deps: FileSearchServiceDeps = {}) {
  const service = createFileService('FileSearchService', deps.config)
  const db = deps.database || rawDb
  const fileFilter = createFileFilter()
  
  // Cache configuration
  const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
  const MAX_CACHE_SIZE = 1000
  const cache = deps.cache || createFileCache({ ttl: CACHE_TTL, maxSize: MAX_CACHE_SIZE })
  
  // Prepared statements (initialized lazily)
  let statements: {
    searchCache: Statement
    insertCache: Statement
    updateCacheHit: Statement
  } | null = null

  function initializeStatements() {
    if (statements) return statements

    statements = {
      searchCache: db.prepare(`
        SELECT results, score_data, created_at
        FROM search_cache
        WHERE cache_key = ? AND expires_at > ?
      `),
      insertCache: db.prepare(`
        INSERT OR REPLACE INTO search_cache 
        (cache_key, query, project_id, results, score_data, created_at, expires_at, hit_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      `),
      updateCacheHit: db.prepare(`
        UPDATE search_cache 
        SET hit_count = hit_count + 1 
        WHERE cache_key = ?
      `)
    }

    return statements
  }

  // Core search functionality
  async function search(
    projectId: number,
    options: SearchOptions
  ): Promise<{
    results: SearchResult[]
    stats: SearchStats
  }> {
    return service.withErrorContext(
      async () => {
        const startTime = Date.now()
        const statements = initializeStatements()

        // Generate cache key
        const cacheKey = generateCacheKey(projectId, options)

        // Check cache first
        const cached = checkCache(cacheKey, statements)
        if (cached) {
          return {
            results: cached.results,
            stats: {
              totalResults: cached.results.length,
              searchTime: Date.now() - startTime,
              cached: true,
              indexCoverage: 100
            }
          }
        }

        // Ensure files are indexed
        await ensureIndexed(projectId)

        // Perform search based on type
        let results: SearchResult[]
        switch (options.searchType || 'semantic') {
          case 'exact':
            results = await exactSearch(projectId, options)
            break
          case 'fuzzy':
            results = await fuzzySearch(projectId, options)
            break
          case 'regex':
            results = await regexSearch(projectId, options)
            break
          case 'semantic':
          default:
            results = await semanticSearch(projectId, options)
            break
        }

        // Apply scoring method
        results = applyScoring(results, options.scoringMethod || 'relevance')

        // Apply limit and offset
        const totalResults = results.length
        if (options.offset) {
          results = results.slice(options.offset)
        }
        if (options.limit) {
          results = results.slice(0, options.limit)
        }

        // Cache results
        cacheResults(cacheKey, projectId, options.query, results, statements)

        return {
          results,
          stats: {
            totalResults,
            searchTime: Date.now() - startTime,
            cached: false,
            indexCoverage: await getIndexCoverage(projectId)
          }
        }
      },
      { action: 'search', id: projectId }
    )
  }

  async function searchByTicket(
    ticket: Ticket,
    options: Partial<SearchOptions> = {}
  ): Promise<{
    results: SearchResult[]
    stats: SearchStats
  }> {
    // Extract keywords from ticket
    const ticketText = `${ticket.title} ${ticket.overview || ''}`
    const keywords = extractQueryKeywords(ticketText)

    // Build search query from keywords
    const searchOptions: SearchOptions = {
      query: keywords.join(' '),
      searchType: options.searchType || 'semantic',
      fileTypes: options.fileTypes,
      limit: options.limit || 50,
      offset: options.offset || 0,
      includeContext: options.includeContext || false,
      contextLines: options.contextLines || 3,
      scoringMethod: options.scoringMethod || 'relevance',
      caseSensitive: options.caseSensitive || false
    }

    return search(ticket.projectId, searchOptions)
  }

  async function searchByKeywords(
    projectId: number,
    keywords: string[],
    options: Partial<SearchOptions> = {}
  ): Promise<{
    results: SearchResult[]
    stats: SearchStats
  }> {
    const searchOptions: SearchOptions = {
      query: keywords.join(' '),
      searchType: options.searchType || 'semantic',
      fileTypes: options.fileTypes,
      limit: options.limit || 50,
      offset: options.offset || 0,
      includeContext: options.includeContext || false,
      contextLines: options.contextLines || 3,
      scoringMethod: options.scoringMethod || 'relevance',
      caseSensitive: options.caseSensitive || false
    }

    return search(projectId, searchOptions)
  }

  // Search implementation methods
  async function exactSearch(projectId: number, options: SearchOptions): Promise<SearchResult[]> {
    const query = options.caseSensitive ? options.query : options.query.toLowerCase()
    const ftsQuery = `"${query}"`

    const results = db
      .prepare(
        `
        SELECT 
          f.file_id,
          f.project_id,
          f.path,
          f.name,
          f.extension,
          snippet(file_search_fts, 5, '<match>', '</match>', '...', 64) as snippet,
          rank
        FROM file_search_fts f
        JOIN file_search_metadata m ON f.file_id = m.file_id
        WHERE m.project_id = ? AND file_search_fts MATCH ?
        ORDER BY rank
        LIMIT ? OFFSET ?
      `
      )
      .all(projectId, ftsQuery, options.limit || 100, options.offset || 0) as any[]

    return enrichResults(results, options)
  }

  async function fuzzySearch(projectId: number, options: SearchOptions): Promise<SearchResult[]> {
    const query = options.query.toLowerCase()
    const trigrams = generateQueryTrigrams(query)
    if (trigrams.length === 0) {
      return []
    }

    const sql = `
      SELECT DISTINCT f.file_id, COUNT(*) as match_count
      FROM file_trigrams f
      WHERE f.trigram IN (${trigrams.map(() => '?').join(',')})
      GROUP BY f.file_id
      HAVING match_count >= ?
      ORDER BY match_count DESC
      LIMIT ?
    `

    const minMatches = Math.max(1, Math.floor(trigrams.length * 0.6))
    const fileMatches = db.prepare(sql).all(...trigrams, minMatches, options.limit || 100) as any[]

    const results: SearchResult[] = []
    for (const match of fileMatches) {
      const fileData = await getFileData(match.file_id)
      if (fileData && fileData.projectId === projectId) {
        const content = fileData.content || ''
        const searchText = `${fileData.path} ${content}`
        const score = calculateFuzzyScore(query, searchText)
        results.push({
          file: fileData,
          score,
          matches: [],
          snippet: generateSnippet(content, query)
        })
      }
    }
    
    return results.sort((a, b) => b.score - a.score)
  }

  async function regexSearch(projectId: number, options: SearchOptions): Promise<SearchResult[]> {
    const ftsFiles = db
      .prepare(
        `
        SELECT file_id, project_id, path, name, extension, content
        FROM file_search_fts
        WHERE project_id = ?
      `
      )
      .all(projectId) as any[]

    if (!ftsFiles || ftsFiles.length === 0) {
      return []
    }

    const results: SearchResult[] = []
    let regex: RegExp

    try {
      regex = new RegExp(options.query, options.caseSensitive ? 'g' : 'gi')
    } catch (error) {
      throw ErrorFactory.invalidParam('query', 'valid regex pattern', options.query)
    }

    for (const ftsFile of ftsFiles) {
      if (options.fileTypes && options.fileTypes.length > 0) {
        if (!options.fileTypes.includes(ftsFile.extension || '')) {
          continue
        }
      }

      const content = ftsFile.content || ''
      const matches: any[] = []
      let match

      while ((match = regex.exec(content)) !== null) {
        const lines = content.substring(0, match.index).split('\n')
        const line = lines.length
        const column = lines[lines.length - 1].length + 1
        matches.push({
          line,
          column,
          text: match[0],
          context: options.includeContext ? getLineContext(content, line, options.contextLines || 3) : undefined
        })

        if (matches.length >= 10) break
      }

      if (matches.length > 0) {
        const fileData = await getFileData(ftsFile.file_id)
        if (fileData) {
          results.push({
            file: fileData,
            score: matches.length,
            matches,
            snippet: generateSnippet(content, options.query)
          })
        }
      }
    }

    return results
  }

  async function semanticSearch(projectId: number, options: SearchOptions): Promise<SearchResult[]> {
    const query = options.query.toLowerCase()
    const queryTokens = tokenizeQuery(query)

    // Build FTS5 query with proper escaping
    const ftsQuery = queryTokens
      .map((token) => {
        const cleaned = token.replace(/[^\w\s-]/g, '').trim()
        if (!cleaned || cleaned.length < 2) return null
        return `${cleaned}*`
      })
      .filter(Boolean)
      .join(' OR ')

    if (!ftsQuery) {
      return []
    }

    const ftsResults = db
      .prepare(
        `
        SELECT 
          f.file_id,
          f.project_id,
          f.path,
          f.name,
          f.extension,
          snippet(file_search_fts, 5, '<match>', '</match>', '...', 64) as snippet,
          rank,
          m.keyword_vector,
          m.tf_idf_vector
        FROM file_search_fts f
        JOIN file_search_metadata m ON f.file_id = m.file_id
        WHERE m.project_id = ? AND file_search_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `
      )
      .all(projectId, ftsQuery, options.limit || 100) as any[]

    const results: SearchResult[] = []
    for (const result of ftsResults) {
      const fileData = await getFileData(result.file_id)
      if (!fileData) continue

      // Apply file type filter
      if (options.fileTypes && options.fileTypes.length > 0) {
        if (!options.fileTypes.includes(getFileExtension(fileData.path))) {
          continue
        }
      }

      // Calculate combined score
      const ftsScore = Math.abs(result.rank)
      let keywordScore = 0
      let semanticScore = 0

      try {
        if (result.keyword_vector) {
          const keywords = JSON.parse(result.keyword_vector)
          if (Array.isArray(keywords)) {
            keywordScore = calculateKeywordScore(queryTokens, keywords)
          }
        }
        if (result.tf_idf_vector) {
          const vectorStr = result.tf_idf_vector instanceof Uint8Array
            ? new TextDecoder().decode(result.tf_idf_vector)
            : result.tf_idf_vector
          const vector = JSON.parse(vectorStr)
          if (typeof vector === 'object' && vector !== null) {
            semanticScore = calculateSemanticScore(queryTokens, vector)
          }
        }
      } catch (error) {
        // Continue with just FTS score
      }

      const combinedScore = ftsScore * 0.4 + keywordScore * 0.3 + semanticScore * 0.3

      results.push({
        file: fileData,
        score: combinedScore,
        matches: extractMatches(fileData.content || '', query),
        keywords: extractTopKeywords(result.keyword_vector),
        snippet: result.snippet
      })
    }

    return results.sort((a, b) => b.score - a.score)
  }

  // Helper functions
  async function ensureIndexed(projectId: number): Promise<void> {
    if (!deps.fileIndexingService) return

    try {
      const files = await getProjectFiles(projectId)
      if (!files || files.length === 0) return

      const stats = await deps.fileIndexingService.getIndexingStats(projectId)
      const coveragePercentage = files.length > 0 ? (stats.indexedFiles / files.length) * 100 : 0

      const needsIndexing = 
        stats.indexedFiles === 0 ||
        coveragePercentage < 80 ||
        !stats.lastIndexed ||
        Date.now() - stats.lastIndexed > 24 * 60 * 60 * 1000

      if (needsIndexing) {
        await deps.fileIndexingService.indexFiles(files)
      }
    } catch (error) {
      // Don't throw, let search continue with potentially partial results
      console.warn('Error ensuring files indexed:', error)
    }
  }

  function generateCacheKey(projectId: number, options: SearchOptions): string {
    const parts = [
      projectId,
      options.query,
      options.searchType || 'semantic',
      options.fileTypes?.join(',') || '',
      options.scoringMethod || 'relevance',
      options.caseSensitive ? '1' : '0',
      options.limit || 100,
      options.offset || 0
    ]
    return parts.join('|')
  }

  function checkCache(cacheKey: string, statements: any): { results: SearchResult[] } | null {
    // Try service cache first
    const serviceCache = cache.get(cacheKey) as any
    if (serviceCache && serviceCache.results) {
      return serviceCache
    }

    // Try database cache
    const cached = statements.searchCache.get(cacheKey, Date.now()) as any
    if (cached) {
      statements.updateCacheHit.run(cacheKey)
      const results = {
        results: JSON.parse(cached.results)
      }
      // Store in service cache for faster access
      cache.set(cacheKey, results)
      return results
    }
    
    return null
  }

  function cacheResults(
    cacheKey: string, 
    projectId: number, 
    query: string, 
    results: SearchResult[],
    statements: any
  ): void {
    try {
      // Store in service cache
      cache.set(cacheKey, { results })

      // Store in database cache
      statements.insertCache.run(
        cacheKey,
        query,
        projectId,
        JSON.stringify(results),
        JSON.stringify(results.map((r) => ({ id: r.file.id, score: r.score }))),
        Date.now(),
        Date.now() + CACHE_TTL
      )
    } catch (error) {
      console.error('Failed to cache search results:', error)
    }
  }

  async function getFileData(fileId: string | number): Promise<File | null> {
    try {
      const ftsData = db
        .prepare(
          `
          SELECT file_id, project_id, path, name, extension, content
          FROM file_search_fts 
          WHERE file_id = ?
        `
        )
        .get(String(fileId)) as any

      if (!ftsData) return null

      try {
        const files = await getProjectFiles(ftsData.project_id)
        if (files && files.length > 0) {
          const file = files.find((f) => String(f.id) === String(fileId))
          if (file) return file
        }
      } catch (error) {
        // Continue with fallback
      }

      // Fallback: construct from FTS data
      const metadata = db
        .prepare(
          `
          SELECT file_size, created_at, updated_at 
          FROM file_search_metadata 
          WHERE file_id = ?
        `
        )
        .get(String(fileId)) as any

      return {
        id: ftsData.file_id,
        projectId: ftsData.project_id,
        path: ftsData.path,
        name: ftsData.name,
        extension: ftsData.extension || null,
        size: metadata?.file_size || null,
        lastModified: null,
        contentType: null,
        content: ftsData.content,
        summary: null,
        summaryLastUpdated: null,
        meta: null,
        checksum: null,
        imports: null,
        exports: null,
        isRelevant: false,
        relevanceScore: null,
        createdAt: metadata?.created_at || Date.now(),
        updatedAt: metadata?.updated_at || Date.now()
      }
    } catch (error) {
      console.error(`Error getting file data for ID ${fileId}:`, error)
      return null
    }
  }

  async function enrichResults(ftsResults: any[], options: SearchOptions): Promise<SearchResult[]> {
    const results: SearchResult[] = []

    for (const result of ftsResults) {
      const fileData = await getFileData(result.file_id)
      if (!fileData) continue

      results.push({
        file: fileData,
        score: Math.abs(result.rank),
        matches: options.includeContext ? extractMatches(fileData.content || '', options.query) : [],
        snippet: result.snippet
      })
    }
    return results
  }

  function applyScoring(results: SearchResult[], method: string): SearchResult[] {
    switch (method) {
      case 'recency':
        return results.sort((a, b) => b.file.updatedAt - a.file.updatedAt)
      case 'frequency':
        return results.sort((a, b) => b.matches.length - a.matches.length)
      case 'relevance':
      default:
        return results.sort((a, b) => b.score - a.score)
    }
  }

  // Utility functions
  function extractQueryKeywords(text: string): string[] {
    const tokens = tokenizeQuery(text)
    const wordFreq = new Map<string, number>()

    for (const token of tokens) {
      if (token.length < 3) continue
      wordFreq.set(token, (wordFreq.get(token) || 0) + 1)
    }

    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word]) => word)
  }

  function tokenizeQuery(query: string): string[] {
    let processed = query
    processed = processed.replace(/([a-z])([A-Z])/g, '$1 $2')
    processed = processed.replace(/[_-]/g, ' ')

    const tokens = processed
      .toLowerCase()
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 1)
      .filter((token) => !/^(and|or|not|the|is|at|which|on|in|of|to|for|a|an)$/.test(token))

    const originalTokens = query
      .toLowerCase()
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 1)

    return [...new Set([...tokens, ...originalTokens])]
  }

  function generateQueryTrigrams(query: string): string[] {
    const trigrams: string[] = []
    const normalized = query.toLowerCase()

    for (let i = 0; i <= normalized.length - 3; i++) {
      trigrams.push(normalized.slice(i, i + 3))
    }

    return [...new Set(trigrams)]
  }

  function calculateFuzzyScore(query: string, text: string): number {
    const qLen = query.length
    const tLen = text.length

    if (qLen === 0) return 1.0
    if (tLen === 0) return 0.0

    // Simple Levenshtein distance implementation
    const matrix: number[][] = []

    for (let i = 0; i <= tLen; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= qLen; j++) {
      matrix[0]![j] = j
    }

    for (let i = 1; i <= tLen; i++) {
      for (let j = 1; j <= qLen; j++) {
        if (text[i - 1] === query[j - 1]) {
          matrix[i]![j] = matrix[i - 1]![j - 1]!
        } else {
          matrix[i]![j] = Math.min(
            matrix[i - 1]![j - 1]! + 1,
            matrix[i]![j - 1]! + 1,
            matrix[i - 1]![j]! + 1
          )
        }
      }
    }

    const distance = matrix[tLen]![qLen]!
    return 1 - distance / Math.max(qLen, tLen)
  }

  function calculateKeywordScore(queryTokens: string[], keywords: any[]): number {
    if (keywords.length === 0) return 0

    let score = 0
    const keywordMap = new Map(keywords.map((k) => [k.keyword, k.tfScore]))

    for (const token of queryTokens) {
      if (keywordMap.has(token)) {
        score += keywordMap.get(token) || 0
      }
    }
    return score / queryTokens.length
  }

  function calculateSemanticScore(queryTokens: string[], tfIdfVector: Record<string, number>): number {
    if (Object.keys(tfIdfVector).length === 0) return 0

    let score = 0
    let queryMagnitude = 0
    let docMagnitude = 0

    for (const token of queryTokens) {
      const queryWeight = 1 / queryTokens.length
      const docWeight = tfIdfVector[token] || 0
      score += queryWeight * docWeight
      queryMagnitude += queryWeight * queryWeight
      docMagnitude += docWeight * docWeight
    }

    if (queryMagnitude === 0 || docMagnitude === 0) return 0
    return score / (Math.sqrt(queryMagnitude) * Math.sqrt(docMagnitude))
  }

  function extractMatches(content: string, query: string): Array<any> {
    const matches: any[] = []
    const lines = content.split('\n')
    const lowerContent = content.toLowerCase()
    const lowerQuery = query.toLowerCase()
    let index = 0
    
    while ((index = lowerContent.indexOf(lowerQuery, index)) !== -1) {
      const linesBefore = content.substring(0, index).split('\n')
      const line = linesBefore.length
      const column = (linesBefore[linesBefore.length - 1] || '').length + 1
      matches.push({
        line,
        column,
        text: content.substring(index, index + query.length)
      })

      index += query.length
      if (matches.length >= 10) break
    }

    return matches
  }

  function generateSnippet(content: string, query: string, maxLength: number = 200): string {
    const index = content.toLowerCase().indexOf(query.toLowerCase())
    if (index === -1) return ''

    const start = Math.max(0, index - 50)
    const end = Math.min(content.length, index + query.length + 50)

    let snippet = content.substring(start, end)
    if (start > 0) snippet = '...' + snippet
    if (end < content.length) snippet += '...'

    return snippet
  }

  function getLineContext(content: string, lineNumber: number, contextLines: number): string {
    const lines = content.split('\n')
    const start = Math.max(0, lineNumber - contextLines - 1)
    const end = Math.min(lines.length, lineNumber + contextLines)
    return lines.slice(start, end).join('\n')
  }

  function getFileExtension(filePath: string): string {
    return filePath.split('.').pop() || ''
  }

  function extractTopKeywords(keywordVector: string | null | undefined): string[] {
    if (!keywordVector) return []

    try {
      const keywords = JSON.parse(keywordVector)
      if (Array.isArray(keywords)) {
        return keywords
          .slice(0, 5)
          .filter((k: any) => k && typeof k.keyword === 'string')
          .map((k: any) => k.keyword)
      }
      return []
    } catch (error) {
      return []
    }
  }

  async function getIndexCoverage(projectId: number): Promise<number> {
    if (!deps.fileIndexingService) return 0

    try {
      const stats = await deps.fileIndexingService.getIndexingStats(projectId)
      const files = await getProjectFiles(projectId)
      if (!files || files.length === 0) return 100
      return Math.round((stats.indexedFiles / files.length) * 100)
    } catch (error) {
      return 0
    }
  }

  // Debug utilities
  async function debugSearch(
    projectId: number,
    query?: string
  ): Promise<{
    indexStats: any
    ftsContent: any
    sampleSearch?: any
    recommendations: string[]
  }> {
    const recommendations: string[] = []

    // Get index stats
    const indexStats = deps.fileIndexingService 
      ? await deps.fileIndexingService.getIndexingStats(projectId)
      : { indexedFiles: 0 }

    // Get FTS5 content
    const ftsContent = await debugFTS5Contents(projectId)

    // Check for common issues
    if (indexStats.indexedFiles === 0) {
      recommendations.push('No files are indexed. Run file sync or force reindex.')
    }

    if (ftsContent.ftsCount === 0) {
      recommendations.push('FTS5 table is empty. Check if indexing is completing successfully.')
    }

    // Try sample search if query provided
    let sampleSearch
    if (query) {
      try {
        sampleSearch = await search(projectId, { query, limit: 5 })
        if (sampleSearch.results.length === 0) {
          recommendations.push(`No results for query "${query}". Try simpler terms or check tokenization.`)
        }
      } catch (error) {
        sampleSearch = { error: error instanceof Error ? error.message : String(error) }
        recommendations.push(`Search failed: ${sampleSearch.error}`)
      }
    }

    return {
      indexStats,
      ftsContent,
      sampleSearch,
      recommendations
    }
  }

  async function debugFTS5Contents(projectId: number): Promise<{
    ftsCount: number
    metadataCount: number
    projectFTSCount: number
    sampleFTSRows: any[]
    sampleMetadataRows: any[]
  }> {
    const ftsCount = (db.prepare('SELECT COUNT(*) as count FROM file_search_fts').get() as any)?.count || 0
    const projectFTSCount = (
      db.prepare('SELECT COUNT(*) as count FROM file_search_fts WHERE project_id = ?').get(projectId) as any
    )?.count || 0
    const metadataCount = (
      db.prepare('SELECT COUNT(*) as count FROM file_search_metadata WHERE project_id = ?').get(projectId) as any
    )?.count || 0

    const sampleFTSRows = db
      .prepare('SELECT file_id, project_id, path, name FROM file_search_fts WHERE project_id = ? LIMIT 5')
      .all(projectId)
    const sampleMetadataRows = db
      .prepare('SELECT file_id, last_indexed, token_count FROM file_search_metadata WHERE project_id = ? LIMIT 5')
      .all(projectId)

    return {
      ftsCount,
      metadataCount,
      projectFTSCount,
      sampleFTSRows,
      sampleMetadataRows
    }
  }

  return {
    // Core functionality
    search,
    searchByTicket,
    searchByKeywords,

    // Debug utilities
    debugSearch,

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
export type FileSearchService = ReturnType<typeof createFileSearchService>

// Export singleton for backward compatibility
export const fileSearchService = createFileSearchService()

// Export individual functions for tree-shaking
export const {
  search,
  searchByTicket,
  searchByKeywords,
} = fileSearchService