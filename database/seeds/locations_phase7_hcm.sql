-- Phase 7 stub data for Hồ Chí Minh (demo city switcher) — curated $0
INSERT INTO sources (name, type, url, status) VALUES
  ('ops_curated_hcm', 'other', 'https://www.openstreetmap.org/', 'active')
ON CONFLICT (name) DO NOTHING;

INSERT INTO locations (
  name, type, address, latitude, longitude, status, city,
  source_id, source_record_id, source_url, last_updated
)
SELECT
  v.name, v.type, v.address, v.lat, v.lng, 'active', 'hcm',
  s.id, v.sid, 'https://www.openstreetmap.org/', now()
FROM sources s
CROSS JOIN (
  VALUES
    ('VinFast Store Quận 1', 'store',
     'Đồng Khởi, Quận 1, TP. Hồ Chí Minh',
     10.7769::float8, 106.7009::float8, 'hcm-store-q1'),
    ('Trạm sạc VinFast Quận 3', 'charging_station',
     'Võ Văn Tần, Quận 3, TP. Hồ Chí Minh',
     10.7825::float8, 106.6902::float8, 'hcm-charge-q3'),
    ('Showroom VinFast Quận 7', 'showroom',
     'Nguyễn Văn Linh, Quận 7, TP. Hồ Chí Minh',
     10.7295::float8, 106.7218::float8, 'hcm-showroom-q7'),
    ('Bãi đỗ Landmark 81', 'parking',
     'Vinhomes Central Park, Bình Thạnh, TP. Hồ Chí Minh',
     10.7951::float8, 106.7220::float8, 'hcm-park-landmark')
) AS v(name, type, address, lat, lng, sid)
WHERE s.name = 'ops_curated_hcm'
  AND NOT EXISTS (
    SELECT 1 FROM locations l
    WHERE l.source_id = s.id AND l.source_record_id = v.sid
  );
