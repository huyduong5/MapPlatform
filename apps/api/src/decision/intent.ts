import type { IntentType, LocationTypeFilter, ParsedIntent } from './types'

function norm(s: string): string {
  return s.normalize('NFC').toLowerCase()
}

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

function includesAny(q: string, words: string[]): boolean {
  const n = norm(q)
  const f = fold(q)
  return words.some((w) => n.includes(norm(w)) || f.includes(fold(w)))
}

const BATTERY_RE =
  /(?:pin|battery|soc)\s*(?:còn|con|còn lại|con lai|=|:)?\s*(\d{1,3})\s*%?|\b(\d{1,3})\s*%\s*(?:pin|battery)?/i

/** Known landmarks in Hà Nội — offline alias before Photon. */
export const LANDMARK_ALIASES: Record<string, { lat: number; lng: number; label: string }> = {
  'times city': { lat: 20.995, lng: 105.8682, label: 'Times City' },
  'vincom times city': { lat: 20.995, lng: 105.8682, label: 'Times City' },
  'aeon mall long biên': { lat: 21.0278, lng: 105.8995, label: 'AEON Mall Long Biên' },
  'aeon mall long bien': { lat: 21.0278, lng: 105.8995, label: 'AEON Mall Long Biên' },
  'hoàn kiếm': { lat: 21.0285, lng: 105.8542, label: 'Hồ Hoàn Kiếm' },
  'hoan kiem': { lat: 21.0285, lng: 105.8542, label: 'Hồ Hoàn Kiếm' },
  'hồ hoàn kiếm': { lat: 21.0285, lng: 105.8542, label: 'Hồ Hoàn Kiếm' },
  'big c thắng lợi': { lat: 21.0025, lng: 105.815, label: 'Big C Thăng Lợi' },
  'royal city': { lat: 21.0028, lng: 105.8155, label: 'Royal City' },
  'lăng bác': { lat: 21.0368, lng: 105.8347, label: 'Lăng Chủ tịch Hồ Chí Minh' },
  'ga hà nội': { lat: 21.0245, lng: 105.8412, label: 'Ga Hà Nội' },
  'ga ha noi': { lat: 21.0245, lng: 105.8412, label: 'Ga Hà Nội' },
  'sân bay nội bài': { lat: 21.2187, lng: 105.8042, label: 'Sân bay Nội Bài' },
  'noi bai': { lat: 21.2187, lng: 105.8042, label: 'Sân bay Nội Bài' },
  'cầu giấy': { lat: 21.0305, lng: 105.782, label: 'Cầu Giấy' },
  'cau giay': { lat: 21.0305, lng: 105.782, label: 'Cầu Giấy' },
  'gia lâm': { lat: 21.0095, lng: 105.9382, label: 'Gia Lâm' },
  'gia lam': { lat: 21.0095, lng: 105.9382, label: 'Gia Lâm' },
}

const LANDMARK_HINT_RE =
  /(?:gần|gan|ở|o|tại|tai|near|around)\s+([A-Za-zÀ-ỹ0-9][A-Za-zÀ-ỹ0-9\s.'-]{1,40}?)(?=[,.]|\s+pin\b|\s+tìm\b|\s+tim\b|$)/i

function extractBattery(query: string): number | null {
  const m = query.match(BATTERY_RE)
  if (!m) return null
  const n = Number(m[1] || m[2])
  if (!Number.isFinite(n) || n < 0 || n > 100) return null
  return n
}

function extractLandmark(query: string): string | null {
  const lower = norm(query)
  for (const key of Object.keys(LANDMARK_ALIASES)) {
    if (lower.includes(norm(key))) return LANDMARK_ALIASES[key].label
  }
  const m = query.match(LANDMARK_HINT_RE)
  if (!m?.[1]) return null
  const raw = m[1].trim().replace(/\s+/g, ' ')
  if (raw.length < 2) return null
  return raw.replace(/\b(hà nội|ha noi|vn|việt nam)\b/gi, '').trim() || null
}

function urgencyFromBattery(battery: number | null): ParsedIntent['urgency'] {
  if (battery == null) return 'normal'
  if (battery <= 15) return 'critical'
  if (battery <= 30) return 'high'
  return 'normal'
}

function detectIntent(query: string, battery: number | null): {
  intent: IntentType
  locationType: LocationTypeFilter
} {
  const hasCharging = includesAny(query, [
    'trạm sạc',
    'tram sac',
    'sạc pin',
    'sac pin',
    'charging',
    'charger',
    'pin yếu',
    'hết pin',
  ])
  const hasStore = includesAny(query, ['cửa hàng', 'cua hang', 'store', 'mua xe'])
  const hasShowroom = includesAny(query, ['showroom', 'phòng trưng bày', 'phong trung bay'])
  const hasService = includesAny(query, [
    'xưởng dịch vụ',
    'xuong dich vu',
    'service center',
    'bảo hành',
    'bao hanh',
    'sửa chữa',
    'sua chua',
  ])
  const hasDealer = includesAny(query, ['đại lý', 'dai ly', 'dealer', 'agency'])
  const hasParking = includesAny(query, [
    'đỗ xe',
    'do xe',
    'bãi đỗ',
    'bai do',
    'parking',
    'chỗ đậu',
    'cho dau',
  ])
  const hasRescue = includesAny(query, [
    'cứu hộ',
    'cuu ho',
    'rescue',
    'kéo xe',
    'keo xe',
    'hỏng xe',
    'hong xe',
  ])
  const hasGas = includesAny(query, [
    'cây xăng',
    'cay xang',
    'trạm xăng',
    'tram xang',
    'xăng dầu',
    'xang dau',
    'gas station',
    'petrol',
    'fuel',
  ])
  const hasUniversity = includesAny(query, [
    'đại học',
    'dai hoc',
    'trường đại học',
    'truong dai hoc',
    'học viện',
    'hoc vien',
    'university',
    'campus',
  ])
  const hasHospital = includesAny(query, [
    'bệnh viện',
    'benh vien',
    'hospital',
    'cấp cứu',
    'cap cuu',
    'y tế',
    'y te',
  ])
  const hasNearby = includesAny(query, [
    'gần đây',
    'gần tôi',
    'gần nhất',
    'gan day',
    'gan toi',
    'near me',
    'xung quanh',
  ])

  if (hasRescue) return { intent: 'find_rescue', locationType: 'rescue_team' }
  if (hasHospital) return { intent: 'find_hospital', locationType: 'hospital' }
  if (hasGas) return { intent: 'find_gas', locationType: 'gas_station' }
  if (hasUniversity) return { intent: 'find_university', locationType: 'university' }
  if (hasParking) return { intent: 'find_parking', locationType: 'parking' }
  if (hasDealer) return { intent: 'find_dealer', locationType: 'dealer' }
  if (hasCharging && !hasStore && !hasShowroom && !hasService) {
    return { intent: 'find_charging', locationType: 'charging_station' }
  }
  if (hasShowroom) return { intent: 'find_showroom', locationType: 'showroom' }
  if (hasService) return { intent: 'find_service', locationType: 'service_center' }
  if (hasStore && !hasCharging) return { intent: 'find_store', locationType: 'store' }
  if (battery != null && battery <= 40) {
    return { intent: 'find_charging', locationType: 'charging_station' }
  }
  if (hasNearby) return { intent: 'find_nearby', locationType: null }
  if (includesAny(query, ['phù hợp', 'phu hop', 'recommend', 'gợi ý', 'goi y'])) {
    return { intent: 'find_charging', locationType: 'charging_station' }
  }
  return { intent: 'unknown', locationType: null }
}

export function parseIntentRules(query: string): ParsedIntent {
  const rawQuery = query.trim()
  const batteryPercent = extractBattery(rawQuery)
  const landmark = extractLandmark(rawQuery)
  const { intent, locationType } = detectIntent(rawQuery, batteryPercent)
  return {
    intent,
    locationType,
    landmark,
    batteryPercent,
    urgency: urgencyFromBattery(batteryPercent),
    rawQuery,
    source: 'rules',
  }
}

export function mergeIntent(base: ParsedIntent, override: Partial<ParsedIntent>): ParsedIntent {
  const merged = { ...base, ...override, rawQuery: base.rawQuery }
  merged.urgency = urgencyFromBattery(merged.batteryPercent)
  return merged
}
