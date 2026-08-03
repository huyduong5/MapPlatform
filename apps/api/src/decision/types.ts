export type IntentType =
  | 'find_charging'
  | 'find_store'
  | 'find_showroom'
  | 'find_service'
  | 'find_dealer'
  | 'find_parking'
  | 'find_rescue'
  | 'find_gas'
  | 'find_university'
  | 'find_hospital'
  | 'find_nearby'
  | 'unknown'

export type LocationTypeFilter =
  | 'charging_station'
  | 'store'
  | 'showroom'
  | 'service_center'
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
  | null

export type ParsedIntent = {
  intent: IntentType
  locationType: LocationTypeFilter
  landmark: string | null
  batteryPercent: number | null
  urgency: 'critical' | 'high' | 'normal'
  rawQuery: string
  source: 'rules' | 'llm'
}

export type AnchorPoint = {
  latitude: number
  longitude: number
  label: string
  source: 'user' | 'landmark_alias' | 'photon' | 'default_city'
}

export type CandidateLocation = {
  id: string
  name: string
  type: string
  address: string | null
  latitude: number
  longitude: number
  status: string
  city?: string
  phone: string | null
  openingHours: string | null
  source: string | null
  sourceUrl: string | null
  distanceKm: number
}

export type RankedRecommendation = CandidateLocation & {
  rank: number
  score: number
  reasons: string[]
}

export type DecideRequest = {
  query: string
  latitude?: number
  longitude?: number
  limit?: number
  /** Phase 7 — scope candidates (+ default anchor) to city */
  city?: 'hanoi' | 'hcm' | 'danang' | 'haiphong' | 'cantho' | 'hue'
}

export type DecideResponse = {
  success: true
  data: {
    query: string
    intent: ParsedIntent
    anchor: AnchorPoint
    radiusMeters: number
    recommendations: RankedRecommendation[]
    explanation: string
  }
}
