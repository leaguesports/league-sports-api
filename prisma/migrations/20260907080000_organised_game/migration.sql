-- CreateEnum
CREATE TYPE "OrganisedGameSport" AS ENUM ('padel', 'golf');

-- CreateEnum
CREATE TYPE "OrganisedGameStatus" AS ENUM ('open', 'started', 'cancelled');

-- CreateEnum
CREATE TYPE "OrganisedGameRsvp" AS ENUM ('pending', 'accepted', 'declined');

-- CreateTable
CREATE TABLE "OrganisedGame" (
    "id" TEXT NOT NULL,
    "hostUserId" TEXT NOT NULL,
    "sport" "OrganisedGameSport" NOT NULL,
    "status" "OrganisedGameStatus" NOT NULL DEFAULT 'open',
    "venueCmsId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "capacity" INTEGER NOT NULL,
    "inviteToken" VARCHAR(32) NOT NULL,
    "liveScorecardId" TEXT,
    "livePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganisedGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganisedGameInvite" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rsvp" "OrganisedGameRsvp" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "OrganisedGameInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganisedGame_inviteToken_key" ON "OrganisedGame"("inviteToken");

-- CreateIndex
CREATE INDEX "OrganisedGame_hostUserId_idx" ON "OrganisedGame"("hostUserId");

-- CreateIndex
CREATE INDEX "OrganisedGame_venueCmsId_idx" ON "OrganisedGame"("venueCmsId");

-- CreateIndex
CREATE INDEX "OrganisedGame_status_startsAt_idx" ON "OrganisedGame"("status", "startsAt");

-- CreateIndex
CREATE INDEX "OrganisedGame_hostUserId_status_idx" ON "OrganisedGame"("hostUserId", "status");

-- CreateIndex
CREATE INDEX "OrganisedGameInvite_userId_idx" ON "OrganisedGameInvite"("userId");

-- CreateIndex
CREATE INDEX "OrganisedGameInvite_gameId_idx" ON "OrganisedGameInvite"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganisedGameInvite_gameId_userId_key" ON "OrganisedGameInvite"("gameId", "userId");

-- AddForeignKey
ALTER TABLE "OrganisedGame" ADD CONSTRAINT "OrganisedGame_venueCmsId_fkey" FOREIGN KEY ("venueCmsId") REFERENCES "Venue"("cmsId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisedGameInvite" ADD CONSTRAINT "OrganisedGameInvite_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "OrganisedGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;
