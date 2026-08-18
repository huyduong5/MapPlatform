/** Transit itineraries via OpenTripPlanner, with Google Maps + stop-corridor degrade. */

import { queryNearbyTransitStops } from './corridor'
import { directionsDeepLink, haversineM, routeWithFallback, type LatLng } from './routing'
import type {
  RouteAmenity,
  RouteGeometry,
  RouteOption,
  TransitLeg,
} from './types'

export type TransitPairResult = {
  routes: [RouteOption, RouteOption]
  provider: string
  degraded: boolean
}

function otpCities(): Set<string> {
  const raw = process.env.OTP_CITIES || 'hanoi'
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  )
}

function otpEnabledForCity(city?: string | null): boolean {
  const base = process.env.OTP_BASE_URL?.trim()
  if (!base) return false
  if (!city) return false
  return otpCities().has(city)
}

function mergeLegGeometries(legs: TransitLeg[]): RouteGeometry | null {
  const coords: Array<[number, number]> = []
  for (const leg of legs) {
    for (const c of leg.geometry?.coordinates || []) coords.push(c)
  }
  if (coords.length < 2) return null
  return { type: 'LineString', coordinates: coords }
}

type OtpItinerary = {
  duration?: number
  walkTime?: number
  transfers?: number
  legs?: Array<{
    mode?: string
    distance?: number
    duration?: number
    from?: { name?: string }
    to?: { name?: string }
    route?: { shortName?: string }
    legGeometry?: { points?: string }
  }>
}

/** Google-encoded polyline decoder → [lng,lat][]. */
export function decodeGooglePolyline(encoded: string): Array<[number, number]> {
  let index = 0
  const len = encoded.length
  let lat = 0
  let lng = 0
  const coordinates: Array<[number, number]> = []

  while (index < len) {
    let b: number
    let shift = 0
    let result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlat = result & 1 ? ~(result >> 1) : result >> 1
    lat += dlat

    shift = 0
    result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlng = result & 1 ? ~(result >> 1) : result >> 1
    lng += dlng

    coordinates.push([lng / 1e5, lat / 1e5])
  }
  return coordinates
}

async function fetchOtpItineraries(from: LatLng, to: LatLng): Promise<OtpItinerary[]> {
  const base = process.env.OTP_BASE_URL!.replace(/\/$/, '')
  const query = `
    query Plan($fromLat: Float!, $fromLon: Float!, $toLat: Float!, $toLon: Float!) {
      plan(
        from: { lat: $fromLat, lon: $fromLon }
        to: { lat: $toLat, lon: $toLon }
        numItineraries: 4
        transportModes: [{mode: WALK}, {mode: TRANSIT}]
      ) {
        itineraries {
          duration
          walkTime
          transfers
          legs {
            mode
            distance
            duration
            from { name }
            to { name }
            route { shortName }
            legGeometry { points }
          }
        }
      }
    }
  `
  try {
    const res = await fetch(`${base}/otp/routers/default/index/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: {
          fromLat: from.latitude,
          fromLon: from.longitude,
          toLat: to.latitude,
          toLon: to.longitude,
        },
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return []
    const json = (await res.json()) as {
      data?: { plan?: { itineraries?: OtpItinerary[] } }
    }
    return json.data?.plan?.itineraries || []
  } catch {
    // Fallback legacy REST
    try {
      const url =
        `${base}/otp/routers/default/plan?fromPlace=${from.latitude},${from.longitude}` +
        `&toPlace=${to.latitude},${to.longitude}&mode=TRANSIT,WALK&numItineraries=4`
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
      if (!res.ok) return []
      const json = (await res.json()) as { plan?: { itineraries?: OtpItinerary[] } }
      return json.plan?.itineraries || []
    } catch {
      return []
    }
  }
}

function itineraryToOption(
  it: OtpItinerary,
  persona: 'fastest' | 'smart',
  from: LatLng,
  to: LatLng,
  amenities: RouteAmenity[],
): RouteOption {
  const legs: TransitLeg[] = (it.legs || []).map((leg) => {
    const pts = leg.legGeometry?.points
    const coords = pts ? decodeGooglePolyline(pts) : []
    return {
      mode: leg.mode || 'WALK',
      fromName: leg.from?.name,
      toName: leg.to?.name,
      routeShortName: leg.route?.shortName,
      distanceM: leg.distance,
      durationS: leg.duration,
      geometry: coords.length >= 2 ? { type: 'LineString', coordinates: coords } : null,
    }
  })
  const geometry = mergeLegGeometries(legs)
  const durationS = it.duration ?? legs.reduce((s, l) => s + (l.durationS || 0), 0)
  const distanceM = legs.reduce((s, l) => s + (l.distanceM || 0), 0)
  const transfers = it.transfers ?? Math.max(0, legs.filter((l) => l.mode !== 'WALK').length - 1)
  const walkPct =
    it.walkTime != null && durationS > 0
      ? Math.round((it.walkTime / durationS) * 100)
      : undefined

  const badges = [
    transfers <= 0 ? 'Không đổi tuyến' : `Đổi tuyến ${transfers} lần`,
    walkPct != null ? `Đi bộ ~${walkPct}%` : undefined,
  ].filter(Boolean) as string[]

  return {
    id: persona,
    persona,
    label: persona === 'fastest' ? 'Nhanh nhất' : 'Ít đổi tuyến / ít đi bộ',
    distanceKm: distanceM / 1000,
    etaMinutes: durationS / 60,
    geometry,
    legs,
    amenities,
    hook: {
      title: persona === 'fastest' ? 'Tuyến công cộng nhanh' : 'Tuyến dễ đi hơn',
      detail: badges.join(' · ') || 'Lịch trình OTP',
      amenityIds: amenities.slice(0, 2).map((a) => a.id),
      kind: 'transit',
    },
    directionsUrl: directionsDeepLink(to, from, 'transit'),
    provider: 'otp',
    badges,
  }
}

async function degradedTransitPair(
  from: LatLng,
  to: LatLng,
  city?: string,
): Promise<TransitPairResult> {
  const [nearFrom, nearTo, walk] = await Promise.all([
    queryNearbyTransitStops({
      latitude: from.latitude,
      longitude: from.longitude,
      city,
      limit: 4,
    }),
    queryNearbyTransitStops({
      latitude: to.latitude,
      longitude: to.longitude,
      city,
      limit: 4,
    }),
    routeWithFallback(from, to, 'walking'),
  ])

  const amenities = [...nearFrom, ...nearTo].filter(
    (a, i, arr) => arr.findIndex((x) => x.id === a.id) === i,
  )
  const stopHint =
    nearFrom[0] != null
      ? `Điểm dừng gần nhất: «${nearFrom[0].name}» (~${Math.round(nearFrom[0].distanceToRouteM)}m).`
      : 'Chưa có GTFS/OTP cho thành phố này — mở Google Maps để xem bus/metro.'

  const baseUrl = directionsDeepLink(to, from, 'transit')
  const fastest: RouteOption = {
    id: 'fastest',
    persona: 'fastest',
    label: 'Nhanh nhất (ước lượng)',
    distanceKm: walk.distanceM / 1000,
    etaMinutes: walk.durationS / 60,
    geometry: walk.geometry,
    amenities: amenities.slice(0, 4),
    hook: {
      title: 'Mở Maps transit',
      detail: stopHint,
      amenityIds: amenities.slice(0, 2).map((a) => a.id),
      kind: 'transit',
    },
    directionsUrl: baseUrl,
    provider: 'degraded-transit',
    badges: ['Ước lượng', 'Google Transit'],
  }

  const viaStop = nearFrom[0]
  let smartGeom = walk.geometry
  let smartDist = walk.distanceM
  let smartDur = walk.durationS * 1.15
  if (viaStop) {
    const a = await routeWithFallback(
      from,
      { latitude: viaStop.latitude, longitude: viaStop.longitude },
      'walking',
    )
    const b = await routeWithFallback(
      { latitude: viaStop.latitude, longitude: viaStop.longitude },
      to,
      'walking',
    )
    const coords = [
      ...(a.geometry?.coordinates || []),
      ...(b.geometry?.coordinates || []),
    ]
    if (coords.length >= 2) {
      smartGeom = { type: 'LineString', coordinates: coords }
      smartDist = a.distanceM + b.distanceM
      smartDur = a.durationS + b.durationS
    }
  }

  const smart: RouteOption = {
    id: 'smart',
    persona: 'smart',
    label: 'Qua điểm dừng gần',
    distanceKm: smartDist / 1000,
    etaMinutes: smartDur / 60,
    geometry: smartGeom,
    amenities,
    hook: {
      title: viaStop ? `Qua «${viaStop.name}»` : 'Tuyến thay thế',
      detail: viaStop
        ? `Ưu tiên tiếp cận điểm dừng/metro gần bạn rồi tới đích (Δ đi bộ ước tính).`
        : stopHint,
      amenityIds: viaStop ? [viaStop.id] : [],
      kind: 'transit',
    },
    directionsUrl: baseUrl,
    provider: 'degraded-transit',
    badges: ['Qua điểm dừng', 'Google Transit'],
    deltas: {
      vsFastestMinutes: Number(((smartDur - walk.durationS) / 60).toFixed(1)),
      vsFastestKm: Number(((smartDist - walk.distanceM) / 1000).toFixed(2)),
      highlight: 'Ước lượng — xác nhận trên Maps',
    },
  }

  void haversineM
  return { routes: [fastest, smart], provider: 'degraded-transit', degraded: true }
}

export async function getTransitRoutePair(
  from: LatLng,
  to: LatLng,
  city?: string,
): Promise<TransitPairResult> {
  if (otpEnabledForCity(city)) {
    const itineraries = await fetchOtpItineraries(from, to)
    if (itineraries.length >= 1) {
      const amenities = await queryNearbyTransitStops({
        latitude: from.latitude,
        longitude: from.longitude,
        city,
        limit: 4,
      })
      const byDuration = [...itineraries].sort(
        (a, b) => (a.duration || 0) - (b.duration || 0),
      )
      const fastestIt = byDuration[0]
      const byTransfers = [...itineraries].sort((a, b) => {
        const ta = a.transfers ?? 99
        const tb = b.transfers ?? 99
        if (ta !== tb) return ta - tb
        return (a.walkTime || 0) - (b.walkTime || 0)
      })
      let smartIt = byTransfers[0]
      if (smartIt === fastestIt && byTransfers[1]) smartIt = byTransfers[1]
      if (smartIt === fastestIt && byDuration[1]) smartIt = byDuration[1]

      const fastest = itineraryToOption(fastestIt, 'fastest', from, to, amenities)
      let smart = itineraryToOption(smartIt, 'smart', from, to, amenities)
      smart = {
        ...smart,
        deltas: {
          vsFastestMinutes: Number((smart.etaMinutes - fastest.etaMinutes).toFixed(1)),
          vsFastestKm: Number((smart.distanceKm - fastest.distanceKm).toFixed(2)),
          highlight: smart.badges?.[0],
        },
      }
      return { routes: [fastest, smart], provider: 'otp', degraded: false }
    }
  }

  return degradedTransitPair(from, to, city)
}
