import { CITIES, parseCity, type CityCode } from '@/lib/cities'
import { getCityAliasTable, lookupPlaceAlias, LANDMARK_ALIASES } from './places/catalog'
import type { AnchorPoint } from './types'

export { LANDMARK_ALIASES }

function defaultCityAnchor(city: CityCode): AnchorPoint {
  const meta = CITIES[city]
  return {
    latitude: meta.latitude,
    longitude: meta.longitude,
    label: `Trung tâm ${meta.name}`,
    source: 'default_city',
  }
}

export function resolveLandmarkAlias(
  landmark: string | null,
  city: CityCode = 'hanoi',
): AnchorPoint | null {
  const hit = lookupPlaceAlias(landmark, city)
  if (!hit) return null
  return {
    latitude: hit.lat,
    longitude: hit.lng,
    label: hit.label,
    source: 'landmark_alias',
  }
}

/** @deprecated Prefer lookupPlaceAlias — kept for CITY_LANDMARKS introspection */
export function getLandmarkTable(city: CityCode = 'hanoi') {
  return getCityAliasTable(city)
}

/** Photon (Komoot) — $0, no API key. Biased to selected city. */
export async function geocodePhoton(
  query: string,
  city: CityCode = 'hanoi',
): Promise<AnchorPoint | null> {
  const meta = CITIES[city]
  const base = (process.env.PHOTON_BASE_URL || 'https://photon.komoot.io/api/').replace(/\/?$/, '/')
  const url = new URL(base)
  url.searchParams.set('q', `${query}, ${meta.name}, Việt Nam`)
  url.searchParams.set('limit', '1')
  url.searchParams.set('lang', 'vi')
  url.searchParams.set('lat', String(meta.latitude))
  url.searchParams.set('lon', String(meta.longitude))

  try {
    const { request } = await import('node:https')
    const body = await new Promise<string>((resolve, reject) => {
      const req = request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          path: `${url.pathname}${url.search}`,
          method: 'GET',
          family: 4,
          headers: { Accept: 'application/json', 'User-Agent': 'MapPlatform/1.0' },
          timeout: 8000,
        },
        (res) => {
          const chunks: Buffer[] = []
          res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
          res.on('end', () => {
            if ((res.statusCode || 0) >= 400) reject(new Error(`Photon ${res.statusCode}`))
            else resolve(Buffer.concat(chunks).toString('utf8'))
          })
        },
      )
      req.on('error', reject)
      req.on('timeout', () => req.destroy(new Error('Photon timeout')))
      req.end()
    })
    const json = JSON.parse(body) as {
      features?: Array<{ geometry?: { coordinates?: number[] }; properties?: { name?: string } }>
    }
    const f = json.features?.[0]
    const coords = f?.geometry?.coordinates
    if (!coords || coords.length < 2) return null
    const [lng, lat] = coords
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return {
      latitude: lat,
      longitude: lng,
      label: f?.properties?.name || query,
      source: 'photon',
    }
  } catch {
    return null
  }
}

export async function resolveAnchor(params: {
  latitude?: number
  longitude?: number
  landmark: string | null
  city?: CityCode | string | null
}): Promise<AnchorPoint> {
  const city = parseCity(params.city)

  if (
    params.latitude != null &&
    params.longitude != null &&
    Number.isFinite(params.latitude) &&
    Number.isFinite(params.longitude)
  ) {
    return {
      latitude: params.latitude,
      longitude: params.longitude,
      label: 'Vị trí người dùng',
      source: 'user',
    }
  }

  const alias = resolveLandmarkAlias(params.landmark, city)
  if (alias) return alias

  if (params.landmark) {
    try {
      const photon = await geocodePhoton(params.landmark, city)
      if (photon) return photon
    } catch {
      // fall through
    }
  }

  return defaultCityAnchor(city)
}
