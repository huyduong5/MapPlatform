import type { NextRequest } from 'next/server'
import { getPool } from '@/lib/db'
import { parseCity } from '@/lib/cities'
import { buildDisplayableNameFilter, wantsIncludeUnnamed } from '@/lib/poiName'

export const dynamic = 'force-dynamic'

const MAX_LIMIT = 500
const SLOW_MS = Number(process.env.LOCATIONS_SLOW_MS || 800)

type LocRow = {
  id: string
  name: string
  type: string
  address?: string
  latitude: number
  longitude: number
  status: string
  city: string
  phone?: string | null
  openingHours?: string | null
  source?: string | null
  sourceUrl?: string | null
  lastUpdated?: string | null
  createdAt?: string
  updatedAt?: string
}

function mapLeanRow(r: Record<string, unknown>): LocRow {
  return {
    id: String(r.id),
    name: String(r.name),
    type: String(r.type),
    address: r.address != null ? String(r.address) : undefined,
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    status: String(r.status),
    city: String(r.city || 'hanoi'),
  }
}

function mapFullRow(r: Record<string, unknown>): LocRow {
  return {
    ...mapLeanRow(r),
    phone: (r.phone as string) ?? null,
    openingHours: (r.openingHours as string) ?? (r.opening_hours as string) ?? null,
    source: (r.source as string) ?? null,
    sourceUrl: (r.sourceUrl as string) ?? (r.source_url as string) ?? null,
    lastUpdated: r.lastUpdated
      ? String(r.lastUpdated)
      : r.last_updated
        ? String(r.last_updated)
        : null,
    createdAt: r.createdAt || r.created_at ? String(r.createdAt ?? r.created_at) : undefined,
    updatedAt: r.updatedAt || r.updated_at ? String(r.updatedAt ?? r.updated_at) : undefined,
  }
}

function parseWithTotal(raw: string | null): boolean {
  if (raw == null || raw === '') return true
  const v = raw.trim().toLowerCase()
  return !(v === '0' || v === 'false' || v === 'no')
}

/** Per-type sample size for low zoom density mode. */
function perTypeCap(zoom: number | null, limit: number): number | null {
  if (zoom == null || !Number.isFinite(zoom)) return null
  if (zoom >= 14) return null
  if (zoom < 11) return Math.max(8, Math.floor(limit / 12))
  if (zoom < 13) return Math.max(12, Math.floor(limit / 10))
  return Math.max(20, Math.floor(limit / 8))
}

export async function GET(req: NextRequest) {
  const t0 = Date.now()
  try {
    const includeUnnamedParam = wantsIncludeUnnamed(req)
    if (includeUnnamedParam instanceof Response) return includeUnnamedParam
    const includeUnnamed = includeUnnamedParam === true

    const { searchParams } = req.nextUrl
    const type = searchParams.get('type')
    const status = searchParams.get('status') || 'active'
    const search = searchParams.get('search')
    const city = parseCity(searchParams.get('city'))
    const page = Math.max(Number(searchParams.get('page') || 1), 1)
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 20), 1), MAX_LIMIT)
    const offset = (page - 1) * limit
    const withTotal = parseWithTotal(searchParams.get('withTotal'))
    const minLat = searchParams.get('minLat')
    const maxLat = searchParams.get('maxLat')
    const minLng = searchParams.get('minLng')
    const maxLng = searchParams.get('maxLng')
    const zoomRaw = searchParams.get('zoom')
    const zoom = zoomRaw != null && zoomRaw !== '' ? Number(zoomRaw) : null
    const cursor = searchParams.get('cursor') // keyset: name|id
    const fields = (searchParams.get('fields') || 'lean').toLowerCase()
    // Search results need richer rows for the panel; map bbox stays lean.
    const fullFields = fields === 'full' || Boolean(search)

    const pool = getPool()
    const where: string[] = []
    const params: unknown[] = []

    if (status) {
      params.push(status)
      where.push(`l.status = $${params.length}`)
    }
    params.push(city)
    where.push(`l.city = $${params.length}`)
    if (type) {
      params.push(type)
      where.push(`l.type = $${params.length}`)
    }
    if (search) {
      params.push(`%${search}%`)
      where.push(`(l.name ILIKE $${params.length} OR l.address ILIKE $${params.length})`)
    }
    if (!includeUnnamed) {
      where.push(buildDisplayableNameFilter('l'))
    }

    let centerLng: number | null = null
    let centerLat: number | null = null
    let hasBbox = false
    if (minLat && maxLat && minLng && maxLng) {
      const south = Number(minLat)
      const north = Number(maxLat)
      const west = Number(minLng)
      const east = Number(maxLng)
      if (
        Number.isFinite(south) &&
        Number.isFinite(north) &&
        Number.isFinite(west) &&
        Number.isFinite(east) &&
        north > south &&
        east > west
      ) {
        hasBbox = true
        centerLng = (west + east) / 2
        centerLat = (south + north) / 2
        params.push(west, south, east, north)
        const iWest = params.length - 3
        const iSouth = params.length - 2
        const iEast = params.length - 1
        const iNorth = params.length
        where.push(
          `l.location && ST_MakeEnvelope($${iWest}, $${iSouth}, $${iEast}, $${iNorth}, 4326)::geography`,
        )
        where.push(`l.latitude BETWEEN $${iSouth} AND $${iNorth}`)
        where.push(`l.longitude BETWEEN $${iWest} AND $${iEast}`)
      }
    }

    // Keyset pagination (admin/list): cursor = encodeURIComponent(`${name}|${id}`)
    if (cursor && !hasBbox) {
      const decoded = decodeURIComponent(cursor)
      const sep = decoded.lastIndexOf('|')
      if (sep > 0) {
        const cName = decoded.slice(0, sep)
        const cId = decoded.slice(sep + 1)
        params.push(cName, cId)
        where.push(
          `(l.name, l.id::text) > ($${params.length - 1}, $${params.length})`,
        )
      }
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    let total: number | null = null
    if (withTotal) {
      const countRes = await pool.query(
        `SELECT COUNT(*)::int AS total FROM locations l ${whereSql}`,
        params,
      )
      total = countRes.rows[0]?.total ?? 0
    }

    const typeCap = hasBbox ? perTypeCap(zoom, limit) : null
    const selectCols = fullFields
      ? `
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
        l.updated_at AS "updatedAt"`
      : `
        l.id::text AS id,
        l.name,
        l.type,
        l.address,
        l.latitude,
        l.longitude,
        l.status,
        l.city`
    const fromSql = fullFields
      ? `FROM locations l LEFT JOIN sources s ON s.id = l.source_id`
      : `FROM locations l`

    let rows: Record<string, unknown>[]
    if (typeCap != null && centerLng != null && centerLat != null) {
      params.push(centerLng, centerLat, typeCap, limit)
      const iLng = params.length - 3
      const iLat = params.length - 2
      const iCap = params.length - 1
      const iLim = params.length
      const { rows: r } = await pool.query(
        `
        WITH ranked AS (
          SELECT ${selectCols},
            ROW_NUMBER() OVER (
              PARTITION BY l.type
              ORDER BY ST_Distance(
                l.location,
                ST_SetSRID(ST_MakePoint($${iLng}, $${iLat}), 4326)::geography
              ) ASC
            ) AS rn
          ${fromSql}
          ${whereSql}
        )
        SELECT * FROM ranked
        WHERE rn <= $${iCap}
        ORDER BY type, rn
        LIMIT $${iLim}
        `,
        params,
      )
      rows = r
    } else {
      params.push(limit, offset)
      const orderBy = cursor && !hasBbox ? 'l.name ASC, l.id ASC' : 'l.name ASC'
      const { rows: r } = await pool.query(
        `
        SELECT ${selectCols}
        ${fromSql}
        ${whereSql}
        ORDER BY ${orderBy}
        LIMIT $${params.length - 1} OFFSET $${params.length}
        `,
        params,
      )
      rows = r
    }

    const elapsed = Date.now() - t0
    if (elapsed >= SLOW_MS) {
      console.warn(
        `[locations] slow query ${elapsed}ms city=${city} limit=${limit} zoom=${zoom} bbox=${hasBbox}`,
      )
    }

    const mapper = fullFields ? mapFullRow : mapLeanRow
    return Response.json({
      success: true,
      data: rows.map((r) => {
        if (!fullFields) return mapper(r)
        return mapper({
          ...r,
          lastUpdated: r.lastUpdated ? new Date(r.lastUpdated as string).toISOString() : null,
          createdAt: r.createdAt ? new Date(r.createdAt as string).toISOString() : undefined,
          updatedAt: r.updatedAt ? new Date(r.updatedAt as string).toISOString() : undefined,
        })
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: total == null ? null : Math.max(Math.ceil(total / limit), 1),
        nextCursor:
          !hasBbox && rows.length
            ? encodeURIComponent(`${rows[rows.length - 1].name}|${rows[rows.length - 1].id}`)
            : null,
      },
      meta: {
        zoom,
        densityMode: typeCap != null,
        elapsedMs: elapsed,
        fields: fullFields ? 'full' : 'lean',
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
