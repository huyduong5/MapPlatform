-- Expand POI types for scale data wave + allow new cities (Wave 4 registry).

ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_type_check;
ALTER TABLE locations ADD CONSTRAINT locations_type_check CHECK (
  type IN (
    'charging_station', 'store', 'service_center', 'showroom', 'dealer',
    'parking', 'rescue_team',
    'gas_station', 'university', 'hospital',
    'pharmacy', 'atm', 'bank', 'police', 'fire_station', 'school', 'marketplace'
  )
);

ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_city_check;
ALTER TABLE locations ADD CONSTRAINT locations_city_check CHECK (
  city IN ('hanoi', 'hcm', 'danang', 'haiphong', 'cantho', 'hue')
);

COMMENT ON COLUMN locations.city IS 'City code: hanoi|hcm|danang|haiphong|cantho|hue';
COMMENT ON COLUMN locations.type IS 'POI type including pharmacy/atm/bank/police/fire_station/school/marketplace';
