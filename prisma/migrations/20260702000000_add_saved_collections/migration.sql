ALTER TABLE "saved_cafes" ALTER COLUMN "collection_name" DROP NOT NULL;
ALTER TABLE "saved_cafes" ALTER COLUMN "collection_name" DROP DEFAULT;

CREATE TABLE "saved_collections" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "saved_collections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "saved_collections_user_id_name_key" ON "saved_collections"("user_id", "name");

ALTER TABLE "saved_collections"
  ADD CONSTRAINT "saved_collections_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "saved_collections" ("user_id", "name")
SELECT DISTINCT "user_id", trim("collection_name")
FROM "saved_cafes"
WHERE "collection_name" IS NOT NULL AND trim("collection_name") <> ''
ON CONFLICT ("user_id", "name") DO NOTHING;
