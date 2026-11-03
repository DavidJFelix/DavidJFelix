CREATE TABLE `summary_comment_locks` (
	`pull_request` text PRIMARY KEY NOT NULL,
	`holder` text NOT NULL,
	`expires_at` integer NOT NULL
);
