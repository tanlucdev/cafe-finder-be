ALTER TABLE "cafes" ADD COLUMN "menu_images" TEXT[] NOT NULL DEFAULT '{}';

UPDATE "cafes"
SET "menu_images" = ARRAY[btrim("menu_image")]
WHERE "menu_image" IS NOT NULL AND btrim("menu_image") <> '';
