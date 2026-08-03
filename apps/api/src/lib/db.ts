import pg from 'pg'

let pool: pg.Pool | null = null

/** Local Docker Compose maps PostGIS to host port 5433 (not 5432). */
const DEFAULT_DATABASE_URL =
  'postgresql://geouser:geopass@127.0.0.1:5433/geo_platform'

export function getPool(): pg.Pool {
  if (!pool) {
    const max = Math.min(Math.max(Number(process.env.PG_POOL_MAX || 20), 2), 100)
    const idleTimeoutMillis = Math.max(Number(process.env.PG_IDLE_TIMEOUT_MS || 30_000), 1000)
    const connectionTimeoutMillis = Math.max(
      Number(process.env.PG_CONNECTION_TIMEOUT_MS || 10_000),
      1000,
    )
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
      max,
      idleTimeoutMillis,
      connectionTimeoutMillis,
    })
  }
  return pool
}
