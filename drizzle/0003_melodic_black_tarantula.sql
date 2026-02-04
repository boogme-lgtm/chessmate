ALTER TABLE `coach_applications` ADD `aiVettingScore` int;--> statement-breakpoint
ALTER TABLE `coach_applications` ADD `aiVettingDetails` text;--> statement-breakpoint
ALTER TABLE `coach_applications` ADD `aiVettingTimestamp` timestamp;--> statement-breakpoint
ALTER TABLE `coach_applications` ADD `autoApproved` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `coach_applications` ADD `humanReviewReason` text;