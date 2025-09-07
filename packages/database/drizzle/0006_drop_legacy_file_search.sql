-- Drop legacy file search tables and indexes (ripgrep-only backend)
-- Safe to run multiple times; uses IF EXISTS guards

DROP TABLE IF EXISTS search_cache; --> statement-breakpoint
DROP TABLE IF EXISTS file_keywords; --> statement-breakpoint
DROP TABLE IF EXISTS file_trigrams; --> statement-breakpoint
DROP TABLE IF EXISTS file_search_metadata; --> statement-breakpoint
DROP TABLE IF EXISTS file_search_fts; --> statement-breakpoint

-- Drop related indexes defensively
DROP INDEX IF EXISTS idx_search_cache_expires; --> statement-breakpoint
DROP INDEX IF EXISTS idx_file_keywords_keyword; --> statement-breakpoint
DROP INDEX IF EXISTS idx_file_search_metadata_project; --> statement-breakpoint
DROP INDEX IF EXISTS idx_file_search_metadata_indexed; --> statement-breakpoint

