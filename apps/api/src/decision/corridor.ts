import { getPool } from '@/lib/db'
import type {
  RouteAmenity,
  RouteGeometry,
  RoutePersona,
  TravelMode,
  TripPurpose,
  VehicleKind,
} from './types'
import { corridorBufferM, isEv } from './vehicle'

const LEISURE_NEAR_DEST = [
  'marketplace',
  'store',
  'university',
  'school',
  'parking',
  'park',
  'tourist_attraction',
]
const LEISURE_ALONG_ROUTE = [
  'marketplace',
  'store',
  'school',
  'university',
  'pharmacy',
  'atm',
  'park',
  'tourist_attraction',
]

export function amenityTypesForPersona(
  mode: TravelMode,
  persona: RoutePersona,
  vehicleKind: VehicleKind | null,
  tripPurpose?: TripPurpose | null,
): string[] {
  if (tripPurpose === 'leisure' || tripPurpose === 'navigate') {
    if (persona === 'fastest') return LEISURE_NEAR_DEST
    return LEISURE_ALONG_ROUTE
  }

  if (tripPurpose === 'need_urgent') {
    return []
  }

  if (persona === 'fastest') {
    if (mode === 'transit') return ['bus_stop', 'subway_station', 'atm']
    if (mode === 'walk') return ['atm', 'pharmacy']
    return isEv(vehicleKind) ? ['charging_station', 'parking'] : ['gas_station', 'parking']
  }

  // smart / experience for need_normal
  switch (mode) {
    case 'walk':
      return ['pharmacy', 'hospital', 'university', 'marketplace', 'atm', 'police']
    case 'bike':
      return ['parking', 'store', 'charging_station', 'atm', 'pharmacy']
    case 'transit':
      return ['bus_stop', 'subway_station', 'atm', 'pharmacy', 'marketplace']
    case 'moto':
    case 'drive':
    default:
      if (isEv(vehicleKind)) {
        return ['charging_station', 'parking', 'store', 'marketplace', 'atm']
      }
      return ['gas_station', 'parking', 'atm', 'pharmacy', 'store']
  }
}

/**
 * POIs within a corridor buffer of the route LineString (PostGIS geography).
 */
export async function queryCorridorAmenities(params: {
  geometry: RouteGeometry | null
  mode: TravelMode
  persona: RoutePersona
  vehicleKind: VehicleKind | null
  excludeIds?: string[]
  limit?: number
  city?: string
  tripPurpose?: TripPurpose | null
  /** Override type list (e.g. near-destination leisure). */
  typeOverride?: string[]
}): Promise<RouteAmenity[]> {
  if (!params.geometry?.coordinates || params.geometry.coordinates.length < 2) {
    return []
  }

  const buffer = corridorBufferM(params.mode)
  const types =
    params.typeOverride ||
    amenityTypesForPersona(params.mode, params.persona, params.vehicleKind, params.tripPurpose)
  if (!types.length) return []

  // Downsample to keep SQL payload small
  const coords = params.geometry.coordinates
  const maxPts = 40
  const sampled: Array<[number, number]> =
    coords.length <= maxPts
      ? coords
      : Array.from({ length: maxPts }, (_, i) => {
          const idx = Math.floor((i * (coords.length - 1)) / (maxPts - 1))
          return coords[idx]
        })

  const wkt = `LINESTRING(${sampled.map(([lng, lat]) => `${lng} ${lat}`).join(',')})`
  const pool = getPool()
  const sqlParams: unknown[] = [wkt, buffer, types, params.limit ?? 8]
  let extra = ''
  if (params.excludeIds?.length) {
    sqlParams.push(params.excludeIds)
    extra += ` AND l.id::text <> ALL($${sqlParams.length}::text[])`
  }
  if (params.city) {
    sqlParams.push(params.city)
    extra += ` AND l.city = $${sqlParams.length}`
  }

  try {
    const { rows } = await pool.query(
      `
      SELECT
        l.id::text AS id,
        l.name,
        l.type,
        l.latitude,
        l.longitude,
        ROUND(ST_Distance(
          COALESCE(l.location, ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography),
          ST_GeomFromText($1, 4326)::geography
        )::numeric, 0)::float AS "distanceToRouteM"
      FROM locations l
      WHERE l.status = 'active'
        AND l.type = ANY($3::text[])
        AND ST_DWithin(
          COALESCE(l.location, ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography),
          ST_GeomFromText($1, 4326)::geography,
          $2
        )
        ${extra}
      ORDER BY "distanceToRouteM" ASC
      LIMIT $4
      `,
      sqlParams,
    )
    return rows as RouteAmenity[]
  } catch {
    return []
  }
}

/** Nearby transit stops around a point (degraded transit). */
export async function queryNearbyTransitStops(params: {
  latitude: number
  longitude: number
  radiusM?: number
  limit?: number
  city?: string
}): Promise<RouteAmenity[]> {
  const pool = getPool()
  const sqlParams: unknown[] = [
    params.longitude,
    params.latitude,
    params.radiusM ?? 800,
    params.limit ?? 6,
  ]
  let extra = ''
  if (params.city) {
    sqlParams.push(params.city)
    extra += ` AND l.city = $${sqlParams.length}`
  }
  try {
    const { rows } = await pool.query(
      `
      SELECT
        l.id::text AS id,
        l.name,
        l.type,
        l.latitude,
        l.longitude,
        ROUND((ST_Distance(
          COALESCE(l.location, ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography),
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ))::numeric, 0)::float AS "distanceToRouteM"
      FROM locations l
      WHERE l.status = 'active'
        AND l.type IN ('bus_stop', 'subway_station')
        AND ST_DWithin(
          COALESCE(l.location, ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography),
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          $3
        )
        ${extra}
      ORDER BY "distanceToRouteM" ASC
      LIMIT $4
      `,
      sqlParams,
    )
    return rows as RouteAmenity[]
  } catch {
    return []
  }
}
