import type {
  CandidateLocation,
  ParsedIntent,
  RankedRecommendation,
  RouteGeometry,
} from './types'
import { estimateReachableKm, isEv, isMoto } from './vehicle'

export function radiusForIntent(intent: ParsedIntent): number {
  const moto = isMoto(intent.vehicleKind)
  if (intent.urgency === 'critical') return moto ? 2000 : 3000
  if (intent.urgency === 'high') return moto ? 4000 : 5000
  if (intent.intent === 'find_store') return 8000
  return moto ? 5000 : 6000
}

function distanceScore(distanceKm: number, urgency: ParsedIntent['urgency']): number {
  const soft = urgency === 'critical' ? 1.5 : urgency === 'high' ? 2.5 : 4
  return Math.max(0, 1 - distanceKm / soft)
}

function typeScore(loc: CandidateLocation, intent: ParsedIntent): number {
  if (!intent.locationType) return 0.7
  return loc.type === intent.locationType ? 1 : 0.1
}

function batteryBoost(intent: ParsedIntent, distanceKm: number): number {
  if (!isEv(intent.vehicleKind)) return 0.5
  if (intent.batteryPercent == null) return 0.5
  if (intent.urgency === 'critical') return distanceKm <= 1.5 ? 1 : distanceKm <= 3 ? 0.7 : 0.3
  if (intent.urgency === 'high') return distanceKm <= 3 ? 0.9 : 0.5
  return 0.6
}

function reachabilityScore(
  intent: ParsedIntent,
  distanceKm: number,
): { score: number; reachable: boolean | null } {
  if (!isEv(intent.vehicleKind)) return { score: 0.5, reachable: null }
  const reach = estimateReachableKm(intent.vehicleKind, intent.batteryPercent)
  if (reach == null) return { score: 0.5, reachable: null }
  const margin = reach * 0.7
  if (distanceKm <= margin) return { score: 1, reachable: true }
  if (distanceKm <= reach) return { score: 0.4, reachable: true }
  return { score: 0.05, reachable: false }
}

export function scoreCandidate(
  loc: CandidateLocation,
  intent: ParsedIntent,
  opts?: {
    roadDistanceKm?: number | null
    etaMinutes?: number | null
    route?: RouteGeometry | null
    directionsUrl?: string | null
  },
): RankedRecommendation {
  const distKm = opts?.roadDistanceKm ?? loc.distanceKm
  const d = distanceScore(distKm, intent.urgency)
  const t = typeScore(loc, intent)
  const b = batteryBoost(intent, distKm)
  const r = reachabilityScore(intent, distKm)
  const etaScore =
    opts?.etaMinutes != null
      ? Math.max(0, 1 - opts.etaMinutes / (intent.urgency === 'critical' ? 12 : 25))
      : 0.5

  // Prefer road metrics when present
  const score = Number(
    (
      0.35 * d +
      0.2 * etaScore +
      0.2 * t +
      0.15 * b +
      0.1 * r.score
    ).toFixed(4),
  )

  const reasons: string[] = []
  if (opts?.roadDistanceKm != null) {
    reasons.push(`Đường ~${opts.roadDistanceKm.toFixed(2)} km`)
  } else {
    reasons.push(`Cách điểm neo ${loc.distanceKm.toFixed(2)} km`)
  }
  if (opts?.etaMinutes != null) {
    reasons.push(`ETA ~${Math.round(opts.etaMinutes)} phút`)
  }
  if (intent.locationType && loc.type === intent.locationType) {
    reasons.push(
      loc.type === 'charging_station'
        ? 'Đúng loại trạm sạc'
        : loc.type === 'gas_station'
          ? 'Đúng loại cây xăng'
          : 'Đúng loại điểm cần tìm',
    )
  }
  if (r.reachable === false) {
    reasons.push('Có thể ngoài tầm pin còn lại — cân nhắc kỹ')
  } else if (r.reachable === true && intent.urgency !== 'normal') {
    reasons.push('Trong tầm pin ước tính')
  }
  if (intent.urgency === 'critical') {
    reasons.push('Ưu tiên khoảng cách vì pin rất thấp')
  } else if (intent.urgency === 'high') {
    reasons.push('Pin thấp — ưu tiên điểm gần')
  }
  if (loc.openingHours) reasons.push(`Giờ mở: ${loc.openingHours}`)

  return {
    ...loc,
    rank: 0,
    score,
    reasons,
    roadDistanceKm: opts?.roadDistanceKm ?? null,
    etaMinutes: opts?.etaMinutes ?? null,
    reachableWithBattery: r.reachable,
    route: opts?.route ?? null,
    directionsUrl: opts?.directionsUrl ?? null,
  }
}

export function rankCandidates(
  candidates: CandidateLocation[],
  intent: ParsedIntent,
  limit: number,
  routeById?: Map<
    string,
    {
      roadDistanceKm: number
      etaMinutes: number
      route: RouteGeometry | null
      directionsUrl: string
    }
  >,
): RankedRecommendation[] {
  const reach = estimateReachableKm(intent.vehicleKind, intent.batteryPercent)
  let pool = candidates
  if (isEv(intent.vehicleKind) && reach != null && intent.urgency !== 'normal') {
    const softMax = reach * 1.15
    const filtered = candidates.filter((c) => {
      const d = routeById?.get(c.id)?.roadDistanceKm ?? c.distanceKm
      return d <= softMax
    })
    if (filtered.length) pool = filtered
  }

  return pool
    .map((c) => {
      const meta = routeById?.get(c.id)
      return scoreCandidate(c, intent, meta)
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.roadDistanceKm ?? a.distanceKm) - (b.roadDistanceKm ?? b.distanceKm),
    )
    .slice(0, limit)
    .map((r, i) => ({ ...r, rank: i + 1 }))
}
