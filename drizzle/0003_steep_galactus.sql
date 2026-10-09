ALTER TABLE `maintenance` ADD `source_record_id` text;--> statement-breakpoint
ALTER TABLE `maintenance` ADD `movement_type` text;--> statement-breakpoint
ALTER TABLE `maintenance` ADD `quantity` integer;--> statement-breakpoint
CREATE INDEX `idx_maintenance_owner_source_record` ON `maintenance` (`owner_id`,`source_record_id`);--> statement-breakpoint
PRAGMA optimize;
