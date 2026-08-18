import { getPool } from '@/lib/db'
import { loadCitiesFromPayload } from '@/lib/citiesStore'

export const dynamic = 'force-dynamic'

/** GET /api/cities — SQL cms_cities (+ counts); hardcode fallback; never blocks on Payload init */
export async function GET() {
  try {
    const citiesPromise = loadCitiesFromPayload()

    let counts: Record<string, number> = {}
    try {
      const pool = getPool()
      const { rows } = await pool.query(
        `
        SELECT city, COUNT(*)::int AS count
        FROM locations
        WHERE status = 'active'
        GROUP BY city
        `,
      )
      counts = Object.fromEntries(rows.map((r) => [r.city, r.count])) as Record<string, number>
    } catch {
      // counts optional when PostGIS unavailable
    }

    const cities = await citiesPromise
    const data = cities.map((c) => ({
      ...c,
      locationCount: counts[c.code] || 0,
    }))

    return Response.json(
      { success: true, data },
      {
        headers: {
          'Cache-Control': 'public, max-age=15, stale-while-revalidate=60',
        },
      },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected server error'
    return Response.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message } },
      { status: 500 },
    )
  }
}
