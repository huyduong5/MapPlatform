import { CITIES, type CityCode, type CityMeta } from '@/lib/cities'
import { getPool } from '@/lib/db'

export type CityPublic = CityMeta & {
  enabled: boolean
  order: number
  locationCount?: number
}

type CacheEntry = { at: number; cities: CityPublic[] }

const TTL_MS = Number(process.env.CITIES_CACHE_TTL_MS || 60_000)
let cache: CacheEntry | null = null

function fallbackCities(): CityPublic[] {
  // Source of truth = Payload Cities when table exists; hardcode for cold/dev.
  return (Object.keys(CITIES) as CityCode[]).map((code, i) => ({
    ...CITIES[code],
    enabled: true,
    order: i,
  }))
}

function rowToCity(row: Record<string, unknown>): CityPublic | null {
  const code = row.code != null ? String(row.code) : ''
  const name = row.name != null ? String(row.name) : ''
  if (!code || !name) return null

  const latitude = Number(row.latitude)
  const longitude = Number(row.longitude)
  // Payload postgres flattens group fields as bbox_min_lat / bbox_minLat depending on version
  const minLat = Number(row.bbox_min_lat ?? row.bbox_minLat ?? row.min_lat)
  const maxLat = Number(row.bbox_max_lat ?? row.bbox_maxLat ?? row.max_lat)
  const minLng = Number(row.bbox_min_lng ?? row.bbox_minLng ?? row.min_lng)
  const maxLng = Number(row.bbox_max_lng ?? row.bbox_maxLng ?? row.max_lng)

  if (![latitude, longitude, minLat, maxLat, minLng, maxLng].every(Number.isFinite)) {
    return null
  }

  return {
    code: code as CityCode,
    name,
    latitude,
    longitude,
    zoom: Number(row.zoom) || 12,
    bbox: { minLat, maxLat, minLng, maxLng },
    enabled: row.enabled !== false && row.enabled !== 'f' && row.enabled !== 0,
    order: Number(row.order) || 0,
  }
}

/**
 * Fast path: read cms_cities via pg (no Payload init / schema push).
 * Returns null if table missing or empty.
 */
async function loadCitiesFromSql(): Promise<CityPublic[] | null> {
  const schema = process.env.PAYLOAD_SCHEMA || 'payload'
  try {
    const pool = getPool()
    // Quote schema/table — Payload lives outside public to avoid PostGIS collisions
    const { rows } = await pool.query<Record<string, unknown>>(
      `
      SELECT *
      FROM ${quoteIdent(schema)}.cms_cities
      ORDER BY "order" ASC NULLS LAST, id ASC
      LIMIT 100
      `,
    )
    if (!rows.length) return null
    const cities = rows.map(rowToCity).filter((c): c is CityPublic => c != null)
    return cities.length > 0 ? cities : null
  } catch {
    // relation/schema does not exist yet (before first Admin/Payload push)
    return null
  }
}

function quoteIdent(ident: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(ident)) {
    throw new Error(`Invalid SQL identifier: ${ident}`)
  }
  return `"${ident}"`
}

/**
 * Public city registry for map/API.
 * Prefer SQL → hardcode. Never call getPayload here (blocks Admin ~10–15s on cold push).
 */
export async function loadCitiesFromPayload(opts?: {
  enabledOnly?: boolean
  bypassCache?: boolean
}): Promise<CityPublic[]> {
  const now = Date.now()
  if (!opts?.bypassCache && cache && now - cache.at < TTL_MS) {
    const list = cache.cities
    return opts?.enabledOnly ? list.filter((c) => c.enabled) : list
  }

  const fromSql = await loadCitiesFromSql()
  const resolved = fromSql && fromSql.length > 0 ? fromSql : fallbackCities()
  cache = { at: now, cities: resolved }
  return opts?.enabledOnly ? resolved.filter((c) => c.enabled) : resolved
}

export function invalidateCitiesCache() {
  cache = null
}

/** JSON blob for crawler `CITIES_JSON` env. */
export async function citiesJsonForCrawler(cityCodes?: string[]): Promise<string> {
  const all = await loadCitiesFromPayload({ bypassCache: true })
  const selected =
    cityCodes && cityCodes.length > 0
      ? all.filter((c) => cityCodes.includes(c.code))
      : all.filter((c) => c.enabled)

  const payload = Object.fromEntries(
    selected.map((c) => [
      c.code,
      {
        code: c.code,
        name: c.name,
        lat: c.latitude,
        lng: c.longitude,
        bbox: {
          min_lat: c.bbox.minLat,
          max_lat: c.bbox.maxLat,
          min_lng: c.bbox.minLng,
          max_lng: c.bbox.maxLng,
        },
      },
    ]),
  )
  return JSON.stringify(payload)
}
