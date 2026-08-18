import { describe, expect, it } from 'vitest'
import {
  formatOsrmInstruction,
  geometryOverlapRatio,
  googleTravelMode,
  haversineProvider,
  isRoutingDegraded,
} from './routing'
import type { RouteGeometry } from './types'

describe('routing helpers', () => {
  it('detects high overlap for identical lines', () => {
    const g: RouteGeometry = {
      type: 'LineString',
      coordinates: [
        [105.85, 21.02],
        [105.86, 21.03],
        [105.87, 21.04],
      ],
    }
    expect(geometryOverlapRatio(g, g)).toBeGreaterThan(0.9)
  })

  it('detects low overlap for distant lines', () => {
    const a: RouteGeometry = {
      type: 'LineString',
      coordinates: [
        [105.85, 21.02],
        [105.86, 21.03],
      ],
    }
    const b: RouteGeometry = {
      type: 'LineString',
      coordinates: [
        [106.65, 10.77],
        [106.66, 10.78],
      ],
    }
    expect(geometryOverlapRatio(a, b)).toBeLessThan(0.2)
  })

  it('maps travel modes to Google deep-link modes', () => {
    expect(googleTravelMode('walk')).toBe('walking')
    expect(googleTravelMode('bike')).toBe('bicycling')
    expect(googleTravelMode('transit')).toBe('transit')
    expect(googleTravelMode('drive')).toBe('driving')
  })
})

describe('formatOsrmInstruction', () => {
  it('keeps existing English instruction when present', () => {
    expect(
      formatOsrmInstruction({
        instruction: 'Turn right onto Main St',
        name: 'Main St',
        type: 'turn',
        modifier: 'right',
      }),
    ).toBe('Turn right onto Main St')
  })

  it('builds Vietnamese turn text from maneuver + street', () => {
    expect(
      formatOsrmInstruction({
        name: 'Đường Cầu Giấy',
        type: 'turn',
        modifier: 'right',
      }),
    ).toBe('Rẽ phải vào Đường Cầu Giấy')
  })

  it('handles depart / arrive / continue uturn', () => {
    expect(formatOsrmInstruction({ name: 'Đường Xuân Thủy', type: 'depart' })).toBe(
      'Bắt đầu từ Đường Xuân Thủy',
    )
    expect(formatOsrmInstruction({ type: 'arrive' })).toBe('Đến nơi')
    expect(
      formatOsrmInstruction({ name: 'Kim Mã', type: 'continue', modifier: 'uturn' }),
    ).toBe('Quay đầu theo Kim Mã')
  })

  it('handles slight / sharp modifiers', () => {
    expect(
      formatOsrmInstruction({ name: 'Phố Huế', type: 'turn', modifier: 'slight left' }),
    ).toBe('Nhẹ Rẽ trái vào Phố Huế')
  })
})

describe('haversine degraded fallback', () => {
  it('marks crow-fly routes as degraded', async () => {
    const r = await haversineProvider.getRoute(
      { latitude: 21.0368, longitude: 105.7824 },
      { latitude: 21.0285, longitude: 105.8542 },
      'driving',
    )
    expect(r?.degraded).toBe(true)
    expect(r?.provider).toBe('haversine')
    expect(r?.geometry?.coordinates).toHaveLength(2)
    expect(isRoutingDegraded(r?.provider)).toBe(true)
  })
})
