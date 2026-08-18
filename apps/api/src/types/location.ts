export type LocationType =
  | 'charging_station'
  | 'store'
  | 'service_center'
  | 'showroom'
  | 'dealer'
  | 'parking'
  | 'rescue_team'
  | 'gas_station'
  | 'university'
  | 'hospital'
  | 'pharmacy'
  | 'atm'
  | 'bank'
  | 'police'
  | 'fire_station'
  | 'school'
  | 'marketplace'
  | 'bus_stop'
  | 'subway_station'
  | 'park'
  | 'tourist_attraction'

export type LocationStatus = 'active' | 'inactive'

export type CityCode = 'hanoi' | 'hcm' | 'danang' | 'haiphong' | 'cantho' | 'hue'

/** Lean row for map markers / bbox lists */
export interface LocationSummary {
  id: string
  name: string
  type: LocationType
  address?: string
  latitude: number
  longitude: number
  status: LocationStatus
  city?: CityCode | string
  source?: string | null
  sourceUrl?: string | null
  phone?: string | null
  openingHours?: string | null
  lastUpdated?: string | null
  createdAt?: string
  updatedAt?: string
  distanceKm?: number
}

/** Rich detail for place card (GET /locations/:id) */
export interface LocationDetail extends LocationSummary {
  address: string
  addressNormalized?: string | null
  displayAddress?: string
  cityName?: string
  website?: string | null
  brand?: string | null
  rating?: number | null
  ratingCount?: number | null
  ratingSource?: string | null
  openNow?: boolean | null
  hoursTodayLabel?: string | null
  sourceLabel?: string
  enrichedAt?: string | null
}

export interface ApiListResponse<T> {
  success: true
  data: T[]
  pagination?: {
    page: number
    limit: number
    total: number | null
    totalPages: number | null
    nextCursor?: string | null
  }
  meta?: {
    zoom?: number | null
    densityMode?: boolean
    elapsedMs?: number
    fields?: string
  }
}

export interface ApiDetailResponse<T> {
  success: true
  data: T
}

export interface ApiErrorResponse {
  success: false
  error: { code: string; message: string }
}
