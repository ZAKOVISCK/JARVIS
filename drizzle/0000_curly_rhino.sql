CREATE TABLE `maintenance` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`prefix` text NOT NULL,
	`part` text NOT NULL,
	`date` text NOT NULL,
	`km` integer,
	`mechanic` text,
	`work_order` text,
	`source` text NOT NULL,
	`notes` text
);
--> statement-breakpoint
CREATE INDEX `idx_maintenance_owner_prefix` ON `maintenance` (`owner_id`,`prefix`);