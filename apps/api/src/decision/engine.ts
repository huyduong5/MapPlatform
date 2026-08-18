import { parseCity } from '@/lib/cities'
import { resolveDestination } from './agents/destination'
import { queryCorridorAmenities } from './corridor'
import { buildExplanation } from './explain'
import { resolveAnchor } from './geocode'
import { attachDeltas, buildRuleHook, enrichRouteHook, isNightHours } from './hooks'
import { parseIntentRules } from './intent'
import { enrichIntentWithLlm } from './llm'
import { queryNearbyCandidates } from './query'
import {
  directionsDeepLink,
  getRoutePair,
  routeWithFallback,
  travelModeToOsrmProfile,
  type LatLng,
  type RouteResult,
} from './routing'
import { radiusForIntent, rankCandidates } from './rules'
import { getTransitRoutePair } from './transit'
import type {
  DecideRequest,
  DecideResponse,
  DestinationPoint,
  ParsedIntent,
  RankedRecommendation,
  RecommendationMode,
  RouteGeometry,
  RouteOption,
  RoutePersona,
  TravelMode,
  TripPurpose,
} from './types'
import {
  detectTravelModeFromQuery,
  normalizeVehicleProfile,
  parseTravelMode,
  parseVehicleKind,
  resolveTravelMode,
  travelModeLabel,
  travelModeNeedsVehicle,
  vehicleLabel,
} from './vehicle'

async function resolveIntent(
  query: string,
  vehicleKindHint: ReturnType<typeof parseVehicleKind>,
): Promise<ParsedIntent> {
  const rules = parseIntentRules(query, { vehicleKind: vehicleKindHint })
  const llm = await enrichIntentWithLlm(query, vehicleKindHint)
  return llm || rules
}

function routeLabel(persona: RoutePersona, purpose: TripPurpose): string {
  if (persona === 'fastest') return 'Nhanh nhất'
  if (purpose === 'leisure' || purpose === 'navigate') {
    return 'Trải nghiệm / tiện ích dọc đường'
  }
  return 'Đặc sắc'
}

function toRouteOption(
  persona: RoutePersona,
  result: RouteResult,
  from: LatLng,
  to: LatLng,
  mode: TravelMode,
  purpose: TripPurpose,
  extras: Pick<RouteOption, 'amenities' | 'hook' | 'badges' | 'legs'>,
): RouteOption {
  return {
    id: persona,
    persona,
    label: routeLabel(persona, purpose),
    distanceKm: result.distanceM / 1000,
    etaMinutes: result.durationS / 60,
    geometry: result.geometry,
    steps: result.steps,
    directionsUrl: directionsDeepLink(to, from, mode),
    provider: result.provider,
    ...extras,
  }
}

async function buildRoutesToPoint(params: {
  from: LatLng
  to: LatLng
  mode: TravelMode
  purpose: TripPurpose
  vehicleKind: ReturnType<typeof parseVehicleKind>
  batteryPercent?: number | null
  city?: string
  excludeIds?: string[]
  nearDestAmenities?: import('./types').RouteAmenity[]
}): Promise<{ routes: RouteOption[]; provider: string; degraded?: boolean }> {
  const {
    from,
    to,
    mode,
    purpose,
    vehicleKind,
    batteryPercent,
    city,
    excludeIds,
    nearDestAmenities,
  } = params

  const singleOnly = purpose === 'need_urgent'

  if (mode === 'transit') {
    const pair = await getTransitRoutePair(from, to, city)
    if (singleOnly) return { routes: [pair.routes[0]], provider: pair.provider, degraded: pair.degraded }
    return pair
  }

  if (singleOnly) {
    const one = await routeWithFallback(from, to, travelModeToOsrmProfile(mode))
    const fastest = toRouteOption('fastest', one, from, to, mode, purpose, {
      amenities: [],
      hook: {
        title: 'Nhanh nhất',
        detail: 'Ưu tiên tới điểm cần thiết sớm nhất.',
        amenityIds: [],
        kind: 'generic',
      },
    })
    return {
      routes: [fastest],
      provider: one.provider,
      degraded: Boolean(one.degraded) || one.provider === 'haversine',
    }
  }

  const pair = await getRoutePair(from, to, mode)
  const night = isNightHours()
  const experiencePersona: RoutePersona =
    purpose === 'leisure' || purpose === 'navigate' ? 'experience' : 'smart'

  const [fastAmenitiesRaw, smartAmenities] = await Promise.all([
    purpose === 'leisure' || purpose === 'navigate'
      ? Promise.resolve(nearDestAmenities || [])
      : queryCorridorAmenities({
          geometry: pair.fastest.geometry,
          mode,
          persona: 'fastest',
          vehicleKind,
          excludeIds,
          city,
          tripPurpose: purpose,
          limit: 6,
        }),
    queryCorridorAmenities({
      geometry: pair.smart.geometry,
      mode,
      persona: experiencePersona,
      vehicleKind,
      excludeIds,
      city,
      tripPurpose: purpose,
      limit: 8,
    }),
  ])

  const fastAmenities = fastAmenitiesRaw
  let fastHook = buildRuleHook({
    persona: 'fastest',
    mode,
    vehicleKind,
    amenities: fastAmenities,
    batteryPercent,
    nightMode: night,
  })
  if ((purpose === 'leisure' || purpose === 'navigate') && fastAmenities.length) {
    const names = fastAmenities
      .slice(0, 3)
      .map((a) => a.name)
      .join(', ')
    fastHook = {
      title: 'Điểm vui chơi gần đích',
      detail: `Gợi ý quanh điểm đến: ${names}.`,
      amenityIds: fastAmenities.slice(0, 3).map((a) => a.id),
      kind: 'leisure',
    }
  }

  let smartHook = buildRuleHook({
    persona: experiencePersona,
    mode,
    vehicleKind,
    amenities: smartAmenities,
    batteryPercent,
    nightMode: night,
    badges: mode === 'walk' || mode === 'bike' ? ['green'] : undefined,
  })
  if ((purpose === 'leisure' || purpose === 'navigate') && smartAmenities.length) {
    const names = smartAmenities
      .slice(0, 3)
      .map((a) => `${a.name}`)
      .join(', ')
    smartHook = {
      title: 'Tiện ích trên đường',
      detail: `Dọc tuyến có: ${names}.`,
      amenityIds: smartAmenities.slice(0, 4).map((a) => a.id),
      kind: 'leisure',
    }
  }

  const ctx = `${purpose} ${mode} → ${to.latitude.toFixed(3)},${to.longitude.toFixed(3)}`
  ;[fastHook, smartHook] = await Promise.all([
    enrichRouteHook(fastHook, ctx),
    enrichRouteHook(smartHook, ctx),
  ])

  const fastest = toRouteOption('fastest', pair.fastest, from, to, mode, purpose, {
    amenities: fastAmenities,
    hook: fastHook,
  })
  let experience = toRouteOption(experiencePersona, pair.smart, from, to, mode, purpose, {
    amenities: smartAmenities,
    hook: smartHook,
    badges: mode === 'walk' || mode === 'bike' ? ['green'] : undefined,
  })
  experience = attachDeltas(fastest, experience)

  return {
    routes: [fastest, experience],
    provider: pair.provider,
    degraded: Boolean(pair.degraded),
  }
}

function syntheticDestinationRec(
  dest: DestinationPoint,
  routes: RouteOption[],
  from: LatLng,
): RankedRecommendation {
  const primary = routes[0]
  const distanceKm =
    primary?.distanceKm ??
    Math.hypot(dest.latitude - from.latitude, dest.longitude - from.longitude) * 111
  return {
    id: `dest:${dest.label}`,
    name: dest.label,
    type: 'tourist_attraction',
    address: dest.label,
    latitude: dest.latitude,
    longitude: dest.longitude,
    status: 'active',
    phone: null,
    openingHours: null,
    source: 'decision',
    sourceUrl: null,
    distanceKm,
    rank: 1,
    score: 1,
    reasons: ['Đích theo ngữ cảnh chuyến đi', `Nguồn: ${dest.source}`],
    roadDistanceKm: primary?.distanceKm ?? null,
    etaMinutes: primary?.etaMinutes ?? null,
    reachableWithBattery: null,
    route: primary?.geometry ?? null,
    directionsUrl: primary?.directionsUrl ?? null,
    routes,
  }
}

export async function runDecision(req: DecideRequest): Promise<DecideResponse['data']> {
  const query = (req.query || '').trim()
  if (!query) {
    throw Object.assign(new Error('query is required'), { code: 'BAD_REQUEST', status: 400 })
  }

  const vehicleHint = parseVehicleKind(req.vehicle?.kind)
  const city = parseCity(req.city)
  const intent = await resolveIntent(query, vehicleHint)

  if (req.destinationLandmark?.trim()) {
    intent.destinationLandmark = req.destinationLandmark.trim()
    if (!intent.landmark) intent.landmark = intent.destinationLandmark
  }
  if (req.vehicle?.batteryPercent != null && Number.isFinite(req.vehicle.batteryPercent)) {
    intent.batteryPercent = Number(req.vehicle.batteryPercent)
  }
  if (vehicleHint) intent.vehicleKind = vehicleHint

  const travelMode = resolveTravelMode(
    parseTravelMode(req.travelMode) || detectTravelModeFromQuery(query),
    intent.vehicleKind || vehicleHint,
  )

  const vehicle = normalizeVehicleProfile(req.vehicle, intent.batteryPercent, intent.vehicleKind)

  if (travelModeNeedsVehicle(travelMode) && !vehicle) {
    throw Object.assign(
      new Error('Chọn loại xe (ô tô/xe máy · điện/xăng) để AI đề xuất đúng điểm'),
      { code: 'VEHICLE_REQUIRED', status: 400 },
    )
  }

  if (vehicle) {
    intent.vehicleKind = vehicle.kind
    if (vehicle.batteryPercent != null) intent.batteryPercent = vehicle.batteryPercent
  }

  const tripPurpose: TripPurpose = intent.tripPurpose
  const destName = intent.destinationLandmark || intent.landmark
  const isDestinationTrip =
    tripPurpose === 'leisure' || tripPurpose === 'navigate' || intent.intent === 'explore_area'

  const hasGps =
    req.latitude != null &&
    req.longitude != null &&
    Number.isFinite(req.latitude) &&
    Number.isFinite(req.longitude)

  if (!hasGps && !destName && !intent.landmark) {
    throw Object.assign(
      new Error('Bật vị trí hiện tại hoặc ghi rõ địa danh trong câu hỏi'),
      { code: 'LOCATION_REQUIRED', status: 400 },
    )
  }

  // Origin = GPS (preferred) or landmark fallback for need-search center
  const anchor = await resolveAnchor({
    latitude: req.latitude,
    longitude: req.longitude,
    landmark: isDestinationTrip ? null : intent.landmark,
    city,
  })

  const destination = isDestinationTrip
    ? await resolveDestination({
        destinationName: destName,
        city,
        near: hasGps
          ? { latitude: Number(req.latitude), longitude: Number(req.longitude) }
          : null,
      })
    : null

  if (isDestinationTrip && !destination) {
    throw Object.assign(
      new Error(
        `Chưa xác định được điểm đến «${destName || '…'}». Hãy ghi rõ địa danh (vd. Hồ Hoàn Kiếm).`,
      ),
      { code: 'DESTINATION_REQUIRED', status: 400 },
    )
  }

  const recommendationMode: RecommendationMode = isDestinationTrip ? 'destination' : 'poi'
  const from: LatLng = { latitude: anchor.latitude, longitude: anchor.longitude }
  const radiusMeters = radiusForIntent(intent)
  const limit = Math.min(Math.max(req.limit ?? 3, 1), 10)
  let routingProvider = 'haversine'
  let transitDegraded = false
  let routingDegraded = false
  let recommendations: RankedRecommendation[] = []

  if (isDestinationTrip && destination) {
    const to: LatLng = { latitude: destination.latitude, longitude: destination.longitude }
    const nearDest = await queryNearbyCandidates({
      anchor: {
        latitude: destination.latitude,
        longitude: destination.longitude,
        label: destination.label,
        source: 'destination',
      },
      radiusMeters: 1200,
      locationType: null,
      locationTypes: [
        'marketplace',
        'store',
        'university',
        'school',
        'parking',
        'park',
        'tourist_attraction',
      ],
      limit: 8,
      city,
    })
    const nearDestAmenities = nearDest.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      latitude: p.latitude,
      longitude: p.longitude,
      distanceToRouteM: Math.round(p.distanceKm * 1000),
    }))

    const dual = await buildRoutesToPoint({
      from,
      to,
      mode: travelMode,
      purpose: tripPurpose,
      vehicleKind: vehicle?.kind ?? intent.vehicleKind,
      batteryPercent: vehicle?.batteryPercent ?? intent.batteryPercent,
      city: city || undefined,
      nearDestAmenities,
    })
    routingProvider = dual.provider
    if (dual.degraded) routingDegraded = true
    recommendations = [syntheticDestinationRec(destination, dual.routes, from)]
  } else {
    // POI need flow
    const candidateLimit = Math.min(Math.max(limit * 3, 8), 12)
    let candidates = await queryNearbyCandidates({
      anchor,
      radiusMeters,
      locationType: intent.locationType,
      limit: candidateLimit,
      city,
    })

    // Expand radius / drop city filter before ever falling back to all types
    if (candidates.length === 0 && intent.locationType) {
      candidates = await queryNearbyCandidates({
        anchor,
        radiusMeters: radiusMeters * 2,
        locationType: intent.locationType,
        limit: candidateLimit,
        city,
      })
    }
    if (candidates.length === 0 && intent.locationType) {
      candidates = await queryNearbyCandidates({
        anchor,
        radiusMeters: radiusMeters * 2.5,
        locationType: intent.locationType,
        limit: candidateLimit,
        // no city filter
      })
    }
    // Still empty: for ICE never include charging; for EV never include gas as "all"
    if (candidates.length === 0) {
      const safeTypes =
        vehicle && !vehicle.kind.includes('ev')
          ? [intent.locationType || 'gas_station', 'parking', 'atm'].filter(Boolean)
          : vehicle
            ? [intent.locationType || 'charging_station', 'parking'].filter(Boolean)
            : intent.locationType
              ? [intent.locationType]
              : undefined
      if (safeTypes?.length) {
        candidates = await queryNearbyCandidates({
          anchor,
          radiusMeters: radiusMeters * 2.5,
          locationType: null,
          locationTypes: safeTypes as string[],
          limit: candidateLimit,
        })
      }
    }

    const osrmProfile = travelModeToOsrmProfile(travelMode === 'transit' ? 'walk' : travelMode)
    const routeById = new Map<
      string,
      {
        roadDistanceKm: number
        etaMinutes: number
        route: RouteGeometry | null
        directionsUrl: string
      }
    >()

    await Promise.all(
      candidates.map(async (c) => {
        try {
          const route = await routeWithFallback(
            from,
            { latitude: c.latitude, longitude: c.longitude },
            osrmProfile,
          )
          routingProvider = route.provider
          routeById.set(c.id, {
            roadDistanceKm: route.distanceM / 1000,
            etaMinutes: route.durationS / 60,
            route: route.geometry,
            directionsUrl: directionsDeepLink(
              { latitude: c.latitude, longitude: c.longitude },
              from,
              travelMode,
            ),
          })
        } catch {
          routeById.set(c.id, {
            roadDistanceKm: c.distanceKm,
            etaMinutes: (c.distanceKm / 25) * 60,
            route: null,
            directionsUrl: directionsDeepLink(
              { latitude: c.latitude, longitude: c.longitude },
              null,
              travelMode,
            ),
          })
        }
      }),
    )

    recommendations = rankCandidates(candidates, intent, limit, routeById)

    await Promise.all(
      recommendations.map(async (rec, idx) => {
        try {
          const dual = await buildRoutesToPoint({
            from,
            to: { latitude: rec.latitude, longitude: rec.longitude },
            mode: travelMode,
            purpose: tripPurpose,
            vehicleKind: vehicle?.kind ?? intent.vehicleKind,
            batteryPercent: vehicle?.batteryPercent ?? intent.batteryPercent,
            city: city || undefined,
            excludeIds: [rec.id],
          })
          if (dual.degraded) routingDegraded = true
          routingProvider = dual.provider
          const routes = dual.routes
          const primary = routes[0]
          recommendations[idx] = {
            ...rec,
            routes,
            route: primary?.geometry ?? rec.route ?? null,
            roadDistanceKm: primary?.distanceKm ?? rec.roadDistanceKm,
            etaMinutes: primary?.etaMinutes ?? rec.etaMinutes,
            directionsUrl: primary?.directionsUrl ?? rec.directionsUrl,
          }
        } catch {
          // Ensure at least one route card from Phase A
          if (!recommendations[idx].routes?.length && recommendations[idx].route) {
            const r = recommendations[idx]
            recommendations[idx] = {
              ...r,
              routes: [
                {
                  id: 'fastest',
                  persona: 'fastest',
                  label: 'Nhanh nhất',
                  distanceKm: r.roadDistanceKm ?? r.distanceKm,
                  etaMinutes: r.etaMinutes ?? (r.distanceKm / 25) * 60,
                  geometry: r.route ?? null,
                  amenities: [],
                  hook: {
                    title: 'Nhanh nhất',
                    detail: 'Tuyến ước lượng.',
                    amenityIds: [],
                    kind: 'generic',
                  },
                  directionsUrl:
                    r.directionsUrl ||
                    directionsDeepLink(
                      { latitude: r.latitude, longitude: r.longitude },
                      from,
                      travelMode,
                    ),
                  provider: routingProvider,
                },
              ],
            }
          }
        }
      }),
    )
  }

  let explanation = buildExplanation(intent, anchor, recommendations, {
    tripPurpose,
    destination,
    recommendationMode,
  })
  const modePart =
    travelModeNeedsVehicle(travelMode) && vehicle
      ? `Phương tiện: ${vehicleLabel(vehicle.kind)}`
      : `Di chuyển: ${travelModeLabel(travelMode)}`
  explanation = `${modePart}. ${explanation}`
  if (routingDegraded || routingProvider === 'haversine') {
    routingDegraded = true
    explanation +=
      ' Chưa lấy được tuyến đường thật (đường chim bay) — mở «Chỉ đường» để xem ngõ/đường trên Google Maps.'
  }
  if (transitDegraded) {
    explanation +=
      ' Transit đang ở chế độ ước lượng (chưa OTP/GTFS) — mở Google Maps để xác nhận.'
  }

  return {
    query,
    intent,
    vehicle,
    travelMode,
    tripPurpose,
    recommendationMode,
    anchor,
    destination,
    radiusMeters,
    recommendations,
    explanation,
    routingProvider,
    routingDegraded: routingDegraded || undefined,
    transitDegraded: transitDegraded || undefined,
  }
}
