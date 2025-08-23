CREATE TABLE `active_tabs` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`tab_type` text NOT NULL,
	`tab_data` text DEFAULT '{}' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`last_accessed_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `active_tabs_project_idx` ON `active_tabs` (`project_id`);--> statement-breakpoint
CREATE INDEX `active_tabs_type_idx` ON `active_tabs` (`tab_type`);--> statement-breakpoint
CREATE INDEX `active_tabs_active_idx` ON `active_tabs` (`is_active`);--> statement-breakpoint
CREATE INDEX `active_tabs_accessed_at_idx` ON `active_tabs` (`last_accessed_at`);--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` integer PRIMARY KEY NOT NULL,
	`chat_id` integer NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`chat_id`) REFERENCES `chats`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chat_messages_chat_idx` ON `chat_messages` (`chat_id`);--> statement-breakpoint
CREATE INDEX `chat_messages_role_idx` ON `chat_messages` (`role`);--> statement-breakpoint
CREATE INDEX `chat_messages_created_at_idx` ON `chat_messages` (`created_at`);--> statement-breakpoint
CREATE TABLE `chats` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`title` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chats_project_idx` ON `chats` (`project_id`);--> statement-breakpoint
CREATE INDEX `chats_updated_at_idx` ON `chats` (`updated_at`);--> statement-breakpoint
CREATE TABLE `claude_agents` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`instructions` text,
	`model` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `claude_agents_name_idx` ON `claude_agents` (`name`);--> statement-breakpoint
CREATE INDEX `claude_agents_model_idx` ON `claude_agents` (`model`);--> statement-breakpoint
CREATE INDEX `claude_agents_active_idx` ON `claude_agents` (`is_active`);--> statement-breakpoint
CREATE TABLE `claude_commands` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`command` text NOT NULL,
	`args` text DEFAULT '{}' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `claude_commands_project_idx` ON `claude_commands` (`project_id`);--> statement-breakpoint
CREATE INDEX `claude_commands_name_idx` ON `claude_commands` (`name`);--> statement-breakpoint
CREATE INDEX `claude_commands_active_idx` ON `claude_commands` (`is_active`);--> statement-breakpoint
CREATE TABLE `claude_hooks` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`hook_type` text NOT NULL,
	`trigger_event` text NOT NULL,
	`script` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `claude_hooks_project_idx` ON `claude_hooks` (`project_id`);--> statement-breakpoint
CREATE INDEX `claude_hooks_type_idx` ON `claude_hooks` (`hook_type`);--> statement-breakpoint
CREATE INDEX `claude_hooks_event_idx` ON `claude_hooks` (`trigger_event`);--> statement-breakpoint
CREATE INDEX `claude_hooks_active_idx` ON `claude_hooks` (`is_active`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`name` text NOT NULL,
	`path` text NOT NULL,
	`size` integer,
	`last_modified` integer,
	`content_type` text,
	`summary` text,
	`is_relevant` integer DEFAULT false,
	`relevance_score` real,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `files_project_idx` ON `files` (`project_id`);--> statement-breakpoint
CREATE INDEX `files_path_idx` ON `files` (`path`);--> statement-breakpoint
CREATE INDEX `files_name_idx` ON `files` (`name`);--> statement-breakpoint
CREATE INDEX `files_relevant_idx` ON `files` (`is_relevant`);--> statement-breakpoint
CREATE INDEX `files_score_idx` ON `files` (`relevance_score`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`path` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `projects_path_idx` ON `projects` (`path`);--> statement-breakpoint
CREATE INDEX `projects_name_idx` ON `projects` (`name`);--> statement-breakpoint
CREATE TABLE `prompts` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`description` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `prompts_project_idx` ON `prompts` (`project_id`);--> statement-breakpoint
CREATE INDEX `prompts_title_idx` ON `prompts` (`title`);--> statement-breakpoint
CREATE INDEX `prompts_tags_idx` ON `prompts` (`tags`);--> statement-breakpoint
CREATE TABLE `provider_keys` (
	`id` integer PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`key_name` text NOT NULL,
	`encrypted_value` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `provider_keys_provider_idx` ON `provider_keys` (`provider`);--> statement-breakpoint
CREATE INDEX `provider_keys_key_name_idx` ON `provider_keys` (`key_name`);--> statement-breakpoint
CREATE INDEX `provider_keys_active_idx` ON `provider_keys` (`is_active`);--> statement-breakpoint
CREATE TABLE `queue_items` (
	`id` integer PRIMARY KEY NOT NULL,
	`queue_id` integer NOT NULL,
	`item_type` text NOT NULL,
	`item_id` integer NOT NULL,
	`priority` integer DEFAULT 5 NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`agent_id` text,
	`error_message` text,
	`estimated_processing_time` integer,
	`actual_processing_time` integer,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`queue_id`) REFERENCES `queues`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `queue_items_queue_idx` ON `queue_items` (`queue_id`);--> statement-breakpoint
CREATE INDEX `queue_items_status_idx` ON `queue_items` (`status`);--> statement-breakpoint
CREATE INDEX `queue_items_priority_idx` ON `queue_items` (`priority`);--> statement-breakpoint
CREATE INDEX `queue_items_item_idx` ON `queue_items` (`item_type`,`item_id`);--> statement-breakpoint
CREATE INDEX `queue_items_agent_idx` ON `queue_items` (`agent_id`);--> statement-breakpoint
CREATE TABLE `queues` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`max_parallel_items` integer DEFAULT 1 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `queues_project_idx` ON `queues` (`project_id`);--> statement-breakpoint
CREATE INDEX `queues_name_idx` ON `queues` (`name`);--> statement-breakpoint
CREATE INDEX `queues_active_idx` ON `queues` (`is_active`);--> statement-breakpoint
CREATE TABLE `selected_files` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`file_id` text NOT NULL,
	`selected_at` integer NOT NULL,
	`selection_reason` text,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `selected_files_project_idx` ON `selected_files` (`project_id`);--> statement-breakpoint
CREATE INDEX `selected_files_file_idx` ON `selected_files` (`file_id`);--> statement-breakpoint
CREATE INDEX `selected_files_active_idx` ON `selected_files` (`is_active`);--> statement-breakpoint
CREATE INDEX `selected_files_selected_at_idx` ON `selected_files` (`selected_at`);--> statement-breakpoint
CREATE INDEX `selected_files_unique_project_file` ON `selected_files` (`project_id`,`file_id`);--> statement-breakpoint
CREATE TABLE `ticket_tasks` (
	`id` integer PRIMARY KEY NOT NULL,
	`ticket_id` integer NOT NULL,
	`content` text NOT NULL,
	`description` text,
	`suggested_file_ids` text DEFAULT '[]' NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	`estimated_hours` real,
	`dependencies` text DEFAULT '[]' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`agent_id` text,
	`suggested_prompt_ids` text DEFAULT '[]' NOT NULL,
	`queue_id` integer,
	`queue_position` integer,
	`queue_status` text,
	`queue_priority` integer,
	`queued_at` integer,
	`queue_started_at` integer,
	`queue_completed_at` integer,
	`queue_agent_id` text,
	`queue_error_message` text,
	`estimated_processing_time` integer,
	`actual_processing_time` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`queue_id`) REFERENCES `queues`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `ticket_tasks_ticket_idx` ON `ticket_tasks` (`ticket_id`);--> statement-breakpoint
CREATE INDEX `ticket_tasks_done_idx` ON `ticket_tasks` (`done`);--> statement-breakpoint
CREATE INDEX `ticket_tasks_order_idx` ON `ticket_tasks` (`ticket_id`,`order_index`);--> statement-breakpoint
CREATE INDEX `ticket_tasks_queue_idx` ON `ticket_tasks` (`queue_id`,`queue_position`);--> statement-breakpoint
CREATE INDEX `ticket_tasks_agent_idx` ON `ticket_tasks` (`agent_id`);--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`title` text NOT NULL,
	`overview` text,
	`status` text DEFAULT 'open' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`suggested_file_ids` text DEFAULT '[]' NOT NULL,
	`suggested_agent_ids` text DEFAULT '[]' NOT NULL,
	`suggested_prompt_ids` text DEFAULT '[]' NOT NULL,
	`queue_id` integer,
	`queue_position` integer,
	`queue_status` text,
	`queue_priority` integer,
	`queued_at` integer,
	`queue_started_at` integer,
	`queue_completed_at` integer,
	`queue_agent_id` text,
	`queue_error_message` text,
	`estimated_processing_time` integer,
	`actual_processing_time` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`queue_id`) REFERENCES `queues`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `tickets_project_idx` ON `tickets` (`project_id`);--> statement-breakpoint
CREATE INDEX `tickets_status_idx` ON `tickets` (`status`);--> statement-breakpoint
CREATE INDEX `tickets_priority_idx` ON `tickets` (`priority`);--> statement-breakpoint
CREATE INDEX `tickets_queue_idx` ON `tickets` (`queue_id`,`queue_position`);--> statement-breakpoint
CREATE INDEX `tickets_queue_status_idx` ON `tickets` (`queue_status`);--> statement-breakpoint
CREATE INDEX `tickets_created_at_idx` ON `tickets` (`created_at`);