-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('live', 'closed');

-- CreateTable
CREATE TABLE "Lobby" (
    "id" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lobby_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "venueId" TEXT,
    "sport" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "state" JSONB NOT NULL,
    "createdBy" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'live',
    "lobbyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lobby_joinCode_key" ON "Lobby"("joinCode");

-- CreateIndex
CREATE UNIQUE INDEX "Session_lobbyId_key" ON "Session"("lobbyId");

-- CreateIndex
CREATE INDEX "Session_venueId_idx" ON "Session"("venueId");

-- CreateIndex
CREATE INDEX "Session_sport_idx" ON "Session"("sport");

-- CreateIndex
CREATE INDEX "Session_createdAt_idx" ON "Session"("createdAt");

-- CreateIndex
CREATE INDEX "Session_updatedAt_idx" ON "Session"("updatedAt");

-- CreateIndex
CREATE INDEX "SessionEvent_createdAt_idx" ON "SessionEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SessionEvent_sessionId_seq_key" ON "SessionEvent"("sessionId", "seq");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEvent" ADD CONSTRAINT "SessionEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
