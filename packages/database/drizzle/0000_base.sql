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
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `files_project_idx` ON `files` (`project_id`);--> statement-breakpoint
CREATE INDEX `files_path_idx` ON `files` (`path`);--> statement-breakpoint
CREATE INDEX `files_name_idx` ON `files` (`name`);--> statement-breakpoint
CREATE INDEX `files_relevant_idx` ON `files` (`is_relevant`);--> statement-breakpoint
CREATE INDEX `files_score_idx` ON `files` (`relevance_score`);--> statement-breakpoint
CREATE INDEX `files_extension_idx` ON `files` (`extension`);--> statement-breakpoint
CREATE INDEX `files_checksum_idx` ON `files` (`checksum`);--> statement-breakpoint
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
	`project_id` integer,
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
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `provider_keys_provider_idx` ON `provider_keys` (`provider`);--> statement-breakpoint
CREATE INDEX `provider_keys_key_name_idx` ON `provider_keys` (`key_name`);--> statement-breakpoint
CREATE INDEX `provider_keys_active_idx` ON `provider_keys` (`is_active`);--> statement-breakpoint
CREATE INDEX `provider_keys_default_idx` ON `provider_keys` (`is_default`);--> statement-breakpoint
CREATE INDEX `provider_keys_environment_idx` ON `provider_keys` (`environment`);--> statement-breakpoint
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
	`status` text DEFAULT 'pending' NOT NULL,
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
CREATE INDEX `ticket_tasks_status_idx` ON `ticket_tasks` (`status`);--> statement-breakpoint
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
CREATE INDEX `tickets_created_at_idx` ON `tickets` (`created_at`);CREATE TABLE `ai_sdk_options` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`name` text NOT NULL,
	`ollama_url` text,
	`lmstudio_url` text,
	`temperature` real,
	`max_tokens` integer,
	`top_p` real,
	`frequency_penalty` real,
	`presence_penalty` real,
	`top_k` integer,
	`stop` text,
	`response_format` text,
	`provider` text,
	`model` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_sdk_options_project_idx` ON `ai_sdk_options` (`project_id`);--> statement-breakpoint
CREATE INDEX `ai_sdk_options_name_idx` ON `ai_sdk_options` (`name`);--> statement-breakpoint
CREATE INDEX `ai_sdk_options_provider_idx` ON `ai_sdk_options` (`provider`);--> statement-breakpoint
CREATE INDEX `ai_sdk_options_model_idx` ON `ai_sdk_options` (`model`);--> statement-breakpoint
CREATE TABLE `claude_messages` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`type` text NOT NULL,
	`message` text,
	`timestamp` text NOT NULL,
	`session_id` text NOT NULL,
	`uuid` text,
	`parent_uuid` text,
	`request_id` text,
	`user_type` text,
	`is_sidechain` integer DEFAULT false,
	`cwd` text,
	`version` text,
	`git_branch` text,
	`tool_use_result` text,
	`content` text,
	`is_meta` integer DEFAULT false,
	`tool_use_id` text,
	`level` text,
	`tokens_used` integer,
	`cost_usd` real,
	`duration_ms` integer,
	`model` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `claude_messages_project_idx` ON `claude_messages` (`project_id`);--> statement-breakpoint
CREATE INDEX `claude_messages_session_idx` ON `claude_messages` (`session_id`);--> statement-breakpoint
CREATE INDEX `claude_messages_type_idx` ON `claude_messages` (`type`);--> statement-breakpoint
CREATE INDEX `claude_messages_timestamp_idx` ON `claude_messages` (`timestamp`);--> statement-breakpoint
CREATE INDEX `claude_messages_uuid_idx` ON `claude_messages` (`uuid`);--> statement-breakpoint
CREATE INDEX `claude_messages_parent_uuid_idx` ON `claude_messages` (`parent_uuid`);--> statement-breakpoint
CREATE TABLE `claude_session_metadata` (
	`id` integer PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`project_path` text NOT NULL,
	`start_time` text NOT NULL,
	`last_update` text NOT NULL,
	`message_count` integer NOT NULL,
	`file_size` integer NOT NULL,
	`has_git_branch` integer DEFAULT false NOT NULL,
	`has_cwd` integer DEFAULT false NOT NULL,
	`first_message_preview` text,
	`last_message_preview` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `claude_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `claude_session_metadata_session_idx` ON `claude_session_metadata` (`session_id`);--> statement-breakpoint
CREATE INDEX `claude_session_metadata_project_path_idx` ON `claude_session_metadata` (`project_path`);--> statement-breakpoint
CREATE INDEX `claude_session_metadata_last_update_idx` ON `claude_session_metadata` (`last_update`);--> statement-breakpoint
CREATE INDEX `claude_session_metadata_file_size_idx` ON `claude_session_metadata` (`file_size`);--> statement-breakpoint
CREATE TABLE `claude_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`project_path` text NOT NULL,
	`start_time` text NOT NULL,
	`last_update` text NOT NULL,
	`message_count` integer DEFAULT 0 NOT NULL,
	`git_branch` text,
	`cwd` text,
	`token_usage` text,
	`service_tiers` text DEFAULT '[]',
	`total_tokens_used` integer,
	`total_cost_usd` real,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `claude_sessions_project_idx` ON `claude_sessions` (`project_id`);--> statement-breakpoint
CREATE INDEX `claude_sessions_project_path_idx` ON `claude_sessions` (`project_path`);--> statement-breakpoint
CREATE INDEX `claude_sessions_start_time_idx` ON `claude_sessions` (`start_time`);--> statement-breakpoint
CREATE INDEX `claude_sessions_last_update_idx` ON `claude_sessions` (`last_update`);--> statement-breakpoint
CREATE INDEX `claude_sessions_branch_idx` ON `claude_sessions` (`git_branch`);--> statement-breakpoint
CREATE TABLE `file_export_info` (
	`id` integer PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`type` text NOT NULL,
	`source` text,
	`specifiers` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `file_export_info_file_idx` ON `file_export_info` (`file_id`);--> statement-breakpoint
CREATE INDEX `file_export_info_type_idx` ON `file_export_info` (`type`);--> statement-breakpoint
CREATE TABLE `file_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`name` text NOT NULL,
	`strategy` text NOT NULL,
	`file_ids` text NOT NULL,
	`relationships` text DEFAULT '[]',
	`estimated_tokens` integer,
	`priority` integer DEFAULT 5 NOT NULL,
	`metadata` text DEFAULT '{}',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `file_groups_project_idx` ON `file_groups` (`project_id`);--> statement-breakpoint
CREATE INDEX `file_groups_strategy_idx` ON `file_groups` (`strategy`);--> statement-breakpoint
CREATE INDEX `file_groups_priority_idx` ON `file_groups` (`priority`);--> statement-breakpoint
CREATE INDEX `file_groups_name_idx` ON `file_groups` (`name`);--> statement-breakpoint
CREATE TABLE `file_import_info` (
	`id` integer PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`source` text NOT NULL,
	`specifiers` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `file_import_info_file_idx` ON `file_import_info` (`file_id`);--> statement-breakpoint
CREATE INDEX `file_import_info_source_idx` ON `file_import_info` (`source`);--> statement-breakpoint
CREATE TABLE `file_importance` (
	`id` integer PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`project_id` integer NOT NULL,
	`score` real NOT NULL,
	`type_score` real NOT NULL,
	`location_score` real NOT NULL,
	`dependency_score` real NOT NULL,
	`size_score` real NOT NULL,
	`recency_score` real NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `file_importance_file_idx` ON `file_importance` (`file_id`);--> statement-breakpoint
CREATE INDEX `file_importance_project_idx` ON `file_importance` (`project_id`);--> statement-breakpoint
CREATE INDEX `file_importance_score_idx` ON `file_importance` (`score`);--> statement-breakpoint
CREATE TABLE `file_relationships` (
	`id` integer PRIMARY KEY NOT NULL,
	`source_file_id` text NOT NULL,
	`target_file_id` text NOT NULL,
	`type` text NOT NULL,
	`strength` real NOT NULL,
	`metadata` text DEFAULT '{}',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`source_file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `file_relationships_source_idx` ON `file_relationships` (`source_file_id`);--> statement-breakpoint
CREATE INDEX `file_relationships_target_idx` ON `file_relationships` (`target_file_id`);--> statement-breakpoint
CREATE INDEX `file_relationships_type_idx` ON `file_relationships` (`type`);--> statement-breakpoint
CREATE INDEX `file_relationships_strength_idx` ON `file_relationships` (`strength`);--> statement-breakpoint
CREATE TABLE `git_remotes` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`name` text NOT NULL,
	`fetch` text NOT NULL,
	`push` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `git_remotes_project_idx` ON `git_remotes` (`project_id`);--> statement-breakpoint
CREATE INDEX `git_remotes_name_idx` ON `git_remotes` (`name`);--> statement-breakpoint
CREATE TABLE `git_stashes` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`stash_index` integer NOT NULL,
	`message` text NOT NULL,
	`branch` text NOT NULL,
	`date` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `git_stashes_project_idx` ON `git_stashes` (`project_id`);--> statement-breakpoint
CREATE INDEX `git_stashes_index_idx` ON `git_stashes` (`stash_index`);--> statement-breakpoint
CREATE INDEX `git_stashes_branch_idx` ON `git_stashes` (`branch`);--> statement-breakpoint
CREATE TABLE `git_status` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`is_repo` integer NOT NULL,
	`current` text,
	`tracking` text,
	`ahead` integer DEFAULT 0 NOT NULL,
	`behind` integer DEFAULT 0 NOT NULL,
	`files` text DEFAULT '[]' NOT NULL,
	`staged` text DEFAULT '[]' NOT NULL,
	`modified` text DEFAULT '[]' NOT NULL,
	`created_files` text DEFAULT '[]' NOT NULL,
	`deleted` text DEFAULT '[]' NOT NULL,
	`renamed` text DEFAULT '[]' NOT NULL,
	`conflicted` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `git_status_project_idx` ON `git_status` (`project_id`);--> statement-breakpoint
CREATE INDEX `git_status_repo_idx` ON `git_status` (`is_repo`);--> statement-breakpoint
CREATE INDEX `git_status_branch_idx` ON `git_status` (`current`);--> statement-breakpoint
CREATE TABLE `git_tags` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`name` text NOT NULL,
	`commit` text NOT NULL,
	`annotation` text,
	`tagger` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `git_tags_project_idx` ON `git_tags` (`project_id`);--> statement-breakpoint
CREATE INDEX `git_tags_name_idx` ON `git_tags` (`name`);--> statement-breakpoint
CREATE INDEX `git_tags_commit_idx` ON `git_tags` (`commit`);--> statement-breakpoint
CREATE TABLE `git_worktrees` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`path` text NOT NULL,
	`branch` text NOT NULL,
	`commit` text NOT NULL,
	`is_main` integer DEFAULT false NOT NULL,
	`is_locked` integer DEFAULT false NOT NULL,
	`lock_reason` text,
	`prunable` integer DEFAULT false,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `git_worktrees_project_idx` ON `git_worktrees` (`project_id`);--> statement-breakpoint
CREATE INDEX `git_worktrees_path_idx` ON `git_worktrees` (`path`);--> statement-breakpoint
CREATE INDEX `git_worktrees_branch_idx` ON `git_worktrees` (`branch`);--> statement-breakpoint
CREATE INDEX `git_worktrees_main_idx` ON `git_worktrees` (`is_main`);--> statement-breakpoint
CREATE TABLE `mcp_server_configs` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`name` text NOT NULL,
	`command` text NOT NULL,
	`args` text DEFAULT '[]',
	`env` text DEFAULT '{}',
	`enabled` integer DEFAULT true NOT NULL,
	`auto_start` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mcp_server_configs_project_idx` ON `mcp_server_configs` (`project_id`);--> statement-breakpoint
CREATE INDEX `mcp_server_configs_name_idx` ON `mcp_server_configs` (`name`);--> statement-breakpoint
CREATE INDEX `mcp_server_configs_enabled_idx` ON `mcp_server_configs` (`enabled`);--> statement-breakpoint
CREATE INDEX `mcp_server_configs_auto_start_idx` ON `mcp_server_configs` (`auto_start`);--> statement-breakpoint
CREATE TABLE `project_tab_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`active_tab_id` integer DEFAULT 0 NOT NULL,
	`client_id` text,
	`last_updated` integer NOT NULL,
	`tab_metadata` text DEFAULT '{}',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `project_tab_state_project_idx` ON `project_tab_state` (`project_id`);--> statement-breakpoint
CREATE INDEX `project_tab_state_client_idx` ON `project_tab_state` (`client_id`);--> statement-breakpoint
CREATE INDEX `project_tab_state_last_updated_idx` ON `project_tab_state` (`last_updated`);--> statement-breakpoint
CREATE TABLE `relevance_configs` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`name` text NOT NULL,
	`weights` text NOT NULL,
	`max_files` integer DEFAULT 100 NOT NULL,
	`min_score` real DEFAULT 0.1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `relevance_configs_project_idx` ON `relevance_configs` (`project_id`);--> statement-breakpoint
CREATE INDEX `relevance_configs_name_idx` ON `relevance_configs` (`name`);--> statement-breakpoint
CREATE TABLE `relevance_scores` (
	`id` integer PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`project_id` integer NOT NULL,
	`total_score` real NOT NULL,
	`keyword_score` real NOT NULL,
	`path_score` real NOT NULL,
	`type_score` real NOT NULL,
	`recency_score` real NOT NULL,
	`import_score` real NOT NULL,
	`query` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `relevance_scores_file_idx` ON `relevance_scores` (`file_id`);--> statement-breakpoint
CREATE INDEX `relevance_scores_project_idx` ON `relevance_scores` (`project_id`);--> statement-breakpoint
CREATE INDEX `relevance_scores_total_score_idx` ON `relevance_scores` (`total_score`);--> statement-breakpoint
CREATE INDEX `relevance_scores_query_idx` ON `relevance_scores` (`query`);--> statement-breakpoint
-- Consolidated base migration continues
CREATE TABLE `model_configs` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`display_name` text,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`temperature` real DEFAULT 0.7,
	`max_tokens` integer DEFAULT 4096,
	`top_p` real DEFAULT 1,
	`top_k` integer DEFAULT 0,
	`frequency_penalty` real DEFAULT 0,
	`presence_penalty` real DEFAULT 0,
	`response_format` text,
	`system_prompt` text,
	`is_system_preset` integer DEFAULT false NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`user_id` integer,
	`description` text,
	`preset_category` text,
	`ui_icon` text,
	`ui_color` text,
	`ui_order` integer DEFAULT 0,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `model_configs_name_idx` ON `model_configs` (`name`);--> statement-breakpoint
CREATE INDEX `model_configs_provider_idx` ON `model_configs` (`provider`);--> statement-breakpoint
CREATE INDEX `model_configs_is_default_idx` ON `model_configs` (`is_default`);--> statement-breakpoint
CREATE INDEX `model_configs_user_idx` ON `model_configs` (`user_id`);--> statement-breakpoint
CREATE TABLE `model_presets` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`config_id` integer NOT NULL,
	`category` text DEFAULT 'general',
	`is_system_preset` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`user_id` integer,
	`usage_count` integer DEFAULT 0 NOT NULL,
	`last_used_at` integer,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`config_id`) REFERENCES `model_configs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `model_presets_category_idx` ON `model_presets` (`category`);--> statement-breakpoint
CREATE INDEX `model_presets_config_idx` ON `model_presets` (`config_id`);--> statement-breakpoint
CREATE INDEX `model_presets_user_idx` ON `model_presets` (`user_id`);--> statement-breakpoint
CREATE INDEX `model_presets_usage_idx` ON `model_presets` (`usage_count`);--> statement-breakpoint
CREATE TABLE `mcp_error_patterns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer,
	`tool_name` text NOT NULL,
	`error_type` text NOT NULL,
	`error_pattern` text NOT NULL,
	`occurrence_count` integer DEFAULT 1 NOT NULL,
	`last_occurred_at` integer NOT NULL,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mcp_error_project_idx` ON `mcp_error_patterns` (`project_id`);--> statement-breakpoint
CREATE INDEX `mcp_error_tool_idx` ON `mcp_error_patterns` (`tool_name`);--> statement-breakpoint
CREATE INDEX `mcp_error_type_idx` ON `mcp_error_patterns` (`error_type`);--> statement-breakpoint
CREATE UNIQUE INDEX `mcp_error_pattern_unique_idx` ON `mcp_error_patterns` (`project_id`,`tool_name`,`error_pattern`);--> statement-breakpoint
CREATE TABLE `mcp_execution_chains` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chain_id` text NOT NULL,
	`execution_id` integer NOT NULL,
	`parent_execution_id` integer,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`execution_id`) REFERENCES `mcp_tool_executions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_execution_id`) REFERENCES `mcp_tool_executions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mcp_chain_idx` ON `mcp_execution_chains` (`chain_id`);--> statement-breakpoint
CREATE INDEX `mcp_chain_execution_idx` ON `mcp_execution_chains` (`execution_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `mcp_chain_exec_unique_idx` ON `mcp_execution_chains` (`chain_id`,`execution_id`);--> statement-breakpoint
CREATE TABLE `mcp_tool_executions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tool_name` text NOT NULL,
	`project_id` integer,
	`user_id` text,
	`session_id` text,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`duration_ms` integer,
	`status` text DEFAULT 'running' NOT NULL,
	`error_message` text,
	`error_code` text,
	`input_params` text,
	`output_size` integer,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mcp_exec_tool_name_idx` ON `mcp_tool_executions` (`tool_name`);--> statement-breakpoint
CREATE INDEX `mcp_exec_project_idx` ON `mcp_tool_executions` (`project_id`);--> statement-breakpoint
CREATE INDEX `mcp_exec_status_idx` ON `mcp_tool_executions` (`status`);--> statement-breakpoint
CREATE INDEX `mcp_exec_started_at_idx` ON `mcp_tool_executions` (`started_at`);--> statement-breakpoint
CREATE INDEX `mcp_exec_session_idx` ON `mcp_tool_executions` (`session_id`);--> statement-breakpoint
CREATE TABLE `mcp_tool_statistics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tool_name` text NOT NULL,
	`project_id` integer,
	`period_start` integer NOT NULL,
	`period_end` integer NOT NULL,
	`period_type` text NOT NULL,
	`execution_count` integer DEFAULT 0 NOT NULL,
	`success_count` integer DEFAULT 0 NOT NULL,
	`error_count` integer DEFAULT 0 NOT NULL,
	`timeout_count` integer DEFAULT 0 NOT NULL,
	`total_duration_ms` integer DEFAULT 0 NOT NULL,
	`avg_duration_ms` real DEFAULT 0 NOT NULL,
	`min_duration_ms` integer,
	`max_duration_ms` integer,
	`total_output_size` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mcp_stat_unique_idx` ON `mcp_tool_statistics` (`tool_name`,`project_id`,`period_type`,`period_start`);--> statement-breakpoint
CREATE INDEX `mcp_stat_tool_name_idx` ON `mcp_tool_statistics` (`tool_name`);--> statement-breakpoint
CREATE INDEX `mcp_stat_project_idx` ON `mcp_tool_statistics` (`project_id`);--> statement-breakpoint
CREATE INDEX `mcp_stat_period_idx` ON `mcp_tool_statistics` (`period_start`,`period_end`);CREATE TABLE `encryption_keys` (
	`id` integer PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`is_default` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
-- provider_keys.secret_ref included in base provider_keys definition above
