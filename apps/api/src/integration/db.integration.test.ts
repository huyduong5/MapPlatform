import { describe, expect, it, beforeAll } from 'vitest'
import pg from 'pg'

/** Local Docker Compose publishes PostGIS on host 5433 (use IPv4 to avoid wrong ::1). */
const DATABASE_URL =
  process.env.DATABASE_URL_TEST ||
  'postgresql://geouser:geopass@127.0.0.1:5433/geo_platform'

describe('INT — locations DB (PostGIS)', () => {
  let pool: pg.Pool

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL })
    await pool.query('SELECT 1')
  })

  it('INT-01 PostGIS extension available', async () => {
    const { rows } = await pool.query('SELECT PostGIS_Version() AS v')
    expect(rows[0].v).toBeTruthy()
  })

  it('INT-02 active charging_station and store exist', async () => {
    const { rows } = await pool.query(
      `SELECT type, COUNT(*)::int AS c FROM public.locations WHERE status='active' GROUP BY type`,
    )
    const map = Object.fromEntries(rows.map((r) => [r.type, r.c]))
    expect(map.charging_station).toBeGreaterThan(0)
    expect(map.store).toBeGreaterThan(0)
  })

  it('INT-03 Phase4 types showroom + service_center exist', async () => {
    const { rows } = await pool.query(
      `SELECT type, COUNT(*)::int AS c FROM public.locations
       WHERE status='active' AND type IN ('showroom','service_center')
       GROUP BY type`,
    )
    const map = Object.fromEntries(rows.map((r) => [r.type, r.c]))
    expect(map.showroom).toBeGreaterThan(0)
    expect(map.service_center).toBeGreaterThan(0)
  })

  it('INT-04 nearby Times City returns rows with distance', async () => {
    const { rows } = await pool.query(
      `
      SELECT name,
        ROUND((ST_Distance(
          COALESCE(location, ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography),
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) / 1000.0)::numeric, 2)::float AS distance_km
      FROM public.locations
      WHERE status='active' AND type='charging_station'
        AND ST_DWithin(
          COALESCE(location, ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography),
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          5000
        )
      ORDER BY distance_km ASC
      LIMIT 5
      `,
      [105.8682, 20.995],
    )
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0].distance_km).toBeLessThan(5)
  })

  it('INT-05 bbox filter returns only points inside box', async () => {
    const minLat = 20.95
    const maxLat = 21.05
    const minLng = 105.8
    const maxLng = 105.9
    // Same hybrid used by GET /api/locations: GIST && + exact lat/lng BETWEEN
    const { rows } = await pool.query(
      `
      SELECT latitude, longitude FROM public.locations
      WHERE status='active'
        AND location && ST_MakeEnvelope($1, $2, $3, $4, 4326)::geography
        AND latitude BETWEEN $2 AND $4
        AND longitude BETWEEN $1 AND $3
      LIMIT 50
      `,
      [minLng, minLat, maxLng, maxLat],
    )
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) {
      expect(r.latitude).toBeGreaterThanOrEqual(minLat)
      expect(r.latitude).toBeLessThanOrEqual(maxLat)
      expect(r.longitude).toBeGreaterThanOrEqual(minLng)
      expect(r.longitude).toBeLessThanOrEqual(maxLng)
    }
  })

  it('INT-06 review_status column exists on crawl_logs', async () => {
    const { rows } = await pool.query(
      `
      SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='crawl_logs' AND column_name='review_status'
      `,
    )
    expect(rows.length).toBe(1)
  })
})
