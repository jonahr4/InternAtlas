-- CreateIndex
CREATE INDEX "Job_postedAt_idx" ON "Job"("postedAt");

-- CreateIndex
CREATE INDEX "Job_lastSeenAt_idx" ON "Job"("lastSeenAt");

-- CreateIndex
CREATE INDEX "Job_createdAt_idx" ON "Job"("createdAt");

-- CreateIndex
CREATE INDEX "Job_employmentType_idx" ON "Job"("employmentType");

-- CreateIndex
CREATE INDEX "Job_locationType_idx" ON "Job"("locationType");

-- CreateIndex
CREATE INDEX "Job_sourcePlatform_idx" ON "Job"("sourcePlatform");

-- CreateIndex
CREATE INDEX "Job_title_idx" ON "Job"("title");

-- CreateIndex
CREATE INDEX "Job_status_postedAt_idx" ON "Job"("status", "postedAt");

-- CreateIndex
CREATE INDEX "Job_status_lastSeenAt_idx" ON "Job"("status", "lastSeenAt");

-- CreateIndex
CREATE INDEX "Job_status_createdAt_idx" ON "Job"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Job_employmentType_postedAt_idx" ON "Job"("employmentType", "postedAt");

-- CreateIndex
CREATE INDEX "Job_companyId_postedAt_idx" ON "Job"("companyId", "postedAt");
