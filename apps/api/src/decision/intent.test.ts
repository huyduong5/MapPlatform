import { describe, expect, it } from 'vitest'
import { parseIntentRules } from './intent'
import { rankCandidates } from './rules'
import { buildExplanation } from './explain'
import type { CandidateLocation } from './types'

describe('parseIntentRules', () => {
  it('parses Times City + low battery charging query', () => {
    const q = 'Xe tôi gần Times City, pin còn 10%, tìm trạm sạc phù hợp nhất.'
    const intent = parseIntentRules(q)
    expect(intent.intent).toBe('find_charging')
    expect(intent.locationType).toBe('charging_station')
    expect(intent.batteryPercent).toBe(10)
    expect(intent.urgency).toBe('critical')
    expect(intent.landmark?.toLowerCase()).toContain('times city')
  })

  it('detects store intent', () => {
    const intent = parseIntentRules('Tìm cửa hàng VinFast gần Royal City')
    expect(intent.intent).toBe('find_store')
    expect(intent.locationType).toBe('store')
    expect(intent.landmark?.toLowerCase()).toContain('royal city')
  })

  it('detects showroom intent', () => {
    const intent = parseIntentRules('Tìm showroom gần Times City')
    expect(intent.intent).toBe('find_showroom')
    expect(intent.locationType).toBe('showroom')
  })

  it('detects parking and rescue intents', () => {
    expect(parseIntentRules('Tìm bãi đỗ xe gần Royal City').locationType).toBe('parking')
    expect(parseIntentRules('Cần cứu hộ gần Cầu Giấy').locationType).toBe('rescue_team')
    expect(parseIntentRules('Tìm đại lý gần Gia Lâm').locationType).toBe('dealer')
  })

  it('detects gas, university, hospital intents', () => {
    expect(parseIntentRules('Tìm cây xăng gần Times City').locationType).toBe('gas_station')
    expect(parseIntentRules('Tìm đại học gần Cầu Giấy').locationType).toBe('university')
    expect(parseIntentRules('Tìm bệnh viện gần Hoàn Kiếm').locationType).toBe('hospital')
  })
})

describe('rankCandidates', () => {
  it('ranks closer charging station higher when battery critical', () => {
    const intent = parseIntentRules('pin còn 8% tìm trạm sạc gần Times City')
    const candidates: CandidateLocation[] = [
      {
        id: 'far',
        name: 'Far Station',
        type: 'charging_station',
        address: null,
        latitude: 21,
        longitude: 105.9,
        status: 'active',
        phone: null,
        openingHours: null,
        source: 'osm',
        sourceUrl: null,
        distanceKm: 4.2,
      },
      {
        id: 'near',
        name: 'Near Station',
        type: 'charging_station',
        address: null,
        latitude: 21,
        longitude: 105.87,
        status: 'active',
        phone: null,
        openingHours: null,
        source: 'osm',
        sourceUrl: null,
        distanceKm: 0.8,
      },
    ]
    const ranked = rankCandidates(candidates, intent, 2)
    expect(ranked[0].id).toBe('near')
    expect(ranked[0].rank).toBe(1)
  })
})

describe('buildExplanation', () => {
  it('mentions top recommendation', () => {
    const intent = parseIntentRules('pin 10% trạm sạc Times City')
    const text = buildExplanation(
      intent,
      { latitude: 21, longitude: 105.86, label: 'Times City', source: 'landmark_alias' },
      [
        {
          id: '1',
          name: 'Station A',
          type: 'charging_station',
          address: null,
          latitude: 21,
          longitude: 105.87,
          status: 'active',
          phone: null,
          openingHours: null,
          source: null,
          sourceUrl: null,
          distanceKm: 0.5,
          rank: 1,
          score: 0.9,
          reasons: ['Cách điểm neo 0.50 km', 'Đúng loại trạm sạc'],
        },
      ],
    )
    expect(text).toContain('Station A')
    expect(text).toContain('Times City')
  })
})

describe('resolveLandmarkAlias city-scoped', () => {
  it('resolves HCM and Đà Nẵng landmarks', async () => {
    const { resolveLandmarkAlias } = await import('./geocode')
    const hcm = resolveLandmarkAlias('Landmark 81', 'hcm')
    expect(hcm?.label).toBe('Landmark 81')
    expect(hcm?.latitude).toBeCloseTo(10.7951, 2)
    const dn = resolveLandmarkAlias('cầu rồng', 'danang')
    expect(dn?.label).toBe('Cầu Rồng')
  })
})
