-- Add indexes for search performance on title and location columns
CREATE INDEX IF NOT EXISTS "Job_title_idx" ON "Job" USING gin (to_tsvector('english', "title"));
CREATE INDEX IF NOT EXISTS "Job_location_idx" ON "Job" ("location");
CREATE INDEX IF NOT EXISTS "Job_status_idx" ON "Job" ("status");
