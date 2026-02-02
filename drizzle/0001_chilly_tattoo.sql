CREATE TABLE `achievements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`description` text,
	`iconName` varchar(64),
	`category` enum('learning','social','streak','milestone','special'),
	`xpReward` int DEFAULT 0,
	`requirement` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `achievements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `coach_matches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentId` int NOT NULL,
	`coachId` int NOT NULL,
	`overallScore` int NOT NULL,
	`styleScore` int,
	`goalScore` int,
	`scheduleScore` int,
	`communicationScore` int,
	`quizAnswers` text,
	`status` enum('suggested','contacted','active','inactive') DEFAULT 'suggested',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `coach_matches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `coach_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` enum('none','CM','FM','IM','GM','WCM','WFM','WIM','WGM') DEFAULT 'none',
	`fideRating` int,
	`lichessUsername` varchar(64),
	`chesscomUsername` varchar(64),
	`specialties` text,
	`teachingStyle` enum('visual','interactive','analytical','competitive'),
	`experienceYears` int,
	`languages` text,
	`hourlyRateCents` int DEFAULT 5000,
	`currency` varchar(3) DEFAULT 'USD',
	`commissionRate` int DEFAULT 15,
	`totalStudents` int DEFAULT 0,
	`totalLessons` int DEFAULT 0,
	`averageRating` decimal(3,2) DEFAULT '0.00',
	`totalReviews` int DEFAULT 0,
	`isAvailable` boolean DEFAULT true,
	`availabilitySchedule` text,
	`isVerified` boolean DEFAULT false,
	`verifiedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `coach_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `coach_profiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentId` int NOT NULL,
	`coachId` int NOT NULL,
	`scheduledAt` timestamp NOT NULL,
	`durationMinutes` int DEFAULT 60,
	`timezone` varchar(64),
	`topic` varchar(255),
	`notes` text,
	`meetingUrl` text,
	`status` enum('pending','confirmed','paid','in_progress','completed','released','cancelled','disputed','refunded') DEFAULT 'pending',
	`amountCents` int NOT NULL,
	`commissionCents` int NOT NULL,
	`coachPayoutCents` int NOT NULL,
	`currency` varchar(3) DEFAULT 'USD',
	`stripePaymentIntentId` varchar(64),
	`stripeTransferId` varchar(64),
	`studentConfirmedAt` timestamp,
	`coachConfirmedAt` timestamp,
	`completedAt` timestamp,
	`payoutAt` timestamp,
	`refundWindowEndsAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lessons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lessonId` int NOT NULL,
	`studentId` int NOT NULL,
	`coachId` int NOT NULL,
	`rating` int NOT NULL,
	`comment` text,
	`knowledgeRating` int,
	`communicationRating` int,
	`preparednessRating` int,
	`isPublic` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `reviews_lessonId_unique` UNIQUE(`lessonId`)
);
--> statement-breakpoint
CREATE TABLE `student_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`skillLevel` enum('beginner','intermediate','advanced','expert') DEFAULT 'beginner',
	`currentRating` int,
	`targetRating` int,
	`primaryGoal` enum('rating_improvement','tournament_prep','openings','tactics','endgames','general'),
	`playingStyle` enum('aggressive','positional','balanced','defensive'),
	`learningStyle` enum('visual','interactive','analytical','competitive'),
	`practiceSchedule` enum('casual','regular','serious','intensive'),
	`totalXp` int DEFAULT 0,
	`currentLevel` int DEFAULT 1,
	`currentStreak` int DEFAULT 0,
	`longestStreak` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `student_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `student_profiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `user_achievements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`achievementId` int NOT NULL,
	`unlockedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_achievements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `waitlist` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` varchar(255),
	`userType` enum('student','coach','both') DEFAULT 'student',
	`referralSource` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `waitlist_id` PRIMARY KEY(`id`),
	CONSTRAINT `waitlist_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `userType` enum('student','coach','both') DEFAULT 'student' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `stripeCustomerId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `stripeConnectAccountId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `stripeConnectOnboarded` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `users` ADD `avatarUrl` text;--> statement-breakpoint
ALTER TABLE `users` ADD `bio` text;--> statement-breakpoint
ALTER TABLE `users` ADD `country` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `timezone` varchar(64);