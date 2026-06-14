-- Add updateChannelId to Guild for the update notification system
ALTER TABLE "Guild" ADD COLUMN "updateChannelId" TEXT;
