import { describe, expect, it } from 'vitest'
import { decodeGooglePolyline } from './transit'
import { buildRuleHook, isNightHours } from './hooks'
import { amenityTypesForPersona } from './corridor'

describe('transit polyline', () => {
  it('decodes a short google polyline', () => {
    // Encoded for roughly (38.5, -120.2)
    const coords = decodeGooglePolyline('_p~iF~ps|U')
    expect(coords.length).toBeGreaterThanOrEqual(1)
    expect(coords[0][0]).toBeCloseTo(-120.2, 0)
    expect(coords[0][1]).toBeCloseTo(38.5, 0)
  })
})

describe('hooks', () => {
  it('builds battery oasis hook for low SOC EV', () => {
    const hook = buildRuleHook({
      persona: 'smart',
      mode: 'drive',
      vehicleKind: 'ev_car',
      batteryPercent: 12,
      amenities: [
        {
          id: 'c1',
          name: 'Trạm sạc A',
          type: 'charging_station',
          latitude: 21,
          longitude: 105,
          distanceToRouteM: 40,
        },
      ],
    })
    expect(hook.kind).toBe('battery_oasis')
    expect(hook.amenityIds).toContain('c1')
  })

  it('exposes night hours helper', () => {
    expect(typeof isNightHours()).toBe('boolean')
  })
})

describe('corridor types', () => {
  it('returns walk smart amenity types', () => {
    const types = amenityTypesForPersona('walk', 'smart', null)
    expect(types).toContain('pharmacy')
    expect(types).toContain('atm')
  })
})
