CREATE TABLE `lesson_disputes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lessonId` int NOT NULL,
	`raisedBy` int NOT NULL,
	`category` enum('coach_no_show','coach_late_or_short','technical_failure','not_as_described','quality') NOT NULL,
	`description` text,
	`evidenceUrls` text,
	`status` enum('open','coach_responded','escalated','resolved') NOT NULL DEFAULT 'open',
	`coachResponse` text,
	`coachRespondedAt` timestamp,
	`coachAction` enum('accept','contest'),
	`resolution` enum('refund_full','refund_partial','denied','feedback_only'),
	`refundAmountCents` int,
	`resolvedBy` enum('coach','admin','system'),
	`resolvedAt` timestamp,
	`adminNote` text,
	`abuseFlag` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lesson_disputes_id` PRIMARY KEY(`id`),
	CONSTRAINT `lesson_disputes_lessonId_unique` UNIQUE(`lessonId`)
);
--> statement-breakpoint
CREATE TABLE `tips` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lessonId` int NOT NULL,
	`studentId` int NOT NULL,
	`coachId` int NOT NULL,
	`amountCents` int NOT NULL,
	`currency` varchar(3) DEFAULT 'USD',
	`stripeCheckoutSessionId` varchar(128),
	`stripeTransferId` varchar(64),
	`status` enum('pending','paid','transferred','failed') DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`paidAt` timestamp,
	`transferredAt` timestamp,
	CONSTRAINT `tips_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `lessons` ADD `stripeChargeId` varchar(64);--> statement-breakpoint
ALTER TABLE `reviews` ADD `studentId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `reviews` ADD `coachId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `reviews` DROP COLUMN `reviewerId`;--> statement-breakpoint
ALTER TABLE `reviews` DROP COLUMN `revieweeId`;