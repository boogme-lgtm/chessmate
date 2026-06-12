CREATE TABLE `pgn_analyses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lessonId` int,
	`contentItemId` int,
	`studentId` int NOT NULL,
	`coachId` int,
	`title` varchar(255) NOT NULL,
	`originalPgn` mediumtext NOT NULL,
	`annotatedPgn` mediumtext,
	`status` enum('draft','sent') NOT NULL DEFAULT 'draft',
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pgn_analyses_id` PRIMARY KEY(`id`)
);
