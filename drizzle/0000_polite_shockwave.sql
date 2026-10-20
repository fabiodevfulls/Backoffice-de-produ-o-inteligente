CREATE TABLE `activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`kind` text NOT NULL,
	`protocol` text,
	`typology_id` integer NOT NULL,
	`typology_name` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`duration_seconds` integer NOT NULL,
	`occurred_at` text NOT NULL,
	`backoffice_url` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `activities_user_email_idx` ON `activities` (`user_email`);--> statement-breakpoint
CREATE INDEX `activities_occurred_at_idx` ON `activities` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `activities_kind_idx` ON `activities` (`kind`);--> statement-breakpoint
CREATE TABLE `typologies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`seconds` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `typologies_name_unique` ON `typologies` (`name`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'attendant' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);