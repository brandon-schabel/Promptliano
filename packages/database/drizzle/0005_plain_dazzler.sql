PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_prompts` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`description` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_prompts`("id", "project_id", "title", "content", "description", "tags", "created_at", "updated_at") SELECT "id", "project_id", "title", "content", "description", "tags", "created_at", "updated_at" FROM `prompts`;--> statement-breakpoint
DROP TABLE `prompts`;--> statement-breakpoint
ALTER TABLE `__new_prompts` RENAME TO `prompts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `prompts_project_idx` ON `prompts` (`project_id`);--> statement-breakpoint
CREATE INDEX `prompts_title_idx` ON `prompts` (`title`);--> statement-breakpoint
CREATE INDEX `prompts_tags_idx` ON `prompts` (`tags`);