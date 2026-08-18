-- Recreation / leisure POI types for context-aware decide.

ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_type_check;
ALTER TABLE locations ADD CONSTRAINT locations_type_check CHECK (
  type IN (
    'charging_station', 'store', 'service_center', 'showroom', 'dealer',
    'parking', 'rescue_team',
    'gas_station', 'university', 'hospital',
    'pharmacy', 'atm', 'bank', 'police', 'fire_station', 'school', 'marketplace',
    'bus_stop', 'subway_station',
    'park', 'tourist_attraction'
  )
);

COMMENT ON COLUMN locations.type IS 'POI type including park/tourist_attraction for leisure trips';
