-- Drop summary-related columns from files table by recreating the table (SQLite limitation)
PRAGMA foreign_keys=off;
BEGIN TRANSACTION;

-- Create new files table without summary columns
CREATE TABLE `files_new` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` integer NOT NULL,
  `name` text NOT NULL,
  `path` text NOT NULL,
  `extension` text,
  `size` integer,
  `last_modified` integer,
  `content_type` text,
  `content` text,
  `meta` text,
  `checksum` text,
  `imports` text,
  `exports` text,
  `is_relevant` integer DEFAULT false,
  `relevance_score` real,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade
);

-- Copy data excluding removed columns
INSERT INTO `files_new` (
  `id`, `project_id`, `name`, `path`, `extension`, `size`, `last_modified`, `content_type`, `content`,
  `meta`, `checksum`, `imports`, `exports`, `is_relevant`, `relevance_score`, `created_at`, `updated_at`
)
SELECT
  `id`, `project_id`, `name`, `path`, `extension`, `size`, `last_modified`, `content_type`, `content`,
  `meta`, `checksum`, `imports`, `exports`, `is_relevant`, `relevance_score`, `created_at`, `updated_at`
FROM `files`;

-- Replace old table
DROP TABLE `files`;
ALTER TABLE `files_new` RENAME TO `files`;

COMMIT;
PRAGMA foreign_keys=on;

