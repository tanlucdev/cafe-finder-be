ALTER TABLE "cafes"
  ADD COLUMN "view_count" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "idx_cafes_view_count" ON "cafes"("view_count");

CREATE TABLE "cafe_view_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "cafe_id" UUID NOT NULL,
  "visitor_key_hash" TEXT NOT NULL,
  "bucket_start" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cafe_view_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cafe_view_events_dedupe_key"
  ON "cafe_view_events"("cafe_id", "visitor_key_hash", "bucket_start");
CREATE INDEX "idx_cafe_view_events_cafe_id" ON "cafe_view_events"("cafe_id");
CREATE INDEX "idx_cafe_view_events_created_at" ON "cafe_view_events"("created_at");

ALTER TABLE "cafe_view_events"
  ADD CONSTRAINT "cafe_view_events_cafe_id_fkey"
  FOREIGN KEY ("cafe_id") REFERENCES "cafes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
