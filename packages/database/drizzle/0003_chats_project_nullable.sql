-- Make chats.project_id nullable to decouple chats from projects
-- SQLite requires table recreation to modify NOT NULL constraints
PRAGMA foreign_keys=off;
BEGIN TRANSACTION;

-- Create new table with project_id nullable
CREATE TABLE `chats_new` (
  `id` integer PRIMARY KEY,
  `project_id` integer,
  `title` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade
);

-- Copy existing data
INSERT INTO `chats_new` (`id`, `project_id`, `title`, `created_at`, `updated_at`)
SELECT `id`, `project_id`, `title`, `created_at`, `updated_at` FROM `chats`;

-- Replace old table
DROP TABLE `chats`;
ALTER TABLE `chats_new` RENAME TO `chats`;

-- Recreate index on project_id (optional, now supports NULLs)
CREATE INDEX IF NOT EXISTS `chats_project_idx` ON `chats` (`project_id`);

COMMIT;
PRAGMA foreign_keys=on;

