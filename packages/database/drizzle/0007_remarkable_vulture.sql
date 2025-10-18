PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_research_records` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer,
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
INSERT INTO `__new_research_records`("id", "project_id", "topic", "description", "status", "total_sources", "processed_sources", "sections_total", "sections_completed", "max_sources", "max_depth", "strategy", "metadata", "created_at", "updated_at", "completed_at") SELECT "id", "project_id", "topic", "description", "status", "total_sources", "processed_sources", "sections_total", "sections_completed", "max_sources", "max_depth", "strategy", "metadata", "created_at", "updated_at", "completed_at" FROM `research_records`;--> statement-breakpoint
DROP TABLE `research_records`;--> statement-breakpoint
ALTER TABLE `__new_research_records` RENAME TO `research_records`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `research_document_sections_research_order_idx` ON `research_document_sections` (`research_id`,`order_index`);--> statement-breakpoint
CREATE INDEX `research_document_sections_status_idx` ON `research_document_sections` (`status`);--> statement-breakpoint
CREATE INDEX `research_sources_research_status_idx` ON `research_sources` (`research_id`,`status`);--> statement-breakpoint
CREATE INDEX `research_sources_fetched_at_idx` ON `research_sources` (`fetched_at`);