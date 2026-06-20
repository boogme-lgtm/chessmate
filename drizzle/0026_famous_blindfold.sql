ALTER TABLE `content_requests` MODIFY COLUMN `status` enum('queued','quoted','pending_payment','payment_collected','in_progress','delivered','cancelled','overdue') NOT NULL DEFAULT 'queued';--> statement-breakpoint
ALTER TABLE `notifications` MODIFY COLUMN `type` enum('new_subscriber','new_content_request','new_message','lesson_booked','lesson_confirmed','lesson_cancelled','lesson_completed','new_review','content_delivered','content_request_quoted','content_request_declined','content_request_accepted','content_request_payment_collected','content_request_deadline_24h','content_request_deadline_1h','content_request_overdue','content_request_deadline_extended','content_request_cancelled_overdue') NOT NULL;--> statement-breakpoint
ALTER TABLE `content_items` ADD `accessType` enum('public','student_only','request_fulfillment') DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE `content_items` ADD `targetStudentId` int;--> statement-breakpoint
ALTER TABLE `content_requests` ADD `deadline24hReminderSentAt` timestamp;--> statement-breakpoint
ALTER TABLE `content_requests` ADD `deadline1hReminderSentAt` timestamp;--> statement-breakpoint
ALTER TABLE `content_requests` ADD `overdueNotifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `content_purchases` ADD CONSTRAINT `uniq_content_purchases_item_user` UNIQUE(`contentItemId`,`userId`);