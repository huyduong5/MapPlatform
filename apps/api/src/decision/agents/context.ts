import type {
  IntentType,
  LocationTypeFilter,
  ParsedIntent,
  TripPurpose,
  VehicleKind,
} from '../types'
import {
  defaultIntentForVehicle,
  defaultLocationTypeForVehicle,
  isEv,
} from '../vehicle'

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
}

function includesAnyFold(q: string, words: string[]): boolean {
  const f = fold(q)
  return words.some((w) => f.includes(fold(w)))
}

const LEISURE_WORDS = [
  'vi vu',
  'vui choi',
  'vui vẻ',
  'dao choi',
  'dao pho',
  'tham quan',
  'check-in',
  'check in',
  'lang man',
  'picnic',
  'ngam canh',
  'du lich',
  'kham pha',
  'di choi',
  'di dao',
  'sightseeing',
  'tour',
  'leisure',
]

const URGENT_GAS_WORDS = [
  'het xang',
  'sap het xang',
  'can xang',
  'do xang',
  'het nhien lieu',
  'out of gas',
  'low fuel',
]

const URGENT_RESCUE_WORDS = ['cuu ho', 'hong xe', 'chet may', 'keo xe']

const NAVIGATE_WORDS = [
  'chi duong',
  'dan duong',
  'huong di',
  'toi ',
  'den ',
  'di ',
  'di den',
  'di toi',
  'muon den',
  'muon di',
  'toi den',
]

/**
 * Detect trip purpose from Vietnamese query + vehicle/battery context.
 * Vehicle must NOT flip leisure → fuel.
 */
export function detectTripPurpose(
  query: string,
  opts: {
    intent: IntentType
    batteryPercent: number | null
    vehicleKind: VehicleKind | null
    hasDestinationHint: boolean
  },
): TripPurpose {
  const f = fold(query)

  if (includesAnyFold(query, LEISURE_WORDS)) return 'leisure'
  if (opts.intent === 'explore_area' || opts.intent === 'joyride') return 'leisure'

  const urgentGas = includesAnyFold(query, URGENT_GAS_WORDS)
  const urgentRescue = includesAnyFold(query, URGENT_RESCUE_WORDS)
  const lowBattery =
    opts.batteryPercent != null &&
    opts.batteryPercent <= 30 &&
    (isEv(opts.vehicleKind) || includesAnyFold(query, ['pin', 'sac', 'charging']))

  if (urgentRescue || opts.intent === 'find_rescue') return 'need_urgent'
  if (urgentGas && !isEv(opts.vehicleKind)) return 'need_urgent'
  if (lowBattery && isEv(opts.vehicleKind)) return 'need_urgent'
  if (opts.intent === 'find_charging' && opts.batteryPercent != null && opts.batteryPercent <= 15) {
    return 'need_urgent'
  }
  if (opts.intent === 'find_gas' && urgentGas) return 'need_urgent'

  // Named place (Vincom, ĐH KHTN, …) → navigate even if intent was find_university
  if (
    opts.hasDestinationHint &&
    !urgentGas &&
    !urgentRescue &&
    (opts.intent === 'navigate_to' ||
      opts.intent === 'find_university' ||
      opts.intent === 'unknown' ||
      opts.intent === 'find_nearby' ||
      includesAnyFold(query, NAVIGATE_WORDS))
  ) {
    return 'navigate'
  }

  if (
    opts.intent === 'navigate_to' ||
    (opts.hasDestinationHint &&
      includesAnyFold(query, NAVIGATE_WORDS) &&
      !includesAnyFold(query, LEISURE_WORDS))
  ) {
    return 'navigate'
  }

  if (
    opts.intent === 'find_charging' ||
    opts.intent === 'find_gas' ||
    opts.intent === 'find_parking' ||
    opts.intent === 'find_hospital' ||
    opts.intent === 'find_store' ||
    opts.intent === 'find_university' ||
    opts.intent === 'find_showroom' ||
    opts.intent === 'find_service' ||
    opts.intent === 'find_dealer'
  ) {
    return 'need_normal'
  }

  if (opts.hasDestinationHint && opts.intent === 'unknown') return 'leisure'

  void f
  return 'need_normal'
}

/** Hard rules: ICE never charging; EV low-battery never gas; leisure never fuel type. */
export function reconcileVehicleIntent(intent: ParsedIntent): ParsedIntent {
  const next = { ...intent }
  const purpose = next.tripPurpose

  if (purpose === 'leisure' || purpose === 'navigate') {
    if (
      next.intent === 'find_charging' ||
      next.intent === 'find_gas' ||
      next.locationType === 'charging_station' ||
      next.locationType === 'gas_station'
    ) {
      next.intent = purpose === 'navigate' ? 'navigate_to' : 'explore_area'
      next.locationType = null
    }
    return next
  }

  if (next.vehicleKind && !isEv(next.vehicleKind)) {
    if (next.intent === 'find_charging' || next.locationType === 'charging_station') {
      next.intent = 'find_gas'
      next.locationType = 'gas_station'
    }
  }

  if (next.vehicleKind && isEv(next.vehicleKind)) {
    if (
      next.batteryPercent != null &&
      next.intent === 'find_gas' &&
      !includesAnyFold(next.rawQuery, URGENT_GAS_WORDS)
    ) {
      next.intent = 'find_charging'
      next.locationType = 'charging_station'
    }
  }

  return next
}

export function applyVehicleDefaultOnlyForNeed(
  intent: IntentType,
  locationType: LocationTypeFilter,
  vehicleKind: VehicleKind | null,
  tripPurpose: TripPurpose,
): { intent: IntentType; locationType: LocationTypeFilter } {
  if (tripPurpose === 'leisure' || tripPurpose === 'navigate') {
    return { intent, locationType }
  }
  if (vehicleKind && (intent === 'unknown' || intent === 'find_nearby')) {
    return {
      intent: defaultIntentForVehicle(vehicleKind),
      locationType: defaultLocationTypeForVehicle(vehicleKind),
    }
  }
  return { intent, locationType }
}

export function isLeisureIntent(intent: IntentType): boolean {
  return intent === 'explore_area' || intent === 'joyride'
}

export function detectLeisureIntent(query: string): boolean {
  return includesAnyFold(query, LEISURE_WORDS)
}
