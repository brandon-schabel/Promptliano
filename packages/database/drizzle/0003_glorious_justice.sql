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
CREATE INDEX `mcp_stat_period_idx` ON `mcp_tool_statistics` (`period_start`,`period_end`);