import { parseCity, type CityCode } from '@/lib/cities'
import { geocodePhoton, resolveLandmarkAlias } from '../geocode'
import { searchPlacesByName } from '../places/search'
import type { DestinationPoint } from '../types'

/**
 * PlaceResolver: alias catalog → map POI index → Photon.
 * Never uses GPS as the destination — GPS is origin only (used to rank ambiguous POIs).
 */
export async function resolveDestination(params: {
  destinationName: string | null
  city?: CityCode | string | null
  /** User origin — ranks Vincom/etc. by distance when DB has multiple hits. */
  near?: { latitude: number; longitude: number } | null
}): Promise<DestinationPoint | null> {
  const name = params.destinationName?.trim()
  if (!name) return null
  const city = parseCity(params.city)

  const alias = resolveLandmarkAlias(name, city)
  if (alias) {
    return {
      latitude: alias.latitude,
      longitude: alias.longitude,
      label: alias.label,
      source: 'landmark_alias',
    }
  }

  try {
    const hits = await searchPlacesByName({
      query: name,
      city,
      near: params.near,
      limit: 8,
      // Destination places — never pick fuel/charging infrastructure as the trip goal
      types: [
        'marketplace',
        'university',
        'tourist_attraction',
        'park',
        'school',
        'hospital',
        'store',
        'parking',
      ],
    })
    const top = hits[0]
    if (top && Number.isFinite(top.latitude) && Number.isFinite(top.longitude)) {
      return {
        latitude: top.latitude,
        longitude: top.longitude,
        label: top.name,
        source: 'poi',
      }
    }
  } catch {
    /* fall through */
  }

  try {
    const photon = await geocodePhoton(name, city)
    if (photon) {
      return {
        latitude: photon.latitude,
        longitude: photon.longitude,
        label: photon.label,
        source: 'photon',
      }
    }
  } catch {
    /* fall through */
  }

  // Soft default: bare «Vincom» → central NCT when DB/Photon miss
  const folded = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim()
  if (folded === 'vincom' || folded === 'tttm vincom' || folded === 'vincom center') {
    const fallback = resolveLandmarkAlias('vincom nguyễn chí thanh', city)
    if (fallback) {
      return {
        latitude: fallback.latitude,
        longitude: fallback.longitude,
        label: fallback.label,
        source: 'landmark_alias',
      }
    }
  }

  return null
}
