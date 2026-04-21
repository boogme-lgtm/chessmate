ALTER TABLE `coach_profiles` MODIFY COLUMN `commissionRate` int DEFAULT 12;--> statement-breakpoint
ALTER TABLE `coach_profiles` ADD `pricingTier` enum('free','pro','elite') DEFAULT 'free' NOT NULL;