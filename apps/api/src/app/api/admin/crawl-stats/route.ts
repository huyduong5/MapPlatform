import type { NextRequest } from 'next/server'
import { getPool } from '@/lib/db'
import { requireAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

/** GET /api/admin/crawl-stats — Phase 4 ops dashboard data */
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const pool = getPool()
    const [jobs, byStatus, warnings, byCityType, locationsStatus, byType] = await Promise.all([
      pool.query(
        `
        SELECT
          j.id::text AS id,
          s.name AS source,
          j.status,
          j.started_at AS "startedAt",
          j.finished_at AS "finishedAt",
          j.records_found AS "recordsFound",
          j.records_created AS "recordsCreated",
          j.records_updated AS "recordsUpdated",
          j.records_deactivated AS "recordsDeactivated",
          j.error_message AS "errorMessage"
        FROM crawl_jobs j
        JOIN sources s ON s.id = j.source_id
        ORDER BY j.started_at DESC
        LIMIT 20
        `,
      ),
      pool.query(
        `
        SELECT status, COUNT(*)::int AS count
        FROM crawl_jobs
        GROUP BY status
        ORDER BY status
        `,
      ),
      pool.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE level = 'WARNING' AND COALESCE(review_status, 'open') = 'open')::int AS "openWarnings",
          COUNT(*) FILTER (WHERE level = 'WARNING')::int AS "totalWarnings",
          COUNT(*) FILTER (WHERE level = 'ERROR')::int AS "errors"
        FROM crawl_logs
        `,
      ),
      pool.query(
        `
        SELECT city, type, COUNT(*)::int AS count
        FROM locations
        WHERE status = 'active'
        GROUP BY city, type
        ORDER BY city, type
        `,
      ),
      pool.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE status = 'active')::int AS active,
          COUNT(*) FILTER (WHERE status = 'inactive')::int AS inactive
        FROM locations
        `,
      ),
      pool.query(
        `
        SELECT type, COUNT(*)::int AS count
        FROM locations
        WHERE status = 'active'
        GROUP BY type
        ORDER BY type
        `,
      ),
    ])

    const active = locationsStatus.rows[0]?.active ?? 0
    const inactiveCount = locationsStatus.rows[0]?.inactive ?? 0
    const total = active + inactiveCount

    return Response.json({
      success: true,
      data: {
        jobs: jobs.rows,
        jobsByStatus: byStatus.rows,
        logSummary: warnings.rows[0] || { openWarnings: 0, totalWarnings: 0, errors: 0 },
        locationsByType: byType.rows,
        locationsByCityType: byCityType.rows,
        locationStatus: {
          active,
          inactive: inactiveCount,
          inactivePct: total ? Math.round((inactiveCount / total) * 1000) / 10 : 0,
        },
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
