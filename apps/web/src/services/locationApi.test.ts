import { describe, expect, it } from 'vitest'

function buildListQuery(params: Record<string, string | undefined>) {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v) q.set(k, v)
  })
  const qs = q.toString()
  return `/api/locations${qs ? `?${qs}` : ''}`
}

describe('location API query builder', () => {
  it('builds search query', () => {
    expect(
      buildListQuery({ search: 'Times City', status: 'active', limit: '20' }),
    ).toBe('/api/locations?search=Times+City&status=active&limit=20')
  })

  it('omits empty params', () => {
    expect(buildListQuery({ type: undefined, status: 'active' })).toBe(
      '/api/locations?status=active',
    )
  })

  it('builds bbox viewport query', () => {
    expect(
      buildListQuery({
        status: 'active',
        minLat: '20.9',
        maxLat: '21.1',
        minLng: '105.7',
        maxLng: '105.9',
        limit: '100',
        withTotal: 'false',
      }),
    ).toBe(
      '/api/locations?status=active&minLat=20.9&maxLat=21.1&minLng=105.7&maxLng=105.9&limit=100&withTotal=false',
    )
  })
})
