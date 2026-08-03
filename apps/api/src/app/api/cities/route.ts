import { getPool } from '@/lib/db'
import { CITIES, type CityCode } from '@/lib/cities'

export const dynamic = 'force-dynamic'

/** GET /api/cities — registry + live counts */
export async function GET() {
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
    const counts = Object.fromEntries(rows.map((r) => [r.city, r.count])) as Record<
      string,
      number
    >

    const data = (Object.keys(CITIES) as CityCode[]).map((code) => ({
      ...CITIES[code],
      locationCount: counts[code] || 0,
      enabled: (counts[code] || 0) > 0 || code === 'hanoi',
    }))

    return Response.json({ success: true, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected server error'
    return Response.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message } },
      { status: 500 },
    )
  }
}
