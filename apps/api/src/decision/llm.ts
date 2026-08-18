import { mergeIntent, parseIntentRules, reconcileVehicleIntent } from './intent'
import type { ParsedIntent, TripPurpose, VehicleKind } from './types'
import { isVehicleKind, parseVehicleKind } from './vehicle'
import { detectTripPurpose } from './agents/context'

type LlmParse = {
  intent?: ParsedIntent['intent']
  locationType?: ParsedIntent['locationType']
  landmark?: string | null
  batteryPercent?: number | null
  vehicleKind?: VehicleKind | null
  destinationLandmark?: string | null
  tripPurpose?: TripPurpose | null
}

const SCHEMA_HINT = `Extract JSON only for this Vietnamese mobility / geo query.
Schema: {
  "tripPurpose":"need_urgent|need_normal|leisure|navigate",
  "intent":"find_charging|find_gas|find_store|find_nearby|find_parking|find_rescue|find_hospital|explore_area|joyride|navigate_to|unknown",
  "locationType":"charging_station|gas_station|store|parking|rescue_team|hospital|null",
  "landmark":string|null,
  "destinationLandmark":string|null,
  "batteryPercent":number|null,
  "vehicleKind":"ev_car|ev_moto|ice_car|ice_moto"|null
}
Rules:
- navigate = đi/tới/đến/chỉ đường tới địa danh cụ thể (Vincom, đại học, ĐHQGHN). destinationLandmark = place name. NEVER charging/gas.
- leisure = sightseeing / vui chơi / vi vu / dạo (destinationLandmark = place name e.g. Hồ Hoàn Kiếm). NEVER set charging/gas for leisure.
- need_urgent = hết xăng / pin rất thấp / cứu hộ.
- If vehicleKind is ice_car or ice_moto, NEVER set locationType charging_station.
- Vehicle type does not change leisure/navigate into fuel search.`

function applyLlmParse(query: string, parsed: LlmParse, vehicleHint?: VehicleKind | null): ParsedIntent {
  const baseIntent = parseIntentRules(query, { vehicleKind: vehicleHint })
  const vehicleKind =
    parseVehicleKind(parsed.vehicleKind) || baseIntent.vehicleKind || vehicleHint || null
  const dest =
    parsed.destinationLandmark ?? parsed.landmark ?? baseIntent.destinationLandmark ?? baseIntent.landmark

  let merged = mergeIntent(baseIntent, {
    intent: parsed.intent || baseIntent.intent,
    locationType:
      parsed.locationType === undefined ? baseIntent.locationType : parsed.locationType,
    landmark: parsed.landmark ?? baseIntent.landmark,
    batteryPercent:
      parsed.batteryPercent === undefined ? baseIntent.batteryPercent : parsed.batteryPercent,
    vehicleKind,
    destinationLandmark: dest,
    source: 'llm',
  })

  const tripPurpose =
    parsed.tripPurpose ||
    detectTripPurpose(query, {
      intent: merged.intent,
      batteryPercent: merged.batteryPercent,
      vehicleKind: merged.vehicleKind,
      hasDestinationHint: Boolean(merged.landmark || merged.destinationLandmark),
    })

  // Rules already classified go-to named place — do not let LLM flip to leisure/fuel
  if (
    baseIntent.tripPurpose === 'navigate' &&
    (baseIntent.destinationLandmark || baseIntent.landmark)
  ) {
    merged.tripPurpose = 'navigate'
    merged.intent = 'navigate_to'
    merged.locationType = null
    merged.landmark = baseIntent.landmark || merged.landmark
    merged.destinationLandmark =
      baseIntent.destinationLandmark || baseIntent.landmark || merged.destinationLandmark
  } else if (
    baseIntent.tripPurpose === 'leisure' &&
    (baseIntent.destinationLandmark || baseIntent.landmark)
  ) {
    merged.tripPurpose = 'leisure'
    if (merged.intent === 'find_charging' || merged.intent === 'find_gas') {
      merged.intent = 'explore_area'
      merged.locationType = null
    }
  } else {
    merged.tripPurpose = tripPurpose
  }
  return reconcileVehicleIntent(merged)
}

async function enrichWithGemini(
  query: string,
  vehicleHint?: VehicleKind | null,
): Promise<ParsedIntent | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) return null
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
  const prompt = `${SCHEMA_HINT}
Vehicle hint from UI: ${vehicleHint || 'none'}
Query: ${query}
JSON:`

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
        },
      }),
      signal: AbortSignal.timeout(Number(process.env.GEMINI_TIMEOUT_MS || 8000)),
    })
    if (!res.ok) {
      console.warn('[nlu] gemini', res.status)
      return null
    }
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!text) return null
    const parsed = JSON.parse(text) as LlmParse
    return applyLlmParse(query, parsed, vehicleHint)
  } catch (e) {
    console.warn('[nlu] gemini error', e instanceof Error ? e.message : e)
    return null
  }
}

async function enrichWithOpenAI(
  query: string,
  vehicleHint?: VehicleKind | null,
): Promise<ParsedIntent | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return null
  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini'
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SCHEMA_HINT },
          {
            role: 'user',
            content: `Vehicle hint from UI: ${vehicleHint || 'none'}\nQuery: ${query}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(Number(process.env.OPENAI_TIMEOUT_MS || 6000)),
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const text = json.choices?.[0]?.message?.content?.trim()
    if (!text) return null
    return applyLlmParse(query, JSON.parse(text) as LlmParse, vehicleHint)
  } catch {
    return null
  }
}

async function enrichWithOllama(
  query: string,
  vehicleHint?: VehicleKind | null,
): Promise<ParsedIntent | null> {
  const base = process.env.OLLAMA_BASE_URL?.replace(/\/$/, '')
  if (!base) return null

  const model = process.env.OLLAMA_MODEL || 'llama3.2'
  const prompt = `${SCHEMA_HINT}
Vehicle hint from UI: ${vehicleHint || 'none'}
Query: ${query}
JSON:`

  try {
    const res = await fetch(`${base}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        format: 'json',
        options: { temperature: 0 },
      }),
      signal: AbortSignal.timeout(Number(process.env.OLLAMA_TIMEOUT_MS || 6000)),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { response?: string }
    const text = json.response?.trim()
    if (!text) return null
    const parsed = JSON.parse(text) as LlmParse
    return applyLlmParse(query, parsed, vehicleHint)
  } catch {
    return null
  }
}

/**
 * NLU enrichment: OpenAI → Gemini → Ollama → null (rules only).
 */
export async function enrichIntentWithLlm(
  query: string,
  vehicleHint?: VehicleKind | null,
): Promise<ParsedIntent | null> {
  const hint = isVehicleKind(vehicleHint) ? vehicleHint : null
  const openai = await enrichWithOpenAI(query, hint)
  if (openai) return openai
  const gemini = await enrichWithGemini(query, hint)
  if (gemini) return gemini
  return enrichWithOllama(query, hint)
}
