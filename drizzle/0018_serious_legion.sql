ALTER TABLE `lessons` ADD `stripeReversalId` varchar(64);--> statement-breakpoint
ALTER TABLE `lessons` ADD `stripeReversalAmountCents` int;--> statement-breakpoint
ALTER TABLE `lessons` ADD `stripePostPayoutRefundId` varchar(64);