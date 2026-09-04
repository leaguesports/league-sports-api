-- GolfRound identity, lock, and history.
-- Additive only: existing Venue and Match rows are unchanged.

CREATE TYPE "GolfRoundStatus" AS ENUM ('live', 'locked');

CREATE TABLE "GolfRound" (
    "id" TEXT NOT NULL,
    "venueCmsId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "status" "GolfRoundStatus" NOT NULL DEFAULT 'live',
    "holesPlayed" INTEGER NOT NULL,
    "startingHole" INTEGER NOT NULL DEFAULT 1,
    "teeName" TEXT,
    "course" JSONB NOT NULL,
    "score" JSONB,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GolfRound_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GolfRoundPlayer" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "isGuest" BOOLEAN NOT NULL,

    CONSTRAINT "GolfRoundPlayer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GolfRound_venueCmsId_idx" ON "GolfRound"("venueCmsId");
CREATE INDEX "GolfRound_status_startsAt_idx" ON "GolfRound"("status", "startsAt");
CREATE UNIQUE INDEX "GolfRoundPlayer_roundId_slot_key" ON "GolfRoundPlayer"("roundId", "slot");
CREATE INDEX "GolfRoundPlayer_userId_idx" ON "GolfRoundPlayer"("userId");

ALTER TABLE "GolfRound" ADD CONSTRAINT "GolfRound_venueCmsId_fkey" FOREIGN KEY ("venueCmsId") REFERENCES "Venue"("cmsId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GolfRoundPlayer" ADD CONSTRAINT "GolfRoundPlayer_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "GolfRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
