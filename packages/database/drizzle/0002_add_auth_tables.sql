-- Add authentication tables

-- Users table for authentication
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`email` text,
	`password_hash` text,
	`role` text DEFAULT 'user' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

-- Create unique index on username
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);

-- Create index for username lookups
CREATE INDEX `users_username_idx` ON `users` (`username`);

-- Create index for role filtering
CREATE INDEX `users_role_idx` ON `users` (`role`);

-- Refresh tokens for session management
CREATE TABLE `refresh_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

-- Create unique index on token
CREATE UNIQUE INDEX `refresh_tokens_token_unique` ON `refresh_tokens` (`token`);

-- Create index for token lookups
CREATE INDEX `refresh_tokens_token_idx` ON `refresh_tokens` (`token`);

-- Create index for user filtering
CREATE INDEX `refresh_tokens_user_idx` ON `refresh_tokens` (`user_id`);

-- Create index for expiry checking
CREATE INDEX `refresh_tokens_expires_idx` ON `refresh_tokens` (`expires_at`);

-- Global auth settings (singleton table)
CREATE TABLE `auth_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`auth_enabled` integer DEFAULT true NOT NULL,
	`require_password` integer DEFAULT false NOT NULL,
	`session_timeout` integer DEFAULT 604800000 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);