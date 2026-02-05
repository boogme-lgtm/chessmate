ALTER TABLE `waitlist` ADD `confirmationEmailSent` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `waitlist` ADD `nurtureEmail1Sent` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `waitlist` ADD `nurtureEmail2Sent` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `waitlist` ADD `nurtureEmail3Sent` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `waitlist` ADD `nurtureEmail4Sent` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `waitlist` ADD `nurtureEmail5Sent` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `waitlist` ADD `lastEmailSentAt` timestamp;