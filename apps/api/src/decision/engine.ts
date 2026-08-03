import { parseCity } from '@/lib/cities'
import { buildExplanation } from './explain'
import { resolveAnchor } from './geocode'
import { parseIntentRules } from './intent'
import { enrichIntentWithLlm } from './llm'
import { queryNearbyCandidates } from './query'
import { radiusForIntent, rankCandidates } from './rules'
import type { DecideRequest, DecideResponse, ParsedIntent } from './types'

async function resolveIntent(query: string): Promise<ParsedIntent> {
  const rules = parseIntentRules(query)
  const llm = await enrichIntentWithLlm(query)
  return llm || rules
}

export async function runDecision(req: DecideRequest): Promise<DecideResponse['data']> {
  const query = (req.query || '').trim()
  if (!query) {
    throw Object.assign(new Error('query is required'), { code: 'BAD_REQUEST', status: 400 })
  }

  const city = parseCity(req.city)
  const intent = await resolveIntent(query)
  const anchor = await resolveAnchor({
    latitude: req.latitude,
    longitude: req.longitude,
    landmark: intent.landmark,
    city,
  })
  const radiusMeters = radiusForIntent(intent)
  const limit = Math.min(Math.max(req.limit ?? 3, 1), 10)

  const candidates = await queryNearbyCandidates({
    anchor,
    radiusMeters,
    locationType: intent.locationType,
    limit,
    city,
  })

  // If typed filter too strict and empty, retry without type (still city-scoped)
  const pool =
    candidates.length === 0 && intent.locationType
      ? await queryNearbyCandidates({
          anchor,
          radiusMeters: radiusMeters * 1.5,
          locationType: null,
          limit,
          city,
        })
      : candidates

  const recommendations = rankCandidates(pool, intent, limit)
  const explanation = buildExplanation(intent, anchor, recommendations)

  return {
    query,
    intent,
    anchor,
    radiusMeters,
    recommendations,
    explanation,
  }
}
