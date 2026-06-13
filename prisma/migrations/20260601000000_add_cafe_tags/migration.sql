ALTER TABLE "cafes"
ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "tags_en" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE cafes
SET tags_en = tags
WHERE cardinality(COALESCE(tags_en, ARRAY[]::TEXT[])) = 0;

CREATE INDEX IF NOT EXISTS idx_cafes_tags ON cafes USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_cafes_tags_en ON cafes USING GIN(tags_en);
