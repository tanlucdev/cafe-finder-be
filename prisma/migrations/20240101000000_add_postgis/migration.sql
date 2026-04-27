-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Thêm cột geography cho cafes
ALTER TABLE cafes ADD COLUMN IF NOT EXISTS location GEOGRAPHY(POINT, 4326);

-- Spatial index cho nearby search
CREATE INDEX IF NOT EXISTS idx_cafes_location ON cafes USING GIST(location);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_cafes_fts ON cafes
  USING GIN(to_tsvector('simple', name || ' ' || COALESCE(address, '') || ' ' || COALESCE(one_liner, '')));

-- Trigger tự update cột location khi lat/lng thay đổi
CREATE OR REPLACE FUNCTION update_cafe_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.lng::float, NEW.lat::float), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cafe_location ON cafes;
CREATE TRIGGER trg_cafe_location
  BEFORE INSERT OR UPDATE ON cafes
  FOR EACH ROW EXECUTE FUNCTION update_cafe_location();
