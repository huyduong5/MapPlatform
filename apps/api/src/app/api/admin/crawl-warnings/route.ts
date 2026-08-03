import type { NextRequest } from 'next/server'
import { getPool } from '@/lib/db'
import { requireAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

/** GET /api/admin/crawl-warnings — open WARNING review queue */
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const status = req.nextUrl.searchParams.get('status') || 'open'
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 50), 100)
    const pool = getPool()
    const params: unknown[] = [limit]
    let statusClause = `AND COALESCE(l.review_status, 'open') = 'open'`
    if (status === 'all') {
      statusClause = ''
    } else if (status === 'resolved' || status === 'ignored' || status === 'open') {
      params.push(status)
      statusClause = `AND COALESCE(l.review_status, 'open') = $${params.length}`
    }

    const { rows } = await pool.query(
      `
      SELECT
        l.id::text AS id,
        l.crawl_job_id::text AS "crawlJobId",
        l.level,
        l.message,
        COALESCE(l.review_status, 'open') AS "reviewStatus",
        l.review_note AS "reviewNote",
        l.reviewed_at AS "reviewedAt",
        l.created_at AS "createdAt",
        s.name AS source
      FROM crawl_logs l
      JOIN crawl_jobs j ON j.id = l.crawl_job_id
      JOIN sources s ON s.id = j.source_id
      WHERE l.level = 'WARNING'
        ${statusClause}
      ORDER BY l.created_at DESC
      LIMIT $1
      `,
      params,
    )

    return Response.json({ success: true, data: rows })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected server error'
    return Response.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message } },
      { status: 500 },
    )
  }
}
