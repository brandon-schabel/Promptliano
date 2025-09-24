CREATE TABLE IF NOT EXISTS `chat_streams` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`chat_id` integer NOT NULL,
	`direction` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`finish_reason` text,
	`usage_json` text,
	`message_metadata_json` text,
	`format` text NOT NULL DEFAULT 'ui',
	`version` integer NOT NULL DEFAULT 1,
	`assistant_message_id` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`chat_id`) REFERENCES `chats`(`id`) ON DELETE cascade,
	FOREIGN KEY (`assistant_message_id`) REFERENCES `chat_messages`(`id`) ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `chat_stream_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`stream_id` integer NOT NULL,
	`seq` integer NOT NULL,
	`ts` integer NOT NULL,
	`type` text NOT NULL,
	`payload` text,
	FOREIGN KEY (`stream_id`) REFERENCES `chat_streams`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_chat_streams_chat_started` ON `chat_streams` (`chat_id`,`started_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_chat_stream_events_stream_seq` ON `chat_stream_events` (`stream_id`,`seq`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_chat_stream_events_type` ON `chat_stream_events` (`type`);
