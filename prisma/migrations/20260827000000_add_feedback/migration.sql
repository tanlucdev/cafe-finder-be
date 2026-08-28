CREATE TYPE "FeedbackStatus" AS ENUM ('new', 'reviewed', 'archived');

CREATE TABLE "feedback" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "type" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "contact_email" TEXT,
  "page_url" TEXT,
  "cafe_id" UUID,
  "user_agent" TEXT,
  "status" "FeedbackStatus" NOT NULL DEFAULT 'new',
  "admin_note" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_feedback_status" ON "feedback"("status");
CREATE INDEX "idx_feedback_cafe_id" ON "feedback"("cafe_id");
CREATE INDEX "idx_feedback_created_at" ON "feedback"("created_at");

ALTER TABLE "feedback"
ADD CONSTRAINT "feedback_cafe_id_fkey"
FOREIGN KEY ("cafe_id") REFERENCES "cafes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
