-- Phase 6: dealer + parking + rescue_team (Hà Nội curated)
INSERT INTO sources (name, type, url, status) VALUES
  ('vinfast_official', 'official_website', 'https://vinfastauto.com/vn_vi/tim-kiem-showroom-tram-sac', 'active'),
  ('ops_curated_hanoi', 'other', 'https://www.openstreetmap.org/', 'active')
ON CONFLICT (name) DO NOTHING;

INSERT INTO locations (
  name, type, address, latitude, longitude, status,
  source_id, source_record_id, source_url, last_updated, phone
)
SELECT
  v.name, v.type, v.address, v.lat, v.lng, 'active',
  s.id, v.sid, v.url, now(), v.phone
FROM sources s
CROSS JOIN (
  VALUES
    ('Đại lý VinFast Gia Lâm', 'dealer',
     'Đường Ngô Xuân Quảng, Trâu Quỳ, Gia Lâm, Hà Nội',
     21.0095::float8, 105.9382::float8, 'vf-dealer-gia-lam',
     'https://vinfastauto.com/vn_vi/tim-kiem-showroom-tram-sac', NULL::text),
    ('Đại lý VinFast Thanh Xuân', 'dealer',
     'Nguyễn Trãi, Thanh Xuân, Hà Nội',
     20.9978::float8, 105.8095::float8, 'vf-dealer-thanh-xuan',
     'https://vinfastauto.com/vn_vi/tim-kiem-showroom-tram-sac', NULL::text),
    ('Bãi đỗ Times City P1', 'parking',
     '458 Minh Khai, Hai Bà Trưng, Hà Nội',
     20.9942::float8, 105.8675::float8, 'park-times-city-p1',
     'https://www.openstreetmap.org/', NULL::text),
    ('Bãi đỗ Royal City', 'parking',
     '72A Nguyễn Trãi, Thanh Xuân, Hà Nội',
     21.0022::float8, 105.815::float8, 'park-royal-city',
     'https://www.openstreetmap.org/', NULL::text),
    ('Đội cứu hộ VinFast Hà Nội', 'rescue_team',
     'Hotline cứu hộ khu vực Hà Nội',
     21.0285::float8, 105.8542::float8, 'rescue-vinfast-hn',
     'https://vinfastauto.com/vn_vi/', '1900232389'),
    ('Điểm ứng cứu cầu Giấy', 'rescue_team',
     'Phạm Hùng, Cầu Giấy, Hà Nội',
     21.0305::float8, 105.782::float8, 'rescue-cau-giay',
     'https://vinfastauto.com/vn_vi/', '1900232389')
) AS v(name, type, address, lat, lng, sid, url, phone)
WHERE s.name = CASE
  WHEN v.type IN ('dealer', 'rescue_team') THEN 'vinfast_official'
  ELSE 'ops_curated_hanoi'
END
  AND NOT EXISTS (
    SELECT 1 FROM locations l
    WHERE l.source_id = s.id AND l.source_record_id = v.sid
  );
