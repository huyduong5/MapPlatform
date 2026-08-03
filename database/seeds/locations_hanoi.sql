-- Fixture locations for local demo (Hà Nội)
INSERT INTO locations (
  name, type, address, latitude, longitude, status,
  source_id, source_url, last_seen_at, last_updated
)
SELECT
  v.name, v.type, v.address, v.latitude, v.longitude, v.status,
  s.id, v.source_url, now(), now()
FROM (
  VALUES
    ('VinFast Times City', 'store', '458 Minh Khai, Hai Bà Trưng, Hà Nội', 20.9950, 105.8620, 'active',
     'vinfast_official', 'https://vinfastauto.com/vn_vi/tim-kiem-showroom-tram-sac'),
    ('Trạm sạc VinFast Royal City', 'charging_station', '72A Nguyễn Trãi, Thanh Xuân, Hà Nội', 20.9985, 105.8115, 'active',
     'vinfast_official', 'https://vinfastauto.com/vn_vi/tim-kiem-showroom-tram-sac'),
    ('Trạm sạc Vincom Bà Triệu', 'charging_station', '191 Bà Triệu, Hai Bà Trưng, Hà Nội', 21.0083, 105.8497, 'active',
     'osm_overpass_charging', NULL),
    ('VinFast Long Biên', 'store', 'Số 1 Nguyễn Văn Linh, Long Biên, Hà Nội', 21.0378, 105.8880, 'inactive',
     'vinfast_official', 'https://vinfastauto.com/vn_vi/tim-kiem-showroom-tram-sac')
) AS v(name, type, address, latitude, longitude, status, source_name, source_url)
JOIN sources s ON s.name = v.source_name
WHERE NOT EXISTS (
  SELECT 1 FROM locations l
  WHERE l.name = v.name AND l.address = v.address
);
