-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "activeSportSlug" TEXT;
ALTER TABLE "Profile" ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);
ALTER TABLE "Profile" ADD COLUMN "onboardingSkippedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SportFollow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sportSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SportFollow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SportFollow_userId_idx" ON "SportFollow"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SportFollow_userId_sportSlug_key" ON "SportFollow"("userId", "sportSlug");
