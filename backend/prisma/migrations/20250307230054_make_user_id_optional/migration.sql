/*
  Warnings:

  - A unique constraint covering the columns `[userId,timestamp]` on the table `BloodSugarReading` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "BloodSugarReading" ADD COLUMN     "isEmbedded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "BloodSugarReading_userId_idx" ON "BloodSugarReading"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BloodSugarReading_userId_timestamp_key" ON "BloodSugarReading"("userId", "timestamp");
