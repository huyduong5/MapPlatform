-- Geo tables for crawler + public API (source of truth).
-- Payload Admin dùng cùng Postgres; có thể sync qua REST sau.
-- Nếu bảng đã tồn tại (do Payload push) thì bỏ qua.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS sources (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL UNIQUE,
  type             TEXT NOT NULL CHECK (type IN ('official_website', 'openstreetmap', 'external_api', 'other')),
  url              TEXT,
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  last_crawled_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS locations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  type              TEXT NOT NULL CHECK (type IN (
                       'charging_station', 'store',
                       'service_center', 'showroom', 'dealer', 'parking', 'rescue_team',
                       'gas_station', 'university', 'hospital'
                     )),
  address           TEXT NOT NULL,
  latitude          DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude         DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  location          GEOGRAPHY(Point, 4326),
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  phone             TEXT,
  opening_hours     TEXT,
  source_id         UUID NOT NULL REFERENCES sources(id),
  source_record_id  TEXT,
  source_url        TEXT,
  last_seen_at      TIMESTAMPTZ,
  last_updated      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crawl_jobs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id             UUID NOT NULL REFERENCES sources(id),
  started_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at           TIMESTAMPTZ,
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed')),
  records_found         INTEGER DEFAULT 0,
  records_created       INTEGER DEFAULT 0,
  records_updated       INTEGER DEFAULT 0,
  records_deactivated   INTEGER DEFAULT 0,
  error_message         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crawl_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_job_id   UUID NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,
  level          TEXT NOT NULL CHECK (level IN ('INFO', 'WARNING', 'ERROR')),
  message        TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS geocode_cache (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address_normalized    TEXT NOT NULL UNIQUE,
  latitude              DOUBLE PRECISION NOT NULL,
  longitude             DOUBLE PRECISION NOT NULL,
  provider              TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION sync_location_geometry()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_location_geometry ON locations;
CREATE TRIGGER trg_sync_location_geometry
BEFORE INSERT OR UPDATE OF latitude, longitude ON locations
FOR EACH ROW
EXECUTE FUNCTION sync_location_geometry();

CREATE INDEX IF NOT EXISTS locations_type_idx ON locations (type);
CREATE INDEX IF NOT EXISTS locations_status_idx ON locations (status);
CREATE INDEX IF NOT EXISTS locations_source_idx ON locations (source_id);
CREATE INDEX IF NOT EXISTS locations_geom_idx ON locations USING GIST (location);
CREATE INDEX IF NOT EXISTS locations_name_trgm_idx ON locations USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS locations_address_trgm_idx ON locations USING GIN (address gin_trgm_ops);

CREATE OR REPLACE FUNCTION ensure_locations_postgis()
RETURNS void AS $$
BEGIN
  PERFORM 1;
END;
$$ LANGUAGE plpgsql;
