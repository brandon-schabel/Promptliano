-- Authentication tables migration
-- Create auth_settings table
CREATE TABLE IF NOT EXISTS `auth_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`auth_enabled` integer DEFAULT true NOT NULL,
	`require_password` integer DEFAULT false NOT NULL,
	`session_timeout` integer DEFAULT 604800000 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint

-- Create users table
CREATE TABLE IF NOT EXISTS `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`email` text,
	`password_hash` text,
	`role` text DEFAULT 'user' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `users_username_unique` ON `users` (`username`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `users_username_idx` ON `users` (`username`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `users_role_idx` ON `users` (`role`);
--> statement-breakpoint

-- Create refresh_tokens table
CREATE TABLE IF NOT EXISTS `refresh_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `refresh_tokens_token_unique` ON `refresh_tokens` (`token`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `refresh_tokens_token_idx` ON `refresh_tokens` (`token`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `refresh_tokens_user_idx` ON `refresh_tokens` (`user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `refresh_tokens_expires_idx` ON `refresh_tokens` (`expires_at`);
