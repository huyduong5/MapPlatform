import { describe, expect, it } from 'vitest'
import { parseIntentRules } from './intent'
import { detectTripPurpose, reconcileVehicleIntent } from './agents/context'
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
