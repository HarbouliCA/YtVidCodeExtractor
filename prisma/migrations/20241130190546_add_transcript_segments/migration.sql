/*
  Warnings:

  - You are about to drop the column `segments` on the `Transcript` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Transcript` DROP COLUMN `segments`;

-- CreateTable
CREATE TABLE `TranscriptSegment` (
    `id` VARCHAR(191) NOT NULL,
    `startTime` DOUBLE NOT NULL,
    `endTime` DOUBLE NOT NULL,
    `text` TEXT NOT NULL,
    `transcriptId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TranscriptSegment_transcriptId_idx`(`transcriptId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TranscriptSegment` ADD CONSTRAINT `TranscriptSegment_transcriptId_fkey` FOREIGN KEY (`transcriptId`) REFERENCES `Transcript`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
