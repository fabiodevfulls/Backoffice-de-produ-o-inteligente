ALTER TABLE `users` ADD `employee_code` text;--> statement-breakpoint
ALTER TABLE `users` ADD `registration_complete` integer DEFAULT false NOT NULL;