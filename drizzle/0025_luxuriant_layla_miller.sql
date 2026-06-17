ALTER TABLE `content_requests` MODIFY COLUMN `status` enum('queued','quoted','pending_payment','payment_collected','in_progress','delivered','cancelled') NOT NULL DEFAULT 'queued';--> statement-breakpoint
ALTER TABLE `notifications` MODIFY COLUMN `type` enum('new_subscriber','new_content_request','new_message','lesson_booked','lesson_confirmed','lesson_cancelled','lesson_completed','new_review','content_delivered','content_request_quoted','content_request_declined','content_request_accepted','content_request_payment_collected') NOT NULL;--> statement-breakpoint
ALTER TABLE `content_requests` ADD `stripePaymentIntentId` varchar(64);--> statement-breakpoint
ALTER TABLE `content_requests` ADD `stripeChargeId` varchar(64);--> statement-breakpoint
ALTER TABLE `content_requests` ADD `stripeCheckoutSessionId` varchar(128);--> statement-breakpoint
ALTER TABLE `content_requests` ADD `stripeTransferId` varchar(64);--> statement-breakpoint
ALTER TABLE `content_requests` ADD `payoutReleasedAt` timestamp;--> statement-breakpoint
ALTER TABLE `content_requests` ADD `payoutAt` timestamp;