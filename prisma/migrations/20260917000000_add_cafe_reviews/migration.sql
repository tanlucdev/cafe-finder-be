CREATE TABLE "cafe_reviews" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "cafe_id" UUID NOT NULL,
  "rating" INTEGER,
  "content" TEXT,
  "is_hidden" BOOLEAN NOT NULL DEFAULT false,
  "admin_note" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cafe_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cafe_reviews_rating_check" CHECK ("rating" IS NULL OR ("rating" >= 1 AND "rating" <= 5))
);

CREATE UNIQUE INDEX "cafe_reviews_user_id_cafe_id_key" ON "cafe_reviews"("user_id", "cafe_id");
CREATE INDEX "idx_cafe_reviews_cafe_visible_created" ON "cafe_reviews"("cafe_id", "is_hidden", "created_at");
CREATE INDEX "idx_cafe_reviews_user_id" ON "cafe_reviews"("user_id");

ALTER TABLE "cafe_reviews"
  ADD CONSTRAINT "cafe_reviews_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cafe_reviews"
  ADD CONSTRAINT "cafe_reviews_cafe_id_fkey"
  FOREIGN KEY ("cafe_id") REFERENCES "cafes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
