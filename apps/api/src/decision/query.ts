import { getPool } from '@/lib/db'
import { isCityCode, type CityCode } from '@/lib/cities'
import type { AnchorPoint, CandidateLocation, LocationTypeFilter } from './types'

export async function queryNearbyCandidates(params: {
  anchor: AnchorPoint
  radiusMeters: number
  locationType: LocationTypeFilter
  limit: number
  city?: CityCode
}): Promise<CandidateLocation[]> {
  const pool = getPool()
  const sqlParams: unknown[] = [
    params.anchor.longitude,
    params.anchor.latitude,
    params.radiusMeters,
    Math.min(params.limit * 3, 50),
  ]
  let extra = ''
  if (params.locationType) {
    sqlParams.push(params.locationType)
    extra += ` AND l.type = $${sqlParams.length}`
  }
  if (params.city && isCityCode(params.city)) {
    sqlParams.push(params.city)
    extra += ` AND l.city = $${sqlParams.length}`
  }

  const { rows } = await pool.query(
    `
    SELECT
      l.id::text AS id,
      l.name,
      l.type,
      l.address,
      l.latitude,
      l.longitude,
      l.status,
      l.city,
      l.phone,
      l.opening_hours AS "openingHours",
      s.name AS source,
      l.source_url AS "sourceUrl",
      ROUND((ST_Distance(
        COALESCE(l.location, ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography),
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      ) / 1000.0)::numeric, 2)::float AS "distanceKm"
    FROM locations l
    LEFT JOIN sources s ON s.id = l.source_id
    WHERE l.status = 'active'
      ${extra}
      AND ST_DWithin(
        COALESCE(l.location, ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography),
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $3
      )
    ORDER BY "distanceKm" ASC
    LIMIT $4
    `,
    sqlParams,
  )

  return rows as CandidateLocation[]
}
