import type { AnchorPoint, ParsedIntent, RankedRecommendation } from './types'

export function buildExplanation(
  intent: ParsedIntent,
  anchor: AnchorPoint,
  recommendations: RankedRecommendation[],
): string {
  if (!recommendations.length) {
    return `Không tìm thấy địa điểm phù hợp quanh ${anchor.label}. Hãy nới bán kính hoặc đổi từ khóa.`
  }

  const top = recommendations[0]
  const parts: string[] = []

  if (intent.batteryPercent != null) {
    parts.push(`Pin còn ${intent.batteryPercent}%`)
  }
  parts.push(`neo tại ${anchor.label}`)

  const typeLabel =
    top.type === 'charging_station'
      ? 'trạm sạc'
      : top.type === 'store'
        ? 'cửa hàng'
        : 'địa điểm'

  const head = `Gợi ý ${typeLabel} phù hợp nhất: **${top.name}** (cách ${top.distanceKm.toFixed(2)} km)`
  const why = top.reasons.slice(0, 3).join('; ')
  const alts =
    recommendations.length > 1
      ? ` Các lựa chọn tiếp: ${recommendations
          .slice(1)
          .map((r) => `${r.name} (${r.distanceKm.toFixed(2)} km)`)
          .join(', ')}.`
      : ''

  return `${head}. Ngữ cảnh: ${parts.join(', ')}. Lý do: ${why}.${alts}`
}
