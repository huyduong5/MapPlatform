import { describe, expect, it } from 'vitest'
import {
  detectTravelModeFromQuery,
  detectVehicleKindFromQuery,
  estimateReachableKm,
  defaultLocationTypeForVehicle,
  resolveTravelMode,
  travelModeNeedsVehicle,
} from './vehicle'

describe('vehicle helpers', () => {
  it('detects EV car from pin wording', () => {
    expect(detectVehicleKindFromQuery('pin còn 10%, tìm trạm sạc')).toBe('ev_car')
  })

  it('detects ice from gas wording', () => {
    expect(detectVehicleKindFromQuery('hết xăng tìm cây xăng')).toBe('ice_car')
  })

  it('estimates reachable range for EV car', () => {
    expect(estimateReachableKm('ev_car', 10)).toBe(35)
    expect(defaultLocationTypeForVehicle('ice_moto')).toBe('gas_station')
  })

  it('detects walk/bike/transit modes from query', () => {
    expect(detectTravelModeFromQuery('đi bộ tìm nhà thuốc')).toBe('walk')
    expect(detectTravelModeFromQuery('đạp xe tìm chỗ đậu')).toBe('bike')
    expect(detectTravelModeFromQuery('đi xe buýt tới bệnh viện')).toBe('transit')
  })

  it('resolves travel mode from vehicle when not explicit', () => {
    expect(resolveTravelMode(null, 'ev_moto')).toBe('moto')
    expect(resolveTravelMode('walk', 'ev_car')).toBe('walk')
    expect(travelModeNeedsVehicle('walk')).toBe(false)
    expect(travelModeNeedsVehicle('drive')).toBe(true)
  })
})
