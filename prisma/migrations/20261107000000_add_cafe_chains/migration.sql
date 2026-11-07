CREATE TABLE "chains" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "description_en" TEXT,
    "cover_image" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chains_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "chains_slug_key" ON "chains"("slug");
ALTER TABLE "cafes" ADD COLUMN "chain_id" UUID;
CREATE INDEX "idx_cafes_chain_id" ON "cafes"("chain_id");
ALTER TABLE "cafes" ADD CONSTRAINT "cafes_chain_id_fkey" FOREIGN KEY ("chain_id") REFERENCES "chains"("id") ON DELETE SET NULL ON UPDATE CASCADE;
