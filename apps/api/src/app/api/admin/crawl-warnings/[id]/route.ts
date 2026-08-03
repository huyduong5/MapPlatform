import type { NextRequest } from 'next/server'
import { getPool } from '@/lib/db'
import { requireAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

type Body = { status?: 'resolved' | 'ignored' | 'open'; note?: string }

/** PATCH /api/admin/crawl-warnings/:id — resolve/ignore a WARNING */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const { id } = await ctx.params
    const body = (await req.json()) as Body
    const status = body.status
    if (!status || !['resolved', 'ignored', 'open'].includes(status)) {
      return Response.json(
        {
          success: false,
          error: { code: 'BAD_REQUEST', message: 'status must be resolved|ignored|open' },
        },
        { status: 400 },
      )
    }

    const pool = getPool()
    const { rows } = await pool.query(
      `
      UPDATE crawl_logs SET
        review_status = $2,
        review_note = COALESCE($3, review_note),
        reviewed_at = CASE WHEN $2 = 'open' THEN NULL ELSE now() END
      WHERE id = $1::uuid AND level = 'WARNING'
      RETURNING
        id::text AS id,
        COALESCE(review_status, 'open') AS "reviewStatus",
        review_note AS "reviewNote",
        reviewed_at AS "reviewedAt",
        message
      `,
      [id, status, body.note ?? null],
    )

    if (!rows[0]) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Warning not found' } },
        { status: 404 },
      )
    }

    return Response.json({ success: true, data: rows[0] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected server error'
    return Response.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message } },
      { status: 500 },
    )
  }
}
