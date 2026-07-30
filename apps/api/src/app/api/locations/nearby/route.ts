import type { NextRequest } from 'next/server'
import { getPool } from '@/lib/db'
import { isCityCode } from '@/lib/cities'
import { buildDisplayableNameFilter } from '@/lib/poiName'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const latitude = Number(searchParams.get('latitude'))
    const longitude = Number(searchParams.get('longitude'))
    const radiusRaw = Number(searchParams.get('radius') || 5000)
    const radius = Math.min(Math.max(Number.isFinite(radiusRaw) ? radiusRaw : 5000, 1), 20_000)
    const type = searchParams.get('type')
    const city = searchParams.get('city')
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 20), 1), 100)

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return Response.json(
        {
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Missing or invalid latitude/longitude' },
        },
        { status: 400 },
      )
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return Response.json(
        {
          success: false,
          error: { code: 'BAD_REQUEST', message: 'latitude/longitude out of range' },
        },
        { status: 400 },
      )
    }
    if (!Number.isFinite(radius) || radius <= 0) {
      return Response.json(
        {
          success: false,
          error: { code: 'BAD_REQUEST', message: 'radius must be a positive number (meters)' },
        },
        { status: 400 },
      )
    }

    const pool = getPool()
    const params: unknown[] = [longitude, latitude, radius, limit]
    let extra = ''
    if (type) {
      params.push(type)
      extra += ` AND l.type = $${params.length}`
    }
    if (isCityCode(city)) {
      params.push(city)
      extra += ` AND l.city = $${params.length}`
    }

    const { rows } = await pool.query(
      `
      SELECT
        l.id::text AS id,
        l.name,
        l.type,
        l.address,
        l.latitude,
        l.longitude,
        l.status,
        l.city,
        l.phone,
        l.opening_hours AS "openingHours",
        s.name AS source,
        l.source_url AS "sourceUrl",
        l.last_updated AS "lastUpdated",
        l.created_at AS "createdAt",
        l.updated_at AS "updatedAt",
        ROUND((ST_Distance(
          COALESCE(l.location, ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography),
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) / 1000.0)::numeric, 2)::float AS "distanceKm"
      FROM locations l
      LEFT JOIN sources s ON s.id = l.source_id
      WHERE l.status = 'active'
        AND ${buildDisplayableNameFilter('l')}
        ${extra}
        AND ST_DWithin(
          COALESCE(l.location, ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography),
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          $3
        )
      ORDER BY "distanceKm" ASC
      LIMIT $4
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
