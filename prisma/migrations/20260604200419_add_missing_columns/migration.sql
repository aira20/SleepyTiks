-- CreateEnum
CREATE TYPE "PremiumTier" AS ENUM ('NONE', 'BASIC', 'PRO', 'LIFETIME');

-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('SUPPORT', 'PURCHASE', 'MIDDLEMAN', 'REPORT', 'REFUND', 'PARTNERSHIP', 'SERVICE_REQUEST', 'APPEAL', 'SELLER_APPLICATION', 'STAFF_APPLICATION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'CLAIMED', 'IN_PROGRESS', 'WAITING_USER', 'WAITING_STAFF', 'ESCALATED', 'ON_HOLD', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'WAITING_PAYMENT', 'PAYMENT_CONFIRMED', 'DELIVERY_IN_PROGRESS', 'COMPLETED', 'DISPUTED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "BlacklistSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'EXTREME');

-- CreateEnum
CREATE TYPE "ScamType" AS ENUM ('NO_DELIVERY', 'FAKE_PRODUCT', 'CHARGEBACK', 'IMPERSONATION', 'PHISHING', 'BAIT_AND_SWITCH', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'CONFIRMED', 'DISMISSED', 'FALSE_REPORT');

-- CreateEnum
CREATE TYPE "AutomationTrigger" AS ENUM ('TICKET_OPENED', 'TICKET_UNCLAIMED_TIMEOUT', 'TICKET_INACTIVE_TIMEOUT', 'TICKET_CLOSED', 'TRANSACTION_STATUS_CHANGED', 'HIGH_PRIORITY_TICKET', 'BLACKLISTED_USER_TICKET', 'REPEAT_TICKET_OPENER');

-- CreateTable
CREATE TABLE "Guild" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "premiumTier" "PremiumTier" NOT NULL DEFAULT 'NONE',
    "premiumExpiresAt" TIMESTAMP(3),
    "premiumLicenseKey" TEXT,
    "logChannelId" TEXT,
    "transcriptChannelId" TEXT,
    "staffRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "adminRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "supportCategoryId" TEXT,
    "purchaseCategoryId" TEXT,
    "middlemanCategoryId" TEXT,
    "appealCategoryId" TEXT,
    "partnerCategoryId" TEXT,
    "reportCategoryId" TEXT,
    "maxOpenTicketsPerUser" INTEGER NOT NULL DEFAULT 3,
    "ticketCooldownSeconds" INTEGER NOT NULL DEFAULT 0,
    "autoCloseInactiveDays" INTEGER NOT NULL DEFAULT 7,
    "requireReasonOnClose" BOOLEAN NOT NULL DEFAULT false,
    "dmUserOnClose" BOOLEAN NOT NULL DEFAULT true,
    "transcriptsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ratingsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "totalTickets" INTEGER NOT NULL DEFAULT 0,
    "totalTransactions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketCategory" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT,
    "description" TEXT,
    "color" INTEGER,
    "discordCategoryId" TEXT,
    "staffRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "autoAssign" BOOLEAN NOT NULL DEFAULT false,
    "requiresForm" BOOLEAN NOT NULL DEFAULT true,
    "formFields" JSONB,
    "welcomeMessage" TEXT,
    "maxOpenPerUser" INTEGER NOT NULL DEFAULT 1,
    "cooldownSeconds" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPremiumOnly" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "ticketNumber" INTEGER NOT NULL,
    "guildId" TEXT NOT NULL,
    "type" "TicketType" NOT NULL,
    "categoryId" TEXT,
    "creatorId" TEXT NOT NULL,
    "creatorTag" TEXT NOT NULL,
    "claimedById" TEXT,
    "claimedByTag" TEXT,
    "channelId" TEXT NOT NULL,
    "channelName" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "formData" JSONB,
    "transactionId" TEXT,
    "firstResponseAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "reopenedAt" TIMESTAMP(3),
    "responseTimeSec" INTEGER,
    "resolutionTimeSec" INTEGER,
    "rating" INTEGER,
    "ratingComment" TEXT,
    "transcriptUrl" TEXT,
    "closedReason" TEXT,
    "closedById" TEXT,
    "closedByTag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketStatusHistory" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "fromStatus" "TicketStatus",
    "toStatus" "TicketStatus" NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedByTag" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffNote" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorTag" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketParticipant" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userTag" TEXT NOT NULL,
    "addedById" TEXT NOT NULL,
    "addedByTag" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "TicketParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketAttachment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedByTag" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketTag" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "addedById" TEXT NOT NULL,

    CONSTRAINT "TicketTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "humanId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "buyerTag" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "sellerTag" TEXT NOT NULL,
    "middlemanId" TEXT,
    "middlemanTag" TEXT,
    "item" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paymentMethod" TEXT NOT NULL,
    "notes" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "pendingAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "waitingPaymentAt" TIMESTAMP(3),
    "paymentConfirmedAt" TIMESTAMP(3),
    "deliveryStartedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "disputedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "disputeReason" TEXT,
    "disputeOpenedById" TEXT,
    "disputeResolution" TEXT,
    "disputeResolvedById" TEXT,
    "paymentProofUrl" TEXT,
    "deliveryProofUrl" TEXT,
    "cancelReason" TEXT,
    "cancelledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionStatusHistory" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "fromStatus" "TransactionStatus",
    "toStatus" "TransactionStatus" NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedByTag" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vouch" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "giverId" TEXT NOT NULL,
    "giverTag" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "receiverTag" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "transactionId" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isRemoved" BOOLEAN NOT NULL DEFAULT false,
    "removedById" TEXT,
    "removeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vouch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reputation" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userTag" TEXT NOT NULL,
    "totalVouches" INTEGER NOT NULL DEFAULT 0,
    "positiveVouches" INTEGER NOT NULL DEFAULT 0,
    "negativeVouches" INTEGER NOT NULL DEFAULT 0,
    "averageRating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "reputationScore" INTEGER NOT NULL DEFAULT 0,
    "totalDeals" INTEGER NOT NULL DEFAULT 0,
    "successfulDeals" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reputation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Blacklist" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userTag" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" TEXT,
    "addedById" TEXT NOT NULL,
    "addedByTag" TEXT NOT NULL,
    "severity" "BlacklistSeverity" NOT NULL DEFAULT 'MEDIUM',
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Blacklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScamReport" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reporterTag" TEXT NOT NULL,
    "accusedId" TEXT NOT NULL,
    "accusedTag" TEXT NOT NULL,
    "scamType" "ScamType" NOT NULL,
    "description" TEXT NOT NULL,
    "evidenceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "amountLost" DECIMAL(12,2),
    "currency" TEXT,
    "transactionId" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedByTag" TEXT,
    "reviewNotes" TEXT,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScamReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffStats" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userTag" TEXT NOT NULL,
    "ticketsClaimed" INTEGER NOT NULL DEFAULT 0,
    "ticketsClosed" INTEGER NOT NULL DEFAULT 0,
    "ticketsEscalated" INTEGER NOT NULL DEFAULT 0,
    "notesLeft" INTEGER NOT NULL DEFAULT 0,
    "messagesInTickets" INTEGER NOT NULL DEFAULT 0,
    "totalFirstResponseMs" BIGINT NOT NULL DEFAULT 0,
    "firstResponseCount" INTEGER NOT NULL DEFAULT 0,
    "totalResolutionMs" BIGINT NOT NULL DEFAULT 0,
    "resolutionCount" INTEGER NOT NULL DEFAULT 0,
    "totalRatingScore" INTEGER NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userTag" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationSec" INTEGER,
    "ticketsHandled" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsSnapshot" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "ticketsOpened" INTEGER NOT NULL DEFAULT 0,
    "ticketsClosed" INTEGER NOT NULL DEFAULT 0,
    "ticketsEscalated" INTEGER NOT NULL DEFAULT 0,
    "avgFirstResponseSec" INTEGER,
    "avgResolutionSec" INTEGER,
    "avgRating" DECIMAL(3,2),
    "ticketsByType" JSONB,
    "transactionsCreated" INTEGER NOT NULL DEFAULT 0,
    "transactionsCompleted" INTEGER NOT NULL DEFAULT 0,
    "transactionsDisputed" INTEGER NOT NULL DEFAULT 0,
    "totalVolumeUsd" DECIMAL(14,2),

    CONSTRAINT "AnalyticsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "trigger" "AutomationTrigger" NOT NULL,
    "conditions" JSONB,
    "actions" JSONB NOT NULL,
    "cooldownSec" INTEGER NOT NULL DEFAULT 3600,
    "lastFiredAt" TIMESTAMP(3),
    "fireCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCache" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "discriminator" TEXT NOT NULL DEFAULT '0',
    "avatarHash" TEXT,
    "accountCreatedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserGuildProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "ticketsOpened" INTEGER NOT NULL DEFAULT 0,
    "ticketsClosed" INTEGER NOT NULL DEFAULT 0,
    "lastTicketAt" TIMESTAMP(3),
    "cooldownUntil" TIMESTAMP(3),
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGuildProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Guild_premiumLicenseKey_key" ON "Guild"("premiumLicenseKey");

-- CreateIndex
CREATE INDEX "Guild_isPremium_idx" ON "Guild"("isPremium");

-- CreateIndex
CREATE INDEX "TicketCategory_guildId_isActive_idx" ON "TicketCategory"("guildId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_channelId_key" ON "Ticket"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_transactionId_key" ON "Ticket"("transactionId");

-- CreateIndex
CREATE INDEX "Ticket_guildId_status_idx" ON "Ticket"("guildId", "status");

-- CreateIndex
CREATE INDEX "Ticket_guildId_creatorId_idx" ON "Ticket"("guildId", "creatorId");

-- CreateIndex
CREATE INDEX "Ticket_guildId_claimedById_idx" ON "Ticket"("guildId", "claimedById");

-- CreateIndex
CREATE INDEX "Ticket_guildId_type_idx" ON "Ticket"("guildId", "type");

-- CreateIndex
CREATE INDEX "Ticket_channelId_idx" ON "Ticket"("channelId");

-- CreateIndex
CREATE INDEX "Ticket_guildId_createdAt_idx" ON "Ticket"("guildId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_guildId_ticketNumber_key" ON "Ticket"("guildId", "ticketNumber");

-- CreateIndex
CREATE INDEX "TicketStatusHistory_ticketId_idx" ON "TicketStatusHistory"("ticketId");

-- CreateIndex
CREATE INDEX "StaffNote_ticketId_idx" ON "StaffNote"("ticketId");

-- CreateIndex
CREATE INDEX "TicketParticipant_ticketId_idx" ON "TicketParticipant"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketParticipant_ticketId_userId_key" ON "TicketParticipant"("ticketId", "userId");

-- CreateIndex
CREATE INDEX "TicketAttachment_ticketId_idx" ON "TicketAttachment"("ticketId");

-- CreateIndex
CREATE INDEX "TicketTag_ticketId_idx" ON "TicketTag"("ticketId");

-- CreateIndex
CREATE INDEX "TicketTag_tag_idx" ON "TicketTag"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "TicketTag_ticketId_tag_key" ON "TicketTag"("ticketId", "tag");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_humanId_key" ON "Transaction"("humanId");

-- CreateIndex
CREATE INDEX "Transaction_guildId_status_idx" ON "Transaction"("guildId", "status");

-- CreateIndex
CREATE INDEX "Transaction_buyerId_idx" ON "Transaction"("buyerId");

-- CreateIndex
CREATE INDEX "Transaction_sellerId_idx" ON "Transaction"("sellerId");

-- CreateIndex
CREATE INDEX "Transaction_middlemanId_idx" ON "Transaction"("middlemanId");

-- CreateIndex
CREATE INDEX "Transaction_guildId_createdAt_idx" ON "Transaction"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "TransactionStatusHistory_transactionId_idx" ON "TransactionStatusHistory"("transactionId");

-- CreateIndex
CREATE INDEX "Vouch_guildId_receiverId_idx" ON "Vouch"("guildId", "receiverId");

-- CreateIndex
CREATE INDEX "Vouch_guildId_giverId_idx" ON "Vouch"("guildId", "giverId");

-- CreateIndex
CREATE INDEX "Vouch_giverId_receiverId_guildId_idx" ON "Vouch"("giverId", "receiverId", "guildId");

-- CreateIndex
CREATE INDEX "Reputation_guildId_reputationScore_idx" ON "Reputation"("guildId", "reputationScore");

-- CreateIndex
CREATE UNIQUE INDEX "Reputation_guildId_userId_key" ON "Reputation"("guildId", "userId");

-- CreateIndex
CREATE INDEX "Blacklist_userId_idx" ON "Blacklist"("userId");

-- CreateIndex
CREATE INDEX "Blacklist_guildId_isActive_idx" ON "Blacklist"("guildId", "isActive");

-- CreateIndex
CREATE INDEX "Blacklist_isGlobal_isActive_idx" ON "Blacklist"("isGlobal", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Blacklist_guildId_userId_key" ON "Blacklist"("guildId", "userId");

-- CreateIndex
CREATE INDEX "ScamReport_guildId_status_idx" ON "ScamReport"("guildId", "status");

-- CreateIndex
CREATE INDEX "ScamReport_accusedId_idx" ON "ScamReport"("accusedId");

-- CreateIndex
CREATE INDEX "ScamReport_reporterId_idx" ON "ScamReport"("reporterId");

-- CreateIndex
CREATE INDEX "StaffStats_guildId_ticketsClosed_idx" ON "StaffStats"("guildId", "ticketsClosed");

-- CreateIndex
CREATE UNIQUE INDEX "StaffStats_guildId_userId_key" ON "StaffStats"("guildId", "userId");

-- CreateIndex
CREATE INDEX "Shift_guildId_userId_idx" ON "Shift"("guildId", "userId");

-- CreateIndex
CREATE INDEX "Shift_guildId_startedAt_idx" ON "Shift"("guildId", "startedAt");

-- CreateIndex
CREATE INDEX "AnalyticsSnapshot_guildId_date_idx" ON "AnalyticsSnapshot"("guildId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsSnapshot_guildId_date_key" ON "AnalyticsSnapshot"("guildId", "date");

-- CreateIndex
CREATE INDEX "AutomationRule_guildId_isActive_trigger_idx" ON "AutomationRule"("guildId", "isActive", "trigger");

-- CreateIndex
CREATE INDEX "UserGuildProfile_guildId_isBanned_idx" ON "UserGuildProfile"("guildId", "isBanned");

-- CreateIndex
CREATE UNIQUE INDEX "UserGuildProfile_userId_guildId_key" ON "UserGuildProfile"("userId", "guildId");

-- AddForeignKey
ALTER TABLE "TicketCategory" ADD CONSTRAINT "TicketCategory_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TicketCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketStatusHistory" ADD CONSTRAINT "TicketStatusHistory_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffNote" ADD CONSTRAINT "StaffNote_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketParticipant" ADD CONSTRAINT "TicketParticipant_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketTag" ADD CONSTRAINT "TicketTag_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionStatusHistory" ADD CONSTRAINT "TransactionStatusHistory_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vouch" ADD CONSTRAINT "Vouch_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reputation" ADD CONSTRAINT "Reputation_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blacklist" ADD CONSTRAINT "Blacklist_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScamReport" ADD CONSTRAINT "ScamReport_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffStats" ADD CONSTRAINT "StaffStats_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsSnapshot" ADD CONSTRAINT "AnalyticsSnapshot_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGuildProfile" ADD CONSTRAINT "UserGuildProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserCache"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
