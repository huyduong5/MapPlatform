import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  GEO_MESSAGES,
  GEO_OPTIONS_COARSE,
  GEO_OPTIONS_QUICK,
  GEO_OPTIONS_WATCH,
  isGeolocationSecureContext,
  isValidLatLng,
  mapGeolocationError,
  messageForStatus,
  positionFromGeolocation,
  readCurrentPosition,
  shouldReplaceFix,
  toUserGeoPosition,
  zoomForAccuracy,
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
      source: 'browser',
      label: undefined,
    })
  })

  it('rejects invalid / null-island coords', () => {
    expect(isValidLatLng(21, 105)).toBe(true)
    expect(isValidLatLng(0, 0)).toBe(false)
    expect(isValidLatLng(91, 0)).toBe(false)
  })

  it('accepts coarse fixes (show blue-dot + accuracy circle like Maps)', () => {
    const coarse = {
      coords: { latitude: 21.02, longitude: 105.85, accuracy: 80_000 },
    } as GeolocationPosition
    expect(positionFromGeolocation(coarse)?.accuracy).toBe(80_000)
  })

  it('positionFromGeolocation drops null-island', () => {
    const good = {
      coords: { latitude: 21.02, longitude: 105.85, accuracy: 40 },
    } as GeolocationPosition
    const bad = {
      coords: { latitude: 0, longitude: 0, accuracy: 10 },
    } as GeolocationPosition
    expect(positionFromGeolocation(good)?.accuracy).toBe(40)
    expect(positionFromGeolocation(bad)).toBeNull()
  })

  it('shouldReplaceFix prefers browser over IP and ignores accuracy regressions', () => {
    const current = toUserGeoPosition({ latitude: 21, longitude: 105, accuracy: 30 })
    const worse = toUserGeoPosition({ latitude: 21.1, longitude: 105.1, accuracy: 2000 })
    const better = toUserGeoPosition({ latitude: 21.01, longitude: 105.01, accuracy: 15 })
    const ip = toUserGeoPosition(
      { latitude: 21.2, longitude: 105.2, accuracy: 25_000 },
      { source: 'ip' },
    )
    expect(shouldReplaceFix(current, worse)).toBe(false)
    expect(shouldReplaceFix(current, better)).toBe(true)
    expect(shouldReplaceFix(ip, current)).toBe(true)
    expect(shouldReplaceFix(current, ip)).toBe(false)
  })

  it('zoomForAccuracy matches Maps-style zoom budget', () => {
    expect(zoomForAccuracy(20)).toBe(18)
    expect(zoomForAccuracy(80)).toBe(17)
    expect(zoomForAccuracy(3_000)).toBe(13)
    expect(zoomForAccuracy(10_000)).toBe(11)
    expect(zoomForAccuracy(40_000)).toBe(10)
  })

  it('exports progressive option presets', () => {
    expect(GEO_OPTIONS_COARSE.enableHighAccuracy).toBe(false)
    expect(GEO_OPTIONS_QUICK.maximumAge).toBe(300_000)
    expect(GEO_OPTIONS_WATCH.enableHighAccuracy).toBe(true)
  })
})

describe('isGeolocationSecureContext', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('allows secure context', () => {
    vi.stubGlobal('window', { isSecureContext: true, location: { hostname: 'example.com' } })
    expect(isGeolocationSecureContext()).toBe(true)
  })

  it('allows localhost on insecure HTTP', () => {
    vi.stubGlobal('window', { isSecureContext: false, location: { hostname: 'localhost' } })
    expect(isGeolocationSecureContext()).toBe(true)
  })

  it('blocks plain HTTP on LAN IP', () => {
    vi.stubGlobal('window', { isSecureContext: false, location: { hostname: '192.168.1.10' } })
    expect(isGeolocationSecureContext()).toBe(false)
  })
})

describe('readCurrentPosition', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects when geolocation missing', async () => {
    vi.stubGlobal('navigator', {})
    await expect(readCurrentPosition(GEO_OPTIONS_QUICK)).rejects.toMatchObject({ code: 2 })
  })
})
