-- Darts 501 (double-out) live + capture.
-- Additive only. venueCmsId is nullable so pub/home games skip Venue.

CREATE TYPE "DartsMatchStatus" AS ENUM ('live', 'locked');

CREATE TABLE "DartsMatch" (
    "id" TEXT NOT NULL,
    "venueCmsId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "startingScore" INTEGER NOT NULL DEFAULT 501,
    "status" "DartsMatchStatus" NOT NULL DEFAULT 'live',
    "winnerSlot" INTEGER,
    "lockedAt" TIMESTAMP(3),
    "lockedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DartsMatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DartsMatchPlayer" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "isGuest" BOOLEAN NOT NULL,
    "remaining" INTEGER NOT NULL,

    CONSTRAINT "DartsMatchPlayer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DartsTurn" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "turnNumber" INTEGER NOT NULL,
    "playerSlot" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "bust" BOOLEAN NOT NULL,
    "checkout" BOOLEAN NOT NULL,
    "remainingAfter" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DartsTurn_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DartsMatch_venueCmsId_idx" ON "DartsMatch"("venueCmsId");
CREATE INDEX "DartsMatch_status_startsAt_idx" ON "DartsMatch"("status", "startsAt");
CREATE INDEX "DartsMatch_lockedByUserId_idx" ON "DartsMatch"("lockedByUserId");
CREATE UNIQUE INDEX "DartsMatchPlayer_matchId_slot_key" ON "DartsMatchPlayer"("matchId", "slot");
CREATE INDEX "DartsMatchPlayer_userId_idx" ON "DartsMatchPlayer"("userId");
CREATE UNIQUE INDEX "DartsTurn_matchId_turnNumber_key" ON "DartsTurn"("matchId", "turnNumber");
CREATE INDEX "DartsTurn_matchId_idx" ON "DartsTurn"("matchId");

ALTER TABLE "DartsMatch" ADD CONSTRAINT "DartsMatch_venueCmsId_fkey" FOREIGN KEY ("venueCmsId") REFERENCES "Venue"("cmsId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DartsMatchPlayer" ADD CONSTRAINT "DartsMatchPlayer_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "DartsMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DartsTurn" ADD CONSTRAINT "DartsTurn_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "DartsMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
