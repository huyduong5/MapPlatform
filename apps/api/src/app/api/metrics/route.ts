import type { NextRequest } from 'next/server'
import { getPool } from '@/lib/db'
import { requireAdmin } from '@/lib/adminAuth'
import { buildDisplayableNameFilter } from '@/lib/poiName'

export const dynamic = 'force-dynamic'

/** Ops metrics snapshot (admin-protected in production) */
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const pool = getPool()
    const [locs, byCityType, inactive, coverage, coverageByCity, jobs, warns] =
      await Promise.all([
        pool.query(
          `SELECT type, COUNT(*)::int AS count FROM locations WHERE status='active' GROUP BY type ORDER BY type`,
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
        SELECT
          COUNT(*) FILTER (WHERE status = 'active')::int AS active,
          COUNT(*) FILTER (WHERE status = 'active' AND phone IS NOT NULL AND phone <> '')::int AS with_phone,
          COUNT(*) FILTER (WHERE status = 'active' AND opening_hours IS NOT NULL AND opening_hours <> '')::int AS with_hours,
          COUNT(*) FILTER (WHERE status = 'active' AND website IS NOT NULL AND website <> '')::int AS with_website,
          COUNT(*) FILTER (WHERE status = 'active' AND address_normalized IS NOT NULL AND address_normalized <> '')::int AS with_normalized_address,
          COUNT(*) FILTER (WHERE status = 'active' AND rating IS NOT NULL)::int AS with_rating,
          COUNT(*) FILTER (WHERE name ~ ' OSM #[0-9]+$')::int AS synthetic_total,
          COUNT(*) FILTER (WHERE status = 'active' AND name ~ ' OSM #[0-9]+$')::int AS synthetic_active,
          COUNT(*) FILTER (
            WHERE status = 'active' AND NOT (${buildDisplayableNameFilter('locations').replace(/\n/g, ' ')})
          )::int AS undisplayable_active
        FROM locations
        `,
        ),
        pool.query(
          `
        SELECT
          city,
          COUNT(*)::int AS active,
          COUNT(*) FILTER (WHERE phone IS NOT NULL AND phone <> '')::int AS with_phone,
          COUNT(*) FILTER (WHERE opening_hours IS NOT NULL AND opening_hours <> '')::int AS with_hours,
          COUNT(*) FILTER (WHERE website IS NOT NULL AND website <> '')::int AS with_website,
          COUNT(*) FILTER (WHERE address_normalized IS NOT NULL AND address_normalized <> '')::int AS with_normalized_address
        FROM locations
        WHERE status = 'active'
        GROUP BY city
        ORDER BY city
        `,
        ),
        pool.query(
          `
        SELECT status, COUNT(*)::int AS count
        FROM crawl_jobs
        WHERE started_at > now() - interval '7 days'
        GROUP BY status
        `,
        ),
        pool.query(
          `
        SELECT COUNT(*)::int AS open_warnings
        FROM crawl_logs
        WHERE level='WARNING' AND COALESCE(review_status,'open')='open'
        `,
        ),
      ])

    const active = inactive.rows[0]?.active ?? 0
    const inactiveCount = inactive.rows[0]?.inactive ?? 0
    const total = active + inactiveCount
    const cov = coverage.rows[0] || {}
    const activeCov = Number(cov.active || 0) || 1
    const pct = (n: number, den = activeCov) =>
      Math.round((n / (den || 1)) * 1000) / 10

    return Response.json({
      success: true,
      data: {
        locationsByType: locs.rows,
        locationsByCityType: byCityType.rows,
        locationStatus: {
          active,
          inactive: inactiveCount,
          inactivePct: total ? Math.round((inactiveCount / total) * 1000) / 10 : 0,
        },
        enrichmentCoverage: {
          withPhone: cov.with_phone ?? 0,
          withHours: cov.with_hours ?? 0,
          withWebsite: cov.with_website ?? 0,
          withNormalizedAddress: cov.with_normalized_address ?? 0,
          withRating: cov.with_rating ?? 0,
          pctPhone: pct(Number(cov.with_phone || 0)),
          pctHours: pct(Number(cov.with_hours || 0)),
          pctWebsite: pct(Number(cov.with_website || 0)),
          pctNormalizedAddress: pct(Number(cov.with_normalized_address || 0)),
          byCity: coverageByCity.rows.map((r) => {
            const a = Number(r.active || 0) || 1
            return {
              city: String(r.city),
              active: Number(r.active || 0),
              pctPhone: pct(Number(r.with_phone || 0), a),
              pctHours: pct(Number(r.with_hours || 0), a),
              pctWebsite: pct(Number(r.with_website || 0), a),
              pctNormalizedAddress: pct(Number(r.with_normalized_address || 0), a),
            }
          }),
        },
        syntheticNames: {
          total: cov.synthetic_total ?? 0,
          active: cov.synthetic_active ?? 0,
          undisplayableActive: cov.undisplayable_active ?? 0,
        },
        jobsLast7d: jobs.rows,
        openWarnings: warns.rows[0]?.open_warnings ?? 0,
        generatedAt: new Date().toISOString(),
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
