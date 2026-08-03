import type { CandidateLocation, ParsedIntent, RankedRecommendation } from './types'

export function radiusForIntent(intent: ParsedIntent): number {
  if (intent.urgency === 'critical') return 3000
  if (intent.urgency === 'high') return 5000
  if (intent.intent === 'find_store') return 8000
  return 6000
}

function distanceScore(distanceKm: number, urgency: ParsedIntent['urgency']): number {
  // Closer is better. Critical urgency punishes distance harder.
  const soft = urgency === 'critical' ? 1.5 : urgency === 'high' ? 2.5 : 4
  return Math.max(0, 1 - distanceKm / soft)
}

function typeScore(loc: CandidateLocation, intent: ParsedIntent): number {
  if (!intent.locationType) return 0.7
  return loc.type === intent.locationType ? 1 : 0.1
}

function batteryBoost(intent: ParsedIntent, distanceKm: number): number {
  if (intent.batteryPercent == null) return 0.5
  if (intent.urgency === 'critical') return distanceKm <= 1.5 ? 1 : distanceKm <= 3 ? 0.7 : 0.3
  if (intent.urgency === 'high') return distanceKm <= 3 ? 0.9 : 0.5
  return 0.6
}

export function scoreCandidate(loc: CandidateLocation, intent: ParsedIntent): RankedRecommendation {
  const d = distanceScore(loc.distanceKm, intent.urgency)
  const t = typeScore(loc, intent)
  const b = batteryBoost(intent, loc.distanceKm)
  // Weights: distance 50%, type 30%, battery/urgency 20%
  const score = Number((0.5 * d + 0.3 * t + 0.2 * b).toFixed(4))

  const reasons: string[] = []
  reasons.push(`Cách điểm neo ${loc.distanceKm.toFixed(2)} km`)
  if (intent.locationType && loc.type === intent.locationType) {
    reasons.push(
      loc.type === 'charging_station' ? 'Đúng loại trạm sạc' : 'Đúng loại cửa hàng',
    )
  }
  if (intent.urgency === 'critical') {
    reasons.push('Ưu tiên khoảng cách vì pin rất thấp')
  } else if (intent.urgency === 'high') {
    reasons.push('Pin thấp — ưu tiên điểm gần')
  }
  if (loc.openingHours) reasons.push(`Giờ mở: ${loc.openingHours}`)

  return { ...loc, rank: 0, score, reasons }
}

export function rankCandidates(
  candidates: CandidateLocation[],
  intent: ParsedIntent,
  limit: number,
): RankedRecommendation[] {
  return candidates
    .map((c) => scoreCandidate(c, intent))
    .sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm)
    .slice(0, limit)
    .map((r, i) => ({ ...r, rank: i + 1 }))
}
