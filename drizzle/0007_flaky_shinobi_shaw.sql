CREATE TABLE `cancellations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lessonId` int NOT NULL,
	`cancelledBy` enum('student','coach') NOT NULL,
	`cancelledByUserId` int NOT NULL,
	`lessonScheduledAt` timestamp NOT NULL,
	`cancelledAt` timestamp NOT NULL DEFAULT (now()),
	`hoursBeforeLesson` int NOT NULL,
	`refundPercent` int NOT NULL,
	`refundAmountCents` int NOT NULL,
	`coachCompensationCents` int NOT NULL,
	`reason` text,
	`stripeRefundId` varchar(64),
	`refundProcessedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cancellations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `disputes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lessonId` int NOT NULL,
	`studentId` int NOT NULL,
	`coachId` int NOT NULL,
	`reason` enum('coach_no_show','poor_quality','technical_issues','inappropriate_behavior','other') NOT NULL,
	`description` text NOT NULL,
	`evidence` text,
	`status` enum('pending','investigating','resolved_refund','resolved_no_refund','escalated') DEFAULT 'pending',
	`resolvedBy` int,
	`resolvedAt` timestamp,
	`resolutionNotes` text,
	`refundAmountCents` int,
	`stripeRefundId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `disputes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lesson_packages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentId` int NOT NULL,
	`coachId` int NOT NULL,
	`totalLessons` int NOT NULL,
	`completedLessons` int DEFAULT 0,
	`remainingLessons` int NOT NULL,
	`totalAmountCents` int NOT NULL,
	`perLessonAmountCents` int NOT NULL,
	`discountPercent` int DEFAULT 0,
	`currency` varchar(3) DEFAULT 'USD',
	`stripePaymentIntentId` varchar(64),
	`status` enum('active','completed','cancelled','expired') DEFAULT 'active',
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lesson_packages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payouts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`coachId` int NOT NULL,
	`lessonId` int,
	`packageId` int,
	`amountCents` int NOT NULL,
	`platformFeeCents` int NOT NULL,
	`processingFeeCents` int DEFAULT 0,
	`netAmountCents` int NOT NULL,
	`currency` varchar(3) DEFAULT 'USD',
	`stripeTransferId` varchar(64),
	`stripePayoutId` varchar(64),
	`status` enum('pending','processing','completed','failed') DEFAULT 'pending',
	`releasedAt` timestamp,
	`completedAt` timestamp,
	`failureReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payouts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `coach_profiles` ADD `subscriptionTier` enum('free','growth','business') DEFAULT 'free';