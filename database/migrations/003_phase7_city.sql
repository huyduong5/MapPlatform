-- Phase 7: multi-city foundation
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT 'hanoi';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'locations_city_check'
  ) THEN
    ALTER TABLE locations
      ADD CONSTRAINT locations_city_check
      CHECK (city IN ('hanoi', 'hcm', 'danang'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS locations_city_idx ON locations (city);
CREATE INDEX IF NOT EXISTS locations_city_type_idx ON locations (city, type);

COMMENT ON COLUMN locations.city IS 'Phase 7 city code: hanoi|hcm|danang';

-- Backfill safety
UPDATE locations SET city = 'hanoi' WHERE city IS NULL OR city = '';
