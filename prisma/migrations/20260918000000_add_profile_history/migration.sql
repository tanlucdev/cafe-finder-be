ALTER TABLE "cafe_submissions"
ADD COLUMN "created_cafe_id" UUID;

ALTER TABLE "cafe_submissions"
ADD CONSTRAINT "cafe_submissions_created_cafe_id_fkey"
FOREIGN KEY ("created_cafe_id") REFERENCES "cafes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "idx_cafe_submissions_created_cafe_id"
ON "cafe_submissions"("created_cafe_id");

CREATE TABLE "quiz_results" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "profile_id" TEXT NOT NULL,
  "profile_title" TEXT NOT NULL,
  "variant" TEXT,
  "score" INTEGER,
  "dna" TEXT,
  "chips" JSONB,
  "answers" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quiz_results_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "quiz_results"
ADD CONSTRAINT "quiz_results_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "idx_quiz_results_user_created"
ON "quiz_results"("user_id", "created_at");
