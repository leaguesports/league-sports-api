-- Golf game days: invite-code days, cards, and a nullable link from GolfRound.
-- Additive. Existing golf rounds, tours, and organised games are unchanged.

CREATE TYPE "GameDayFormat" AS ENUM ('stroke', 'scramble');
CREATE TYPE "GameDayStatus" AS ENUM ('setup', 'in_play', 'final');
CREATE TYPE "GameDayCardStatus" AS ENUM ('live', 'locked');

CREATE TABLE "WeekendEvent" (
    "id" TEXT NOT NULL,
    "organiserUserId" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeekendEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GameDay" (
    "id" TEXT NOT NULL,
    "organiserUserId" TEXT NOT NULL,
    "venueCmsId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "defaultTee" TEXT NOT NULL,
    "teeOptions" JSONB NOT NULL,
    "format" "GameDayFormat" NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "watchToken" TEXT NOT NULL,
    "watchTokenHash" TEXT NOT NULL,
    "status" "GameDayStatus" NOT NULL DEFAULT 'setup',
    "weekendEventId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameDay_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GameDayCard" (
    "id" TEXT NOT NULL,
    "gameDayId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "golfRoundId" TEXT NOT NULL,
    "scorerPlayerId" TEXT NOT NULL,
    "status" "GameDayCardStatus" NOT NULL DEFAULT 'live',
    "holesPlayed" INTEGER NOT NULL,
    "startingHole" INTEGER NOT NULL,
    "course" JSONB NOT NULL,
    "tees" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameDayCard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GameDayPlayer" (
    "id" TEXT NOT NULL,
    "gameDayId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "userId" TEXT,
    "handicapIndex" DECIMAL(4,1),
    "teeName" TEXT NOT NULL,
    "cardId" TEXT,
    "slot" INTEGER,
    "deviceTokenHash" TEXT,
    "looksRight" BOOLEAN NOT NULL DEFAULT false,
    "courseRating" DECIMAL(4,1),
    "slopeRating" INTEGER,
    "teePar" INTEGER,
    "courseHandicap" INTEGER,
    "playingHandicap" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameDayPlayer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GameDayHoleScore" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "holeNumber" INTEGER NOT NULL,
    "strokes" JSONB NOT NULL,
    "clientTimestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameDayHoleScore_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GameDayFeedEvent" (
    "id" TEXT NOT NULL,
    "gameDayId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameDayFeedEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "GolfRound" ADD COLUMN "gameDayId" TEXT;

CREATE UNIQUE INDEX "GameDay_inviteCode_key" ON "GameDay"("inviteCode");
CREATE UNIQUE INDEX "GameDay_watchTokenHash_key" ON "GameDay"("watchTokenHash");
CREATE INDEX "GameDay_organiserUserId_idx" ON "GameDay"("organiserUserId");
CREATE INDEX "GameDay_venueCmsId_idx" ON "GameDay"("venueCmsId");
CREATE INDEX "GameDay_weekendEventId_idx" ON "GameDay"("weekendEventId");
CREATE INDEX "WeekendEvent_organiserUserId_idx" ON "WeekendEvent"("organiserUserId");

CREATE UNIQUE INDEX "GameDayCard_golfRoundId_key" ON "GameDayCard"("golfRoundId");
CREATE UNIQUE INDEX "GameDayCard_gameDayId_number_key" ON "GameDayCard"("gameDayId", "number");
CREATE INDEX "GameDayCard_gameDayId_idx" ON "GameDayCard"("gameDayId");

CREATE INDEX "GameDayPlayer_gameDayId_idx" ON "GameDayPlayer"("gameDayId");
CREATE INDEX "GameDayPlayer_cardId_idx" ON "GameDayPlayer"("cardId");
CREATE INDEX "GameDayPlayer_deviceTokenHash_idx" ON "GameDayPlayer"("deviceTokenHash");
CREATE INDEX "GameDayPlayer_userId_idx" ON "GameDayPlayer"("userId");

CREATE UNIQUE INDEX "GameDayHoleScore_cardId_holeNumber_key" ON "GameDayHoleScore"("cardId", "holeNumber");
CREATE INDEX "GameDayHoleScore_cardId_idx" ON "GameDayHoleScore"("cardId");
CREATE INDEX "GameDayFeedEvent_gameDayId_createdAt_idx" ON "GameDayFeedEvent"("gameDayId", "createdAt");
CREATE INDEX "GolfRound_gameDayId_idx" ON "GolfRound"("gameDayId");

ALTER TABLE "WeekendEvent" ADD CONSTRAINT "WeekendEvent_organiserUserId_fkey" FOREIGN KEY ("organiserUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GameDay" ADD CONSTRAINT "GameDay_organiserUserId_fkey" FOREIGN KEY ("organiserUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GameDay" ADD CONSTRAINT "GameDay_venueCmsId_fkey" FOREIGN KEY ("venueCmsId") REFERENCES "Venue"("cmsId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GameDay" ADD CONSTRAINT "GameDay_weekendEventId_fkey" FOREIGN KEY ("weekendEventId") REFERENCES "WeekendEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GameDayCard" ADD CONSTRAINT "GameDayCard_gameDayId_fkey" FOREIGN KEY ("gameDayId") REFERENCES "GameDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameDayCard" ADD CONSTRAINT "GameDayCard_golfRoundId_fkey" FOREIGN KEY ("golfRoundId") REFERENCES "GolfRound"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GameDayPlayer" ADD CONSTRAINT "GameDayPlayer_gameDayId_fkey" FOREIGN KEY ("gameDayId") REFERENCES "GameDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameDayPlayer" ADD CONSTRAINT "GameDayPlayer_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "GameDayCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GameDayHoleScore" ADD CONSTRAINT "GameDayHoleScore_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "GameDayCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameDayFeedEvent" ADD CONSTRAINT "GameDayFeedEvent_gameDayId_fkey" FOREIGN KEY ("gameDayId") REFERENCES "GameDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GolfRound" ADD CONSTRAINT "GolfRound_gameDayId_fkey" FOREIGN KEY ("gameDayId") REFERENCES "GameDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;
