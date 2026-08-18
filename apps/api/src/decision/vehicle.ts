import type {
  LocationTypeFilter,
  TravelMode,
  VehicleKind,
  VehicleProfile,
} from './types'

export const VEHICLE_KINDS: VehicleKind[] = ['ev_car', 'ev_moto', 'ice_car', 'ice_moto']

export const TRAVEL_MODES: TravelMode[] = ['drive', 'moto', 'walk', 'bike', 'transit']

export function isVehicleKind(v: unknown): v is VehicleKind {
  return typeof v === 'string' && (VEHICLE_KINDS as string[]).includes(v)
}

export function isTravelMode(v: unknown): v is TravelMode {
  return typeof v === 'string' && (TRAVEL_MODES as string[]).includes(v)
}

export function parseVehicleKind(v: unknown): VehicleKind | null {
  return isVehicleKind(v) ? v : null
}

export function parseTravelMode(v: unknown): TravelMode | null {
  return isTravelMode(v) ? v : null
}

export function isEv(kind: VehicleKind | null | undefined): boolean {
  return kind === 'ev_car' || kind === 'ev_moto'
}

export function isMoto(kind: VehicleKind | null | undefined): boolean {
  return kind === 'ev_moto' || kind === 'ice_moto'
}

/** Default POI type for this vehicle when query does not specify another intent. */
export function defaultLocationTypeForVehicle(kind: VehicleKind): LocationTypeFilter {
  if (isEv(kind)) return 'charging_station'
  return 'gas_station'
}

export function defaultIntentForVehicle(kind: VehicleKind): 'find_charging' | 'find_gas' {
  return isEv(kind) ? 'find_charging' : 'find_gas'
}

/**
 * Rough remaining range (km) from battery %.
 * Car EV has longer range than moto EV at same SOC.
 */
export function estimateReachableKm(
  kind: VehicleKind | null,
  batteryPercent: number | null | undefined,
): number | null {
  if (batteryPercent == null || !Number.isFinite(batteryPercent)) return null
  const pct = Math.max(0, Math.min(100, batteryPercent))
  const fullRange = kind === 'ev_moto' ? 80 : kind === 'ev_car' ? 350 : null
  if (fullRange == null) return null
  return Math.round((fullRange * pct) / 100)
}

/** OSRM profile: motorcycle when available; many public servers only support driving. */
export function routingProfileForVehicle(kind: VehicleKind | null): 'driving' | 'motorcycle' {
  return isMoto(kind) ? 'motorcycle' : 'driving'
}

export function travelModeFromVehicle(kind: VehicleKind | null): TravelMode {
  if (!kind) return 'drive'
  return isMoto(kind) ? 'moto' : 'drive'
}

/** Resolve travel mode from explicit request or vehicle kind. */
export function resolveTravelMode(
  explicit: TravelMode | null | undefined,
  vehicleKind: VehicleKind | null,
): TravelMode {
  if (explicit) return explicit
  return travelModeFromVehicle(vehicleKind)
}

export function travelModeNeedsVehicle(mode: TravelMode): boolean {
  return mode === 'drive' || mode === 'moto'
}

export function vehicleLabel(kind: VehicleKind): string {
  switch (kind) {
    case 'ev_car':
      return 'ô tô điện'
    case 'ev_moto':
      return 'xe máy điện'
    case 'ice_car':
      return 'ô tô xăng/dầu'
    case 'ice_moto':
      return 'xe máy xăng'
  }
}

export function travelModeLabel(mode: TravelMode): string {
  switch (mode) {
    case 'drive':
      return 'ô tô'
    case 'moto':
      return 'xe máy'
    case 'walk':
      return 'đi bộ'
    case 'bike':
      return 'xe đạp'
    case 'transit':
      return 'xe buýt / metro'
  }
}

export function normalizeVehicleProfile(
  body: VehicleProfile | undefined,
  batteryFromIntent: number | null,
  kindFromIntent: VehicleKind | null,
): VehicleProfile | null {
  const kind = parseVehicleKind(body?.kind) || kindFromIntent
  if (!kind) return null
  const battery =
    body?.batteryPercent != null && Number.isFinite(Number(body.batteryPercent))
      ? Number(body.batteryPercent)
      : batteryFromIntent
  return { kind, batteryPercent: battery }
}

/** Detect vehicle kind from Vietnamese NL when UI did not send one. */
export function detectVehicleKindFromQuery(query: string): VehicleKind | null {
  const f = query
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
  const hasEv =
    /\bev\b/.test(f) ||
    f.includes('dien') ||
    f.includes('pin') ||
    f.includes('tram sac') ||
    f.includes('sac pin')
  const hasMoto =
    f.includes('xe may') ||
    f.includes('xe máy') ||
    f.includes('moto') ||
    f.includes('motor') ||
    f.includes('scooter')
  const hasCar = f.includes('o to') || f.includes('oto') || f.includes('xe hoi') || f.includes('car')
  const hasGasHint =
    f.includes('xang') || f.includes('cay xang') || f.includes('petrol') || f.includes('fuel')

  if (hasMoto && (hasEv || (!hasGasHint && f.includes('pin')))) return 'ev_moto'
  if (hasMoto && hasGasHint) return 'ice_moto'
  if (hasMoto) return hasEv ? 'ev_moto' : 'ice_moto'
  if (hasCar && hasGasHint) return 'ice_car'
  if (hasCar && hasEv) return 'ev_car'
  if (hasEv && !hasGasHint) return 'ev_car'
  if (hasGasHint) return 'ice_car'
  return null
}

function foldVi(query: string): string {
  return query
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
}

export function detectTravelModeFromQuery(query: string): TravelMode | null {
  const f = foldVi(query)
  if (/\bdi\s*bo\b/.test(f) || f.includes('walk') || f.includes('bo bo')) {
    return 'walk'
  }
  if (/\bxe\s*dap\b/.test(f) || f.includes('bicycle') || /\bbike\b/.test(f) || f.includes('dap xe')) {
    return 'bike'
  }
  if (
    /\bxe\s*buyt\b/.test(f) ||
    f.includes('bus') ||
    f.includes('metro') ||
    f.includes('tau dien') ||
    f.includes('cong cong') ||
    f.includes('transit')
  ) {
    return 'transit'
  }
  return null
}

/** Corridor buffer (meters) by travel mode. */
export function corridorBufferM(mode: TravelMode): number {
  switch (mode) {
    case 'walk':
      return 120
    case 'bike':
      return 150
    case 'transit':
      return 200
    default:
      return 250
  }
}
