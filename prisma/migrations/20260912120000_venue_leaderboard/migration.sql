-- Venue leaderboards v1: Profile opt-out + durable event facts + board snapshots.

ALTER TABLE "Profile" ADD COLUMN "appearOnVenueLeaderboards" BOOLEAN NOT NULL DEFAULT true;

CREATE TYPE "VenueLeaderboardSport" AS ENUM ('padel', 'golf', 'darts');
CREATE TYPE "VenueLeaderboardBoard" AS ENUM ('records', 'potm', 'grinder', 'streak');

CREATE TABLE "VenueLeaderboardEventFact" (
    "id" TEXT NOT NULL,
    "venueCmsId" TEXT NOT NULL,
    "sport" "VenueLeaderboardSport" NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL,
    "won" BOOLEAN,
    "golfGross" INTEGER,
    "golfNet" INTEGER,
    "golfTeeId" TEXT,
    "golfTeeName" TEXT,
    "golfHolesPlayed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueLeaderboardEventFact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VenueLeaderboardSnapshot" (
    "id" TEXT NOT NULL,
    "venueCmsId" TEXT NOT NULL,
    "board" "VenueLeaderboardBoard" NOT NULL,
    "windowKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenueLeaderboardSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VenueLeaderboardEventFact_venueCmsId_sport_eventId_userId_key"
    ON "VenueLeaderboardEventFact"("venueCmsId", "sport", "eventId", "userId");
CREATE INDEX "VenueLeaderboardEventFact_venueCmsId_sport_idx"
    ON "VenueLeaderboardEventFact"("venueCmsId", "sport");
CREATE INDEX "VenueLeaderboardEventFact_userId_idx"
    ON "VenueLeaderboardEventFact"("userId");
CREATE INDEX "VenueLeaderboardEventFact_venueCmsId_lockedAt_idx"
    ON "VenueLeaderboardEventFact"("venueCmsId", "lockedAt");

CREATE UNIQUE INDEX "VenueLeaderboardSnapshot_venueCmsId_board_windowKey_key"
    ON "VenueLeaderboardSnapshot"("venueCmsId", "board", "windowKey");
CREATE INDEX "VenueLeaderboardSnapshot_venueCmsId_idx"
    ON "VenueLeaderboardSnapshot"("venueCmsId");

ALTER TABLE "VenueLeaderboardEventFact"
    ADD CONSTRAINT "VenueLeaderboardEventFact_venueCmsId_fkey"
    FOREIGN KEY ("venueCmsId") REFERENCES "Venue"("cmsId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VenueLeaderboardSnapshot"
    ADD CONSTRAINT "VenueLeaderboardSnapshot_venueCmsId_fkey"
    FOREIGN KEY ("venueCmsId") REFERENCES "Venue"("cmsId") ON DELETE RESTRICT ON UPDATE CASCADE;
