ALTER TABLE cafes
ADD COLUMN IF NOT EXISTS rating DECIMAL(3, 2);

CREATE INDEX IF NOT EXISTS idx_cafes_rating ON cafes(rating);
