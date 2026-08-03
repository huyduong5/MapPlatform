-- Production indexes for city-scoped list/nearby queries + name/address dedupe support.
-- Safe to re-run (IF NOT EXISTS). Avoid CONCURRENTLY so migrate scripts in a transaction work.

CREATE INDEX IF NOT EXISTS locations_city_status_idx
  ON locations (city, status);

CREATE INDEX IF NOT EXISTS locations_city_status_type_idx
  ON locations (city, status, type);

CREATE INDEX IF NOT EXISTS locations_source_name_addr_idx
  ON locations (source_id, lower(name), lower(address));

COMMENT ON INDEX locations_city_status_idx IS 'Prod: filter city+status on map/list';
COMMENT ON INDEX locations_city_status_type_idx IS 'Prod: filter city+status+type';
COMMENT ON INDEX locations_source_name_addr_idx IS 'Prod: fallback dedupe without source_record_id';
