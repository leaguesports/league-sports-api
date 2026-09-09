-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'lobby_open_game_compatible';
ALTER TYPE "NotificationType" ADD VALUE 'lobby_proposal_ready';
ALTER TYPE "NotificationType" ADD VALUE 'lobby_open_game_joined';
ALTER TYPE "NotificationType" ADD VALUE 'lobby_open_game_filled';

-- CreateEnum
CREATE TYPE "LobbySport" AS ENUM ('padel', 'darts', 'golf');

-- CreateEnum
CREATE TYPE "LobbySkill" AS ENUM ('casual', 'intermediate', 'competitive');

-- CreateEnum
CREATE TYPE "LobbyOpenGameStatus" AS ENUM ('open', 'filled', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "LobbyProposalStatus" AS ENUM ('pending', 'accepted', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "LobbyProposalResponse" AS ENUM ('pending', 'accept', 'pass');

-- CreateTable
CREATE TABLE "LobbyLooking" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sport" "LobbySport" NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "city" TEXT NOT NULL,
    "area" TEXT,
    "venueCmsId" TEXT,
    "partySize" INTEGER NOT NULL,
    "skill" "LobbySkill",
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LobbyLooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LobbyOpenGame" (
    "id" TEXT NOT NULL,
    "hostUserId" TEXT NOT NULL,
    "sport" "LobbySport" NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "city" TEXT NOT NULL,
    "area" TEXT,
    "venueCmsId" TEXT,
    "slotsNeeded" INTEGER NOT NULL,
    "slotsFilled" INTEGER NOT NULL,
    "skill" "LobbySkill",
    "status" "LobbyOpenGameStatus" NOT NULL DEFAULT 'open',
    "organiseGameId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LobbyOpenGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LobbyOpenGameMember" (
    "id" TEXT NOT NULL,
    "openGameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "partySize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LobbyOpenGameMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LobbyProposal" (
    "id" TEXT NOT NULL,
    "sport" "LobbySport" NOT NULL,
    "city" TEXT NOT NULL,
    "area" TEXT,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "venueCmsId" TEXT,
    "skill" "LobbySkill",
    "status" "LobbyProposalStatus" NOT NULL DEFAULT 'pending',
    "organiseGameId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LobbyProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LobbyProposalMember" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "partySize" INTEGER NOT NULL,
    "response" "LobbyProposalResponse" NOT NULL DEFAULT 'pending',
    "lookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "LobbyProposalMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LobbyLooking_userId_key" ON "LobbyLooking"("userId");

-- CreateIndex
CREATE INDEX "LobbyLooking_sport_city_expiresAt_idx" ON "LobbyLooking"("sport", "city", "expiresAt");

-- CreateIndex
CREATE INDEX "LobbyLooking_expiresAt_idx" ON "LobbyLooking"("expiresAt");

-- CreateIndex
CREATE INDEX "LobbyOpenGame_sport_city_status_idx" ON "LobbyOpenGame"("sport", "city", "status");

-- CreateIndex
CREATE INDEX "LobbyOpenGame_hostUserId_idx" ON "LobbyOpenGame"("hostUserId");

-- CreateIndex
CREATE INDEX "LobbyOpenGame_status_windowEnd_idx" ON "LobbyOpenGame"("status", "windowEnd");

-- CreateIndex
CREATE UNIQUE INDEX "LobbyOpenGameMember_openGameId_userId_key" ON "LobbyOpenGameMember"("openGameId", "userId");

-- CreateIndex
CREATE INDEX "LobbyOpenGameMember_userId_idx" ON "LobbyOpenGameMember"("userId");

-- CreateIndex
CREATE INDEX "LobbyOpenGameMember_openGameId_idx" ON "LobbyOpenGameMember"("openGameId");

-- CreateIndex
CREATE INDEX "LobbyProposal_sport_city_status_idx" ON "LobbyProposal"("sport", "city", "status");

-- CreateIndex
CREATE INDEX "LobbyProposal_status_windowEnd_idx" ON "LobbyProposal"("status", "windowEnd");

-- CreateIndex
CREATE UNIQUE INDEX "LobbyProposalMember_proposalId_userId_key" ON "LobbyProposalMember"("proposalId", "userId");

-- CreateIndex
CREATE INDEX "LobbyProposalMember_userId_idx" ON "LobbyProposalMember"("userId");

-- CreateIndex
CREATE INDEX "LobbyProposalMember_proposalId_idx" ON "LobbyProposalMember"("proposalId");

-- AddForeignKey
ALTER TABLE "LobbyOpenGameMember" ADD CONSTRAINT "LobbyOpenGameMember_openGameId_fkey" FOREIGN KEY ("openGameId") REFERENCES "LobbyOpenGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LobbyProposalMember" ADD CONSTRAINT "LobbyProposalMember_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "LobbyProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
