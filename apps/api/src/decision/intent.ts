import type { IntentType, LocationTypeFilter, ParsedIntent, VehicleKind } from './types'
import {
  applyVehicleDefaultOnlyForNeed,
  detectLeisureIntent,
  detectTripPurpose,
  reconcileVehicleIntent,
} from './agents/context'
import { LANDMARK_ALIASES, matchAliasInQuery } from './places/catalog'
import { detectVehicleKindFromQuery, isEv, parseVehicleKind } from './vehicle'

function norm(s: string): string {
  return s.normalize('NFC').toLowerCase()
}

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
}

function includesAny(q: string, words: string[]): boolean {
  const n = norm(q)
  const f = fold(q)
  return words.some((w) => n.includes(norm(w)) || f.includes(fold(w)))
}

const BATTERY_RE =
  /(?:pin|battery|soc)\s*(?:còn|con|còn lại|con lai|=|:)?\s*(\d{1,3})\s*%?|\b(\d{1,3})\s*%\s*(?:pin|battery)?/i

/** @deprecated Prefer places/catalog — re-exported for tests / older imports. */
export { LANDMARK_ALIASES }

const LANDMARK_HINT_RE =
  /(?:(?:tôi|toi|mình|minh|em|anh|chị|chi)\s+)?(?:muốn|muon|cần|can)\s+(?:đi|di|tới|toi|đến|den|về|ve)\s+(?:tới|toi|đến|den|về|ve|lại|lai)?\s*([A-Za-zÀ-ỹ0-9][A-Za-zÀ-ỹ0-9\s.'-]{1,60}?)(?=[,.]|\s+pin\b|\s+tìm\b|\s+tim\b|\s+thì\b|\s+thi\b|\s+để\b|\s+de\b|\s+với\b|\s+voi\b|$)/i

const GO_TO_RE =
  /(?:đi|di)\s+(?:tới|toi|đến|den)?\s*([A-Za-zÀ-ỹ0-9][A-Za-zÀ-ỹ0-9\s.'-]{1,60}?)(?=[,.]|\s+pin\b|\s+thì\b|\s+thi\b|$)/i

const GO_TO_DEN_RE =
  /(?:(?:^|\s)(?:đến|den|về|ve)\s+|chỉ\s*đường\s+(?:đến|den|tới|toi)\s+|chi\s*duong\s+(?:den|toi)\s+)([A-Za-zÀ-ỹ0-9][A-Za-zÀ-ỹ0-9\s.'-]{1,60}?)(?=[,.]|\s+pin\b|\s+thì\b|\s+thi\b|$)/i

function extractBattery(query: string): number | null {
  const m = query.match(BATTERY_RE)
  if (!m) return null
  const n = Number(m[1] || m[2])
  if (!Number.isFinite(n) || n < 0 || n > 100) return null
  return n
}

function cleanLandmarkRaw(raw: string): string | null {
  let t = raw.trim().replace(/\s+/g, ' ')
  t = t
    .replace(
      /\b(hà nội|ha noi|vn|việt nam|viet nam|trung tâm thương mại|trung tam thuong mai|tttm|mall)\b/gi,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim()
  if (t.length < 2) return null
  return t
}

export function extractLandmark(query: string): string | null {
  const aliasHit = matchAliasInQuery(query, 'hanoi')
  if (aliasHit) return aliasHit.label

  for (const re of [GO_TO_RE, GO_TO_DEN_RE, LANDMARK_HINT_RE]) {
    const m = query.match(re)
    if (m?.[1]) {
      const cleaned = cleanLandmarkRaw(m[1])
      if (cleaned) return cleaned
    }
  }
  return null
}

function urgencyFromBattery(battery: number | null): ParsedIntent['urgency'] {
  if (battery == null) return 'normal'
  if (battery <= 15) return 'critical'
  if (battery <= 30) return 'high'
  return 'normal'
}

function hasUrgentNeed(query: string): boolean {
  return includesAny(query, [
    'hết xăng',
    'het xang',
    'sắp hết xăng',
    'sap het xang',
    'cứu hộ',
    'cuu ho',
    'hỏng xe',
    'hong xe',
    'hết pin',
    'het pin',
    'pin yếu',
    'pin yeu',
  ])
}

function detectIntent(query: string, battery: number | null): {
  intent: IntentType
  locationType: LocationTypeFilter
} {
  if (detectLeisureIntent(query)) {
    return { intent: 'explore_area', locationType: null }
  }

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
    'hết xăng',
    'het xang',
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
  const hasNavigate = includesAny(query, [
    'chỉ đường',
    'chi duong',
    'dẫn đường',
    'dan duong',
    'hướng đi',
    'huong di',
  ])

  if (hasRescue) return { intent: 'find_rescue', locationType: 'rescue_team' }
  if (hasHospital && hasNearby) return { intent: 'find_hospital', locationType: 'hospital' }
  if (hasGas) return { intent: 'find_gas', locationType: 'gas_station' }
  if (hasUniversity && hasNearby) return { intent: 'find_university', locationType: 'university' }
  if (hasParking && hasNearby) return { intent: 'find_parking', locationType: 'parking' }
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
  if (hasNavigate) return { intent: 'navigate_to', locationType: null }
  if (hasUniversity) return { intent: 'find_university', locationType: 'university' }
  if (hasHospital) return { intent: 'find_hospital', locationType: 'hospital' }
  if (hasParking) return { intent: 'find_parking', locationType: 'parking' }
  if (hasNearby) return { intent: 'find_nearby', locationType: null }
  return { intent: 'unknown', locationType: null }
}

export function parseIntentRules(
  query: string,
  opts?: { vehicleKind?: VehicleKind | null },
): ParsedIntent {
  const rawQuery = query.trim()
  const batteryPercent = extractBattery(rawQuery)
  const landmark = extractLandmark(rawQuery)
  const vehicleKind =
    parseVehicleKind(opts?.vehicleKind) || detectVehicleKindFromQuery(rawQuery)
  let { intent, locationType } = detectIntent(rawQuery, batteryPercent)

  if (
    landmark &&
    !hasUrgentNeed(rawQuery) &&
    intent !== 'explore_area' &&
    !detectLeisureIntent(rawQuery)
  ) {
    const goToPlace = includesAny(rawQuery, [
      'đi ',
      'di ',
      'đi tới',
      'đi đến',
      'tới ',
      'đến ',
      'den ',
      'chỉ đường',
      'chi duong',
      'dẫn đường',
      'dan duong',
      'muốn đi',
      'muon di',
      'muốn đến',
      'muon den',
    ])
    const findNearLandmark = includesAny(rawQuery, [
      'tìm',
      'tim ',
      'tìm kiếm',
      'gần nhất',
      'gan nhat',
      'gần đây',
      'near me',
    ])
    if (goToPlace && !findNearLandmark) {
      intent = 'navigate_to'
      locationType = null
    } else if (
      goToPlace &&
      (intent === 'find_university' || intent === 'unknown' || intent === 'find_nearby')
    ) {
      intent = 'navigate_to'
      locationType = null
    }
  }

  const preliminaryPurpose = detectTripPurpose(rawQuery, {
    intent,
    batteryPercent,
    vehicleKind,
    hasDestinationHint: Boolean(landmark),
  })

  const applied = applyVehicleDefaultOnlyForNeed(
    intent,
    locationType,
    vehicleKind,
    preliminaryPurpose,
  )
  intent = applied.intent
  locationType = applied.locationType

  if (
    preliminaryPurpose !== 'leisure' &&
    preliminaryPurpose !== 'navigate' &&
    vehicleKind &&
    isEv(vehicleKind) &&
    batteryPercent != null &&
    intent === 'find_gas'
  ) {
    intent = 'find_charging'
    locationType = 'charging_station'
  }
  if (
    preliminaryPurpose !== 'leisure' &&
    preliminaryPurpose !== 'navigate' &&
    vehicleKind &&
    !isEv(vehicleKind) &&
    intent === 'find_charging'
  ) {
    intent = 'find_gas'
    locationType = 'gas_station'
  }

  const tripPurpose = detectTripPurpose(rawQuery, {
    intent,
    batteryPercent,
    vehicleKind,
    hasDestinationHint: Boolean(landmark),
  })

  const parsed: ParsedIntent = {
    intent,
    locationType,
    landmark,
    batteryPercent,
    urgency:
      tripPurpose === 'need_urgent'
        ? batteryPercent != null
          ? urgencyFromBattery(batteryPercent)
          : 'high'
        : urgencyFromBattery(batteryPercent),
    rawQuery,
    source: 'rules',
    vehicleKind,
    destinationLandmark: landmark,
    tripPurpose,
  }

  return reconcileVehicleIntent(parsed)
}

export function mergeIntent(base: ParsedIntent, override: Partial<ParsedIntent>): ParsedIntent {
  const merged = { ...base, ...override, rawQuery: base.rawQuery }
  merged.urgency = urgencyFromBattery(merged.batteryPercent)
  if (!merged.tripPurpose) {
    merged.tripPurpose = detectTripPurpose(merged.rawQuery, {
      intent: merged.intent,
      batteryPercent: merged.batteryPercent,
      vehicleKind: merged.vehicleKind,
      hasDestinationHint: Boolean(merged.landmark || merged.destinationLandmark),
    })
  }
  return reconcileVehicleIntent(merged)
}

export { reconcileVehicleIntent, detectTripPurpose }
