import type { File as ProjectFile } from '@promptliano/database'
import { ApiError } from '@promptliano/shared'
import { rawDb } from '@promptliano/database'
import { ErrorFactory, withErrorContext } from '@promptliano/shared'
import type { Database, Statement } from 'bun:sqlite'
import { createFileService, createFileFilter, createProgressTracker, type FileServiceConfig } from './file-service-factory'

export interface IndexingStats {
  totalFiles: number
  indexedFiles: number
  totalKeywords: number
  avgTokensPerFile: number
  lastIndexed: number | null
}

export interface IndexingResult {
  indexed: number
  skipped: number
  failed: number
}

export interface FileIndexingServiceDeps {
  database?: Database
  config?: FileServiceConfig
  batchSize?: number
}

export function createFileIndexingService(deps: FileIndexingServiceDeps = {}) {
  const service = createFileService('FileIndexingService', deps.config)
  const db = deps.database || rawDb
  const fileFilter = createFileFilter()
  const batchSize = deps.batchSize || 100

  // Stop words to filter out
  const STOP_WORDS = new Set([
    'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'as', 'are', 'was', 'were',
    'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'to', 'of', 'in', 'for', 'with'
  ])

  // Prepared statements (initialized lazily)
  let statements: {
    insertFTS: Statement
    updateFTS: Statement
    insertMetadata: Statement
    insertKeyword: Statement
    insertTrigram: Statement
    getFileMetadata: Statement
  } | null = null

  function initializeStatements() {
    if (statements) return statements

    ensureTables()

    statements = {
      insertFTS: db.prepare(`
        INSERT INTO file_search_fts (file_id, project_id, path, name, extension, content, summary, keywords)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `),
      updateFTS: db.prepare(`
        UPDATE file_search_fts 
        SET content = ?, summary = ?, keywords = ?
        WHERE file_id = ?
      `),
      insertMetadata: db.prepare(`
        INSERT OR REPLACE INTO file_search_metadata 
        (file_id, project_id, tf_idf_vector, keyword_vector, last_indexed, file_size, token_count, language, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
      insertKeyword: db.prepare(`
        INSERT OR REPLACE INTO file_keywords (file_id, keyword, frequency, tf_score, idf_score)
        VALUES (?, ?, ?, ?, ?)
      `),
      insertTrigram: db.prepare(`
        INSERT OR IGNORE INTO file_trigrams (trigram, file_id, position)
        VALUES (?, ?, ?)
      `),
      getFileMetadata: db.prepare(`
        SELECT last_indexed, token_count, language 
        FROM file_search_metadata 
        WHERE file_id = ?
      `)
    }

    return statements
  }

  function ensureTables() {
    try {
      // Check if tables exist
      db.prepare('SELECT 1 FROM file_search_fts LIMIT 0').get()
    } catch (error) {
      // Create tables if they don't exist
      createTables()
    }
  }

  function createTables() {
    // Create FTS5 virtual table
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS file_search_fts USING fts5(
        file_id UNINDEXED,
        project_id UNINDEXED,
        path,
        name,
        extension UNINDEXED,
        content,
        summary,
        keywords,
        tokenize = 'porter unicode61 remove_diacritics 2'
      )
    `)

    // Create metadata table
    db.exec(`
      CREATE TABLE IF NOT EXISTS file_search_metadata (
        file_id TEXT PRIMARY KEY,
        project_id INTEGER NOT NULL,
        tf_idf_vector BLOB,
        keyword_vector TEXT,
        last_indexed INTEGER NOT NULL,
        file_size INTEGER,
        token_count INTEGER,
        language TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    // Create indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_file_search_metadata_project 
      ON file_search_metadata(project_id)
    `)
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_file_search_metadata_indexed 
      ON file_search_metadata(last_indexed)
    `)

    // Create keyword table
    db.exec(`
      CREATE TABLE IF NOT EXISTS file_keywords (
        file_id TEXT NOT NULL,
        keyword TEXT NOT NULL,
        frequency INTEGER NOT NULL,
        tf_score REAL NOT NULL,
        idf_score REAL,
        PRIMARY KEY (file_id, keyword)
      )
    `)

    // Create keyword indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_file_keywords_keyword 
      ON file_keywords(keyword)
    `)

    // Create trigram table
    db.exec(`
      CREATE TABLE IF NOT EXISTS file_trigrams (
        trigram TEXT NOT NULL,
        file_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        PRIMARY KEY (trigram, file_id, position)
      )
    `)

    // Create search cache table
    db.exec(`
      CREATE TABLE IF NOT EXISTS search_cache (
        cache_key TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        project_id INTEGER NOT NULL,
        results TEXT NOT NULL,
        score_data TEXT,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        hit_count INTEGER DEFAULT 0
      )
    `)

    // Create cache index
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_search_cache_expires 
      ON search_cache(expires_at)
    `)
  }

  async function indexFile(file: ProjectFile, forceReindex = false): Promise<void> {
    return service.withErrorContext(
      async () => {
        const statements = initializeStatements()

        // Check if already indexed and up to date
        if (!forceReindex) {
          const metadata = getFileMetadata(String(file.id), statements)
          if (metadata && metadata.last_indexed >= file.updatedAt) {
            return // Already indexed and current
          }
        }

        const content = file.content || ''
        const processedContent = preprocessContent(content)
        const tokens = tokenize(content)
        const keywords = extractKeywords(tokens)
        const tfIdfVector = calculateTfIdf(tokens, keywords)
        const trigrams = generateTrigrams(file.path + ' ' + processedContent)

        // Begin transaction for atomic updates
        db.transaction(() => {
          // Check if file exists in FTS
          const exists = db.prepare('SELECT 1 FROM file_search_fts WHERE file_id = ?').get(String(file.id))

          if (exists) {
            statements.updateFTS.run(
              processedContent,
              file.summary || '',
              keywords.map(k => k.keyword).join(' '),
              String(file.id)
            )
          } else {
            statements.insertFTS.run(
              String(file.id),
              file.projectId,
              file.path,
              file.name,
              getFileExtension(file.path),
              processedContent,
              file.summary || '',
              keywords.map(k => k.keyword).join(' ')
            )
          }

          // Update metadata
          statements.insertMetadata.run(
            String(file.id),
            file.projectId,
            Buffer.from(JSON.stringify(tfIdfVector)),
            JSON.stringify(keywords.slice(0, 20)),
            Date.now(),
            file.size || 0,
            tokens.length,
            detectLanguage(getFileExtension(file.path)),
            file.createdAt,
            file.updatedAt
          )

          // Clear existing keywords and trigrams
          db.prepare('DELETE FROM file_keywords WHERE file_id = ?').run(String(file.id))
          db.prepare('DELETE FROM file_trigrams WHERE file_id = ?').run(String(file.id))

          // Insert keywords
          for (const kw of keywords) {
            statements.insertKeyword.run(
              String(file.id), 
              kw.keyword, 
              kw.frequency, 
              kw.tfScore, 
              kw.idfScore || 0
            )
          }

          // Insert trigrams
          for (const [trigram, position] of trigrams) {
            statements.insertTrigram.run(trigram, String(file.id), position)
          }
        })()
      },
      { action: 'index-file', id: file.id }
    )
  }

  async function indexFiles(files: ProjectFile[], forceReindex = false): Promise<IndexingResult> {
    return service.withErrorContext(
      async () => {
        const progress = createProgressTracker(files.length)
        let indexed = 0
        let skipped = 0
        let failed = 0

        // Process in batches for better performance
        for (let i = 0; i < files.length; i += batchSize) {
          const batch = files.slice(i, i + batchSize)
          
          for (const file of batch) {
            try {
              // Skip files that don't need indexing
              if (!forceReindex) {
                const statements = initializeStatements()
                const metadata = getFileMetadata(String(file.id), statements)
                if (metadata && metadata.last_indexed >= file.updatedAt) {
                  skipped++
                  progress.increment()
                  continue
                }
              }

              // Skip binary and large files
              if (fileFilter.shouldSkipFile(file)) {
                skipped++
                progress.increment()
                continue
              }

              await indexFile(file, forceReindex)
              indexed++
              progress.increment()
            } catch (error) {
              console.error(`Failed to index file ${file.id}:`, error)
              failed++
              progress.error()
            }
          }

          // Allow other operations to run
          await new Promise(resolve => setTimeout(resolve, 0))
        }

        return { indexed, skipped, failed }
      },
      { action: 'index-files' }
    )
  }

  async function *indexFilesWithProgress(
    files: ProjectFile[], 
    forceReindex = false
  ): AsyncIterator<{
    processed: number
    total: number
    current: string
    indexed: number
    skipped: number
    failed: number
  }> {
    const progress = createProgressTracker(files.length)
    let indexed = 0
    let skipped = 0
    let failed = 0

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize)
      
      for (const file of batch) {
        try {
          // Skip files that don't need indexing
          if (!forceReindex) {
            const statements = initializeStatements()
            const metadata = getFileMetadata(String(file.id), statements)
            if (metadata && metadata.last_indexed >= file.updatedAt) {
              skipped++
              progress.increment()
              yield {
                processed: progress.getProgress().completed + progress.getProgress().errors,
                total: files.length,
                current: file.path,
                indexed,
                skipped,
                failed
              }
              continue
            }
          }

          // Skip binary and large files
          if (fileFilter.shouldSkipFile(file)) {
            skipped++
            progress.increment()
            yield {
              processed: progress.getProgress().completed + progress.getProgress().errors,
              total: files.length,
              current: file.path,
              indexed,
              skipped,
              failed
            }
            continue
          }

          await indexFile(file, forceReindex)
          indexed++
          progress.increment()
        } catch (error) {
          console.error(`Failed to index file ${file.id}:`, error)
          failed++
          progress.error()
        }

        yield {
          processed: progress.getProgress().completed + progress.getProgress().errors,
          total: files.length,
          current: file.path,
          indexed,
          skipped,
          failed
        }
      }

      // Allow other operations to run
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }

  async function removeFileFromIndex(fileId: string | number): Promise<void> {
    return service.withErrorContext(
      async () => {
        db.transaction(() => {
          db.prepare('DELETE FROM file_search_fts WHERE file_id = ?').run(String(fileId))
          db.prepare('DELETE FROM file_search_metadata WHERE file_id = ?').run(String(fileId))
          db.prepare('DELETE FROM file_keywords WHERE file_id = ?').run(String(fileId))
          db.prepare('DELETE FROM file_trigrams WHERE file_id = ?').run(String(fileId))
        })()
      },
      { action: 'remove-from-index', id: fileId }
    )
  }

  async function clearProjectIndex(projectId: number): Promise<void> {
    return service.withErrorContext(
      async () => {
        db.transaction(() => {
          // Get all file IDs for the project
          const fileIds = db
            .prepare('SELECT file_id FROM file_search_metadata WHERE project_id = ?')
            .all(projectId)
            .map((row: any) => row.file_id)

          // Delete from all tables
          for (const fileId of fileIds) {
            db.prepare('DELETE FROM file_search_fts WHERE file_id = ?').run(fileId)
            db.prepare('DELETE FROM file_search_metadata WHERE file_id = ?').run(fileId)
            db.prepare('DELETE FROM file_keywords WHERE file_id = ?').run(fileId)
            db.prepare('DELETE FROM file_trigrams WHERE file_id = ?').run(fileId)
          }
        })()
      },
      { action: 'clear-project-index', id: projectId }
    )
  }

  async function getIndexingStats(projectId: number): Promise<IndexingStats> {
    const stats = db
      .prepare(
        `
        SELECT 
          COUNT(*) as indexed_files,
          AVG(token_count) as avg_tokens,
          MAX(last_indexed) as last_indexed
        FROM file_search_metadata
        WHERE project_id = ?
      `
      )
      .get(projectId) as any

    const keywordCount = db
      .prepare(
        `
        SELECT COUNT(DISTINCT keyword) as count
        FROM file_keywords k
        JOIN file_search_metadata m ON k.file_id = m.file_id
        WHERE m.project_id = ?
      `
      )
      .get(projectId) as any

    return {
      totalFiles: 0, // Would need to query project files
      indexedFiles: stats?.indexed_files || 0,
      totalKeywords: keywordCount?.count || 0,
      avgTokensPerFile: Math.round(stats?.avg_tokens || 0),
      lastIndexed: stats?.last_indexed || null
    }
  }

  // Helper functions
  function preprocessContent(content: string): string {
    // Return original content - let FTS5 handle tokenization
    return content
  }

  function tokenize(content: string): string[] {
    // Pre-process to handle code patterns
    let processed = content
    processed = processed.replace(/([a-z])([A-Z])/g, '$1 $2')
    processed = processed.replace(/([a-zA-Z])(\d)/g, '$1 $2')
    processed = processed.replace(/(\d)([a-zA-Z])/g, '$1 $2')
    processed = processed.replace(/_/g, ' ')
    processed = processed.replace(/-/g, ' ')

    // Split on word boundaries
    const tokens = processed
      .toLowerCase()
      .split(/[\s\n\r\t.,;:!?\(\)\[\]{}"'`<>\/\\|@#$%^&*+=~-]+/)
      .filter((token) => token.length > 2 && token.length < 50)
      .filter((token) => !STOP_WORDS.has(token))

    // Also get original tokens
    const originalTokens = content
      .toLowerCase()
      .split(/[\s\n\r\t.,;:!?\(\)\[\]{}"'`<>\/\\|@#$%^&*+=~-]+/)
      .filter((token) => token.length > 2 && token.length < 50)
      .filter((token) => !STOP_WORDS.has(token))

    // Combine and deduplicate
    return [...new Set([...tokens, ...originalTokens])]
  }

  function extractKeywords(tokens: string[]): Array<{
    keyword: string
    frequency: number
    tfScore: number
    idfScore?: number
  }> {
    const frequencies = new Map<string, number>()

    for (const token of tokens) {
      frequencies.set(token, (frequencies.get(token) || 0) + 1)
    }

    const totalTokens = tokens.length
    return Array.from(frequencies.entries())
      .map(([keyword, frequency]) => ({
        keyword,
        frequency,
        tfScore: frequency / totalTokens
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 100) // Top 100 keywords
  }

  function calculateTfIdf(
    tokens: string[],
    keywords: Array<{ keyword: string; frequency: number; tfScore: number }>
  ): Record<string, number> {
    const vector: Record<string, number> = {}

    // For now, just use TF scores
    // IDF calculation would require corpus statistics
    for (const kw of keywords) {
      vector[kw.keyword] = kw.tfScore
    }
    
    return vector
  }

  function generateTrigrams(text: string): Array<[string, number]> {
    const trigrams: Array<[string, number]> = []
    const normalized = text.toLowerCase()

    for (let i = 0; i <= normalized.length - 3; i++) {
      const trigram = normalized.slice(i, i + 3)
      if (!/\s{2,}/.test(trigram)) {
        // Skip trigrams with multiple spaces
        trigrams.push([trigram, i])
      }
    }

    return trigrams
  }

  function detectLanguage(extension: string | undefined): string {
    if (!extension) return 'unknown'

    const languageMap: Record<string, string> = {
      ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
      py: 'python', java: 'java', cpp: 'cpp', c: 'c', cs: 'csharp',
      go: 'go', rs: 'rust', php: 'php', rb: 'ruby', swift: 'swift',
      kt: 'kotlin', scala: 'scala', r: 'r', sql: 'sql', sh: 'shell',
      bash: 'shell', ps1: 'powershell', lua: 'lua', dart: 'dart',
      julia: 'julia', ml: 'ocaml', hs: 'haskell', ex: 'elixir',
      clj: 'clojure', elm: 'elm', vue: 'vue', svelte: 'svelte'
    }

    return languageMap[extension.toLowerCase()] || 'text'
  }

  function getFileExtension(filePath: string): string {
    return filePath.split('.').pop() || ''
  }

  function getFileMetadata(
    fileId: string | number,
    statements: any
  ): {
    last_indexed: number
    token_count: number
    language: string
  } | null {
    return statements.getFileMetadata.get(fileId) as any
  }

  return {
    // Core functionality
    indexFile,
    indexFiles,
    indexFilesWithProgress,
    removeFileFromIndex,
    clearProjectIndex,
    getIndexingStats,

    // Service metadata
    serviceName: service.serviceName,
    config: service.config,

    // Cleanup
    destroy: service.destroy
  }
}

// Export types
export type FileIndexingService = ReturnType<typeof createFileIndexingService>

// Export singleton for backward compatibility
export const fileIndexingService = createFileIndexingService()

// Export individual functions for tree-shaking
export const {
  indexFile,
  indexFiles,
  indexFilesWithProgress,
  removeFileFromIndex,
  clearProjectIndex,
  getIndexingStats
} = fileIndexingService