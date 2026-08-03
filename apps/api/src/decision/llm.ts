import { mergeIntent, parseIntentRules } from './intent'
import type { ParsedIntent } from './types'

/**
 * Optional local LLM (Ollama) — $0, self-hosted.
 * If unavailable, caller keeps rule-based intent.
 */
export async function enrichIntentWithLlm(query: string): Promise<ParsedIntent | null> {
  const base = process.env.OLLAMA_BASE_URL?.replace(/\/$/, '')
  if (!base) return null

  const model = process.env.OLLAMA_MODEL || 'llama3.2'
  const prompt = `Extract JSON only for this Vietnamese EV geo query.
Schema: {"intent":"find_charging|find_store|find_nearby|unknown","locationType":"charging_station|store|null","landmark":string|null,"batteryPercent":number|null}
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
    const parsed = JSON.parse(text) as {
      intent?: ParsedIntent['intent']
      locationType?: ParsedIntent['locationType']
      landmark?: string | null
      batteryPercent?: number | null
    }
    const baseIntent = parseIntentRules(query)
    return mergeIntent(baseIntent, {
      intent: parsed.intent || baseIntent.intent,
      locationType:
        parsed.locationType === undefined ? baseIntent.locationType : parsed.locationType,
      landmark: parsed.landmark ?? baseIntent.landmark,
      batteryPercent:
        parsed.batteryPercent === undefined ? baseIntent.batteryPercent : parsed.batteryPercent,
      source: 'llm',
    })
  } catch {
    return null
  }
}
