import type { File, Ticket } from '@promptliano/database'
import { rawDb } from '@promptliano/database'
import { getProjectFiles, getProjectById as getProjectRecord } from '../project-service'
import { searchWithRipgrep, buildGlobsForExtensions } from './backends/file-search-rg'
import { searchWithFtsMin } from './backends/file-search-fts-min'
import { spawnSync } from 'node:child_process'
import { createFileService, type FileServiceConfig } from './file-service-factory'

export interface SearchOptions {
  query: string
  searchType?: 'ast' | 'exact' | 'fuzzy' | 'semantic' | 'regex'
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
  config?: FileServiceConfig
}

export function createFileSearchService(deps: FileSearchServiceDeps = {}) {
  const service = createFileService('FileSearchService', deps.config)
  const db = rawDb

  // Core search functionality
  async function search(
    projectId: number,
    options: SearchOptions
  ): Promise<{
    results: SearchResult[]
    stats: SearchStats
  }> {
    const t0 = Date.now()
    const backend = selectBackend()
    const { results } = await searchWithBackend(projectId, options, backend)
    return {
      results,
      stats: {
        totalResults: results.length,
        searchTime: Date.now() - t0,
        cached: false,
        indexCoverage: 100
      }
    }
  }

  function selectBackend(): 'sg' | 'rg' | 'fts' | 'like' {
    const envPref = String(process.env.FILE_SEARCH_BACKEND || 'sg').toLowerCase()
    if (envPref === 'sg') {
      if (isAstGrepAvailable()) return 'sg'
    }
    if (envPref === 'rg') {
      if (isRipgrepAvailable()) return 'rg'
      // fall through to detect fts/like
    }
    if (envPref === 'fts') {
      return 'fts'
    }
    if (envPref === 'like') {
      return 'like'
    }
    // Auto-detect
    if (isAstGrepAvailable()) return 'sg'
    if (isRipgrepAvailable()) return 'rg'
    // If FTS table exists, use it
    try {
      db.prepare('SELECT 1 FROM file_search_fts LIMIT 0').get()
      return 'fts'
    } catch {}
    return 'like'
  }

  function isRipgrepAvailable(): boolean {
    const rgPath = process.env.FILE_SEARCH_RIPGREP_PATH || 'rg'
    try {
      const res = spawnSync(rgPath, ['--version'], { stdio: 'ignore' })
      return res.status === 0
    } catch {
      return false
    }
  }

  function isAstGrepAvailable(): boolean {
    const candidates = [process.env.FILE_SEARCH_ASTGREP_PATH, process.env.AST_GREP_PATH, 'ast-grep', 'sg'].filter(
      Boolean
    ) as string[]
    for (const bin of candidates) {
      try {
        const res = spawnSync(bin, ['--version'], { stdio: 'ignore' })
        if (res.status === 0) return true
      } catch {}
    }
    return false
  }

  async function searchWithBackend(
    projectId: number,
    options: SearchOptions,
    backend: 'sg' | 'rg' | 'fts' | 'like'
  ): Promise<{ results: SearchResult[] }> {
    const normalizedQuery = options.query || ''
    const fileTypeGlobs = buildGlobsForExtensions(options.fileTypes)

    // Helper to fetch a file by relative path
    const getFileByPath = (relPath: string) =>
      db
        .prepare(
          `SELECT * FROM files WHERE project_id = ? AND path = ? LIMIT 1`
        )
        .get(projectId, relPath) as File | null

    if (backend === 'sg' || backend === 'rg') {
      const proj = await getProjectRecord(projectId)
      const projectPath = proj?.path
      if (!projectPath) {
        return { results: [] }
      }

      // fuzzy: filename-only scoring without content match
      if ((options.searchType || 'ast') === 'fuzzy') {
        const all = await getProjectFiles(projectId)
        const scored = all
          .map((f) => ({ file: f, score: calculateFuzzyScore(normalizedQuery.toLowerCase(), f.path.toLowerCase()) }))
          .filter((r) => r.score > 0)
          .sort((a, b) => b.score - a.score)
        const limited = scored.slice(options.offset || 0, (options.offset || 0) + (options.limit || 100))
        const results: SearchResult[] = limited.map((r) => ({ file: r.file, score: r.score, matches: [] }))
        return { results }
      }

      if (backend === 'sg' && (options.searchType || 'ast') !== 'regex') {
        try {
          const sgItems = await searchWithAstGrep(projectPath, normalizedQuery, {
            caseSensitive: options.caseSensitive,
            limit: options.limit,
          })
          const results: SearchResult[] = []
          for (const item of sgItems) {
            const file = getFileByPath(item.path)
            if (!file) continue
            if (options.fileTypes && options.fileTypes.length > 0) {
              const ext = getFileExtension(file.path)
              if (!options.fileTypes.includes(ext)) continue
            }
            const content = file.content || ''
            const matches = item.matches.map((m) => ({
              line: m.line,
              column: m.column,
              text: m.text,
              context: options.includeContext ? getLineContext(content, m.line, options.contextLines || 3) : undefined
            }))
            results.push({ file, score: item.score, matches, snippet: generateSnippet(content, normalizedQuery) })
          }
          const offset = options.offset || 0
          const limit = options.limit || results.length
          return { results: results.slice(offset, offset + limit) }
        } catch {
          // fallback to ripgrep
        }
      }

      try {
        const rgItems = await searchWithRipgrep(projectPath, normalizedQuery, {
          caseSensitive: options.caseSensitive,
          exact: (options.searchType || 'ast') === 'exact',
          regex: (options.searchType || 'ast') === 'regex',
          limit: options.limit,
          fileGlobs: fileTypeGlobs
        })

        const results: SearchResult[] = []
        for (const item of rgItems) {
          const file = getFileByPath(item.path)
          if (!file) continue
          const content = file.content || ''
          const matches = item.matches.map((m) => ({
            line: m.line,
            column: m.column,
            text: m.text,
            context: options.includeContext ? getLineContext(content, m.line, options.contextLines || 3) : undefined
          }))
          results.push({ file, score: item.score, matches, snippet: generateSnippet(content, normalizedQuery) })
        }

        // Apply offset/limit if needed
        const offset = options.offset || 0
        const limit = options.limit || results.length
        return { results: results.slice(offset, offset + limit) }
      } catch {
        // ripgrep not available → fallback
        return searchWithBackend(projectId, options, 'fts')
      }
    }

    if (backend === 'fts') {
      // Build a simple FTS query from tokens
      const tokens = tokenizeQuery(normalizedQuery.toLowerCase())
      const query = tokens
        .map((t) => t.replace(/[^\w\s-]/g, '').trim())
        .filter((t) => t && t.length >= 2)
        .map((t) => `${t}*`)
        .join(' OR ')
      if (!query) return { results: [] }

      const { rows } = searchWithFtsMin(projectId, query, { limit: options.limit, offset: options.offset })
      const results: SearchResult[] = []
      for (const r of rows) {
        const fileRow = db
          .prepare('SELECT * FROM files WHERE id = ? LIMIT 1')
          .get(r.fileId) as File | null
        if (!fileRow) continue
        if (options.fileTypes && options.fileTypes.length > 0) {
          const ext = getFileExtension(fileRow.path)
          if (!options.fileTypes.includes(ext)) continue
        }
        const content = fileRow.content || ''
        results.push({
          file: fileRow,
          score: Math.abs(r.rank),
          matches: extractMatches(content, normalizedQuery),
          snippet: r.snippet
        })
      }
      return { results }
    }

    // LIKE fallback
    const like = options.caseSensitive ? normalizedQuery : normalizedQuery.toLowerCase()
    const likeParam = `%${like}%`
    const rows = db
      .prepare(
        options.caseSensitive
          ? `SELECT * FROM files WHERE project_id = ? AND (path LIKE ? OR content LIKE ?) LIMIT ? OFFSET ?`
          : `SELECT * FROM files WHERE project_id = ? AND (LOWER(path) LIKE ? OR LOWER(content) LIKE ?) LIMIT ? OFFSET ?`
      )
      .all(projectId, likeParam, likeParam, options.limit || 100, options.offset || 0) as File[]

    const results: SearchResult[] = []
    for (const f of rows) {
      if (options.fileTypes && options.fileTypes.length > 0) {
        const ext = getFileExtension(f.path)
        if (!options.fileTypes.includes(ext)) continue
      }
      const content = f.content || ''
      results.push({ file: f, score: 1, matches: extractMatches(content, normalizedQuery), snippet: generateSnippet(content, normalizedQuery) })
    }
    return { results }
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

  // Removed legacy exact/fuzzy/regex/semantic search implementations

  // Helper functions
  // Legacy cache/indexing removed

  // Removed legacy FTS helpers and scoring

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

  // Legacy trigram generation removed

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
          matrix[i]![j] = Math.min(matrix[i - 1]![j - 1]! + 1, matrix[i]![j - 1]! + 1, matrix[i - 1]![j]! + 1)
        }
      }
    }

    const distance = matrix[tLen]![qLen]!
    return 1 - distance / Math.max(qLen, tLen)
  }

  // Legacy keyword/TF scoring removed

  // Legacy semantic scoring removed

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

  // Legacy keyword extraction removed

  // Index coverage not applicable with ripgrep/like paths

  // Debug utilities
  async function debugSearch(projectId: number, query?: string) {
    const sample = query ? await search(projectId, { query, limit: 5 }) : { results: [], stats: { totalResults: 0, searchTime: 0, cached: false, indexCoverage: 100 } }
    return {
      indexStats: { mode: selectBackend(), note: 'legacy index removed' },
      ftsContent: { enabled: tryHasFts() },
      sampleSearch: sample,
      recommendations: [] as string[]
    }
  }

  function tryHasFts(): boolean {
    try {
      db.prepare('SELECT 1 FROM file_search_fts LIMIT 0').get()
      return true
    } catch {
      return false
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
    destroy: service.destroy
  }
}

// Export types
export type FileSearchService = ReturnType<typeof createFileSearchService>

// Export singleton for backward compatibility
export const fileSearchService = createFileSearchService()

// Export individual functions for tree-shaking
export const { search, searchByTicket, searchByKeywords } = fileSearchService
