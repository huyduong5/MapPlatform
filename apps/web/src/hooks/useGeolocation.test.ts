import { describe, expect, it, vi } from 'vitest'
import {
  GEO_MESSAGES,
  mapGeolocationError,
  messageForStatus,
  toUserGeoPosition,
} from './useGeolocation'

describe('geolocation helpers', () => {
  it('maps GeolocationPositionError codes', () => {
    expect(mapGeolocationError({ code: 1 })).toBe('denied')
    expect(mapGeolocationError({ code: 2 })).toBe('unavailable')
    expect(mapGeolocationError({ code: 3 })).toBe('unavailable')
    expect(mapGeolocationError({ code: 99 })).toBe('error')
  })

  it('exposes friendly Vietnamese messages', () => {
    expect(messageForStatus('denied')).toBe(GEO_MESSAGES.denied)
    expect(messageForStatus('unavailable')).toBe(GEO_MESSAGES.unavailable)
    expect(messageForStatus('error')).toBe(GEO_MESSAGES.error)
    expect(messageForStatus('idle')).toBeNull()
    expect(messageForStatus('active')).toBeNull()
  })

  it('builds user position from coords', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    const p = toUserGeoPosition({ latitude: 21.02, longitude: 105.85, accuracy: 18 })
    expect(p).toEqual({
      latitude: 21.02,
      longitude: 105.85,
      accuracy: 18,
      updatedAt: 1_700_000_000_000,
    })
  })
})
