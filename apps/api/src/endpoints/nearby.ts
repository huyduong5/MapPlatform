import type { Endpoint } from 'payload'
import { getPool } from '../lib/db'

/**
 * Public nearby search — PostGIS.
 * Mounted at GET /api/locations/nearby (custom Payload endpoint path).
 */
export const nearbyEndpoint: Endpoint = {
  path: '/locations/nearby',
  method: 'get',
  handler: async (req) => {
    try {
      const url = new URL(req.url || '', 'http://localhost')
      const latitude = Number(url.searchParams.get('latitude'))
      const longitude = Number(url.searchParams.get('longitude'))
      const radius = Number(url.searchParams.get('radius') || 5000)
      const type = url.searchParams.get('type')
      const limit = Math.min(Number(url.searchParams.get('limit') || 20), 50)

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
      // Sync geom for rows that may lack PostGIS column yet
      await pool.query(`
        SELECT ensure_locations_postgis();
      `).catch(() => undefined)

      const params: unknown[] = [longitude, latitude, radius, limit]
      let typeClause = ''
      if (type) {
        params.push(type)
        typeClause = `AND l.type = $${params.length}`
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
          ${typeClause}
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
  },
}
