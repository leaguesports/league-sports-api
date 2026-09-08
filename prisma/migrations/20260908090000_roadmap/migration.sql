-- CreateEnum
CREATE TYPE "RoadmapFeatureStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'SHIPPED');

-- CreateEnum
CREATE TYPE "RoadmapRequestType" AS ENUM ('FEATURE_REQUEST', 'BUG');

-- CreateEnum
CREATE TYPE "RoadmapRequestStatus" AS ENUM ('NEW', 'PLANNED', 'DONE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "RoadmapFeature" (
    "id" TEXT NOT NULL,
    "slug" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "RoadmapFeatureStatus" NOT NULL DEFAULT 'PLANNED',
    "shippedAt" TIMESTAMP(3),
    "githubIssueUrl" TEXT,
    "voteCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "RoadmapFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoadmapVote" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "voterKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoadmapVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoadmapNotify" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "unsubscribedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoadmapNotify_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoadmapRequest" (
    "id" TEXT NOT NULL,
    "type" "RoadmapRequestType" NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "email" TEXT,
    "status" "RoadmapRequestStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoadmapRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoadmapFeature_slug_key" ON "RoadmapFeature"("slug");

-- CreateIndex
CREATE INDEX "RoadmapFeature_status_idx" ON "RoadmapFeature"("status");

-- CreateIndex
CREATE INDEX "RoadmapFeature_createdAt_idx" ON "RoadmapFeature"("createdAt");

-- CreateIndex
CREATE INDEX "RoadmapFeature_voteCount_idx" ON "RoadmapFeature"("voteCount");

-- CreateIndex
CREATE UNIQUE INDEX "RoadmapVote_featureId_voterKey_key" ON "RoadmapVote"("featureId", "voterKey");

-- CreateIndex
CREATE INDEX "RoadmapVote_featureId_idx" ON "RoadmapVote"("featureId");

-- CreateIndex
CREATE INDEX "RoadmapVote_voterKey_idx" ON "RoadmapVote"("voterKey");

-- CreateIndex
CREATE UNIQUE INDEX "RoadmapNotify_featureId_email_key" ON "RoadmapNotify"("featureId", "email");

-- CreateIndex
CREATE INDEX "RoadmapNotify_email_idx" ON "RoadmapNotify"("email");

-- CreateIndex
CREATE INDEX "RoadmapNotify_featureId_idx" ON "RoadmapNotify"("featureId");

-- CreateIndex
CREATE INDEX "RoadmapRequest_status_createdAt_idx" ON "RoadmapRequest"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "RoadmapVote" ADD CONSTRAINT "RoadmapVote_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "RoadmapFeature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadmapNotify" ADD CONSTRAINT "RoadmapNotify_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "RoadmapFeature"("id") ON DELETE CASCADE ON UPDATE CASCADE;
