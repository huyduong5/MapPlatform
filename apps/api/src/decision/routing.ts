/** Routing adapters — ORS primary (multi-profile), OSRM fallback, dual-route pairs. */

import type { RouteGeometry, RouteStep, TravelMode } from './types'

export type RoutingProfile = 'driving' | 'motorcycle' | 'walking' | 'cycling'

export type RouteResult = {
  distanceM: number
  durationS: number
  geometry: RouteGeometry | null
  provider: string
  steps?: RouteStep[]
  /** True when geometry is crow-fly haversine, not a road path. */
  degraded?: boolean
}

export type LatLng = { latitude: number; longitude: number }

export type RoutePairResult = {
  fastest: RouteResult
  smart: RouteResult
  provider: string
  degraded?: boolean
}

const OSRM_UA = 'MapPlatform/1.0 (decision-routing; +https://github.com)'
const OSRM_TIMEOUT_MS = 10_000
const OSRM_RETRIES = 2
const HAVERSINE_CACHE_TTL_MS = 30_000

type OsrmMirror = {
  /** Origin without trailing slash */
  origin: string
  /**
   * Path before `/route/v1/{profile}/…`
   * '' for project-osrm; '/routed-car' etc for FOSSGIS.
   */
  pathForProfile: (osrmProfile: string) => string
}

function defaultOsrmMirrors(): OsrmMirror[] {
  const fromEnv = (process.env.OSRM_BASE_URLS || process.env.OSRM_BASE_URL || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const mirrors: OsrmMirror[] = []
  for (const raw of fromEnv) {
    const origin = raw.replace(/\/$/, '')
    if (origin.includes('routing.openstreetmap.de')) {
      mirrors.push({
        origin,
        pathForProfile: (p) => {
          if (p === 'foot' || p === 'walking') return '/routed-foot'
          if (p === 'bike' || p === 'cycling') return '/routed-bike'
          return '/routed-car'
        },
      })
    } else {
      mirrors.push({ origin, pathForProfile: () => '' })
    }
  }

  if (!mirrors.length) {
    mirrors.push(
      { origin: 'https://router.project-osrm.org', pathForProfile: () => '' },
      {
        origin: 'https://routing.openstreetmap.de',
        pathForProfile: (p) => {
          if (p === 'foot' || p === 'walking') return '/routed-foot'
          if (p === 'bike' || p === 'cycling') return '/routed-bike'
          return '/routed-car'
        },
      },
    )
  }
  return mirrors
}

/** Build Vietnamese turn-by-turn text from OSRM maneuver + street name. */
export function formatOsrmInstruction(input: {
  instruction?: string | null
  name?: string | null
  type?: string | null
  modifier?: string | null
}): string {
  const existing = (input.instruction || '').trim()
  if (existing) return existing

  const name = (input.name || '').trim()
  const type = (input.type || '').toLowerCase()
  const mod = (input.modifier || '').toLowerCase()

  const into = name ? ` vào ${name}` : ''
  const along = name ? ` theo ${name}` : ''

  const turnWord =
    mod === 'left' || mod === 'sharp left' || mod === 'slight left'
      ? 'trái'
      : mod === 'right' || mod === 'sharp right' || mod === 'slight right'
        ? 'phải'
        : ''

  const slight =
    mod.startsWith('slight') ? 'Nhẹ ' : mod.startsWith('sharp') ? 'Gắt ' : ''

  switch (type) {
    case 'depart':
      return name ? `Bắt đầu từ ${name}` : 'Bắt đầu hành trình'
    case 'arrive':
      return name ? `Đến nơi: ${name}` : 'Đến nơi'
    case 'turn':
      if (turnWord) return `${slight}Rẽ ${turnWord}${into}`
      return name ? `Rẽ${into}` : 'Rẽ'
    case 'new name':
      return name ? `Tiếp tục vào ${name}` : 'Tiếp tục đi thẳng'
    case 'continue':
      if (mod === 'uturn' || mod === 'u-turn') return `Quay đầu${along}`
      return name ? `Đi tiếp theo ${name}` : 'Đi thẳng'
    case 'merge':
      return name ? `Nhập làn vào ${name}` : 'Nhập làn'
    case 'on ramp':
    case 'off ramp':
      return name ? `Ra/vào đường ${name}` : 'Ra/vào đường nhánh'
    case 'fork':
      if (turnWord) return `Đi nhánh bên ${turnWord}${into}`
      return name ? `Đi nhánh${into}` : 'Đi theo nhánh đường'
    case 'end of road':
      if (turnWord) return `Hết đường, rẽ ${turnWord}${into}`
      return name ? `Hết đường, vào ${name}` : 'Hết đường'
    case 'roundabout':
    case 'rotary':
      return name ? `Vào vòng xuyến rồi ra ${name}` : 'Đi vòng xuyến'
    case 'notification':
      return name || 'Tiếp tục'
    default:
      if (turnWord) return `Rẽ ${turnWord}${into}`
      return name || 'Tiếp tục'
  }
}

type OsrmStepRaw = {
  maneuver?: {
    instruction?: string
    type?: string
    modifier?: string
  }
  name?: string
  distance?: number
  duration?: number
}

function stepsFromOsrmLegs(
  legs: Array<{ steps?: OsrmStepRaw[] }> | undefined,
): RouteStep[] {
  const steps: RouteStep[] = []
  for (const leg of legs || []) {
    for (const s of leg.steps || []) {
      const instruction = formatOsrmInstruction({
        instruction: s.maneuver?.instruction,
        name: s.name,
        type: s.maneuver?.type,
        modifier: s.maneuver?.modifier,
      })
      if (!instruction) continue
      steps.push({
        instruction,
        distanceM: s.distance,
        durationS: s.duration,
      })
    }
  }
  return steps.slice(0, 24)
}

function parseOsrmRouteJson(
  route: {
    distance?: number
    duration?: number
    geometry?: { type?: string; coordinates?: number[][] }
    legs?: Array<{ steps?: OsrmStepRaw[] }>
  },
  providerTag: string,
): RouteResult {
  const coords = (route.geometry?.coordinates || []) as Array<[number, number]>
  const steps = stepsFromOsrmLegs(route.legs)
  return {
    distanceM: Number(route.distance || 0),
    durationS: Number(route.duration || 0),
    geometry: coords.length >= 2 ? { type: 'LineString', coordinates: coords } : null,
    provider: providerTag,
    steps: steps.length ? steps : undefined,
  }
}

async function fetchOsrmOnce(url: string): Promise<{
  code?: string
  routes?: Array<{
    distance?: number
    duration?: number
    geometry?: { type?: string; coordinates?: number[][] }
    legs?: Array<{ steps?: OsrmStepRaw[] }>
  }>
} | null> {
  // Prefer Node https with family:4 — undici fetch often ETIMEDOUT on OSRM demo IPv6.
  try {
    const { request } = await import('node:https')
    const parsed = new URL(url)
    const body = await new Promise<string>((resolve, reject) => {
      const req = request(
        {
          protocol: parsed.protocol,
          hostname: parsed.hostname,
          port: parsed.port || 443,
          path: `${parsed.pathname}${parsed.search}`,
          method: 'GET',
          family: 4,
          headers: {
            Accept: 'application/json',
            'User-Agent': OSRM_UA,
          },
          timeout: OSRM_TIMEOUT_MS,
        },
        (res) => {
          const chunks: Buffer[] = []
          res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
          res.on('end', () => {
            if ((res.statusCode || 0) >= 400) {
              reject(new Error(`OSRM HTTP ${res.statusCode}`))
              return
            }
            resolve(Buffer.concat(chunks).toString('utf8'))
          })
        },
      )
      req.on('error', reject)
      req.on('timeout', () => {
        req.destroy(new Error('OSRM timeout'))
      })
      req.end()
    })
    return JSON.parse(body) as {
      code?: string
      routes?: Array<{
        distance?: number
        duration?: number
        geometry?: { type?: string; coordinates?: number[][] }
        legs?: Array<{ steps?: OsrmStepRaw[] }>
      }>
    }
  } catch {
    return null
  }
}

function osrmProfileCandidates(profile: RoutingProfile): string[] {
  if (profile === 'motorcycle') return ['motorcycle', 'driving']
  if (profile === 'walking') return ['foot', 'walking']
  if (profile === 'cycling') return ['bike', 'cycling']
  return ['driving']
}

function buildOsrmRouteUrl(
  mirror: OsrmMirror,
  osrmProfile: string,
  from: LatLng,
  to: LatLng,
  alternatives: boolean,
): string {
  const prefix = mirror.pathForProfile(osrmProfile)
  const pathProfile =
    osrmProfile === 'walking' ? 'foot' : osrmProfile === 'cycling' ? 'bike' : osrmProfile
  const q = `overview=full&geometries=geojson&steps=true&alternatives=${alternatives ? 'true' : 'false'}&generate_hints=false`
  return `${mirror.origin}${prefix}/route/v1/${pathProfile}/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?${q}`
}

async function fetchOsrmRoutes(
  from: LatLng,
  to: LatLng,
  profile: RoutingProfile,
  alternatives: boolean,
): Promise<RouteResult[]> {
  const mirrors = defaultOsrmMirrors()
  const profiles = osrmProfileCandidates(profile)

  for (const mirror of mirrors) {
    for (const p of profiles) {
      const url = buildOsrmRouteUrl(mirror, p, from, to, alternatives)
      for (let attempt = 0; attempt < OSRM_RETRIES; attempt++) {
        const json = await fetchOsrmOnce(url)
        if (json?.code === 'Ok' && json.routes?.length) {
          return json.routes.slice(0, alternatives ? 3 : 1).map((route) =>
            parseOsrmRouteJson(route, `osrm:${p}`),
          )
        }
      }
    }
  }
  return []
}

export interface RoutingProvider {
  name: string
  getRoute(
    from: LatLng,
    to: LatLng,
    profile: RoutingProfile,
  ): Promise<RouteResult | null>
}

const memoryCache = new Map<string, { at: number; value: RouteResult }>()
const pairCache = new Map<string, { at: number; value: RoutePairResult }>()
const CACHE_TTL_MS = 10 * 60_000

function cacheKey(from: LatLng, to: LatLng, profile: string): string {
  const r = (n: number) => Math.round(n * 1e4) / 1e4
  return `${profile}:${r(from.latitude)},${r(from.longitude)}>${r(to.latitude)},${r(to.longitude)}`
}

function getCached(key: string): RouteResult | null {
  const hit = memoryCache.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    memoryCache.delete(key)
    return null
  }
  return hit.value
}

function setCached(key: string, value: RouteResult) {
  // Do not keep crow-fly fallback in the long cache — retry road routers next time
  if (value.degraded || value.provider === 'haversine') {
    memoryCache.set(key, { at: Date.now() - (CACHE_TTL_MS - HAVERSINE_CACHE_TTL_MS), value })
    return
  }
  memoryCache.set(key, { at: Date.now(), value })
}

function getPairCached(key: string): RoutePairResult | null {
  const hit = pairCache.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    pairCache.delete(key)
    return null
  }
  return hit.value
}

function setPairCached(key: string, value: RoutePairResult) {
  if (value.degraded || value.provider.includes('haversine')) {
    pairCache.set(key, {
      at: Date.now() - (CACHE_TTL_MS - HAVERSINE_CACHE_TTL_MS),
      value,
    })
    return
  }
  pairCache.set(key, { at: Date.now(), value })
}

export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.latitude - a.latitude)
  const dLng = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export const haversineProvider: RoutingProvider = {
  name: 'haversine',
  async getRoute(from, to, profile) {
    const distanceM = haversineM(from, to)
    const speedKmh =
      profile === 'walking' ? 4.5 : profile === 'cycling' ? 15 : profile === 'motorcycle' ? 28 : 25
    const durationS = (distanceM / (speedKmh * 1000)) * 3600
    return {
      distanceM,
      durationS,
      geometry: {
        type: 'LineString',
        coordinates: [
          [from.longitude, from.latitude],
          [to.longitude, to.latitude],
        ],
      },
      provider: 'haversine',
      degraded: true,
      steps: [
        {
          instruction: 'Ước lượng đường thẳng (chưa có tuyến đường thật) — mở Chỉ đường Google Maps',
          distanceM,
          durationS,
        },
      ],
    }
  },
}

export function travelModeToOsrmProfile(mode: TravelMode): RoutingProfile {
  switch (mode) {
    case 'walk':
      return 'walking'
    case 'bike':
      return 'cycling'
    case 'moto':
      return 'motorcycle'
    default:
      return 'driving'
  }
}

export function travelModeToOrsProfile(mode: TravelMode): string {
  switch (mode) {
    case 'walk':
      return 'foot-walking'
    case 'bike':
      return 'cycling-regular'
    case 'moto':
      return 'driving-car'
    case 'drive':
      return 'driving-car'
    default:
      return 'driving-car'
  }
}

export function googleTravelMode(mode: TravelMode): string {
  switch (mode) {
    case 'walk':
      return 'walking'
    case 'bike':
      return 'bicycling'
    case 'transit':
      return 'transit'
    default:
      return 'driving'
  }
}

/** Sampled overlap ratio — high means nearly identical paths. */
export function geometryOverlapRatio(a: RouteGeometry | null, b: RouteGeometry | null): number {
  if (!a?.coordinates?.length || !b?.coordinates?.length) return 0
  const sample = (coords: Array<[number, number]>, n: number) => {
    if (coords.length <= n) return coords
    const out: Array<[number, number]> = []
    for (let i = 0; i < n; i++) {
      const idx = Math.floor((i * (coords.length - 1)) / (n - 1))
      out.push(coords[idx])
    }
    return out
  }
  const sa = sample(a.coordinates, 12)
  const sb = sample(b.coordinates, 24)
  let hits = 0
  for (const p of sa) {
    let best = Infinity
    for (const q of sb) {
      const d = haversineM(
        { latitude: p[1], longitude: p[0] },
        { latitude: q[1], longitude: q[0] },
      )
      if (d < best) best = d
    }
    if (best < 80) hits++
  }
  return hits / sa.length
}

function midpointAvoidPolygon(geometry: RouteGeometry | null, halfDeg = 0.004): object | null {
  const coords = geometry?.coordinates
  if (!coords || coords.length < 2) return null
  const mid = coords[Math.floor(coords.length / 2)]
  const [lng, lat] = mid
  return {
    type: 'Polygon',
    coordinates: [
      [
        [lng - halfDeg, lat - halfDeg],
        [lng + halfDeg, lat - halfDeg],
        [lng + halfDeg, lat + halfDeg],
        [lng - halfDeg, lat + halfDeg],
        [lng - halfDeg, lat - halfDeg],
      ],
    ],
  }
}

function parseOrsFeature(feature: {
  properties?: {
    summary?: { distance?: number; duration?: number }
    segments?: Array<{
      steps?: Array<{ instruction?: string; distance?: number; duration?: number }>
    }>
  }
  geometry?: { type?: string; coordinates?: number[][] }
}): RouteResult | null {
  const coords = (feature.geometry?.coordinates || []) as Array<[number, number]>
  const summary = feature.properties?.summary
  if (!summary && coords.length < 2) return null
  const steps: RouteStep[] = []
  for (const seg of feature.properties?.segments || []) {
    for (const s of seg.steps || []) {
      if (s.instruction) {
        steps.push({
          instruction: s.instruction,
          distanceM: s.distance,
          durationS: s.duration,
        })
      }
    }
  }
  return {
    distanceM: Number(summary?.distance || 0),
    durationS: Number(summary?.duration || 0),
    geometry: coords.length >= 2 ? { type: 'LineString', coordinates: coords } : null,
    provider: 'ors',
    steps: steps.length ? steps.slice(0, 24) : undefined,
  }
}

async function orsDirections(
  from: LatLng,
  to: LatLng,
  mode: TravelMode,
  opts?: {
    preference?: 'fastest' | 'shortest' | 'recommended'
    alternativeRoutes?: boolean
    avoidFeatures?: string[]
    avoidPolygons?: object | null
    greenQuiet?: boolean
  },
): Promise<RouteResult[]> {
  const apiKey = process.env.ORS_API_KEY?.trim()
  if (!apiKey) return []

  const profile = travelModeToOrsProfile(mode)
  const url = `https://api.openrouteservice.org/v2/directions/${profile}/geojson`
  const body: Record<string, unknown> = {
    coordinates: [
      [from.longitude, from.latitude],
      [to.longitude, to.latitude],
    ],
    instructions: true,
    preference: opts?.preference || 'fastest',
  }
  if (opts?.alternativeRoutes) {
    body.alternative_routes = {
      target_count: 2,
      share_factor: 0.6,
      weight_factor: 1.4,
    }
  }
  const options: Record<string, unknown> = {}
  if (opts?.avoidFeatures?.length) options.avoid_features = opts.avoidFeatures
  if (opts?.avoidPolygons) options.avoid_polygons = opts.avoidPolygons
  if (opts?.greenQuiet && (mode === 'walk' || mode === 'bike')) {
    options.profile_params = {
      weightings: {
        green: { factor: 0.8 },
        quiet: { factor: 1.0 },
      },
    }
  }
  if (Object.keys(options).length) body.options = options

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json, application/geo+json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const json = (await res.json()) as {
      features?: Array<{
        properties?: RouteResult extends never ? never : {
          summary?: { distance?: number; duration?: number }
          segments?: Array<{
            steps?: Array<{ instruction?: string; distance?: number; duration?: number }>
          }>
        }
        geometry?: { type?: string; coordinates?: number[][] }
      }>
    }
    const out: RouteResult[] = []
    for (const f of json.features || []) {
      const parsed = parseOrsFeature(f)
      if (parsed) {
        parsed.provider = `ors:${profile}`
        out.push(parsed)
      }
    }
    return out
  } catch {
    return []
  }
}

export function createOsrmProvider(_baseUrl?: string): RoutingProvider {
  void _baseUrl
  return {
    name: 'osrm',
    async getRoute(from, to, profile) {
      const key = cacheKey(from, to, `osrm:${profile}`)
      const cached = getCached(key)
      if (cached && !cached.degraded) return cached

      const routes = await fetchOsrmRoutes(from, to, profile, false)
      const value = routes[0] || null
      if (value) setCached(key, value)
      return value
    },
  }
}

async function osrmAlternatives(
  from: LatLng,
  to: LatLng,
  mode: TravelMode,
): Promise<RouteResult[]> {
  return fetchOsrmRoutes(from, to, travelModeToOsrmProfile(mode), true)
}

/** Stub — implement when GOONG_API_KEY is set. */
export function createGoongProvider(): RoutingProvider | null {
  if (!process.env.GOONG_API_KEY) return null
  return {
    name: 'goong',
    async getRoute() {
      return null
    },
  }
}

/** Stub — implement when GOOGLE_MAPS_API_KEY is set. */
export function createGoogleProvider(): RoutingProvider | null {
  if (!process.env.GOOGLE_MAPS_API_KEY) return null
  return {
    name: 'google',
    async getRoute() {
      return null
    },
  }
}

export function getRoutingProvider(): RoutingProvider {
  const mode = (process.env.ROUTING_PROVIDER || 'auto').toLowerCase()
  if (mode === 'haversine') return haversineProvider
  if (mode === 'osrm') return createOsrmProvider()
  if (mode === 'goong') return createGoongProvider() || createOsrmProvider()
  if (mode === 'google') return createGoogleProvider() || createOsrmProvider()

  return createGoongProvider() || createGoogleProvider() || createOsrmProvider()
}

export function isRoutingDegraded(provider: string | undefined | null): boolean {
  return !provider || provider === 'haversine' || provider.includes('haversine')
}

export async function routeWithFallback(
  from: LatLng,
  to: LatLng,
  profile: RoutingProfile,
): Promise<RouteResult> {
  const primary = getRoutingProvider()
  try {
    const r = await primary.getRoute(from, to, profile)
    if (r && !r.degraded) return r
  } catch {
    /* fall through */
  }
  // Explicit multi-mirror retry even if primary was a stub
  const osrmHits = await fetchOsrmRoutes(from, to, profile, false)
  if (osrmHits[0]) return osrmHits[0]

  const fb = await haversineProvider.getRoute(from, to, profile)
  return fb!
}

function sortByDuration(routes: RouteResult[]): RouteResult[] {
  return [...routes].sort((a, b) => a.durationS - b.durationS || a.distanceM - b.distanceM)
}

function pickSmart(
  fastest: RouteResult,
  candidates: RouteResult[],
): RouteResult {
  const others = candidates.filter((c) => c !== fastest)
  for (const c of others) {
    if (geometryOverlapRatio(fastest.geometry, c.geometry) < 0.85) return c
  }
  return others[0] || fastest
}

/**
 * Always returns two route options (fastest + smart/diverse).
 * Primary: ORS with alternatives / green-quiet / avoid.
 * Fallback: OSRM alternatives, then haversine duplicate with label distinction.
 */
export async function getRoutePair(
  from: LatLng,
  to: LatLng,
  mode: TravelMode,
): Promise<RoutePairResult> {
  if (mode === 'transit') {
    const single = await routeWithFallback(from, to, 'walking')
    return {
      fastest: single,
      smart: single,
      provider: single.provider,
      degraded: single.degraded || isRoutingDegraded(single.provider),
    }
  }

  const key = cacheKey(from, to, `pair:${mode}`)
  const cached = getPairCached(key)
  if (cached && !cached.degraded) return cached

  let routes = await orsDirections(from, to, mode, {
    preference: 'fastest',
    alternativeRoutes: true,
  })

  if (routes.length < 2 && (mode === 'walk' || mode === 'bike')) {
    const green = await orsDirections(from, to, mode, {
      preference: 'recommended',
      greenQuiet: true,
    })
    routes = [...routes, ...green]
  }

  if (routes.length < 2 && (mode === 'drive' || mode === 'moto')) {
    const avoidHw = await orsDirections(from, to, mode, {
      preference: 'fastest',
      avoidFeatures: ['highways'],
    })
    routes = [...routes, ...avoidHw]
  }

  if (routes.length < 2) {
    const osrmAlts = await osrmAlternatives(from, to, mode)
    routes = [...routes, ...osrmAlts]
  }

  if (routes.length === 0) {
    const single = await routeWithFallback(from, to, travelModeToOsrmProfile(mode))
    routes = [single]
  }

  const sorted = sortByDuration(routes)
  let fastest = sorted[0]
  let smart = pickSmart(fastest, sorted)

  if (geometryOverlapRatio(fastest.geometry, smart.geometry) >= 0.85) {
    const poly = midpointAvoidPolygon(fastest.geometry)
    const diversified = await orsDirections(from, to, mode, {
      preference: mode === 'walk' || mode === 'bike' ? 'recommended' : 'shortest',
      avoidPolygons: poly,
      greenQuiet: mode === 'walk' || mode === 'bike',
      avoidFeatures: mode === 'drive' || mode === 'moto' ? ['tollways'] : undefined,
    })
    if (diversified[0] && geometryOverlapRatio(fastest.geometry, diversified[0].geometry) < 0.9) {
      smart = diversified[0]
    } else if (smart === fastest) {
      smart = { ...fastest, provider: `${fastest.provider}+alt` }
    }
  }

  if (smart.durationS < fastest.durationS) {
    const tmp = fastest
    fastest = smart
    smart = tmp
  }

  const degraded =
    Boolean(fastest.degraded) ||
    isRoutingDegraded(fastest.provider) ||
    (fastest.geometry?.coordinates?.length ?? 0) < 3

  const value: RoutePairResult = {
    fastest,
    smart,
    provider: fastest.provider,
    degraded,
  }
  setPairCached(key, value)
  return value
}

export function directionsDeepLink(
  to: LatLng,
  from?: LatLng | null,
  mode: TravelMode = 'drive',
): string {
  const dest = `${to.latitude},${to.longitude}`
  const travelmode = googleTravelMode(mode)
  if (from) {
    return `https://www.google.com/maps/dir/?api=1&origin=${from.latitude},${from.longitude}&destination=${dest}&travelmode=${travelmode}`
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=${travelmode}`
}
