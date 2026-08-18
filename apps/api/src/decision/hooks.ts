import type {
  RouteAmenity,
  RouteHook,
  RouteOption,
  RoutePersona,
  TravelMode,
  VehicleKind,
} from './types'
import { isEv } from './vehicle'

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    charging_station: 'trạm sạc',
    gas_station: 'cây xăng',
    parking: 'bãi đỗ',
    pharmacy: 'nhà thuốc',
    hospital: 'bệnh viện',
    atm: 'ATM',
    store: 'cửa hàng',
    marketplace: 'chợ / TTTM',
    police: 'đồn công an',
    university: 'đại học',
    school: 'trường học',
    bus_stop: 'điểm bus',
    subway_station: 'ga metro',
    park: 'công viên',
    tourist_attraction: 'điểm tham quan',
  }
  return map[type] || type
}

export function buildRuleHook(params: {
  persona: RoutePersona
  mode: TravelMode
  vehicleKind: VehicleKind | null
  amenities: RouteAmenity[]
  batteryPercent?: number | null
  nightMode?: boolean
  badges?: string[]
}): RouteHook {
  const { persona, mode, vehicleKind, amenities, batteryPercent, nightMode, badges } = params

  if (nightMode && amenities.some((a) => a.type === 'police' || a.type === 'hospital')) {
    const a = amenities.find((x) => x.type === 'police' || x.type === 'hospital')!
    return {
      title: 'An toàn buổi tối',
      detail: `Tuyến đi gần ${typeLabel(a.type)} «${a.name}» — hữu ích nếu đi muộn.`,
      amenityIds: [a.id],
      kind: 'night_safety',
    }
  }

  if (
    persona === 'smart' &&
    isEv(vehicleKind) &&
    batteryPercent != null &&
    batteryPercent <= 25
  ) {
    const charge = amenities.find((a) => a.type === 'charging_station')
    if (charge) {
      return {
        title: 'Ốc đảo pin trên đường',
        detail: `Có ${typeLabel(charge.type)} «${charge.name}» dọc tuyến — dự phòng nếu pin thấp.`,
        amenityIds: [charge.id],
        kind: 'battery_oasis',
      }
    }
  }

  if (persona === 'smart' && (mode === 'walk' || mode === 'bike') && badges?.includes('green')) {
    return {
      title: mode === 'walk' ? 'Lối đi xanh / yên hơn' : 'Cung đường êm hơn',
      detail:
        mode === 'walk'
          ? 'Ưu tiên đoạn đường xanh và yên hơn, đánh đổi thêm vài phút.'
          : 'Ưu tiên cung đường dễ đạp hơn thay vì chỉ tối đa tốc độ.',
      amenityIds: amenities.slice(0, 2).map((a) => a.id),
      kind: 'eco',
    }
  }

  if (mode === 'transit' && badges?.length) {
    return {
      title: 'Lịch trình công cộng',
      detail: badges.join(' · '),
      amenityIds: amenities.filter((a) => a.type === 'bus_stop' || a.type === 'subway_station').slice(0, 2).map((a) => a.id),
      kind: 'transit',
    }
  }

  const priority =
    persona === 'smart'
      ? ['charging_station', 'gas_station', 'pharmacy', 'atm', 'parking', 'marketplace', 'store', 'bus_stop', 'subway_station']
      : ['atm', 'parking', 'pharmacy', 'charging_station', 'gas_station']

  for (const t of priority) {
    const hit = amenities.find((a) => a.type === t)
    if (hit) {
      return {
        title: `Tiện ích: ${typeLabel(hit.type)}`,
        detail: `Dọc đường có «${hit.name}» (~${Math.round(hit.distanceToRouteM)}m khỏi tuyến).`,
        amenityIds: [hit.id],
        kind: t === 'atm' || t === 'pharmacy' || t === 'parking' ? 'pit_stop' : 'amenity',
      }
    }
  }

  if (persona === 'fastest') {
    return {
      title: 'Nhanh nhất',
      detail: 'Ưu tiên thời gian tới điểm đến.',
      amenityIds: [],
      kind: 'generic',
    }
  }

  if (persona === 'experience') {
    return {
      title: 'Trải nghiệm dọc đường',
      detail: 'Tuyến thay thế với tiện ích / điểm dừng thú vị hơn.',
      amenityIds: amenities.slice(0, 3).map((a) => a.id),
      kind: 'leisure',
    }
  }

  return {
    title: 'Đặc sắc',
    detail: 'Tuyến thay thế với tiện ích / trải nghiệm khác tuyến nhanh nhất.',
    amenityIds: [],
    kind: 'generic',
  }
}

async function openaiHookPolish(hook: RouteHook, context: string): Promise<RouteHook> {
  const key = process.env.OPENAI_API_KEY?.trim()
  if (!key) return hook

  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini'
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 120,
        messages: [
          {
            role: 'system',
            content:
              'Bạn viết copy tiếng Việt ngắn (1 câu title ≤6 từ, 1 câu detail ≤28 từ) cho tuyến đường map. Trả JSON {"title":"...","detail":"..."}. Không emoji.',
          },
          {
            role: 'user',
            content: `Ngữ cảnh: ${context}\nGợi ý gốc: ${hook.title} — ${hook.detail}`,
          },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) return hook
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const raw = json.choices?.[0]?.message?.content
    if (!raw) return hook
    const parsed = JSON.parse(raw) as { title?: string; detail?: string }
    return {
      ...hook,
      title: (parsed.title || hook.title).slice(0, 48),
      detail: (parsed.detail || hook.detail).slice(0, 160),
    }
  } catch {
    return hook
  }
}

export async function enrichRouteHook(
  hook: RouteHook,
  context: string,
): Promise<RouteHook> {
  return openaiHookPolish(hook, context)
}

export function attachDeltas(fastest: RouteOption, smart: RouteOption): RouteOption {
  const vsMin = Number((smart.etaMinutes - fastest.etaMinutes).toFixed(1))
  const vsKm = Number((smart.distanceKm - fastest.distanceKm).toFixed(2))
  let highlight: string | undefined
  if (vsMin <= 0.5) highlight = 'Cùng ETA gần như tuyến nhanh'
  else if (vsMin <= 5) highlight = `Chậm hơn ~${Math.round(vsMin)} phút`
  else highlight = `Chậm hơn ~${Math.round(vsMin)} phút`
  return {
    ...smart,
    deltas: { vsFastestMinutes: vsMin, vsFastestKm: vsKm, highlight },
  }
}

export function isNightHours(d = new Date()): boolean {
  const h = d.getHours()
  return h >= 18 || h < 5
}
