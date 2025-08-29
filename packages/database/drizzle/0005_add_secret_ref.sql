-- Add secret_ref column to provider_keys for env-based secret references
ALTER TABLE `provider_keys` ADD COLUMN `secret_ref` text;

