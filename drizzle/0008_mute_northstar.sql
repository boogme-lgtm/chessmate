ALTER TABLE `users` MODIFY COLUMN `openId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `email` varchar(320) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `password` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `emailVerified` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `emailVerificationToken` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `emailVerificationExpires` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `passwordResetToken` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordResetExpires` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);