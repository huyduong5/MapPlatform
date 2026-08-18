import type { NextRequest } from 'next/server'
import { getPool } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** Public liveness — no auth */
export async function GET(_req: NextRequest) {
  try {
    const pool = getPool()
    const started = Date.now()
    await pool.query('SELECT 1')
    const dbMs = Date.now() - started
    return Response.json({
      success: true,
      data: {
        status: 'ok',
        service: 'mapplatform-app',
        phase: 6,
        db: { ok: true, latencyMs: dbMs },
        time: new Date().toISOString(),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'db down'
    return Response.json(
      {
        success: false,
        error: { code: 'SERVICE_UNAVAILABLE', message },
        data: { status: 'degraded', db: { ok: false } },
      },
      { status: 503 },
    )
  }
}
