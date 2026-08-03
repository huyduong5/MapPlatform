/** Shared reverse-geocode for thin addresses ($0 Photon / Nominatim). */

import type { Pool } from 'pg'
import { isThinAddress } from '@/lib/openingHours'

const UA =
  process.env.GEOCODER_USER_AGENT ||
  'MapPlatform-VinSmartFuture/1.0 (contact: dev@example.com)'

const MIN_NOMINATIM_MS = Number(process.env.NOMINATIM_MIN_INTERVAL_MS || '1100')
let lastNominatimAt = 0

type NominatimAddress = {
  house_number?: string
  road?: string
  pedestrian?: string
  suburb?: string
  neighbourhood?: string
  quarter?: string
  city_district?: string
  district?: string
  county?: string
  city?: string
  town?: string
  village?: string
  state?: string
  postcode?: string
  country?: string
}

/** Round to ~11m so nearby clicks share one reverse cache entry. */
export function roundCoord(n: number, digits = 4): number {
  const f = 10 ** digits
  return Math.round(n * f) / f
}

function buildFromNominatimParts(addr: NominatimAddress): string | null {
  const street = [addr.house_number, addr.road || addr.pedestrian].filter(Boolean).join(' ')
  const parts = [
    street || null,
    addr.suburb || addr.neighbourhood || addr.quarter,
    addr.city_district || addr.district || addr.county,
    addr.city || addr.town || addr.village || addr.state,
    addr.postcode,
    addr.country || 'Việt Nam',
  ].filter((p) => p && String(p).trim())
  if (parts.length < 2) return null
  return parts.join(', ')
}

function pickUsableAddress(...candidates: Array<string | null | undefined>): string | null {
  for (const c of candidates) {
    if (!c) continue
    const t = c.trim()
    if (!t) continue
    if (!isThinAddress(t) || t.length > 25) return t
  }
  return null
}

async function reversePhoton(lat: number, lng: number): Promise<string | null> {
  const photonBase = (
    process.env.PHOTON_REVERSE_URL || 'https://photon.komoot.io/reverse'
  ).replace(/\/?$/, '')
  const url = new URL(photonBase)
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lng))
  // Photon public instance: default|de|en|fr only (not vi)
  url.searchParams.set('lang', 'en')
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': UA,
      'Accept-Language': 'vi,en;q=0.8',
    },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) {
    console.warn('[reverseGeocode] photon', res.status)
    return null
  }
  const json = (await res.json()) as {
    features?: Array<{ properties?: Record<string, string> }>
  }
  const p = json.features?.[0]?.properties
  if (!p) return null
  const parts = [
    [p.housenumber, p.street].filter(Boolean).join(' '),
    p.district || p.suburb || p.locality || p.neighbourhood,
    p.city || p.county || p.state,
    p.country || 'Việt Nam',
  ].filter((x) => x && String(x).trim())
  return pickUsableAddress(parts.join(', '), p.name)
}

async function reverseNominatim(lat: number, lng: number): Promise<string | null> {
  const elapsed = Date.now() - lastNominatimAt
  if (elapsed < MIN_NOMINATIM_MS) {
    await new Promise((r) => setTimeout(r, MIN_NOMINATIM_MS - elapsed))
  }
  const nominatim =
    process.env.NOMINATIM_REVERSE_URL ||
    'https://nominatim.openstreetmap.org/reverse'
  const url = new URL(nominatim)
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lng))
  url.searchParams.set('format', 'json')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('accept-language', 'vi')
  lastNominatimAt = Date.now()
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': UA,
      'Accept-Language': 'vi,en;q=0.8',
      // Public Nominatim rejects bare undici clients without browser-like hints
      Referer: process.env.GEOCODER_REFERER || 'https://localhost/',
    },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) {
    console.warn(
      '[reverseGeocode] nominatim',
      res.status,
      await res.text().catch(() => ''),
    )
    return null
  }
  const json = (await res.json()) as {
    display_name?: string
    address?: NominatimAddress
  }
  const built = json.address ? buildFromNominatimParts(json.address) : null
  return pickUsableAddress(built, json.display_name)
}

export type ReverseResult = { address: string; provider: string }

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<ReverseResult | null> {
  try {
    const fromPhoton = await reversePhoton(lat, lng)
    if (fromPhoton) return { address: fromPhoton, provider: 'reverse-photon' }
  } catch (e) {
    console.warn('[reverseGeocode] photon error', e)
  }
  try {
    const fromNom = await reverseNominatim(lat, lng)
    if (fromNom) return { address: fromNom, provider: 'reverse-nominatim' }
    return null
  } catch (e) {
    console.warn('[reverseGeocode] nominatim error', e)
    return null
  }
}

/** Look up a prior reverse result near this point (≈11m grid). */
export async function getReverseCache(
  pool: Pool,
  lat: number,
  lng: number,
): Promise<string | null> {
  const rLat = roundCoord(lat)
  const rLng = roundCoord(lng)
  try {
    const { rows } = await pool.query(
      `
      SELECT address_normalized
      FROM geocode_cache
      WHERE provider LIKE 'reverse%'
        AND round(latitude::numeric, 4) = $1::numeric
        AND round(longitude::numeric, 4) = $2::numeric
      LIMIT 1
      `,
      [rLat, rLng],
    )
    return rows[0]?.address_normalized ? String(rows[0].address_normalized) : null
  } catch {
    return null
  }
}

/** Persist reverse result for lat/lng reuse (+ forward key = address). */
export async function setReverseCache(
  pool: Pool,
  lat: number,
  lng: number,
  address: string,
  provider: string,
): Promise<void> {
  const rLat = roundCoord(lat)
  const rLng = roundCoord(lng)
  const key = address.trim()
  if (!key) return
  try {
    await pool.query(
      `
      INSERT INTO geocode_cache (address_normalized, latitude, longitude, provider)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (address_normalized) DO NOTHING
      `,
      [key, rLat, rLng, provider.startsWith('reverse') ? provider : `reverse-${provider}`],
    )
  } catch (e) {
    console.warn('[reverseGeocode] cache write failed', e)
  }
}
