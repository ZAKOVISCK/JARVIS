CREATE TABLE `import_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`file_name` text NOT NULL,
	`file_type` text NOT NULL,
	`status` text NOT NULL,
	`total_rows` integer NOT NULL,
	`accepted_rows` integer NOT NULL,
	`duplicate_rows` integer NOT NULL,
	`quarantine_rows` integer NOT NULL,
	`created_at` text NOT NULL,
	`integrated_at` text,
	`rolled_back_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_import_jobs_owner_created` ON `import_jobs` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `import_rows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`row_number` integer NOT NULL,
	`payload` text NOT NULL,
	`status` text NOT NULL,
	`reason` text,
	`dedupe_key` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_import_rows_owner_job` ON `import_rows` (`owner_id`,`job_id`);--> statement-breakpoint
CREATE INDEX `idx_import_rows_job_status` ON `import_rows` (`job_id`,`status`);--> statement-breakpoint
ALTER TABLE `maintenance` ADD `import_job_id` text;