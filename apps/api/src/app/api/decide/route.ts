import type { NextRequest } from 'next/server'
import { runDecision } from '@/decision/engine'
import { parseCity } from '@/lib/cities'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      query?: string
      latitude?: number
      longitude?: number
      limit?: number
      city?: string
    }

    if (!body.query || typeof body.query !== 'string') {
      return Response.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'query (string) is required' } },
        { status: 400 },
      )
    }

    const data = await runDecision({
      query: body.query,
      latitude: body.latitude,
      longitude: body.longitude,
      limit: body.limit,
      city: parseCity(body.city),
    })

    return Response.json({ success: true, data })
  } catch (err) {
    const status = (err as { status?: number }).status || 500
    const code = (err as { code?: string }).code || 'INTERNAL_SERVER_ERROR'
    const message = err instanceof Error ? err.message : 'Unexpected server error'
    return Response.json({ success: false, error: { code, message } }, { status })
  }
}
