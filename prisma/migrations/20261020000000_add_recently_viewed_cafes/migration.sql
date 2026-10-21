CREATE TABLE "recently_viewed_cafes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "cafe_id" UUID NOT NULL,
  "last_viewed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "recently_viewed_cafes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recently_viewed_cafes_user_id_cafe_id_key"
  ON "recently_viewed_cafes"("user_id", "cafe_id");
CREATE INDEX "idx_recently_viewed_cafes_user_last_viewed_at"
  ON "recently_viewed_cafes"("user_id", "last_viewed_at");

ALTER TABLE "recently_viewed_cafes"
  ADD CONSTRAINT "recently_viewed_cafes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recently_viewed_cafes"
  ADD CONSTRAINT "recently_viewed_cafes_cafe_id_fkey"
  FOREIGN KEY ("cafe_id") REFERENCES "cafes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
