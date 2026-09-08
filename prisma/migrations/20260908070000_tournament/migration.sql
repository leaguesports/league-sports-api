-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('draft', 'registration', 'active', 'completed');

-- CreateEnum
CREATE TYPE "TournamentRegistrationStatus" AS ENUM ('pending', 'accepted', 'withdrawn');

-- CreateEnum
CREATE TYPE "TournamentSlotSide" AS ENUM ('home', 'away');

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sport" "TeamSport" NOT NULL,
    "size" INTEGER NOT NULL,
    "status" "TournamentStatus" NOT NULL DEFAULT 'draft',
    "venueCmsId" TEXT,
    "startsAt" TIMESTAMP(3),
    "organizerUserId" TEXT NOT NULL,
    "winnerTeamId" TEXT,
    "inviteToken" VARCHAR(32) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentRegistration" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "status" "TournamentRegistrationStatus" NOT NULL DEFAULT 'pending',
    "seed" INTEGER,
    "registeredBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentSlot" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "homeTeamId" TEXT,
    "awayTeamId" TEXT,
    "homeSeed" INTEGER,
    "awaySeed" INTEGER,
    "teamMatchId" TEXT,
    "winnerTeamId" TEXT,
    "nextSlotId" TEXT,
    "nextSide" "TournamentSlotSide",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tournament_inviteToken_key" ON "Tournament"("inviteToken");

-- CreateIndex
CREATE INDEX "Tournament_organizerUserId_idx" ON "Tournament"("organizerUserId");

-- CreateIndex
CREATE INDEX "Tournament_status_startsAt_idx" ON "Tournament"("status", "startsAt");

-- CreateIndex
CREATE INDEX "Tournament_organizerUserId_status_idx" ON "Tournament"("organizerUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentRegistration_tournamentId_teamId_key" ON "TournamentRegistration"("tournamentId", "teamId");

-- CreateIndex
CREATE INDEX "TournamentRegistration_teamId_idx" ON "TournamentRegistration"("teamId");

-- CreateIndex
CREATE INDEX "TournamentRegistration_tournamentId_idx" ON "TournamentRegistration"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentSlot_teamMatchId_key" ON "TournamentSlot"("teamMatchId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentSlot_tournamentId_round_position_key" ON "TournamentSlot"("tournamentId", "round", "position");

-- CreateIndex
CREATE INDEX "TournamentSlot_tournamentId_idx" ON "TournamentSlot"("tournamentId");

-- CreateIndex
CREATE INDEX "TournamentSlot_teamMatchId_idx" ON "TournamentSlot"("teamMatchId");

-- AddForeignKey
ALTER TABLE "TournamentRegistration" ADD CONSTRAINT "TournamentRegistration_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentRegistration" ADD CONSTRAINT "TournamentRegistration_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentSlot" ADD CONSTRAINT "TournamentSlot_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentSlot" ADD CONSTRAINT "TournamentSlot_teamMatchId_fkey" FOREIGN KEY ("teamMatchId") REFERENCES "TeamMatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
