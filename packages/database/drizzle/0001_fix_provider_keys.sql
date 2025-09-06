-- Fix provider_keys table to remove encrypted_value constraint
-- and ensure plain text key column exists

-- Make encrypted_value nullable (remove NOT NULL constraint)
-- SQLite doesn't support ALTER COLUMN, so we need to recreate the table

-- Create temporary table with new schema
CREATE TABLE `provider_keys_new` (
	`id` integer PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`key_name` text NOT NULL,
	`name` text,
	`secret_ref` text,
	`key` text,
	`base_url` text,
	`custom_headers` text DEFAULT '{}',
	`is_default` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`environment` text DEFAULT 'production' NOT NULL,
	`description` text,
	`expires_at` integer,
	`last_used` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	-- Keep encrypted_value for backward compatibility but nullable
	`encrypted_value` text,
	`encrypted` integer DEFAULT false,
	`iv` text,
	`tag` text,
	`salt` text
);

-- Copy existing data
INSERT INTO `provider_keys_new` 
SELECT 
	id,
	provider,
	key_name,
	name,
	secret_ref,
	key,
	base_url,
	custom_headers,
	is_default,
	is_active,
	environment,
	description,
	expires_at,
	last_used,
	created_at,
	updated_at,
	encrypted_value,
	encrypted,
	iv,
	tag,
	salt
FROM `provider_keys`;

-- Drop old table
DROP TABLE `provider_keys`;

-- Rename new table
ALTER TABLE `provider_keys_new` RENAME TO `provider_keys`;

-- Recreate indexes
CREATE INDEX `provider_keys_provider_idx` ON `provider_keys` (`provider`);
CREATE INDEX `provider_keys_key_name_idx` ON `provider_keys` (`key_name`);
CREATE INDEX `provider_keys_name_idx` ON `provider_keys` (`name`);
CREATE INDEX `provider_keys_active_idx` ON `provider_keys` (`is_active`);
CREATE INDEX `provider_keys_default_idx` ON `provider_keys` (`is_default`);
CREATE INDEX `provider_keys_environment_idx` ON `provider_keys` (`environment`);