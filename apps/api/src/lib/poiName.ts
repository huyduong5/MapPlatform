/** POI display-name quality (reject synthetic OSM placeholders on public APIs). */

import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'

const SYNTHETIC_OSM_RE = / OSM #\d+$/i
const SINGLE_LETTER_RE = /^[A-Za-z]$/

export function isSyntheticOsmName(name: string | null | undefined): boolean {
  if (!name) return false
  return SYNTHETIC_OSM_RE.test(String(name).trim())
}

export function isRealPoiName(name: string | null | undefined): boolean {
  if (!name || !String(name).trim()) return false
  const n = String(name).trim()
  if (isSyntheticOsmName(n)) return false
  if (n.length < 4) return false
  if (SINGLE_LETTER_RE.test(n)) return false
  return true
}

/** SQL predicate for rows safe to show on the consumer map. */
export function buildDisplayableNameFilter(alias = 'l'): string {
  const n = `${alias}.name`
  return `(
    ${n} !~ ' OSM #[0-9]+$'
    AND length(trim(${n})) >= 4
    AND trim(${n}) !~ '^[A-Za-z]$'
  )`
}

/**
 * `?includeUnnamed=1` bypasses the displayable-name filter (admin only).
 * Returns Response when auth fails; otherwise boolean.
 */
export function wantsIncludeUnnamed(req: NextRequest): boolean | Response {
  const raw = req.nextUrl.searchParams.get('includeUnnamed')
  if (!raw || raw === '0' || raw === 'false' || raw === 'no') return false
  const denied = requireAdmin(req)
  if (denied) return denied
  return true
}
