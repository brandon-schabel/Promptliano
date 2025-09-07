# File Search Transition Plan

This document outlines a clean transition to a simpler, more reliable file search while keeping the existing API surface compatible. It proposes replacing the multi-table, index-heavy approach with a primary ripgrep backend and a minimal SQLite FTS fallback. It also enumerates what can be removed (files, DB tables, and code paths), and provides a migration plan and rollout strategy.

## Goals
- Preserve API: keep `createFileSearchService()` and `search(projectId, options)` signatures and return shapes (`SearchResult`, `SearchStats`).
- Drastically reduce code and moving parts (no multi-table index maintenance, no custom TF/trigram/DB cache layers).
- Improve reliability: search works without pre-indexing, defaulting to `ripgrep` with a minimal FTS or LIKE fallback.

## Target Architecture
- Backends (selected at runtime, ordered by preference):
  - ripgrep backend (primary): spawn `rg` with `--json`, parse streaming results, rank simply, return context.
  - FTS minimal backend (fallback): a single FTS5 table with BM25 ranking and `snippet(...)`.
  - LIKE fallback (last resort): `files.content LIKE ?` + filename boost when FTS/ripgrep are unavailable.
- Factory: `createFileSearchService` detects backend by env (`FILE_SEARCH_BACKEND=rg|fts|like`) and availability (e.g., `rg` on PATH). API stays the same.

## What Can Be Removed
Two removal modes are supported. Choose A (ripgrep-only) for the simplest system, or B (ripgrep primary + minimal FTS fallback) to keep a DB-based fallback.

### A) Ripgrep-only (remove all search-specific tables and indexing code)
- DB tables to DROP:
  - `file_search_fts`
  - `file_search_metadata`
  - `file_keywords`
  - `file_trigrams`
  - `search_cache`
  - Related indexes: `idx_file_search_metadata_project`, `idx_file_search_metadata_indexed`, `idx_file_keywords_keyword`, `idx_search_cache_expires`.
- Service files/code to remove or replace:
  - Remove: `packages/services/src/file-services/file-indexing-service.ts` (no DB index to maintain).
  - Remove: custom trigram/keyword/TF scoring utilities embedded in `file-search-service.ts`.
  - Remove: DB search cache logic and prepared statements in `file-search-service.ts`.
  - Remove: `ensureIndexed()` and any dependency on `fileIndexingService`.
  - Remove: calls to `fileIndexingService.indexFiles(...)`, `removeFileFromIndex(...)`, and `clearProjectIndex(...)` from `file-sync-service-unified.ts`.
- Tests to delete or rewrite:
  - `packages/services/src/file-search-service.test.ts` sections that assert trigram/TF/DB cache behavior. Replace with ripgrep/FTS/LIKE backend tests.

### B) Ripgrep primary + minimal FTS fallback (keep 1 FTS table; remove the rest)
- DB tables to KEEP:
  - `file_search_fts` only.
- DB tables to DROP:
  - `file_search_metadata`
  - `file_keywords`
  - `file_trigrams`
  - `search_cache`
  - Related indexes: `idx_file_search_metadata_project`, `idx_file_search_metadata_indexed`, `idx_file_keywords_keyword`, `idx_search_cache_expires`.
- Service files/code to remove or replace:
  - Replace `file-indexing-service.ts` with a minimal seeding approach OR DB triggers (recommended) that keep `file_search_fts` in sync with the `files` table (no separate indexing passes).
  - Remove trigram/keyword/TF scoring and DB cache from `file-search-service.ts`. Prefer `bm25(file_search_fts)` and `snippet(...)` only.
  - Remove `ensureIndexed()` and the dependency on `fileIndexingService`. FTS sync is handled in DB triggers or in a very small “on-demand upsert” helper.
  - Remove references to `fileIndexingService.*` from `file-sync-service-unified.ts`.
- Tests to delete or rewrite:
  - As above, remove tests asserting trigram/TF/DB cache behavior; add tests that validate BM25 ordering and ripgrep fallback.

## New Files to Add
- `packages/services/src/file-services/backends/file-search-rg.ts`
  - Spawns `rg` with `--json`, `--line-number`, `--column`, `--hidden` (plus glob filters for `fileTypes`), and parses streaming results.
  - Supports `searchType` mapping:
    - `exact` → add `-F` (fixed strings), toggle `-i` for case-insensitive.
    - `regex` → default regex mode, toggle `-i` for case-insensitive.
    - `fuzzy` → applies fuzzy search against filenames only (in-memory), then optionally runs rg to fetch line matches for the filtered set.
    - `semantic` → alias to `exact`/`regex` or to FTS backend when present.
  - Produces `SearchResult[]` with simple scoring (filename boost + match count).

- `packages/services/src/file-services/backends/file-search-fts-min.ts`
  - A minimal FTS5 backend using just one table and BM25 ranking:
    ```sql
    CREATE VIRTUAL TABLE IF NOT EXISTS file_search_fts USING fts5(
      file_id UNINDEXED,
      project_id UNINDEXED,
      path,
      content,
      tokenize = 'porter'
    );
    ```
  - Query pattern:
    ```sql
    SELECT 
      file_id,
      path,
      bm25(file_search_fts) AS rank,
      snippet(file_search_fts, 3, '<match>', '</match>', '...', 64) AS snippet
    FROM file_search_fts
    WHERE project_id = ? AND file_search_fts MATCH ?
    ORDER BY rank
    LIMIT ? OFFSET ?;
    ```

- Optional: `packages/services/src/file-services/backends/lru.ts` (tiny in-memory LRU cache for small, short-lived query results; no DB cache).

## Factory Selection (unchanged API)
- `createFileSearchService` remains the entry point; internal backend selection:
  - `FILE_SEARCH_BACKEND=rg|fts|like` (default `rg`).
  - If `rg` not available, fall back to `fts` if `file_search_fts` exists, else `like`.
- Keep named exports aliasing to the new implementation: `search`, `searchByTicket`, `searchByKeywords`.

## Database Migration

### If choosing A) Ripgrep-only
- Drizzle migration (SQLite) to drop tables:
  ```sql
  DROP TABLE IF EXISTS search_cache;
  DROP TABLE IF EXISTS file_keywords;
  DROP TABLE IF EXISTS file_trigrams;
  DROP TABLE IF EXISTS file_search_metadata;
  DROP TABLE IF EXISTS file_search_fts;
  -- Drop related indexes if they exist (defensive)
  DROP INDEX IF EXISTS idx_search_cache_expires;
  DROP INDEX IF EXISTS idx_file_keywords_keyword;
  DROP INDEX IF EXISTS idx_file_search_metadata_project;
  DROP INDEX IF EXISTS idx_file_search_metadata_indexed;
  ```
- No new tables required.

### If choosing B) Ripgrep + minimal FTS fallback
- Drizzle migration (SQLite) to drop tables except FTS:
  ```sql
  DROP TABLE IF EXISTS search_cache;
  DROP TABLE IF EXISTS file_keywords;
  DROP TABLE IF EXISTS file_trigrams;
  DROP TABLE IF EXISTS file_search_metadata;
  DROP INDEX IF EXISTS idx_search_cache_expires;
  DROP INDEX IF EXISTS idx_file_keywords_keyword;
  DROP INDEX IF EXISTS idx_file_search_metadata_project;
  DROP INDEX IF EXISTS idx_file_search_metadata_indexed;
  ```
- Create or ensure minimal FTS table:
  ```sql
  CREATE VIRTUAL TABLE IF NOT EXISTS file_search_fts USING fts5(
    file_id UNINDEXED,
    project_id UNINDEXED,
    path,
    content,
    tokenize = 'porter'
  );
  ```
- Recommended: keep FTS in sync with the `files` table via triggers (no separate indexer):
  ```sql
  CREATE TRIGGER IF NOT EXISTS files_ai AFTER INSERT ON files BEGIN
    DELETE FROM file_search_fts WHERE file_id = NEW.id;
    INSERT INTO file_search_fts(file_id, project_id, path, content)
    VALUES (NEW.id, NEW.project_id, NEW.path, NEW.content);
  END;

  CREATE TRIGGER IF NOT EXISTS files_au AFTER UPDATE OF content, path, project_id ON files BEGIN
    DELETE FROM file_search_fts WHERE file_id = NEW.id;
    INSERT INTO file_search_fts(file_id, project_id, path, content)
    VALUES (NEW.id, NEW.project_id, NEW.path, NEW.content);
  END;

  CREATE TRIGGER IF NOT EXISTS files_ad AFTER DELETE ON files BEGIN
    DELETE FROM file_search_fts WHERE file_id = OLD.id;
  END;
  ```

## Code Changes (high level)

- `packages/services/src/file-services/file-search-service.ts`
  - Keep the exported API, but internally route to the selected backend.
  - Remove: cache table usage, trigram/keyword/TF scoring, `ensureIndexed`, index coverage, and “debug FTS metadata” relying on dropped tables.
  - Keep: `searchByTicket`, `searchByKeywords` as thin wrappers.

- `packages/services/src/file-services/file-indexing-service.ts`
  - Option A (ripgrep-only): delete this file and remove imports.
  - Option B (rg + FTS): replace with a tiny helper that ensures the FTS table exists; prefer DB triggers to keep FTS synced. No batch indexing needed.

- `packages/services/src/file-services/file-sync-service-unified.ts`
  - Remove or guard calls to `fileIndexingService.indexFiles(...)`, `removeFileFromIndex(...)`, `clearProjectIndex(...)` behind backend detection. For B (triggers), these become no-ops and can be removed.

- `packages/server/src/mcp/tools/project/project-manager.tool.ts`
  - No changes required; it calls `createFileSearchService().search(...)` and will transparently use the new backend.

- Tests
  - Adapt `packages/services/src/file-search-service.test.ts` to validate:
    - ripgrep backend (skip if `rg` not found).
    - minimal FTS fallback with BM25.
    - LIKE fallback for environments without `rg`/FTS.
  - Remove tests depending on trigram/TF/cache internals.

## Example: ripgrep backend sketch

```ts
// packages/services/src/file-services/backends/file-search-rg.ts
import { spawn } from 'node:child_process'
import { once } from 'node:events'

export async function searchWithRipgrep(projectPath: string, query: string, opts: {
  caseSensitive?: boolean
  exact?: boolean
  regex?: boolean
  limit?: number
  fileGlobs?: string[]
}) {
  const args = [
    '--json', '--line-number', '--column', '--hidden', '--max-columns', '200',
    opts.caseSensitive ? '-S' : '-i',
  ]
  if (opts.exact) args.push('-F')
  // Add file glob filters
  for (const g of opts.fileGlobs || []) args.push('--glob', g)
  args.push(query, projectPath)

  const rg = spawn('rg', args, { stdio: ['ignore', 'pipe', 'inherit'] })
  const results: any[] = []

  rg.stdout.setEncoding('utf8')
  for await (const chunk of rg.stdout) {
    for (const line of String(chunk).split('\n')) {
      if (!line.trim()) continue
      try {
        const evt = JSON.parse(line)
        if (evt.type === 'match') results.push(evt)
      } catch {}
    }
    if (opts.limit && results.length >= opts.limit) rg.kill('SIGTERM')
  }
  await once(rg, 'close')

  // Map to SearchResult shape, apply simple scoring
  return results
}
```

## Rollout Plan
- Phase 1 (additive):
  - Add new backends and factory selection; default to ripgrep with automatic fallback.
  - Keep old code intact behind a feature flag (`FILE_SEARCH_BACKEND=legacy`) to compare.
- Phase 2 (switch default):
  - Make `rg` the default. Start removing codepaths that are now unused (trigram/TF/cache).
- Phase 3 (cleanup + DB migration):
  - Run the chosen DB migration (A or B) to drop unneeded tables/indexes.
  - Remove `file-indexing-service.ts` or shrink it to the minimal helper (if using triggers).

## Operational Notes
- Env flags:
  - `FILE_SEARCH_BACKEND=rg|fts|like|legacy` (default `rg`).
  - `FILE_SEARCH_RIPGREP_PATH` (optional), to set a custom path to `rg` if not on PATH; otherwise use `@vscode/ripgrep` as a vendored binary.
- Performance expectations:
  - ripgrep: sub-second searches on large repos, respects .gitignore, minimal memory.
  - FTS minimal: fast, but requires content duplication; triggers avoid batch re-indexing complexity.

## Checklist
- [ ] Add ripgrep backend file and factory selection.
- [ ] Add minimal FTS backend and (optional) DB triggers.
- [ ] Remove tables (A: all five; B: keep `file_search_fts`, drop the rest).
- [ ] Remove `file-indexing-service.ts` or replace with minimal helper.
- [ ] Remove trigram/TF/cache logic and `ensureIndexed()` from `file-search-service.ts`.
- [ ] Remove indexer calls from `file-sync-service-unified.ts`.
- [ ] Update tests to validate rg/FTS/LIKE paths.
- [ ] Document env flags and rollout in README.

## Rollback
- Set `FILE_SEARCH_BACKEND=legacy` to revert to the current implementation while code remains.
- If you already dropped tables, restore from backup or re-run the legacy table creation scripts before flipping back.

---

This plan minimizes code, removes fragile indexing layers, and improves reliability while keeping your search API stable.
