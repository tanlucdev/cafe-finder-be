CREATE TYPE "CafeVoteAction" AS ENUM ('VOTE', 'UNVOTE');

CREATE TABLE "cafe_vote_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "action" "CafeVoteAction" NOT NULL,
  "user_id" UUID NOT NULL,
  "cafe_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cafe_vote_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_cafe_vote_events_cafe_created_at" ON "cafe_vote_events"("cafe_id", "created_at");
CREATE INDEX "idx_cafe_vote_events_user_created_at" ON "cafe_vote_events"("user_id", "created_at");
CREATE INDEX "idx_cafe_vote_events_action_created_at" ON "cafe_vote_events"("action", "created_at");

ALTER TABLE "cafe_vote_events"
  ADD CONSTRAINT "cafe_vote_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cafe_vote_events"
  ADD CONSTRAINT "cafe_vote_events_cafe_id_fkey"
  FOREIGN KEY ("cafe_id") REFERENCES "cafes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "cafe_vote_events" ("action", "user_id", "cafe_id", "created_at")
SELECT 'VOTE'::"CafeVoteAction", "user_id", "cafe_id", "created_at"
FROM "cafe_votes";
