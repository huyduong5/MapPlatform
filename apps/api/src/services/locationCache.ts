import type { ApiListResponse, LocationSummary } from '@/types/location'

export type MapBounds = {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

const TTL_MS = 90_000
const MAX_ENTRIES = 40
const ROUND = 3

type CacheEntry = {
  data: ApiListResponse<LocationSummary>
  expiresAt: number
  touchedAt: number
}

const store = new Map<string, CacheEntry>()

function roundCoord(n: number): string {
  return n.toFixed(ROUND)
}

/** Stable cache key for bbox list queries (city + rounded viewport + status + limit). */
export function locationCacheKey(params: {
  city?: string
  status?: string
  limit?: number
  bounds?: MapBounds
}): string | null {
  if (!params.bounds) return null
  const b = params.bounds
  return [
    params.city || '',
    params.status || 'active',
    String(params.limit ?? 100),
    roundCoord(b.minLat),
    roundCoord(b.maxLat),
    roundCoord(b.minLng),
    roundCoord(b.maxLng),
  ].join('|')
}

function prune(now: number) {
  for (const [k, v] of store) {
    if (v.expiresAt <= now) store.delete(k)
  }
  while (store.size > MAX_ENTRIES) {
    let oldestKey: string | null = null
    let oldestTouch = Infinity
    for (const [k, v] of store) {
      if (v.touchedAt < oldestTouch) {
        oldestTouch = v.touchedAt
        oldestKey = k
      }
    }
    if (!oldestKey) break
    store.delete(oldestKey)
  }
}

export function getCachedLocations(
  key: string | null,
  now = Date.now(),
): ApiListResponse<LocationSummary> | null {
  if (!key) return null
  const entry = store.get(key)
  if (!entry) return null
  if (entry.expiresAt <= now) {
    store.delete(key)
    return null
  }
  entry.touchedAt = now
  return entry.data
}

export function setCachedLocations(
  key: string | null,
  data: ApiListResponse<LocationSummary>,
  now = Date.now(),
) {
  if (!key) return
  store.set(key, {
    data,
    expiresAt: now + TTL_MS,
    touchedAt: now,
  })
  prune(now)
}

export function invalidateLocationCache(city?: string) {
  if (!city) {
    store.clear()
    return
  }
  const prefix = `${city}|`
  for (const k of [...store.keys()]) {
    if (k.startsWith(prefix)) store.delete(k)
  }
}

/** Test helper */
export function _resetLocationCache() {
  store.clear()
}
