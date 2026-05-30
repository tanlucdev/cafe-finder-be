ALTER TABLE cafes
ADD COLUMN IF NOT EXISTS vibes_en TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS purposes_en TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS amenities_en TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE cafes
SET vibes_en = ARRAY(
  SELECT CASE lower(value)
    WHEN 'hiện đại' THEN 'Modern'
    WHEN 'lang man' THEN 'Romantic'
    WHEN 'lãng mạn' THEN 'Romantic'
    WHEN 'nhộn nhịp' THEN 'Lively'
    WHEN 'sáng tạo' THEN 'Creative'
    WHEN 'thiên nhiên' THEN 'Nature'
    WHEN 'yên tĩnh' THEN 'Quiet'
    ELSE value
  END
  FROM unnest(vibes) AS value
)
WHERE cardinality(COALESCE(vibes_en, ARRAY[]::TEXT[])) = 0;

UPDATE cafes
SET purposes_en = ARRAY(
  SELECT CASE lower(value)
    WHEN 'chill một mình' THEN 'Solo chill'
    WHEN 'chụp ảnh' THEN 'Photos'
    WHEN 'đọc sách' THEN 'Read'
    WHEN 'gặp bạn bè' THEN 'Meet friends'
    WHEN 'hẹn hò' THEN 'Date'
    WHEN 'học tập' THEN 'Study'
    WHEN 'họp nhóm' THEN 'Group meeting'
    WHEN 'làm việc' THEN 'Work'
    ELSE value
  END
  FROM unnest(purposes) AS value
)
WHERE cardinality(COALESCE(purposes_en, ARRAY[]::TEXT[])) = 0;

UPDATE cafes
SET amenities_en = ARRAY(
  SELECT CASE lower(value)
    WHEN 'chỗ đậu xe' THEN 'Parking'
    WHEN 'điều hoà' THEN 'Air conditioning'
    WHEN 'không gian ngoài trời' THEN 'Outdoor seating'
    WHEN 'ổ cắm' THEN 'Power outlets'
    WHEN 'sân thượng' THEN 'Rooftop'
    ELSE value
  END
  FROM unnest(amenities) AS value
)
WHERE cardinality(COALESCE(amenities_en, ARRAY[]::TEXT[])) = 0;

CREATE INDEX IF NOT EXISTS idx_cafes_vibes_en ON cafes USING GIN(vibes_en);
CREATE INDEX IF NOT EXISTS idx_cafes_purposes_en ON cafes USING GIN(purposes_en);
CREATE INDEX IF NOT EXISTS idx_cafes_amenities_en ON cafes USING GIN(amenities_en);
