-- Padel Match identity, lock, and history.
-- Additive only: existing Venue rows are unchanged (FK from Match.venueCmsId).
-- Empty DB: Venue table already exists from the prior migration; this creates Match tables.
-- Venue-only DB: no Venue columns dropped or rewritten.

CREATE TYPE "MatchRuleset" AS ENUM ('golden_point', 'advantage');
CREATE TYPE "MatchStatus" AS ENUM ('live', 'locked');
CREATE TYPE "MatchTeam" AS ENUM ('A', 'B');
CREATE TYPE "MatchPlayerSlot" AS ENUM ('A1', 'A2', 'B1', 'B2');

CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "venueCmsId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "ruleset" "MatchRuleset" NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'live',
    "servingTeam" "MatchTeam",
    "winnerTeam" "MatchTeam",
    "lockedAt" TIMESTAMP(3),
    "score" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MatchPlayer" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "slot" "MatchPlayerSlot" NOT NULL,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "isGuest" BOOLEAN NOT NULL,

    CONSTRAINT "MatchPlayer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Match_venueCmsId_idx" ON "Match"("venueCmsId");
CREATE INDEX "Match_status_startsAt_idx" ON "Match"("status", "startsAt");
CREATE UNIQUE INDEX "MatchPlayer_matchId_slot_key" ON "MatchPlayer"("matchId", "slot");
CREATE INDEX "MatchPlayer_userId_idx" ON "MatchPlayer"("userId");

ALTER TABLE "Match" ADD CONSTRAINT "Match_venueCmsId_fkey" FOREIGN KEY ("venueCmsId") REFERENCES "Venue"("cmsId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MatchPlayer" ADD CONSTRAINT "MatchPlayer_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
