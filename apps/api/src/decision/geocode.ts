import { CITIES, parseCity, type CityCode } from '@/lib/cities'
import { LANDMARK_ALIASES } from './intent'
import type { AnchorPoint } from './types'

/** City-scoped landmark aliases (Phase 7+) */
const CITY_LANDMARKS: Partial<
  Record<CityCode, Record<string, { lat: number; lng: number; label: string }>>
> = {
    hanoi: LANDMARK_ALIASES,
    hcm: {
      'quận 1': { lat: 10.7769, lng: 106.7009, label: 'Quận 1' },
      'quan 1': { lat: 10.7769, lng: 106.7009, label: 'Quận 1' },
      'landmark 81': { lat: 10.7951, lng: 106.722, label: 'Landmark 81' },
      'bitexco': { lat: 10.7716, lng: 106.7043, label: 'Bitexco' },
      'quận 7': { lat: 10.7295, lng: 106.7218, label: 'Quận 7' },
      'quan 7': { lat: 10.7295, lng: 106.7218, label: 'Quận 7' },
    },
    danang: {
      'cầu rồng': { lat: 16.061, lng: 108.227, label: 'Cầu Rồng' },
      'cau rong': { lat: 16.061, lng: 108.227, label: 'Cầu Rồng' },
      'sơn trà': { lat: 16.0615, lng: 108.247, label: 'Sơn Trà' },
      'son tra': { lat: 16.0615, lng: 108.247, label: 'Sơn Trà' },
      'hải châu': { lat: 16.0544, lng: 108.2022, label: 'Hải Châu' },
      'hai chau': { lat: 16.0544, lng: 108.2022, label: 'Hải Châu' },
    },
}

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
  if (!landmark) return null
  const key = landmark.toLowerCase().trim()
  const table = CITY_LANDMARKS[city] || LANDMARK_ALIASES
  const hit = table[key]
  if (hit) {
    return { latitude: hit.lat, longitude: hit.lng, label: hit.label, source: 'landmark_alias' }
  }
  for (const [alias, val] of Object.entries(table)) {
    if (key.includes(alias) || alias.includes(key)) {
      return { latitude: val.lat, longitude: val.lng, label: val.label, source: 'landmark_alias' }
    }
  }
  return null
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

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) return null
  const json = (await res.json()) as {
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
