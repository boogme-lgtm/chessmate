ALTER TABLE `coach_matches` ADD `budgetScore` int;--> statement-breakpoint
ALTER TABLE `coach_matches` ADD `ratingScore` int;--> statement-breakpoint
ALTER TABLE `coach_matches` ADD `credentialScore` int;--> statement-breakpoint
ALTER TABLE `coach_matches` ADD `experienceScore` int;--> statement-breakpoint
ALTER TABLE `coach_matches` ADD `matchReasons` text;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `assessmentData` text;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `assessmentCompletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `assessmentVersion` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `budgetMinCents` int;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `budgetMaxCents` int;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `credentialImportance` enum('gm','titled','somewhat','teaching','notimportant');--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `improvementAreas` text;--> statement-breakpoint
ALTER TABLE `waitlist` ADD `assessmentData` text;--> statement-breakpoint
ALTER TABLE `coach_matches` ADD CONSTRAINT `uniq_coach_matches_student_coach` UNIQUE(`studentId`,`coachId`);