-- CreateTable
CREATE TABLE "CoverageIntent" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "sport" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "sourcePage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsubscribedAt" TIMESTAMP(3),

    CONSTRAINT "CoverageIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoverageIntent_email_sport_city_key" ON "CoverageIntent"("email", "sport", "city");

-- CreateIndex
CREATE INDEX "CoverageIntent_email_idx" ON "CoverageIntent"("email");

-- CreateIndex
CREATE INDEX "CoverageIntent_unsubscribedAt_idx" ON "CoverageIntent"("unsubscribedAt");
