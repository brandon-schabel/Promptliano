CREATE TABLE `research_document_sections` (
	`id` integer PRIMARY KEY NOT NULL,
	`research_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`content` text,
	`order_index` integer NOT NULL,
	`level` integer DEFAULT 1,
	`parent_section_id` integer,
	`cited_source_ids` text DEFAULT '[]',
	`status` text DEFAULT 'pending' NOT NULL,
	`word_count` integer,
	`token_count` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`research_id`) REFERENCES `research_records`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `research_document_sections_research_id_idx` ON `research_document_sections` (`research_id`);--> statement-breakpoint
CREATE INDEX `research_document_sections_order_idx` ON `research_document_sections` (`order_index`);--> statement-breakpoint
CREATE TABLE `research_exports` (
	`id` integer PRIMARY KEY NOT NULL,
	`research_id` integer NOT NULL,
	`format` text NOT NULL,
	`filename` text NOT NULL,
	`size` integer,
	`download_url` text,
	`download_count` integer DEFAULT 0,
	`content` text,
	`created_at` integer NOT NULL,
	`expires_at` integer,
	FOREIGN KEY (`research_id`) REFERENCES `research_records`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `research_exports_research_id_idx` ON `research_exports` (`research_id`);--> statement-breakpoint
CREATE TABLE `research_processed_data` (
	`id` integer PRIMARY KEY NOT NULL,
	`source_id` integer NOT NULL,
	`research_id` integer NOT NULL,
	`raw_content` text,
	`cleaned_content` text,
	`markdown` text,
	`summary` text,
	`title` text,
	`excerpt` text,
	`author` text,
	`publish_date` integer,
	`keywords` text DEFAULT '[]',
	`entities` text DEFAULT '[]',
	`token_count` integer,
	`relevance_score` real,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `research_sources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`research_id`) REFERENCES `research_records`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `research_processed_data_source_id_idx` ON `research_processed_data` (`source_id`);--> statement-breakpoint
CREATE INDEX `research_processed_data_research_id_idx` ON `research_processed_data` (`research_id`);--> statement-breakpoint
CREATE TABLE `research_records` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`topic` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'initializing' NOT NULL,
	`total_sources` integer DEFAULT 0,
	`processed_sources` integer DEFAULT 0,
	`sections_total` integer DEFAULT 0,
	`sections_completed` integer DEFAULT 0,
	`max_sources` integer DEFAULT 10,
	`max_depth` integer DEFAULT 3,
	`strategy` text DEFAULT 'balanced' NOT NULL,
	`metadata` text DEFAULT '{}',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `research_sources` (
	`id` integer PRIMARY KEY NOT NULL,
	`research_id` integer NOT NULL,
	`url` text NOT NULL,
	`title` text,
	`source_type` text DEFAULT 'web' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`content_length` integer,
	`token_count` integer,
	`cited` integer DEFAULT false,
	`citation_count` integer DEFAULT 0,
	`error_message` text,
	`retry_count` integer DEFAULT 0,
	`fetched_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`research_id`) REFERENCES `research_records`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `research_sources_research_id_idx` ON `research_sources` (`research_id`);--> statement-breakpoint
CREATE INDEX `research_sources_status_idx` ON `research_sources` (`status`);