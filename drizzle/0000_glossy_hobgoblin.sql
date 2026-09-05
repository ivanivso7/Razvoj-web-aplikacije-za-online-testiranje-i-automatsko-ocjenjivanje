CREATE TABLE `answers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attempt_id` integer NOT NULL,
	`question_id` integer NOT NULL,
	`answer` text NOT NULL,
	`awarded_points` integer NOT NULL,
	`is_correct` integer NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`test_id` integer NOT NULL,
	`student_id` integer NOT NULL,
	`score` integer NOT NULL,
	`max_score` integer NOT NULL,
	`submitted_at` text NOT NULL,
	FOREIGN KEY (`test_id`) REFERENCES `tests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`test_id` integer NOT NULL,
	`type` text NOT NULL,
	`prompt` text NOT NULL,
	`options_json` text,
	`correct_answer` text NOT NULL,
	`points` integer NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`test_id`) REFERENCES `tests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`subject` text NOT NULL,
	`description` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`published` integer DEFAULT false NOT NULL,
	`teacher_id` integer NOT NULL,
	FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);