CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`kind` text NOT NULL,
	`actor` text NOT NULL,
	`created_at` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_owner_subject` ON `audit_events` (`owner_id`,`subject_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_owner_created` ON `audit_events` (`owner_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `import_jobs` ADD `file_hash` text;--> statement-breakpoint
ALTER TABLE `import_jobs` ADD `column_mapping` text;--> statement-breakpoint
ALTER TABLE `import_jobs` ADD `cancelled_at` text;