import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  getLocations,
  isAbortError,
  peekCachedLocations,
} from '@/services/locationApi'
import { _resetLocationCache } from '@/services/locationCache'

describe('locationApi abort + cache', () => {
  beforeEach(() => {
    _resetLocationCache()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.signal?.aborted) {
          const err = new DOMException('Aborted', 'AbortError')
          throw err
        }
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: '1',
                name: 'Test POI',
                type: 'store',
                status: 'active',
                latitude: 21.02,
                longitude: 105.85,
                address: 'HN',
                city: 'hanoi',
              },
            ],
          }),
        }
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('isAbortError recognizes AbortError', () => {
    expect(isAbortError(new DOMException('x', 'AbortError'))).toBe(true)
    expect(isAbortError(new Error('nope'))).toBe(false)
  })

  it('stores bbox responses in cache for peek', async () => {
    const bounds = { minLat: 21, maxLat: 21.1, minLng: 105.8, maxLng: 105.9 }
    await getLocations({
      status: 'active',
      limit: 100,
      city: 'hanoi',
      bounds,
      withTotal: false,
    })
    const peeked = peekCachedLocations({
      status: 'active',
      limit: 100,
      city: 'hanoi',
      bounds,
    })
    expect(peeked?.[0].name).toBe('Test POI')
  })

  it('aborted fetch throws AbortError and does not update via caller', async () => {
    const ac = new AbortController()
    ac.abort()
    await expect(
      getLocations(
        { status: 'active', limit: 100, city: 'hanoi' },
        { signal: ac.signal },
      ),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })
})
