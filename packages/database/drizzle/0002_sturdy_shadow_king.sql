CREATE TABLE `model_configs` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`display_name` text,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`temperature` real DEFAULT 0.7,
	`max_tokens` integer DEFAULT 4096,
	`top_p` real DEFAULT 1,
	`top_k` integer DEFAULT 0,
	`frequency_penalty` real DEFAULT 0,
	`presence_penalty` real DEFAULT 0,
	`response_format` text,
	`is_system_preset` integer DEFAULT false NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`user_id` integer,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `model_configs_name_idx` ON `model_configs` (`name`);--> statement-breakpoint
CREATE INDEX `model_configs_provider_idx` ON `model_configs` (`provider`);--> statement-breakpoint
CREATE INDEX `model_configs_is_default_idx` ON `model_configs` (`is_default`);--> statement-breakpoint
CREATE INDEX `model_configs_user_idx` ON `model_configs` (`user_id`);--> statement-breakpoint
CREATE TABLE `model_presets` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`config_id` integer NOT NULL,
	`category` text DEFAULT 'general',
	`is_system_preset` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`user_id` integer,
	`usage_count` integer DEFAULT 0 NOT NULL,
	`last_used_at` integer,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`config_id`) REFERENCES `model_configs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `model_presets_category_idx` ON `model_presets` (`category`);--> statement-breakpoint
CREATE INDEX `model_presets_config_idx` ON `model_presets` (`config_id`);--> statement-breakpoint
CREATE INDEX `model_presets_user_idx` ON `model_presets` (`user_id`);--> statement-breakpoint
CREATE INDEX `model_presets_usage_idx` ON `model_presets` (`usage_count`);