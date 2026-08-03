import { describe, expect, it, beforeEach } from 'vitest'
import {
  _resetLocationCache,
  getCachedLocations,
  invalidateLocationCache,
  locationCacheKey,
  setCachedLocations,
} from '@/services/locationCache'
import type { ApiListResponse, LocationSummary } from '@/types/location'
import { cityContains } from '@/lib/cities'

function fakeList(names: string[]): ApiListResponse<LocationSummary> {
  return {
    success: true,
    data: names.map((name, i) => ({
      id: `id-${i}`,
      name,
      type: 'store',
      status: 'active',
      latitude: 21,
      longitude: 105.8,
      address: '',
      city: 'hanoi',
    })) as LocationSummary[],
  }
}

describe('locationCache', () => {
  beforeEach(() => _resetLocationCache())

  it('builds stable rounded bbox keys', () => {
    const a = locationCacheKey({
      city: 'hanoi',
      status: 'active',
      limit: 100,
      bounds: { minLat: 21.0284, maxLat: 21.1, minLng: 105.8, maxLng: 105.9 },
    })
    const b = locationCacheKey({
      city: 'hanoi',
      status: 'active',
      limit: 100,
      bounds: { minLat: 21.0281, maxLat: 21.1, minLng: 105.8, maxLng: 105.9 },
    })
    expect(a).toBe(b)
    expect(a).toContain('hanoi|active|100|')
  })

  it('returns null key without bounds', () => {
    expect(locationCacheKey({ city: 'hanoi', status: 'active', limit: 100 })).toBeNull()
  })

  it('get/set respects TTL and LRU invalidate by city', () => {
    const key = locationCacheKey({
      city: 'hanoi',
      status: 'active',
      limit: 100,
      bounds: { minLat: 21, maxLat: 21.1, minLng: 105.8, maxLng: 105.9 },
    })
    setCachedLocations(key, fakeList(['A']))
    expect(getCachedLocations(key)?.data[0].name).toBe('A')

    invalidateLocationCache('hanoi')
    expect(getCachedLocations(key)).toBeNull()
  })

  it('expires entries after TTL', () => {
    const key = locationCacheKey({
      city: 'hcm',
      status: 'active',
      limit: 50,
      bounds: { minLat: 10.7, maxLat: 10.8, minLng: 106.6, maxLng: 106.7 },
    })
    const now = Date.now()
    setCachedLocations(key, fakeList(['B']), now)
    expect(getCachedLocations(key, now + 1000)?.data[0].name).toBe('B')
    expect(getCachedLocations(key, now + 100_000)).toBeNull()
  })
})

describe('cityContains', () => {
  it('detects GPS inside/outside Hanoi bbox', () => {
    expect(cityContains('hanoi', 21.0285, 105.8542)).toBe(true)
    expect(cityContains('hanoi', 10.78, 106.7)).toBe(false)
  })
})
