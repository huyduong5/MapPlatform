import { timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'

export function requireAdmin(req: NextRequest): Response | null {
  const expected = process.env.ADMIN_TOKEN || ''
  if (!expected || expected === 'change-me-in-production') {
    // Dev fallback: allow if NODE_ENV=development and no strict token
    if (process.env.NODE_ENV === 'production') {
      return Response.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'ADMIN_TOKEN not configured' },
        },
        { status: 401 },
      )
    }
    return null
  }

  const provided = req.headers.get('x-admin-token') || ''
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid admin token' } },
      { status: 401 },
    )
  }
  return null
}
