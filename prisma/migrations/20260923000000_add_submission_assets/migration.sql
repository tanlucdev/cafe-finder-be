CREATE TABLE "submission_assets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "submission_id" UUID NOT NULL,
  "public_id" TEXT NOT NULL,
  "field" TEXT NOT NULL,
  "secure_url" TEXT,
  "status" TEXT NOT NULL DEFAULT 'signed',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "submission_assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "submission_assets_public_id_key" ON "submission_assets"("public_id");
CREATE INDEX "submission_assets_submission_id_field_status_idx"
  ON "submission_assets"("submission_id", "field", "status");

ALTER TABLE "submission_assets"
  ADD CONSTRAINT "submission_assets_submission_id_fkey"
  FOREIGN KEY ("submission_id") REFERENCES "cafe_submissions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
