-- Migration: Recreate urls table with proper schema format
-- This fixes the ALTER TABLE formatting issue where crawl_session_id lacks backticks

-- Create new table with proper schema
CREATE TABLE `urls_new` (
	`id` integer PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`url_hash` text NOT NULL,
	`domain` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`http_status` integer,
	`last_crawled_at` integer,
	`next_crawl_at` integer,
	`crawl_session_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

-- Copy data from old table
INSERT INTO `urls_new`
SELECT
  `id`,
  `url`,
  `url_hash`,
  `domain`,
  `status`,
  `http_status`,
  `last_crawled_at`,
  `next_crawl_at`,
  `crawl_session_id`,
  `created_at`,
  `updated_at`
FROM `urls`;

-- Drop old table
DROP TABLE `urls`;

-- Rename new table
ALTER TABLE `urls_new` RENAME TO `urls`;

-- Recreate indexes
CREATE UNIQUE INDEX IF NOT EXISTS `urls_url_hash_idx` ON `urls`(`url_hash`);
CREATE INDEX IF NOT EXISTS `urls_domain_idx` ON `urls`(`domain`);
CREATE INDEX IF NOT EXISTS `urls_status_idx` ON `urls`(`status`);
CREATE INDEX IF NOT EXISTS `urls_next_crawl_idx` ON `urls`(`next_crawl_at`);
