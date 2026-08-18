-- Transit stop types for dual-route / OTP degrade corridors.

ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_type_check;
ALTER TABLE locations ADD CONSTRAINT locations_type_check CHECK (
  type IN (
    'charging_station', 'store', 'service_center', 'showroom', 'dealer',
    'parking', 'rescue_team',
    'gas_station', 'university', 'hospital',
    'pharmacy', 'atm', 'bank', 'police', 'fire_station', 'school', 'marketplace',
    'bus_stop', 'subway_station'
  )
);

COMMENT ON COLUMN locations.type IS 'POI type including bus_stop/subway_station for transit corridors';
