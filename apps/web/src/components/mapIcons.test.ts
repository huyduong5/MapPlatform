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
]

describe('mapIcons', () => {
  it('defines a color for every location type', () => {
    for (const t of TYPES) {
      expect(TYPE_COLORS[t]).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })

  it('builds cached DivIcons with type glyph + recommended ring', () => {
    const a = makeTypeIcon('parking')
    const b = makeTypeIcon('parking')
    expect(a).toBe(b)

    const html = String(a.options.html)
    expect(html).toContain(TYPE_COLORS.parking)
    expect(html).toContain('<svg')
    expect(html).toContain('mp-marker')

    const rec = makeTypeIcon('rescue_team', { recommended: true })
    const recHtml = String(rec.options.html)
    expect(recHtml).toContain('mp-marker--rec')
    expect(recHtml).toContain('#c2410c')
    expect(rec).not.toBe(makeTypeIcon('rescue_team'))
  })

  it('builds a blue-dot user location icon', () => {
    const icon = makeUserLocationIcon()
    expect(String(icon.options.html)).toContain('mp-user-marker')
    expect(String(icon.options.html)).toContain('#2563eb')
    expect(makeUserLocationIcon()).toBe(icon)
  })
})

