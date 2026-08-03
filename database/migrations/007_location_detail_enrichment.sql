-- Location detail enrichment columns (website, brand, rating, normalized address)
ALTER TABLE locations ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS rating REAL;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS rating_count INT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS rating_source TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS address_normalized TEXT;

COMMENT ON COLUMN locations.website IS 'POI website from OSM contact:website / website';
COMMENT ON COLUMN locations.brand IS 'Brand / operator brand tag';
COMMENT ON COLUMN locations.rating IS 'Optional rating (OSM stars or future provider)';
COMMENT ON COLUMN locations.rating_count IS 'Optional review count';
COMMENT ON COLUMN locations.rating_source IS 'osm|places|manual|…';
COMMENT ON COLUMN locations.address_normalized IS 'Reverse-geocoded or cleaned display address';
COMMENT ON COLUMN locations.enriched_at IS 'When address/rating enrichment last ran';

-- Speed reverse-cache lookups by rounded lat/lng (provider like reverse-*)
CREATE INDEX IF NOT EXISTS geocode_cache_reverse_ll_idx
  ON geocode_cache (round(latitude::numeric, 4), round(longitude::numeric, 4))
  WHERE provider LIKE 'reverse%';
