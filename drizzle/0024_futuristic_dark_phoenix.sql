ALTER TABLE `notifications` MODIFY COLUMN `type` enum('new_subscriber','new_content_request','new_message','lesson_booked','lesson_confirmed','lesson_cancelled','lesson_completed','new_review','content_delivered','content_request_quoted','content_request_declined') NOT NULL;--> statement-breakpoint
ALTER TABLE `content_requests` ADD `coachNote` text;--> statement-breakpoint
ALTER TABLE `notifications` ADD `recipientRole` enum('coach','student') DEFAULT 'student' NOT NULL;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `chesscomUsername` varchar(64);--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `lichessUsername` varchar(64);--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `fideId` varchar(20);