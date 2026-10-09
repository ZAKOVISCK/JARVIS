CREATE TABLE `query_history` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`run_id` text NOT NULL,
	`item_key` text NOT NULL,
	`request_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`prefix` text NOT NULL,
	`part` text NOT NULL,
	`search_text` text NOT NULL,
	`status` text NOT NULL,
	`source_mode` text NOT NULL,
	`snapshot` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_queries_owner_run_item` ON `query_history` (`owner_id`,`run_id`,`item_key`);--> statement-breakpoint
CREATE INDEX `idx_queries_owner_created` ON `query_history` (`owner_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_queries_owner_prefix_created` ON `query_history` (`owner_id`,`prefix`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_queries_owner_status_created` ON `query_history` (`owner_id`,`status`,`created_at`);