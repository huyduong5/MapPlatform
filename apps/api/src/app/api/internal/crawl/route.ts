import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { citiesJsonForCrawler } from '@/lib/citiesStore'
import { invokeCrawl } from '@/lib/crawlRunner'

export const dynamic = 'force-dynamic'

/**
 * POST /api/internal/crawl — expose old Python run_once flow for Jobs/ops.
 * Auth: x-admin-token (ADMIN_TOKEN).
 * Body: { cities: string[], sources: string[], payloadCrawlJobId?: string }
 */
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const body = (await req.json()) as {
      cities?: unknown
      sources?: unknown
      payloadCrawlJobId?: unknown
    }

    const cities = Array.isArray(body.cities) ? body.cities.map(String).filter(Boolean) : []
    const sources = Array.isArray(body.sources) ? body.sources.map(String).filter(Boolean) : []
    if (cities.length === 0 || sources.length === 0) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'cities and sources arrays are required',
          },
        },
        { status: 400 },
      )
    }

    const citiesJson = await citiesJsonForCrawler(cities)
    const result = await invokeCrawl({
      cities,
      sources,
      citiesJson,
      payloadCrawlJobId:
        body.payloadCrawlJobId != null ? String(body.payloadCrawlJobId) : undefined,
    })

    const ok = result.exitCode === 0 && (result.summary?.ok ?? true)
    return Response.json({
      success: ok,
      data: {
        exitCode: result.exitCode,
        summary: result.summary,
        logTail: result.logTail,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected server error'
    return Response.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message } },
      { status: 500 },
    )
  }
}
