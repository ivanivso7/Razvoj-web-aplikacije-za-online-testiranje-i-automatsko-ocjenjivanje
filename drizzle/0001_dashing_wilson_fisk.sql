CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token` text NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sessions_token` ON `sessions` (`token`);--> statement-breakpoint
CREATE INDEX `idx_sessions_user_id` ON `sessions` (`user_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`test_id` integer NOT NULL,
	`student_id` integer NOT NULL,
	`score` integer NOT NULL,
	`max_score` integer NOT NULL,
	`submitted_at` text NOT NULL,
	FOREIGN KEY (`test_id`) REFERENCES `tests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_attempts`("id", "test_id", "student_id", "score", "max_score", "submitted_at") SELECT "id", "test_id", "student_id", "score", "max_score", "submitted_at" FROM `attempts`;--> statement-breakpoint
DROP TABLE `attempts`;--> statement-breakpoint
ALTER TABLE `__new_attempts` RENAME TO `attempts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_attempts_student_date` ON `attempts` (`student_id`,`submitted_at`);--> statement-breakpoint
CREATE INDEX `idx_attempts_test` ON `attempts` (`test_id`);--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text DEFAULT '' NOT NULL,
	`password_salt` text DEFAULT '' NOT NULL,
	`role` text DEFAULT 'student' NOT NULL,
	`study` text DEFAULT 'Informatika' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "name", "email", "password_hash", "password_salt", "role", "study", "created_at") SELECT "id", "name", "email", '', '', CASE WHEN "role" = 'teacher' THEN 'profesor' ELSE "role" END, 'Informatika', "created_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_answers_attempt` ON `answers` (`attempt_id`);--> statement-breakpoint
CREATE INDEX `idx_questions_test_position` ON `questions` (`test_id`,`position`);--> statement-breakpoint
CREATE INDEX `idx_tests_subject` ON `tests` (`subject`);--> statement-breakpoint
CREATE INDEX `idx_tests_teacher` ON `tests` (`teacher_id`);
