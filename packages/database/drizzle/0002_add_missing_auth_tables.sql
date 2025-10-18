-- Add missing authentication tables

-- Refresh tokens for session management
CREATE TABLE IF NOT EXISTS `refresh_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

-- Create unique index on token
CREATE UNIQUE INDEX IF NOT EXISTS `refresh_tokens_token_unique` ON `refresh_tokens` (`token`);

-- Create index for token lookups
CREATE INDEX IF NOT EXISTS `refresh_tokens_token_idx` ON `refresh_tokens` (`token`);

-- Create index for user filtering
CREATE INDEX IF NOT EXISTS `refresh_tokens_user_idx` ON `refresh_tokens` (`user_id`);

-- Create index for expiry checking
CREATE INDEX IF NOT EXISTS `refresh_tokens_expires_idx` ON `refresh_tokens` (`expires_at`);

-- Global auth settings (singleton table)
CREATE TABLE IF NOT EXISTS `auth_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`auth_enabled` integer DEFAULT true NOT NULL,
	`require_password` integer DEFAULT false NOT NULL,
	`session_timeout` integer DEFAULT 604800000 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);