CREATE TABLE `research_source_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` integer NOT NULL,
	`url` text NOT NULL,
	`title` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`depth` integer,
	`parent_url` text,
	`relevance_score` real,
	`token_count` integer,
	`discovered_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`crawl_session_id` text,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `research_sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `research_source_links_source_discovered_idx` ON `research_source_links` (`source_id`,`discovered_at`);--> statement-breakpoint
CREATE INDEX `research_source_links_source_url_idx` ON `research_source_links` (`source_id`,`url`);--> statement-breakpoint
ALTER TABLE `crawled_content` ADD `research_source_id` integer REFERENCES research_sources(id);--> statement-breakpoint
ALTER TABLE `crawled_content` ADD `depth` integer;--> statement-breakpoint
ALTER TABLE `crawled_content` ADD `crawl_session_id` text;--> statement-breakpoint
CREATE INDEX `crawled_content_research_source_idx` ON `crawled_content` (`research_source_id`);--> statement-breakpoint
CREATE INDEX `crawled_content_crawl_session_idx` ON `crawled_content` (`crawl_session_id`);--> statement-breakpoint
ALTER TABLE `research_sources` ADD `metadata` text DEFAULT '{}';--> statement-breakpoint
ALTER TABLE `urls` ADD `crawl_session_id` text;