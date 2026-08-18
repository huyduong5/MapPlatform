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
  | 'explore_area'
  | 'joyride'
  | 'navigate_to'
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
  | 'bus_stop'
  | 'subway_station'
  | 'park'
  | 'tourist_attraction'
  | null

/** High-level trip mission — drives routing & enrichment policy. */
export type TripPurpose = 'need_urgent' | 'need_normal' | 'leisure' | 'navigate'

export type RecommendationMode = 'poi' | 'destination'

/** Vehicle selected in UI wizard (or parsed from NL). */
export type VehicleKind = 'ev_car' | 'ev_moto' | 'ice_car' | 'ice_moto'

/** How the user wants to travel to the recommended POI. */
export type TravelMode = 'drive' | 'moto' | 'walk' | 'bike' | 'transit'

export type VehicleProfile = {
  kind: VehicleKind
  batteryPercent?: number | null
}

export type RouteGeometry = {
  type: 'LineString'
  coordinates: Array<[number, number]> // [lng, lat]
}

export type RouteStep = {
  instruction: string
  distanceM?: number
  durationS?: number
}

export type TransitLeg = {
  mode: string
  fromName?: string
  toName?: string
  routeShortName?: string
  distanceM?: number
  durationS?: number
  geometry?: RouteGeometry | null
}

export type RouteAmenity = {
  id: string
  name: string
  type: string
  latitude: number
  longitude: number
  distanceToRouteM: number
}

export type RouteHook = {
  title: string
  detail: string
  amenityIds: string[]
  kind?:
    | 'amenity'
    | 'eco'
    | 'battery_oasis'
    | 'night_safety'
    | 'transit'
    | 'pit_stop'
    | 'leisure'
    | 'generic'
}

export type RoutePersona = 'fastest' | 'smart' | 'experience'

export type RouteOption = {
  id: string
  persona: RoutePersona
  label: string
  distanceKm: number
  etaMinutes: number
  geometry: RouteGeometry | null
  steps?: RouteStep[]
  legs?: TransitLeg[]
  amenities: RouteAmenity[]
  hook: RouteHook
  directionsUrl: string
  provider: string
  badges?: string[]
  deltas?: {
    vsFastestMinutes: number
    vsFastestKm: number
    highlight?: string
  }
}

export type ParsedIntent = {
  intent: IntentType
  locationType: LocationTypeFilter
  landmark: string | null
  batteryPercent: number | null
  urgency: 'critical' | 'high' | 'normal'
  rawQuery: string
  source: 'rules' | 'llm'
  vehicleKind: VehicleKind | null
  destinationLandmark: string | null
  tripPurpose: TripPurpose
}

export type AnchorPoint = {
  latitude: number
  longitude: number
  label: string
  source: 'user' | 'landmark_alias' | 'photon' | 'default_city' | 'destination'
}

export type DestinationPoint = {
  latitude: number
  longitude: number
  label: string
  source: 'landmark_alias' | 'photon' | 'default_city' | 'poi'
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
  roadDistanceKm?: number | null
  etaMinutes?: number | null
  reachableWithBattery?: boolean | null
  /** Legacy: mirrors routes[0] for older clients. */
  route?: RouteGeometry | null
  directionsUrl?: string | null
  routes?: RouteOption[]
}

export type DecideRequest = {
  query: string
  latitude?: number
  longitude?: number
  limit?: number
  city?: 'hanoi' | 'hcm' | 'danang' | 'haiphong' | 'cantho' | 'hue'
  vehicle?: VehicleProfile
  travelMode?: TravelMode
  destinationLandmark?: string
}

export type DecideResponse = {
  success: true
  data: {
    query: string
    intent: ParsedIntent
    vehicle: VehicleProfile | null
    travelMode: TravelMode
    tripPurpose: TripPurpose
    recommendationMode: RecommendationMode
    /** User origin (GPS or fallback). */
    anchor: AnchorPoint
    /** Trip destination when mode=destination (e.g. Hồ Hoàn Kiếm). */
    destination: DestinationPoint | null
    radiusMeters: number
    recommendations: RankedRecommendation[]
    explanation: string
    routingProvider?: string
    /** Crow-fly / haversine — not a road-following geometry. */
    routingDegraded?: boolean
    transitDegraded?: boolean
  }
}
