-- Process Management Tables Migration
CREATE TABLE `process_runs` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`process_id` text NOT NULL,
	`pid` integer,
	`name` text,
	`command` text NOT NULL,
	`args` text DEFAULT '[]' NOT NULL,
	`cwd` text NOT NULL,
	`env` text,
	`status` text DEFAULT 'running' NOT NULL,
	`exit_code` integer,
	`signal` text,
	`started_at` integer NOT NULL,
	`exited_at` integer,
	`cpu_usage` real,
	`memory_usage` integer,
	`script_name` text,
	`script_type` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `process_runs_process_id_unique` ON `process_runs` (`process_id`);--> statement-breakpoint
CREATE INDEX `process_runs_project_idx` ON `process_runs` (`project_id`);--> statement-breakpoint
CREATE INDEX `process_runs_process_id_idx` ON `process_runs` (`process_id`);--> statement-breakpoint
CREATE INDEX `process_runs_status_idx` ON `process_runs` (`status`);--> statement-breakpoint
CREATE INDEX `process_runs_started_at_idx` ON `process_runs` (`started_at`);--> statement-breakpoint
CREATE TABLE `process_logs` (
	`id` integer PRIMARY KEY NOT NULL,
	`run_id` integer NOT NULL,
	`timestamp` integer NOT NULL,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`line_number` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `process_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `process_logs_run_idx` ON `process_logs` (`run_id`);--> statement-breakpoint
CREATE INDEX `process_logs_timestamp_idx` ON `process_logs` (`timestamp`);--> statement-breakpoint
CREATE INDEX `process_logs_type_idx` ON `process_logs` (`type`);--> statement-breakpoint
CREATE TABLE `process_ports` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`run_id` integer,
	`port` integer NOT NULL,
	`protocol` text DEFAULT 'tcp' NOT NULL,
	`address` text DEFAULT '0.0.0.0' NOT NULL,
	`pid` integer,
	`process_name` text,
	`state` text DEFAULT 'listening' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `process_runs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `process_ports_project_idx` ON `process_ports` (`project_id`);--> statement-breakpoint
CREATE INDEX `process_ports_run_idx` ON `process_ports` (`run_id`);--> statement-breakpoint
CREATE INDEX `process_ports_port_idx` ON `process_ports` (`port`);--> statement-breakpoint
CREATE INDEX `process_ports_state_idx` ON `process_ports` (`state`);