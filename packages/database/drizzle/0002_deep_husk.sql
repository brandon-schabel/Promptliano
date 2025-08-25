ALTER TABLE `files` ADD `extension` text;--> statement-breakpoint
CREATE INDEX `files_extension_idx` ON `files` (`extension`);