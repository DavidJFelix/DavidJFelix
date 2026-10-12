CREATE TABLE `chunk_reviews` (
	`key` text PRIMARY KEY NOT NULL,
	`result` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
