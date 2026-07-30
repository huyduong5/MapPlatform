import { describe, expect, it } from 'vitest'
import {
  buildDisplayableNameFilter,
  isRealPoiName,
  isSyntheticOsmName,
} from '@/lib/poiName'

describe('poiName', () => {
  it('detects synthetic OSM names', () => {
    expect(isSyntheticOsmName('Trường OSM #4493605992')).toBe(true)
    expect(isSyntheticOsmName('Trường THCS Nguyễn Du')).toBe(false)
  })

  it('validates real POI names', () => {
    expect(isRealPoiName('Trường THCS Nguyễn Du')).toBe(true)
    expect(isRealPoiName('Trường OSM #1')).toBe(false)
    expect(isRealPoiName('ATM')).toBe(false)
    expect(isRealPoiName('A')).toBe(false)
  })

  it('builds SQL filter fragment', () => {
    expect(buildDisplayableNameFilter('l')).toContain('l.name')
    expect(buildDisplayableNameFilter('l')).toContain('OSM #')
  })
})
