ALTER TABLE `coach_profiles` ADD `onboardingStep` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `coach_profiles` ADD `onboardingCompleted` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `coach_profiles` ADD `onboardingCompletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `coach_profiles` ADD `profilePhotoUrl` text;--> statement-breakpoint
ALTER TABLE `coach_profiles` ADD `videoIntroUrl` text;--> statement-breakpoint
ALTER TABLE `coach_profiles` ADD `minAdvanceHours` int DEFAULT 24;--> statement-breakpoint
ALTER TABLE `coach_profiles` ADD `maxAdvanceDays` int DEFAULT 30;--> statement-breakpoint
ALTER TABLE `coach_profiles` ADD `bufferMinutes` int DEFAULT 15;--> statement-breakpoint
ALTER TABLE `coach_profiles` ADD `lessonDurations` text;--> statement-breakpoint
ALTER TABLE `coach_profiles` ADD `lessonFormats` text;--> statement-breakpoint
ALTER TABLE `coach_profiles` ADD `packageDiscountEnabled` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `coach_profiles` ADD `packageDiscountPercent` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `coach_profiles` ADD `guidelinesAgreed` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `coach_profiles` ADD `guidelinesAgreedAt` timestamp;--> statement-breakpoint
ALTER TABLE `coach_profiles` ADD `profileActive` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `coach_profiles` ADD `profileActivatedAt` timestamp;