-- Seed showroom + service_center (Phase 4) — idempotent
INSERT INTO sources (name, type, url, status) VALUES
  ('vinfast_official', 'official_website', 'https://vinfastauto.com/vn_vi/tim-kiem-showroom-tram-sac', 'active')
ON CONFLICT (name) DO NOTHING;

INSERT INTO locations (
  name, type, address, latitude, longitude, status,
  source_id, source_record_id, source_url, last_updated
)
SELECT
  v.name, v.type, v.address, v.lat, v.lng, 'active',
  s.id, v.sid, 'https://vinfastauto.com/vn_vi/tim-kiem-showroom-tram-sac', now()
FROM sources s
CROSS JOIN (
  VALUES
    ('Showroom VinFast Times City', 'showroom',
     'Tầng L1, Vincom Mega Mall Times City, 458 Minh Khai, Hai Bà Trưng, Hà Nội',
     20.9952::float8, 105.868::float8, 'vf-showroom-times-city'),
    ('Showroom VinFast Phạm Văn Đồng', 'showroom',
     'Số 68 Phạm Văn Đồng, Cổ Nhuế, Bắc Từ Liêm, Hà Nội',
     21.0665::float8, 105.7852::float8, 'vf-showroom-pvd'),
    ('Xưởng dịch vụ VinFast Long Biên', 'service_center',
     'Số 1 Nguyễn Văn Linh, Long Biên, Hà Nội',
     21.038::float8, 105.889::float8, 'vf-service-long-bien'),
    ('Xưởng dịch vụ VinFast Hà Đông', 'service_center',
     'Đường Tố Hữu, Hà Đông, Hà Nội',
     20.9845::float8, 105.7858::float8, 'vf-service-ha-dong')
) AS v(name, type, address, lat, lng, sid)
WHERE s.name = 'vinfast_official'
  AND NOT EXISTS (
    SELECT 1 FROM locations l
    WHERE l.source_id = s.id AND l.source_record_id = v.sid
  );
