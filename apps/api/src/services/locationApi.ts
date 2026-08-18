import type {
  ApiDetailResponse,
  ApiListResponse,
  LocationDetail,
  LocationSummary,
} from '@/types/location'
import type { CityCode } from '@/lib/cities'
import {
  getCachedLocations,
  locationCacheKey,
  setCachedLocations,
  type MapBounds,
} from '@/services/locationCache'

/** Same-origin by default (monolith). Override with NEXT_PUBLIC_API_BASE_URL if needed. */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') || ''

export type { MapBounds }

export type RequestOpts = {
  signal?: AbortSignal
  /** Skip in-memory bbox cache (search / forced refresh). */
  skipCache?: boolean
}

function isAbortError(e: unknown): boolean {
  return (
    (e instanceof DOMException && e.name === 'AbortError') ||
    (e instanceof Error && e.name === 'AbortError')
  )
}

export type LocationApiError = Error & { code?: string }

async function request<T>(path: string, opts?: RequestOpts): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    signal: opts?.signal,
  })
  const json = await res.json()
  if (!res.ok || json.success === false) {
    const err = new Error(json?.error?.message || `HTTP ${res.status}`) as LocationApiError
    err.code = json?.error?.code
    throw err
  }
  return json as T
}

export async function getCities(opts?: RequestOpts): Promise<
  ApiListResponse<{
    code: CityCode
    name: string
    latitude: number
    longitude: number
    zoom: number
    locationCount: number
    enabled: boolean
  }>
> {
  return request('/api/cities', opts)
}

export async function getLocations(
  params: {
    type?: string
    status?: string
    search?: string
    page?: number
    limit?: number
    bounds?: MapBounds
    city?: CityCode
    /** Map pan/zoom: skip COUNT(*) on API (default true when omitted). */
    withTotal?: boolean
    /** Leaflet zoom — enables density sampling when low. */
    zoom?: number
  },
  opts?: RequestOpts,
): Promise<ApiListResponse<LocationSummary>> {
  const cacheKey =
    !params.search && !opts?.skipCache
      ? locationCacheKey({
          city: params.city,
          status: params.status,
          limit: params.limit,
          bounds: params.bounds,
        })
      : null

  const q = new URLSearchParams()
  if (params.type) q.set('type', params.type)
  if (params.status) q.set('status', params.status)
  if (params.search) q.set('search', params.search)
  if (params.page) q.set('page', String(params.page))
  if (params.limit) q.set('limit', String(params.limit))
  if (params.city) q.set('city', params.city)
  if (params.withTotal === false) q.set('withTotal', 'false')
  if (params.zoom != null && Number.isFinite(params.zoom)) q.set('zoom', String(Math.round(params.zoom)))
  if (params.bounds) {
    q.set('minLat', String(params.bounds.minLat))
    q.set('maxLat', String(params.bounds.maxLat))
    q.set('minLng', String(params.bounds.minLng))
    q.set('maxLng', String(params.bounds.maxLng))
  }
  const qs = q.toString()
  try {
    const res = await request<ApiListResponse<LocationSummary>>(
      `/api/locations${qs ? `?${qs}` : ''}`,
      opts,
    )
    if (cacheKey && !params.search) setCachedLocations(cacheKey, res)
    return res
  } catch (e) {
    if (isAbortError(e)) throw e
    if (cacheKey) {
      const hit = getCachedLocations(cacheKey)
      if (hit) return hit
    }
    throw e
  }
}

/** Instant paint from in-memory bbox cache (no network). */
export function peekCachedLocations(params: {
  status?: string
  limit?: number
  bounds?: MapBounds
  city?: CityCode
}): LocationSummary[] | null {
  const key = locationCacheKey({
    city: params.city,
    status: params.status,
    limit: params.limit,
    bounds: params.bounds,
  })
  return getCachedLocations(key)?.data ?? null
}

export async function searchLocations(
  query: string,
  city?: CityCode,
  opts?: RequestOpts,
) {
  return getLocations(
    { search: query, status: 'active', limit: 50, city },
    { ...opts, skipCache: true },
  )
}

export async function getLocationById(
  id: string,
  opts?: RequestOpts,
): Promise<ApiDetailResponse<LocationDetail>> {
  return request(`/api/locations/${id}`, opts)
}

export async function getNearbyLocations(
  params: {
    latitude: number
    longitude: number
    radius?: number
    type?: string
    limit?: number
    city?: CityCode
  },
  opts?: RequestOpts,
): Promise<ApiListResponse<LocationSummary>> {
  const q = new URLSearchParams({
    latitude: String(params.latitude),
    longitude: String(params.longitude),
    radius: String(params.radius ?? 5000),
  })
  if (params.type) q.set('type', params.type)
  if (params.limit) q.set('limit', String(params.limit))
  if (params.city) q.set('city', params.city)
  return request(`/api/locations/nearby?${q.toString()}`, opts)
}

export { isAbortError }
