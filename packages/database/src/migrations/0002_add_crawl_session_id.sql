-- Migration: Add crawl_session_id column to urls table
-- This enables tracking which crawl session a URL belongs to
-- Applied to: /Users/brandon/Programming/promptliano/data/promptliano.db
-- Date: 2025-10-11

-- Add crawl_session_id to urls table
ALTER TABLE urls ADD COLUMN crawl_session_id TEXT;

-- Note: crawled_content table already has crawl_session_id column in schema
-- This migration was applied manually via: sqlite3 data/promptliano.db "ALTER TABLE urls ADD COLUMN crawl_session_id TEXT;"
