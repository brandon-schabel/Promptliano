CREATE TABLE `crawled_content` (
	`id` integer PRIMARY KEY NOT NULL,
	`url_id` integer NOT NULL,
	`title` text,
	`clean_content` text,
	`raw_html` text,
	`summary` text,
	`metadata` text DEFAULT '{}',
	`links` text DEFAULT '[]' NOT NULL,
	`crawled_at` integer NOT NULL,
	FOREIGN KEY (`url_id`) REFERENCES `urls`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `crawled_content_url_idx` ON `crawled_content` (`url_id`);--> statement-breakpoint
CREATE TABLE `domains` (
	`id` integer PRIMARY KEY NOT NULL,
	`domain` text NOT NULL,
	`robots_txt` text,
	`crawl_delay` integer DEFAULT 1000 NOT NULL,
	`last_crawl_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `domains_domain_unique` ON `domains` (`domain`);--> statement-breakpoint
CREATE INDEX `domains_domain_idx` ON `domains` (`domain`);--> statement-breakpoint
CREATE TABLE `urls` (
	`id` integer PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`url_hash` text NOT NULL,
	`domain` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`http_status` integer,
	`last_crawled_at` integer,
	`next_crawl_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `urls_url_hash_unique` ON `urls` (`url_hash`);--> statement-breakpoint
CREATE INDEX `urls_url_hash_idx` ON `urls` (`url_hash`);--> statement-breakpoint
CREATE INDEX `urls_domain_idx` ON `urls` (`domain`);--> statement-breakpoint
CREATE INDEX `urls_status_idx` ON `urls` (`status`);--> statement-breakpoint
CREATE INDEX `urls_next_crawl_idx` ON `urls` (`next_crawl_at`);