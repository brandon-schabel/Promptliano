-- Add metadata column if it does not exist
ALTER TABLE `research_sources` ADD COLUMN IF NOT EXISTS `metadata` text DEFAULT '{}' NOT NULL;

-- Ensure existing research_records metadata values are valid JSON blobs
UPDATE `research_records`
SET `metadata` = '{}'
WHERE `metadata` IS NULL OR substr(trim(`metadata`), 1, 1) != '{';

-- Initialize research_sources metadata values
UPDATE `research_sources`
SET `metadata` = '{}'
WHERE `metadata` IS NULL OR substr(trim(`metadata`), 1, 1) != '{';

