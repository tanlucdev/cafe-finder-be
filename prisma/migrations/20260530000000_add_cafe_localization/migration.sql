ALTER TABLE cafes
ADD COLUMN IF NOT EXISTS name_en TEXT,
ADD COLUMN IF NOT EXISTS address_en TEXT,
ADD COLUMN IF NOT EXISTS district_en TEXT,
ADD COLUMN IF NOT EXISTS one_liner_en TEXT,
ADD COLUMN IF NOT EXISTS description_en TEXT,
ADD COLUMN IF NOT EXISTS signature_drink_en TEXT,
ADD COLUMN IF NOT EXISTS parking_location_en TEXT;

UPDATE cafes
SET district_en = CASE district
  WHEN 'Quận 1' THEN 'District 1'
  WHEN 'Quận 2' THEN 'District 2'
  WHEN 'Quận 3' THEN 'District 3'
  WHEN 'Quận 4' THEN 'District 4'
  WHEN 'Quận 5' THEN 'District 5'
  WHEN 'Quận 6' THEN 'District 6'
  WHEN 'Quận 7' THEN 'District 7'
  WHEN 'Quận 8' THEN 'District 8'
  WHEN 'Quận 9' THEN 'District 9'
  WHEN 'Quận 10' THEN 'District 10'
  WHEN 'Quận 11' THEN 'District 11'
  WHEN 'Quận 12' THEN 'District 12'
  WHEN 'Bình Thạnh' THEN 'Binh Thanh'
  WHEN 'Phú Nhuận' THEN 'Phu Nhuan'
  WHEN 'Tân Bình' THEN 'Tan Binh'
  WHEN 'Tân Phú' THEN 'Tan Phu'
  WHEN 'Gò Vấp' THEN 'Go Vap'
  WHEN 'Thủ Đức' THEN 'Thu Duc'
  ELSE district
END
WHERE district IS NOT NULL AND district_en IS NULL;

UPDATE cafes
SET name_en = name
WHERE name_en IS NULL;

CREATE INDEX IF NOT EXISTS idx_cafes_district_en ON cafes(district_en);

CREATE INDEX IF NOT EXISTS idx_cafes_fts_i18n ON cafes
USING GIN(to_tsvector(
  'simple',
  COALESCE(name, '') || ' ' || COALESCE(name_en, '') || ' ' ||
  COALESCE(address, '') || ' ' || COALESCE(address_en, '') || ' ' ||
  COALESCE(one_liner, '') || ' ' || COALESCE(one_liner_en, '')
));
