ALTER TABLE "cafe_submissions"
  ADD COLUMN "payload" JSONB,
  ADD COLUMN "submission_type" TEXT NOT NULL DEFAULT 'community';

ALTER TYPE "SubmissionStatus" ADD VALUE IF NOT EXISTS 'draft';
