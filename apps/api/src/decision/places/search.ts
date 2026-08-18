import { getPool } from '@/lib/db'
import { isCityCode, type CityCode } from '@/lib/cities'
import type { CandidateLocation } from '../types'

export type PlaceSearchHit = CandidateLocation & {
  distanceKm: number
}

function foldForLike(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim()
}

const PLACE_TYPE_PRIORITY = [
  'marketplace',
  'university',
  'tourist_attraction',
  'school',
  'hospital',
  'store',
  'parking',
  'gas_station',
  'charging_station',
]

/**
 * Search map POIs by name/address. Ranks by distance to `near` when provided.
 */
export async function searchPlacesByName(params: {
  query: string
  city?: CityCode | string | null
  near?: { latitude: number; longitude: number } | null
  limit?: number
  types?: string[]
}): Promise<PlaceSearchHit[]> {
  const raw = params.query?.trim()
  if (!raw || raw.length < 2) return []

  const q = foldForLike(raw)
  const limit = Math.min(Math.max(params.limit ?? 8, 1), 20)
  const pool = getPool()

  const sqlParams: unknown[] = []
  const push = (v: unknown) => {
    sqlParams.push(v)
    return `$${sqlParams.length}`
  }

  const pFold = push(`%${q}%`)
  const pRaw = push(`%${raw}%`)
  const pLimit = push(limit)

  let cityClause = ''
  if (params.city && isCityCode(params.city)) {
    cityClause = ` AND l.city = ${push(params.city)}`
  }

  const types = params.types?.length ? params.types : PLACE_TYPE_PRIORITY
  let typeClause = ''
  if (types.length) {
    typeClause = ` AND l.type = ANY(${push(types)}::text[])`
  }

  let nearSelect = 'NULL::float AS "distanceKm"'
  let orderBy = `length(l.name) ASC`

  if (
    params.near &&
    Number.isFinite(params.near.latitude) &&
    Number.isFinite(params.near.longitude)
  ) {
    const pLng = push(params.near.longitude)
    const pLat = push(params.near.latitude)
    nearSelect = `ROUND((ST_Distance(
      COALESCE(l.location, ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography),
      ST_SetSRID(ST_MakePoint(${pLng}, ${pLat}), 4326)::geography
    ) / 1000.0)::numeric, 2)::float AS "distanceKm"`
    orderBy = `"distanceKm" ASC NULLS LAST, length(l.name) ASC`
  }

  try {
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
        ${nearSelect}
      FROM locations l
      LEFT JOIN sources s ON s.id = l.source_id
      WHERE l.status = 'active'
        ${cityClause}
        ${typeClause}
        AND (
          lower(l.name) LIKE lower(${pFold})
          OR lower(coalesce(l.address, '')) LIKE lower(${pFold})
          OR l.name ILIKE ${pRaw}
          OR coalesce(l.address, '') ILIKE ${pRaw}
        )
      ORDER BY ${orderBy}
      LIMIT ${pLimit}
      `,
      sqlParams,
    )
    return rows as PlaceSearchHit[]
  } catch {
    return []
  }
}
