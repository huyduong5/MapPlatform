-- Phase 7 stub data for Đà Nẵng (city switcher) — curated $0
INSERT INTO sources (name, type, url, status) VALUES
  ('ops_curated_danang', 'other', 'https://www.openstreetmap.org/', 'active')
ON CONFLICT (name) DO NOTHING;

INSERT INTO locations (
  name, type, address, latitude, longitude, status, city,
  source_id, source_record_id, source_url, last_updated
)
SELECT
  v.name, v.type, v.address, v.lat, v.lng, 'active', 'danang',
  s.id, v.sid, 'https://www.openstreetmap.org/', now()
FROM sources s
CROSS JOIN (
  VALUES
    ('VinFast Store Đà Nẵng', 'store',
     'Nguyễn Văn Linh, Hải Châu, Đà Nẵng',
     16.0544::float8, 108.2022::float8, 'dn-store-hc'),
    ('Trạm sạc VinFast Sơn Trà', 'charging_station',
     'Võ Nguyên Giáp, Sơn Trà, Đà Nẵng',
     16.0615::float8, 108.2470::float8, 'dn-charge-st'),
    ('Showroom VinFast Đà Nẵng', 'showroom',
     'Điện Biên Phủ, Thanh Khê, Đà Nẵng',
     16.0678::float8, 108.1830::float8, 'dn-showroom-tk'),
    ('Bãi đỗ cầu Rồng', 'parking',
     'Cầu Rồng, Hải Châu, Đà Nẵng',
     16.0610::float8, 108.2270::float8, 'dn-park-rong')
) AS v(name, type, address, lat, lng, sid)
WHERE s.name = 'ops_curated_danang'
  AND NOT EXISTS (
    SELECT 1 FROM locations l
    WHERE l.source_id = s.id AND l.source_record_id = v.sid
  );
