-- Initial schema for the Discord bot. Apply only to a new/empty database
-- unless the existing database has been reviewed and baselined first.
CREATE TABLE "GuildConfig" (
    "guildId" TEXT NOT NULL,
    "ticketCategoryId" TEXT,
    "ticketClosedCategoryId" TEXT,
    "ticketLogChannelId" TEXT,
    "ticketPanelChannelId" TEXT,
    "ticketPanelMessageId" TEXT,
    "ticketStaffRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ticketTranscriptEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ticketMessageLoggingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "allowDuplicateTickets" BOOLEAN NOT NULL DEFAULT false,
    "moderationLogChannel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GuildConfig_pkey" PRIMARY KEY ("guildId")
);

CREATE TABLE "LogSetting" (
    "guildId" TEXT NOT NULL,
    "generalChannelId" TEXT,
    "messageChannelId" TEXT,
    "memberChannelId" TEXT,
    "voiceChannelId" TEXT,
    "roleChannelId" TEXT,
    "channelChannelId" TEXT,
    "moderationChannelId" TEXT,
    "ticketChannelId" TEXT,
    "levelChannelId" TEXT,
    CONSTRAINT "LogSetting_pkey" PRIMARY KEY ("guildId")
);

CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "ticketType" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "assigneeId" TEXT,
    "openKey" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModerationCase" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModerationCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InteractiveRole" (
    "guildId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT,
    "emoji" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InteractiveRole_pkey" PRIMARY KEY ("guildId", "roleId")
);

CREATE TABLE "GuildEvent" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "maxParticipants" INTEGER NOT NULL DEFAULT 20,
    "rewards" TEXT NOT NULL DEFAULT 'غير محدد',
    "rules" TEXT NOT NULL DEFAULT 'لا توجد شروط',
    "channelId" TEXT,
    "imageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "eventNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuildEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GuildEventParticipant" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuildEventParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Ticket_channelId_key" ON "Ticket"("channelId");
CREATE UNIQUE INDEX "Ticket_openKey_key" ON "Ticket"("openKey");
CREATE INDEX "Ticket_guildId_status_idx" ON "Ticket"("guildId", "status");
CREATE INDEX "Ticket_guildId_creatorId_ticketType_status_idx"
    ON "Ticket"("guildId", "creatorId", "ticketType", "status");
CREATE INDEX "ModerationCase_guildId_createdAt_idx"
    ON "ModerationCase"("guildId", "createdAt");
CREATE INDEX "InteractiveRole_guildId_category_idx"
    ON "InteractiveRole"("guildId", "category");
CREATE INDEX "GuildEvent_guildId_name_idx" ON "GuildEvent"("guildId", "name");
CREATE INDEX "GuildEventParticipant_eventId_joinedAt_idx"
    ON "GuildEventParticipant"("eventId", "joinedAt");
CREATE UNIQUE INDEX "GuildEventParticipant_guildId_eventId_userId_key"
    ON "GuildEventParticipant"("guildId", "eventId", "userId");

ALTER TABLE "GuildEventParticipant"
    ADD CONSTRAINT "GuildEventParticipant_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "GuildEvent"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
