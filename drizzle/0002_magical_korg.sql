ALTER TABLE `maintenance` ADD `record_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_maintenance_owner_record_key` ON `maintenance` (`owner_id`,`record_key`);--> statement-breakpoint
PRAGMA optimize;
