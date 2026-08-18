import type { LocationSummary } from '@/types/location'

export type VehicleKind = 'ev_car' | 'ev_moto' | 'ice_car' | 'ice_moto'
export type TravelMode = 'drive' | 'moto' | 'walk' | 'bike' | 'transit'
export type TripPurpose = 'need_urgent' | 'need_normal' | 'leisure' | 'navigate'

export type RouteOptionView = {
  id: string
  persona: 'fastest' | 'smart' | 'experience'
  label: string
  distanceKm: number
  etaMinutes: number
  geometry?: {
    type: 'LineString'
    coordinates: Array<[number, number]>
  } | null
  steps?: Array<{
    instruction: string
    distanceM?: number
    durationS?: number
  }>
  amenities?: Array<{
    id: string
    name: string
    type: string
    latitude: number
    longitude: number
    distanceToRouteM: number
  }>
  hook?: {
    title: string
    detail: string
    amenityIds: string[]
    kind?: string
  }
  directionsUrl: string
  provider: string
  badges?: string[]
  deltas?: {
    vsFastestMinutes: number
    vsFastestKm: number
    highlight?: string
  }
  legs?: Array<{
    mode: string
    fromName?: string
    toName?: string
    routeShortName?: string
    distanceM?: number
    durationS?: number
  }>
}

export type DecideResult = {
  query: string
  intent: {
    intent: string
    locationType: string | null
    landmark: string | null
    batteryPercent: number | null
    urgency: string
    source: string
    vehicleKind?: string | null
    tripPurpose?: TripPurpose
    destinationLandmark?: string | null
  }
  vehicle: { kind: VehicleKind; batteryPercent?: number | null } | null
  travelMode?: TravelMode
  tripPurpose?: TripPurpose
  recommendationMode?: 'poi' | 'destination'
  destination?: {
    latitude: number
    longitude: number
    label: string
    source: string
  } | null
  anchor: {
    latitude: number
    longitude: number
    label: string
    source: string
  }
  radiusMeters: number
  recommendations: Array<
    LocationSummary & {
      distanceKm: number
      rank: number
      score: number
      reasons: string[]
      roadDistanceKm?: number | null
      etaMinutes?: number | null
      reachableWithBattery?: boolean | null
      route?: {
        type: 'LineString'
        coordinates: Array<[number, number]>
      } | null
      directionsUrl?: string | null
      routes?: RouteOptionView[]
    }
  >
  explanation: string
  routingProvider?: string
  routingDegraded?: boolean
  transitDegraded?: boolean
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') || ''

export async function decide(params: {
  query: string
  latitude?: number
  longitude?: number
  limit?: number
  city?: string
  vehicle?: { kind: VehicleKind; batteryPercent?: number }
  travelMode?: TravelMode
  destinationLandmark?: string
}): Promise<DecideResult> {
  const res = await fetch(`${API_BASE}/api/decide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    cache: 'no-store',
  })
  const json = await res.json()
  if (!res.ok || json.success === false) {
    throw new Error(json?.error?.message || `HTTP ${res.status}`)
  }
  return json.data as DecideResult
}
