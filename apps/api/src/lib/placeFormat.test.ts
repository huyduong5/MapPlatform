import { describe, expect, it } from 'vitest'
import {
  filterDisplayableLocations,
  isRealPoiName,
  isSyntheticOsmName,
  isThinAddress,
  parseOpeningHours,
  starsLabel,
} from '@/lib/placeFormat'

describe('placeFormat', () => {
  it('detects thin city-only addresses', () => {
    expect(isThinAddress('Hà Nội, Việt Nam')).toBe(true)
    expect(isThinAddress('Hà Nội')).toBe(true)
    expect(
      isThinAddress(
        '227 Nguyễn Văn Cừ, Quận 5, Hồ Chí Minh, Việt Nam',
      ),
    ).toBe(false)
  })

  it('parses Mo-Fr hours for a weekday', () => {
    // Wednesday 2026-07-29 10:00 local — use fixed Date
    const wed = new Date('2026-07-29T10:00:00')
    const r = parseOpeningHours('Mo-Fr 08:00-17:00', wed)
    expect(r.openNow).toBe(true)
    expect(r.todayLabel).toContain('Đang mở')
  })

  it('handles 24/7', () => {
    const r = parseOpeningHours('24/7')
    expect(r.openNow).toBe(true)
    expect(r.todayLabel).toContain('24/7')
  })

  it('formats stars', () => {
    expect(starsLabel(4.5, 19)).toContain('4.5')
    expect(starsLabel(4.5, 19)).toContain('(19)')
  })

  it('filters synthetic OSM placeholder names', () => {
    expect(isSyntheticOsmName('Trường OSM #4493605992')).toBe(true)
    expect(isRealPoiName('Trường OSM #4493605992')).toBe(false)
    expect(isRealPoiName('Trường THCS Nguyễn Du')).toBe(true)
    const out = filterDisplayableLocations([
      { id: '1', name: 'Trường OSM #1' },
      { id: '2', name: 'VinFast Store' },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].name).toBe('VinFast Store')
  })
})
