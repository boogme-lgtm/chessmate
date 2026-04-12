CREATE TABLE `content_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`coachId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`kind` enum('course','video','pdf','pgn','bundle') NOT NULL,
	`storageKey` varchar(512),
	`thumbnailUrl` text,
	`priceCents` int NOT NULL DEFAULT 0,
	`currency` varchar(3) DEFAULT 'USD',
	`previewContent` text,
	`published` boolean NOT NULL DEFAULT false,
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_purchases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contentItemId` int NOT NULL,
	`userId` int NOT NULL,
	`unlockMethod` enum('purchase','subscription','free','gift') NOT NULL,
	`amountPaidCents` int NOT NULL DEFAULT 0,
	`stripePaymentIntentId` varchar(64),
	`unlockedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `content_purchases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `group_lesson_participants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`groupLessonId` int NOT NULL,
	`studentId` int NOT NULL,
	`stripePaymentIntentId` varchar(64),
	`paid` boolean NOT NULL DEFAULT false,
	`paidAt` timestamp,
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	`dropped` boolean NOT NULL DEFAULT false,
	`droppedAt` timestamp,
	CONSTRAINT `group_lesson_participants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `group_lessons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`coachId` int NOT NULL,
	`organizerId` int NOT NULL,
	`scheduledAt` timestamp NOT NULL,
	`durationMinutes` int NOT NULL DEFAULT 60,
	`timezone` varchar(64),
	`topic` varchar(255),
	`notes` text,
	`meetingUrl` text,
	`maxParticipants` int NOT NULL,
	`totalAmountCents` int NOT NULL,
	`perParticipantCents` int NOT NULL,
	`commissionCents` int NOT NULL,
	`coachPayoutCents` int NOT NULL,
	`currency` varchar(3) DEFAULT 'USD',
	`inviteToken` varchar(64) NOT NULL,
	`status` enum('forming','confirmed','in_progress','completed','cancelled') NOT NULL DEFAULT 'forming',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `group_lessons_id` PRIMARY KEY(`id`),
	CONSTRAINT `group_lessons_inviteToken_unique` UNIQUE(`inviteToken`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lessonId` int NOT NULL,
	`senderId` int NOT NULL,
	`contentType` enum('text','pgn') NOT NULL DEFAULT 'text',
	`content` text NOT NULL,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `reviews` DROP INDEX `reviews_lessonId_unique`;--> statement-breakpoint
ALTER TABLE `lessons` MODIFY COLUMN `status` enum('pending_confirmation','confirmed','declined','paid','in_progress','completed','released','cancelled','no_show','disputed','refunded') DEFAULT 'pending_confirmation';