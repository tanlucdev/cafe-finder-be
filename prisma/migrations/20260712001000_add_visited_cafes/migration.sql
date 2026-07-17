CREATE TABLE "visited_cafes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "cafe_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visited_cafes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "visited_cafes_user_id_cafe_id_key" ON "visited_cafes"("user_id", "cafe_id");
CREATE INDEX "idx_visited_cafes_cafe_id" ON "visited_cafes"("cafe_id");

ALTER TABLE "visited_cafes" ADD CONSTRAINT "visited_cafes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "visited_cafes" ADD CONSTRAINT "visited_cafes_cafe_id_fkey" FOREIGN KEY ("cafe_id") REFERENCES "cafes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
