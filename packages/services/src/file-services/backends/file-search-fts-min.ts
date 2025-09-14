import { rawDb } from '@promptliano/database'

export interface FtsMinResultItem {
  fileId: string
  path: string
  rank: number
  snippet?: string
}

export interface FtsMinOptions {
  limit?: number
  offset?: number
}

/**
 * Minimal FTS backend. Uses a single FTS5 table with bm25 ranking.
 * Falls back gracefully if the table isn’t present.
 */
export function searchWithFtsMin(
  projectId: number,
  query: string,
  opts: FtsMinOptions = {}
): { rows: FtsMinResultItem[] } {
  try {
    // Probe table existence
    rawDb.prepare('SELECT 1 FROM file_search_fts LIMIT 0').get()
  } catch {
    return { rows: [] }
  }

  // Build a basic MATCH query. Caller is expected to sanitize tokens.
  const limit = opts.limit ?? 100
  const offset = opts.offset ?? 0

  const sql = `
    SELECT 
      file_id as fileId,
      path,
      bm25(file_search_fts) AS rank,
      snippet(file_search_fts, 3, '<match>', '</match>', '...', 64) AS snippet
    FROM file_search_fts
    WHERE project_id = ? AND file_search_fts MATCH ?
    ORDER BY rank
    LIMIT ? OFFSET ?
  `

  const rows = rawDb.prepare(sql).all(projectId, query, limit, offset) as any[]
  return {
    rows: rows.map((r) => ({ fileId: String(r.fileId), path: r.path, rank: Number(r.rank), snippet: r.snippet }))
  }
}
