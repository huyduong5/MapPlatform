import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
]

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

function clientKey(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return fwd || req.headers.get('x-real-ip') || 'local'
}

function rateLimit(req: NextRequest): NextResponse | null {
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000)
  const max = Number(process.env.RATE_LIMIT_MAX || 120)
  if (!Number.isFinite(windowMs) || !Number.isFinite(max) || max <= 0) return null

  const now = Date.now()
  const key = `${clientKey(req)}:${req.nextUrl.pathname}`
  const cur = buckets.get(key)
  if (!cur || cur.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return null
  }
  cur.count += 1
  if (cur.count > max) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'TOO_MANY_REQUESTS', message: 'Rate limit exceeded' },
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((cur.resetAt - now) / 1000)),
        },
      },
    )
  }
  return null
}

export function middleware(req: NextRequest) {
  // Skip rate limit for CORS preflight
  if (req.method !== 'OPTIONS') {
    const limited = rateLimit(req)
    if (limited) return limited
  }

  const origin = req.headers.get('origin') || ''
  const allowed = (process.env.CORS_ORIGINS || DEFAULT_ORIGINS.join(','))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const res =
    req.method === 'OPTIONS'
      ? new NextResponse(null, { status: 204 })
      : NextResponse.next()

  if (origin && allowed.includes(origin)) {
    res.headers.set('Access-Control-Allow-Origin', origin)
    res.headers.set('Vary', 'Origin')
    res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS')
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-token')
  }

  return res
}

export const config = {
  matcher: '/api/:path*',
}
