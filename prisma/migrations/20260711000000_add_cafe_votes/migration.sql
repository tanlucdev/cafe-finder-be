CREATE TABLE "cafe_votes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "cafe_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cafe_votes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cafe_votes_user_id_cafe_id_key" ON "cafe_votes"("user_id", "cafe_id");
CREATE INDEX "idx_cafe_votes_cafe_id" ON "cafe_votes"("cafe_id");
CREATE INDEX "idx_cafe_votes_created_at" ON "cafe_votes"("created_at");
CREATE INDEX "idx_cafe_votes_cafe_created_at" ON "cafe_votes"("cafe_id", "created_at");

ALTER TABLE "cafe_votes"
  ADD CONSTRAINT "cafe_votes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cafe_votes"
  ADD CONSTRAINT "cafe_votes_cafe_id_fkey"
  FOREIGN KEY ("cafe_id") REFERENCES "cafes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
