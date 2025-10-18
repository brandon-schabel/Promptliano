-- Migration: Recreate crawled_content table to add crawl_session_id and research_source_id columns
-- This ensures the database schema matches the current Drizzle model definition.

-- Create the replacement table with the full schema
CREATE TABLE `crawled_content_new` (
  `id` integer PRIMARY KEY NOT NULL,
  `url_id` integer NOT NULL REFERENCES `urls`(`id`) ON DELETE CASCADE,
  `research_source_id` integer REFERENCES `research_sources`(`id`) ON DELETE SET NULL,
  `depth` integer,
  `title` text,
  `clean_content` text,
  `raw_html` text,
  `summary` text,
  `metadata` text DEFAULT '{}',
  `links` text DEFAULT '[]',
  `crawl_session_id` text,
  `crawled_at` integer NOT NULL
);

-- Copy data from the existing table, applying sensible defaults for the new columns
INSERT INTO `crawled_content_new` (
  `id`,
  `url_id`,
  `research_source_id`,
  `depth`,
  `title`,
  `clean_content`,
  `raw_html`,
  `summary`,
  `metadata`,
  `links`,
  `crawl_session_id`,
  `crawled_at`
)
SELECT
  `id`,
  `url_id`,
  NULL AS `research_source_id`,
  NULL AS `depth`,
  `title`,
  `clean_content`,
  `raw_html`,
  `summary`,
  COALESCE(`metadata`, '{}') AS `metadata`,
  COALESCE(`links`, '[]') AS `links`,
  NULL AS `crawl_session_id`,
  `crawled_at`
FROM `crawled_content`;

-- Replace the old table
DROP TABLE "crawled_content";
ALTER TABLE "crawled_content_new" RENAME TO "crawled_content";

-- Recreate indexes to match the schema expectations
CREATE INDEX IF NOT EXISTS `crawled_content_url_idx` ON `crawled_content`(`url_id`);
CREATE INDEX IF NOT EXISTS `crawled_content_research_source_idx` ON `crawled_content`(`research_source_id`);
CREATE INDEX IF NOT EXISTS `crawled_content_crawl_session_idx` ON `crawled_content`(`crawl_session_id`);

