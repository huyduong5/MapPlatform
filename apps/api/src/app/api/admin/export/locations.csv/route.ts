import type { NextRequest } from 'next/server'
import { getPool } from '@/lib/db'
import { requireAdmin } from '@/lib/adminAuth'
import { parseCity } from '@/lib/cities'

export const dynamic = 'force-dynamic'

/** GET /api/admin/export/locations.csv */
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const city = parseCity(req.nextUrl.searchParams.get('city'))
    const pool = getPool()
    const { rows } = await pool.query(
      `
      SELECT
        l.id::text AS id,
        l.city,
        l.type,
        l.name,
        l.address,
        l.latitude,
        l.longitude,
        l.status,
        l.phone,
        s.name AS source
      FROM locations l
      LEFT JOIN sources s ON s.id = l.source_id
      WHERE l.status = 'active' AND l.city = $1
      ORDER BY l.type, l.name
      `,
      [city],
    )

    const header = [
      'id',
      'city',
      'type',
      'name',
      'address',
      'latitude',
      'longitude',
      'status',
      'phone',
      'source',
    ]
    const esc = (v: unknown) => {
      const s = v == null ? '' : String(v)
      return `"${s.replace(/"/g, '""')}"`
    }
    const lines = [
      header.join(','),
      ...rows.map((r) =>
        header.map((h) => esc((r as Record<string, unknown>)[h])).join(','),
      ),
    ]
    const body = lines.join('\n')

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="locations_${city}.csv"`,
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
