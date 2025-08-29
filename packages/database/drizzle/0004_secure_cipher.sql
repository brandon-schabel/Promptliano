CREATE TABLE `encryption_keys` (
	`id` integer PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`is_default` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
