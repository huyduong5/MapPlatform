-- Seed sources for Phase 1 MVP
INSERT INTO sources (name, type, url, status) VALUES
  ('vinfast_official', 'official_website', 'https://vinfastauto.com/vn_vi/tim-kiem-showroom-tram-sac', 'active'),
  ('osm_overpass_charging', 'openstreetmap', 'https://overpass-api.de/api/interpreter', 'active')
ON CONFLICT (name) DO UPDATE
  SET url = EXCLUDED.url,
      type = EXCLUDED.type,
      status = EXCLUDED.status,
      updated_at = now();
