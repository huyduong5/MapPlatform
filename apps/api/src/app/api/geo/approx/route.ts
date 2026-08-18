import { NextResponse } from 'next/server'

function clientIp(req: Request): string | null {
  const xf = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const xr = req.headers.get('x-real-ip')?.trim()
  const ip = xf || xr || null
  if (!ip) return null
  if (ip === '::1' || ip === '127.0.0.1' || ip.startsWith('127.') || ip.startsWith('::ffff:127.')) {
    return null
  }
  if (
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  ) {
    return null
  }
  return ip
}

type Approx = {
  latitude: number
  longitude: number
  accuracy: number
  label: string
  source: 'ip'
}

/**
 * Approximate location from public IP when the browser Geolocation network
 * provider fails (common on Linux / VN networks: "Failed to query location
 * from network service") even though permission is granted.
 */
async function lookupApprox(ip: string | null): Promise<Approx | null> {
  // ipwho.is — HTTPS, no key for low volume
  const url = ip ? `https://ipwho.is/${encodeURIComponent(ip)}` : 'https://ipwho.is/'
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8_000),
    cache: 'no-store',
  })
  if (!res.ok) return null
  const data = (await res.json()) as {
    success?: boolean
    latitude?: number
    longitude?: number
    city?: string
    region?: string
    country_code?: string
  }
  if (data.success === false) return null
  const latitude = Number(data.latitude)
  const longitude = Number(data.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude === 0 && longitude === 0) return null

  const parts = [data.city, data.region, data.country_code].filter(Boolean)
  return {
    latitude,
    longitude,
    // IP geolocation is city-level at best
    accuracy: 25_000,
    label: parts.length ? parts.join(', ') : 'ước lượng theo IP',
    source: 'ip',
  }
}

export async function GET(req: Request) {
  try {
    const ip = clientIp(req)
    const approx = await lookupApprox(ip)
    if (!approx) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'GEO_UNAVAILABLE',
            message: 'Could not approximate location from IP',
          },
        },
        { status: 503 },
      )
    }
    return NextResponse.json({ success: true, data: approx })
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'GEO_UNAVAILABLE',
          message: e instanceof Error ? e.message : 'lookup failed',
        },
      },
      { status: 503 },
    )
  }
}
