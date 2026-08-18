import { describe, expect, it } from 'vitest'
import { parseIntentRules, extractLandmark } from './intent'
import { detectTripPurpose, reconcileVehicleIntent } from './agents/context'
import { lookupPlaceAlias } from './places/catalog'
import { resolveDestination } from './agents/destination'
import type { ParsedIntent } from './types'

describe('context-aware intent', () => {
  it('ICE + vi vu Hoan Kiem → leisure, not gas/charging', () => {
    const intent = parseIntentRules(
      'tôi muốn đi vi vu tại hồ Hoàn Kiếm Hà Nội thì bạn đề xuất cho tôi',
      { vehicleKind: 'ice_car' },
    )
    expect(intent.tripPurpose).toBe('leisure')
    expect(intent.intent).toBe('explore_area')
    expect(intent.locationType).toBeNull()
    expect(intent.landmark?.toLowerCase()).toContain('hoàn kiếm')
    expect(intent.destinationLandmark?.toLowerCase()).toContain('hoàn kiếm')
  })

  it('ICE + sắp hết xăng → need_urgent gas', () => {
    const intent = parseIntentRules('xe tôi sắp hết xăng đề xuất nơi đổ xăng gần nhất', {
      vehicleKind: 'ice_car',
    })
    expect(intent.tripPurpose).toBe('need_urgent')
    expect(intent.locationType).toBe('gas_station')
    expect(intent.intent).toBe('find_gas')
  })

  it('EV low battery → need_urgent charging', () => {
    const intent = parseIntentRules('pin còn 12% tìm trạm sạc gần nhất', {
      vehicleKind: 'ev_car',
    })
    expect(['need_urgent', 'need_normal']).toContain(intent.tripPurpose)
    expect(intent.locationType).toBe('charging_station')
  })

  it('reconcile blocks ICE charging even if LLM-like merge set it', () => {
    const bad: ParsedIntent = {
      intent: 'find_charging',
      locationType: 'charging_station',
      landmark: 'Hồ Hoàn Kiếm',
      batteryPercent: null,
      urgency: 'normal',
      rawQuery: 'vi vu hồ hoàn kiếm',
      source: 'llm',
      vehicleKind: 'ice_car',
      destinationLandmark: 'Hồ Hoàn Kiếm',
      tripPurpose: 'leisure',
    }
    const fixed = reconcileVehicleIntent(bad)
    expect(fixed.locationType).not.toBe('charging_station')
    expect(fixed.intent).toBe('explore_area')
  })

  it('detectTripPurpose leisure from keywords', () => {
    expect(
      detectTripPurpose('đi chơi quanh hồ hoàn kiếm', {
        intent: 'unknown',
        batteryPercent: null,
        vehicleKind: 'ice_car',
        hasDestinationHint: true,
      }),
    ).toBe('leisure')
  })
})

describe('map place intelligence', () => {
  it('đi Vincom → navigate, extracts Vincom, not gas', () => {
    const intent = parseIntentRules('tôi muốn đi trung tâm thương mại Vincom', {
      vehicleKind: 'ice_car',
    })
    expect(intent.tripPurpose).toBe('navigate')
    expect(intent.intent).toBe('navigate_to')
    expect(intent.locationType).toBeNull()
    expect(intent.landmark?.toLowerCase()).toContain('vincom')
  })

  it('đến Đại học Khoa học Tự nhiên → navigate to HUS alias', () => {
    const intent = parseIntentRules('đến Đại học Khoa học Tự nhiên', {
      vehicleKind: 'ice_car',
    })
    expect(intent.tripPurpose).toBe('navigate')
    expect(intent.landmark?.toLowerCase()).toMatch(/khoa học tự nhiên|hus/)
    const alias = lookupPlaceAlias(intent.landmark)
    expect(alias?.label).toContain('Khoa học Tự nhiên')
  })

  it('đi ĐHQGHN / VNU → navigate to VNU', () => {
    const a = parseIntentRules('chỉ đường đến ĐHQGHN', { vehicleKind: 'ice_car' })
    expect(a.tripPurpose).toBe('navigate')
    expect(a.landmark?.toLowerCase()).toMatch(/quốc gia|vnu|đhqg/)
    const b = parseIntentRules('đi VNU', { vehicleKind: 'ice_car' })
    expect(b.tripPurpose).toBe('navigate')
    expect(lookupPlaceAlias(b.landmark)?.label).toContain('Quốc gia')
  })

  it('bare vincom alias does not snap to Times City', () => {
    expect(lookupPlaceAlias('vincom')).toBeNull()
    expect(lookupPlaceAlias('vincom nguyễn chí thanh')?.label).toMatch(/Nguyễn Chí Thanh/i)
    expect(lookupPlaceAlias('vincom times city')?.label).toMatch(/Times City/i)
  })

  it('extractLandmark handles đi tới', () => {
    expect(extractLandmark('đi tới Vincom')?.toLowerCase()).toContain('vincom')
    expect(extractLandmark('toi muon di Vincom')?.toLowerCase()).toBe('vincom')
  })

  it('resolveDestination uses alias for HUS', async () => {
    const dest = await resolveDestination({
      destinationName: 'Trường Đại học Khoa học Tự nhiên',
      city: 'hanoi',
    })
    expect(dest?.source).toBe('landmark_alias')
    expect(dest?.label).toContain('Khoa học Tự nhiên')
    expect(dest?.latitude).toBeCloseTo(20.9959, 2)
  })
})
