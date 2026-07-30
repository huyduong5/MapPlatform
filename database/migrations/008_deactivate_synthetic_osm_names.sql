-- Deactivate synthetic OSM placeholder names and ultra-short junk labels.
-- e.g. "Trường OSM #4493605992", single-letter "A" ATM names.

UPDATE locations
SET
  status = 'inactive',
  updated_at = now()
WHERE status = 'active'
  AND (
    name ~ ' OSM #[0-9]+$'
    OR length(trim(name)) < 4
    OR trim(name) ~ '^[A-Za-z]$'
  );

COMMENT ON TABLE locations IS 'POI rows; inactive used for unnamed/synthetic OSM cleanup (migration 008)';
