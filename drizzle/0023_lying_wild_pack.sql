CREATE TABLE `coach_subscription_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`coachId` int NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`monthlyPriceCents` int NOT NULL DEFAULT 0,
	`description` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `coach_subscription_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `coach_subscription_settings_coachId_unique` UNIQUE(`coachId`)
);
--> statement-breakpoint
CREATE TABLE `coach_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subscriberId` int NOT NULL,
	`coachId` int NOT NULL,
	`status` enum('active','cancelled','expired') NOT NULL DEFAULT 'active',
	`monthlyPriceCents` int NOT NULL DEFAULT 0,
	`stripeSubscriptionId` varchar(255),
	`currentPeriodEnd` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `coach_subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `coach_subscriptions_subscriberId_coachId_unique` UNIQUE(`subscriberId`,`coachId`)
);
--> statement-breakpoint
CREATE TABLE `content_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentId` int NOT NULL,
	`coachId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`amountCents` int NOT NULL DEFAULT 0,
	`status` enum('queued','in_progress','delivered','cancelled') NOT NULL DEFAULT 'queued',
	`dueDate` timestamp,
	`deliveredAt` timestamp,
	`contentItemId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('new_subscriber','new_content_request','new_message','lesson_booked','lesson_confirmed','lesson_cancelled','lesson_completed','new_review','content_delivered') NOT NULL,
	`title` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`relatedUserId` int,
	`relatedLessonId` int,
	`relatedContentRequestId` int,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `lessons` MODIFY COLUMN `status` enum('pending_payment','payment_collected','pending_confirmation','confirmed','decline_pending','declined','cancel_pending','paid','in_progress','completed','released','cancelled','no_show','disputed','refunded','subscription_dm') DEFAULT 'pending_payment';