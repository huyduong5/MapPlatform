import type { NextRequest } from 'next/server'
import { getPool } from '@/lib/db'
import { CITIES, parseCity } from '@/lib/cities'
import {
  friendlySourceLabel,
  isThinAddress,
  parseOpeningHours,
} from '@/lib/openingHours'
import {
  getReverseCache,
  reverseGeocode,
  setReverseCache,
} from '@/lib/reverseGeocode'
import { isRealPoiName, wantsIncludeUnnamed } from '@/lib/poiName'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const includeUnnamedParam = wantsIncludeUnnamed(req)
    if (includeUnnamedParam instanceof Response) return includeUnnamedParam
    const includeUnnamed = includeUnnamedParam === true

    const { id } = await ctx.params
    const pool = getPool()
    const { rows } = await pool.query(
      `
      SELECT
        l.id::text AS id,
        l.name,
        l.type,
        l.address,
        l.address_normalized AS "addressNormalized",
        l.latitude,
        l.longitude,
        l.status,
        l.city,
        l.phone,
        l.opening_hours AS "openingHours",
        l.website,
        l.brand,
        l.rating,
        l.rating_count AS "ratingCount",
        l.rating_source AS "ratingSource",
        l.enriched_at AS "enrichedAt",
        s.name AS source,
        l.source_url AS "sourceUrl",
        l.last_updated AS "lastUpdated",
        l.created_at AS "createdAt",
        l.updated_at AS "updatedAt"
      FROM locations l
      LEFT JOIN sources s ON s.id = l.source_id
      WHERE l.id::text = $1
      LIMIT 1
      `,
      [id],
    )

    if (!rows[0]) {
      return Response.json(
        {
          success: false,
          error: { code: 'LOCATION_NOT_FOUND', message: 'Location not found' },
        },
        { status: 404 },
      )
    }

    const row = rows[0] as Record<string, unknown>
    const poiName = String(row.name || '')
    if (!includeUnnamed && !isRealPoiName(poiName)) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'UNNAMED_POI',
            message: 'Location has no valid display name',
          },
        },
        { status: 404 },
      )
    }

    const cityCode = parseCity(String(row.city || 'hanoi'))
    const cityName = CITIES[cityCode]?.name || String(row.city)

    let addressNormalized =
      (row.addressNormalized as string | null) ||
      (row.address_normalized as string | null) ||
      null
    const address = String(row.address || '')
    const displayAddress = addressNormalized || address

    // On-demand reverse-geocode when address is thin and not yet normalized
    const recentlyTried =
      Boolean(row.enrichedAt) &&
      Date.now() - new Date(String(row.enrichedAt)).getTime() < 60_000
    const needsEnrich =
      isThinAddress(displayAddress) &&
      !(row.addressNormalized || row.address_normalized) &&
      Number.isFinite(Number(row.latitude)) &&
      Number.isFinite(Number(row.longitude)) &&
      !recentlyTried

    let enrichedAtIso: string | null = row.enrichedAt
      ? new Date(row.enrichedAt as string).toISOString()
      : null

    if (needsEnrich) {
      const lat = Number(row.latitude)
      const lng = Number(row.longitude)
      let reversed = await getReverseCache(pool, lat, lng)
      let provider = 'reverse-cache'
      if (!reversed) {
        const result = await reverseGeocode(lat, lng)
        if (result) {
          reversed = result.address
          provider = result.provider
          await setReverseCache(pool, lat, lng, reversed, provider)
        }
      }
      if (reversed) {
        addressNormalized = reversed
        try {
          await pool.query(
            `
            UPDATE locations SET
              address_normalized = $2,
              enriched_at = now(),
              updated_at = now()
            WHERE id::text = $1
            `,
            [id, reversed],
          )
          enrichedAtIso = new Date().toISOString()
        } catch (e) {
          console.warn('[locations/:id] enrich persist failed', e)
        }
      } else {
        try {
          await pool.query(
            `UPDATE locations SET enriched_at = now() WHERE id::text = $1`,
            [id],
          )
          enrichedAtIso = new Date().toISOString()
        } catch {
          /* ignore */
        }
      }
    }

    const hours = parseOpeningHours(
      (row.openingHours as string) || (row.opening_hours as string) || null,
    )
    const sourceRaw = (row.source as string) || null

    return Response.json({
      success: true,
      data: {
        id: String(row.id),
        name: String(row.name),
        type: String(row.type),
        address,
        addressNormalized,
        displayAddress: addressNormalized || address,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        status: String(row.status),
        city: cityCode,
        cityName,
        phone: (row.phone as string) ?? null,
        openingHours: (row.openingHours as string) ?? null,
        openNow: hours.openNow,
        hoursTodayLabel: hours.todayLabel,
        website: (row.website as string) ?? null,
        brand: (row.brand as string) ?? null,
        rating: row.rating != null ? Number(row.rating) : null,
        ratingCount: row.ratingCount != null ? Number(row.ratingCount) : null,
        ratingSource: (row.ratingSource as string) ?? null,
        source: sourceRaw,
        sourceLabel: friendlySourceLabel(sourceRaw),
        sourceUrl: (row.sourceUrl as string) ?? null,
        lastUpdated: row.lastUpdated
          ? new Date(row.lastUpdated as string).toISOString()
          : null,
        createdAt: row.createdAt ? new Date(row.createdAt as string).toISOString() : null,
        updatedAt: row.updatedAt ? new Date(row.updatedAt as string).toISOString() : null,
        enrichedAt: enrichedAtIso,
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
