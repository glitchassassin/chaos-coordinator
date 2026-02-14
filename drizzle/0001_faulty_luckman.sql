ALTER TABLE `triggers` RENAME COLUMN "interpreted_check" TO "check_script";--> statement-breakpoint
ALTER TABLE `triggers` ADD `last_error` text;