CREATE TABLE `ai_sdk_options` (
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
ALTER TABLE `files` ADD `content` text;--> statement-breakpoint
ALTER TABLE `files` ADD `summary_last_updated` integer;--> statement-breakpoint
ALTER TABLE `files` ADD `meta` text;--> statement-breakpoint
ALTER TABLE `files` ADD `checksum` text;--> statement-breakpoint
ALTER TABLE `files` ADD `imports` text;--> statement-breakpoint
ALTER TABLE `files` ADD `exports` text;--> statement-breakpoint
CREATE INDEX `files_checksum_idx` ON `files` (`checksum`);--> statement-breakpoint
ALTER TABLE `provider_keys` ADD `name` text;--> statement-breakpoint
ALTER TABLE `provider_keys` ADD `key` text;--> statement-breakpoint
ALTER TABLE `provider_keys` ADD `encrypted` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_keys` ADD `iv` text;--> statement-breakpoint
ALTER TABLE `provider_keys` ADD `tag` text;--> statement-breakpoint
ALTER TABLE `provider_keys` ADD `salt` text;--> statement-breakpoint
ALTER TABLE `provider_keys` ADD `base_url` text;--> statement-breakpoint
ALTER TABLE `provider_keys` ADD `custom_headers` text DEFAULT '{}';--> statement-breakpoint
ALTER TABLE `provider_keys` ADD `is_default` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_keys` ADD `environment` text DEFAULT 'production' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_keys` ADD `description` text;--> statement-breakpoint
ALTER TABLE `provider_keys` ADD `expires_at` integer;--> statement-breakpoint
ALTER TABLE `provider_keys` ADD `last_used` integer;--> statement-breakpoint
CREATE INDEX `provider_keys_name_idx` ON `provider_keys` (`name`);--> statement-breakpoint
CREATE INDEX `provider_keys_default_idx` ON `provider_keys` (`is_default`);--> statement-breakpoint
CREATE INDEX `provider_keys_environment_idx` ON `provider_keys` (`environment`);--> statement-breakpoint
ALTER TABLE `ticket_tasks` ADD `status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
CREATE INDEX `ticket_tasks_status_idx` ON `ticket_tasks` (`status`);