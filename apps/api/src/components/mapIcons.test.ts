/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest'
import { TYPE_COLORS, makeTypeIcon, makeUserLocationIcon } from './mapIcons'
import type { LocationType } from '@/types/location'

const TYPES: LocationType[] = [
  'charging_station',
  'store',
  'showroom',
  'service_center',
  'dealer',
  'parking',
  'rescue_team',
  'gas_station',
  'university',
  'hospital',
  'pharmacy',
  'atm',
  'bank',
  'police',
  'fire_station',
  'school',
  'marketplace',
  'bus_stop',
  'subway_station',
  'park',
  'tourist_attraction',
]

describe('mapIcons', () => {
  it('defines a color for every location type', () => {
    for (const t of TYPES) {
      expect(TYPE_COLORS[t]).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })

  it('builds cached DivIcons with pin glyph + recommended ring', () => {
    const a = makeTypeIcon('parking')
    const b = makeTypeIcon('parking')
    expect(a).toBe(b)

    const html = String(a.options.html)
    expect(html).toContain(TYPE_COLORS.parking)
    expect(html).toContain('<svg')
    expect(html).toContain('mp-marker')
    expect(html).toContain('mp-marker--type-parking')
    expect(a.options.iconAnchor?.[1]).toBeGreaterThan((a.options.iconSize as number[])[1] / 2)

    const rec = makeTypeIcon('rescue_team', { recommended: true })
    const recHtml = String(rec.options.html)
    expect(recHtml).toContain('mp-marker--rec')
    expect(recHtml).toContain('#c2410c')
    expect(rec).not.toBe(makeTypeIcon('rescue_team'))
  })

  it('uses a distinct cache entry and classes for selected state', () => {
    const idle = makeTypeIcon('charging_station')
    const selected = makeTypeIcon('charging_station', { selected: true })
    expect(selected).not.toBe(idle)

    const html = String(selected.options.html)
    expect(html).toContain('mp-marker--selected')
    expect(html).toContain('mp-marker-ripple')
    expect(html).toContain('bolt')
    expect(html).toContain('mp-marker--type-charging_station')
    expect((selected.options.iconSize as number[])[0]).toBe(40)
    expect((idle.options.iconSize as number[])[0]).toBe(32)

    // selected wins over recommendation pulse class
    const both = makeTypeIcon('charging_station', { recommended: true, selected: true })
    const bothHtml = String(both.options.html)
    expect(bothHtml).toContain('mp-marker--selected')
    expect(bothHtml).not.toContain('mp-marker--rec')
  })

  it('builds a blue-dot user location icon', () => {
    const icon = makeUserLocationIcon()
    expect(String(icon.options.html)).toContain('mp-user-marker')
    expect(String(icon.options.html)).toContain('#2563eb')
    expect(makeUserLocationIcon()).toBe(icon)
  })
})
