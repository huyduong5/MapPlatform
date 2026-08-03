-- Expand location types: gas stations, universities, hospitals
ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_type_check;
ALTER TABLE locations ADD CONSTRAINT locations_type_check CHECK (
  type IN (
    'charging_station', 'store', 'service_center', 'showroom', 'dealer',
    'parking', 'rescue_team',
    'gas_station', 'university', 'hospital'
  )
);
