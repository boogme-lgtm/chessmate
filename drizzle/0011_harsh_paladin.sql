CREATE TABLE `referral_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`coachId` int NOT NULL,
	`code` varchar(12) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`totalUses` int NOT NULL DEFAULT 0,
	`maxUses` int,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referral_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `referral_codes_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `referrals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referralCodeId` int NOT NULL,
	`referredUserId` int NOT NULL,
	`status` enum('signed_up','lesson_completed','reward_issued') NOT NULL DEFAULT 'signed_up',
	`rewardIssuedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referrals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `notificationPreferences` text;--> statement-breakpoint
ALTER TABLE `users` ADD `deletedAt` timestamp;