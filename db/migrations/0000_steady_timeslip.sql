CREATE TABLE `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`tmux_session` text NOT NULL,
	`status` text DEFAULT 'starting' NOT NULL,
	`initial_prompt` text,
	`linked_issue_id` text,
	`linked_pr_id` text,
	`log_path` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`ended_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agents_tmux_session_unique` ON `agents` (`tmux_session`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`directory` text NOT NULL,
	`remote_url` text,
	`provider_type` text,
	`owner` text,
	`repo` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`removed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_directory_unique` ON `projects` (`directory`);