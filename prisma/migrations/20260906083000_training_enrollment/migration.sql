-- CreateEnum
CREATE TYPE "TrainingEnrollmentStatus" AS ENUM ('active', 'completed');

-- CreateTable
CREATE TABLE "TrainingEnrollment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "TrainingEnrollmentStatus" NOT NULL DEFAULT 'active',
    "completedStepIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "percentComplete" INTEGER NOT NULL DEFAULT 0,
    "currentStepIndex" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "TrainingEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingEnrollment_userId_idx" ON "TrainingEnrollment"("userId");

-- CreateIndex
CREATE INDEX "TrainingEnrollment_userId_planId_status_idx" ON "TrainingEnrollment"("userId", "planId", "status");

-- At most one active enrollment per user+plan. Completed history may repeat.
CREATE UNIQUE INDEX "TrainingEnrollment_userId_planId_active_key" ON "TrainingEnrollment"("userId", "planId") WHERE "status" = 'active';
