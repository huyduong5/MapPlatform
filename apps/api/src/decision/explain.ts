import type {
  AnchorPoint,
  DestinationPoint,
  ParsedIntent,
  RankedRecommendation,
  RecommendationMode,
  TripPurpose,
} from './types'
import { vehicleLabel } from './vehicle'

export function buildExplanation(
  intent: ParsedIntent,
  anchor: AnchorPoint,
  recommendations: RankedRecommendation[],
  opts?: {
    tripPurpose?: TripPurpose
    destination?: DestinationPoint | null
    recommendationMode?: RecommendationMode
  },
): string {
  const purpose = opts?.tripPurpose || intent.tripPurpose
  const dest = opts?.destination

  if (!recommendations.length) {
    return `Không tìm thấy địa điểm phù hợp quanh ${anchor.label}. Hãy nới bán kính hoặc đổi từ khóa.`
  }

  const top = recommendations[0]
  const parts: string[] = []
  if (intent.vehicleKind) parts.push(vehicleLabel(intent.vehicleKind))
  if (intent.batteryPercent != null) parts.push(`pin còn ${intent.batteryPercent}%`)
  parts.push(`xuất phát: ${anchor.label}`)
  if (dest) parts.push(`đích: ${dest.label}`)

  if (opts?.recommendationMode === 'destination' || purpose === 'leisure' || purpose === 'navigate') {
    const dist =
      top.roadDistanceKm != null
        ? `~${top.roadDistanceKm.toFixed(2)} km đường`
        : `${top.distanceKm.toFixed(2)} km`
    const eta =
      top.etaMinutes != null ? `, ETA ~${Math.round(top.etaMinutes)} phút` : ''
    const routeHint =
      (top.routes?.length || 0) >= 2
        ? ' Có 2 tuyến: Nhanh nhất và Trải nghiệm (tiện ích dọc đường).'
        : top.routes?.length === 1
          ? ' Tuyến nhanh nhất tới đích.'
          : ''
    const play = top.routes?.[0]?.amenities?.slice(0, 3).map((a) => a.name) || []
    const playHint = play.length ? ` Gợi ý quanh đích: ${play.join(', ')}.` : ''
    const src =
      dest?.source === 'poi'
        ? ' (từ map POI)'
        : dest?.source === 'landmark_alias'
          ? ' (alias)'
          : dest?.source === 'photon'
            ? ' (geocode)'
            : ''
    const headline =
      purpose === 'navigate' ? `Chỉ đường tới **${top.name}**` : `Chuyến vui chơi / tới **${top.name}**`
    return `${headline}${src} (${dist}${eta}). Ngữ cảnh: ${parts.join(', ')}.${routeHint}${playHint}`
  }

  if (purpose === 'need_urgent') {
    const typeLabel =
      top.type === 'gas_station'
        ? 'cây xăng'
        : top.type === 'charging_station'
          ? 'trạm sạc'
          : top.type === 'rescue_team'
            ? 'đội cứu hộ'
            : 'điểm cần thiết'
    const dist =
      top.roadDistanceKm != null
        ? `~${top.roadDistanceKm.toFixed(2)} km đường`
        : `${top.distanceKm.toFixed(2)} km`
    const eta =
      top.etaMinutes != null ? `, ETA ~${Math.round(top.etaMinutes)} phút` : ''
    return `Ưu tiên khẩn: ${typeLabel} gần nhất **${top.name}** (${dist}${eta}). Ngữ cảnh: ${parts.join(', ')}. Chỉ đề xuất tuyến nhanh nhất.`
  }

  const typeLabel =
    top.type === 'charging_station'
      ? 'trạm sạc'
      : top.type === 'gas_station'
        ? 'cây xăng'
        : top.type === 'store'
          ? 'cửa hàng'
          : 'địa điểm'

  const dist =
    top.roadDistanceKm != null
      ? `~${top.roadDistanceKm.toFixed(2)} km đường`
      : `${top.distanceKm.toFixed(2)} km`
  const eta =
    top.etaMinutes != null ? `, ETA ~${Math.round(top.etaMinutes)} phút` : ''

  const head = `Gợi ý ${typeLabel} phù hợp nhất: **${top.name}** (${dist}${eta})`
  const why = top.reasons.slice(0, 3).join('; ')
  const alts =
    recommendations.length > 1
      ? ` Các lựa chọn tiếp: ${recommendations
          .slice(1)
          .map((r) => {
            const d =
              r.roadDistanceKm != null
                ? `~${r.roadDistanceKm.toFixed(2)} km`
                : `${r.distanceKm.toFixed(2)} km`
            return `${r.name} (${d})`
          })
          .join(', ')}.`
      : ''

  return `${head}. Ngữ cảnh: ${parts.join(', ')}. Lý do: ${why}.${alts}`
}
