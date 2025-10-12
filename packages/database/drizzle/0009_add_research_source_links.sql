CREATE TABLE IF NOT EXISTS `research_source_links` (
  `id` integer PRIMARY KEY AUTOINCREMENT,
  `source_id` integer NOT NULL,
  `url` text NOT NULL,
  `title` text,
  `status` text NOT NULL DEFAULT 'pending',
  `depth` integer,
  `parent_url` text,
  `relevance_score` real,
  `token_count` integer,
  `discovered_at` integer NOT NULL,
  `crawl_session_id` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`source_id`) REFERENCES `research_sources`(`id`) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS `research_source_links_source_url_idx`
  ON `research_source_links` (`source_id`, `url`);

CREATE INDEX IF NOT EXISTS `research_source_links_source_discovered_idx`
  ON `research_source_links` (`source_id`, `discovered_at` DESC);
