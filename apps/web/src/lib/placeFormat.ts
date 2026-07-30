/** Client-side opening-hours + address helpers (mirror of API lib). */

const DAY_KEYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const

export function isThinAddress(address: string | null | undefined): boolean {
  if (!address) return true
  const a = address.trim()
  if (a.length < 20) return true
  if (/^[^,]{2,40},\s*Việt Nam$/i.test(a)) return true
  if (/^[^,]{2,40},\s*Vietnam$/i.test(a)) return true
  return false
}

function parseTimeToMinutes(t: string): number | null {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 24 || min > 59) return null
  return h * 60 + min
}

export function parseOpeningHours(
  raw: string | null | undefined,
  now = new Date(),
): { openNow: boolean | null; todayLabel: string | null; raw: string } {
  if (!raw || !raw.trim()) return { openNow: null, todayLabel: null, raw: '' }
  const text = raw.trim()
  if (/^24\/7$/i.test(text) || /^24 hours$/i.test(text)) {
    return { openNow: true, todayLabel: 'Mở cửa 24/7', raw: text }
  }

  const dayKey = DAY_KEYS[now.getDay()]
  const minutesNow = now.getHours() * 60 + now.getMinutes()
  const segments = text.split(';').map((s) => s.trim()).filter(Boolean)
  let todayRanges: Array<{ open: number; close: number }> = []

  for (const seg of segments) {
    const m = seg.match(/^([A-Za-z,\-\s]+)\s+(.+)$/)
    if (!m) continue
    if (!dayMatches(m[1].trim(), dayKey)) continue
    const ranges: Array<{ open: number; close: number }> = []
    for (const tr of m[2].split(',')) {
      const rm = tr.trim().match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/)
      if (!rm) continue
      const open = parseTimeToMinutes(rm[1])
      const close = parseTimeToMinutes(rm[2])
      if (open == null || close == null) continue
      ranges.push({ open, close })
    }
    if (ranges.length) {
      todayRanges = ranges
      break
    }
  }

  if (!todayRanges.length) return { openNow: null, todayLabel: text, raw: text }

  const openNow = todayRanges.some((r) =>
    r.close < r.open
      ? minutesNow >= r.open || minutesNow < r.close
      : minutesNow >= r.open && minutesNow < r.close,
  )
  const fmt = (n: number) =>
    `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
  const labelParts = todayRanges.map((r) => `${fmt(r.open)}–${fmt(r.close)}`)
  return {
    openNow,
    todayLabel: openNow
      ? `Đang mở · hôm nay ${labelParts.join(', ')}`
      : `Đã đóng · hôm nay ${labelParts.join(', ')}`,
    raw: text,
  }
}

function dayMatches(daysPart: string, dayKey: string): boolean {
  for (const tok of daysPart.split(',').map((t) => t.trim()).filter(Boolean)) {
    if (tok.includes('-')) {
      const [a, b] = tok.split('-').map((x) => x.trim())
      const ia = DAY_KEYS.indexOf(a as (typeof DAY_KEYS)[number])
      const ib = DAY_KEYS.indexOf(b as (typeof DAY_KEYS)[number])
      const di = DAY_KEYS.indexOf(dayKey as (typeof DAY_KEYS)[number])
      if (ia < 0 || ib < 0 || di < 0) continue
      if (ia <= ib) {
        if (di >= ia && di <= ib) return true
      } else if (di >= ia || di <= ib) return true
    } else if (tok === dayKey) return true
  }
  return false
}

export function friendlySourceLabel(source: string | null | undefined): string {
  if (!source) return '—'
  if (source.startsWith('osm_overpass') || source.includes('openstreetmap')) return 'OpenStreetMap'
  if (source.includes('vinfast')) return 'VinFast'
  return source
}

export function starsLabel(rating: number, count?: number | null): string {
  const r = Math.round(rating * 10) / 10
  const filled = Math.round(rating)
  const stars = '★'.repeat(Math.min(5, Math.max(0, filled))) + '☆'.repeat(Math.max(0, 5 - filled))
  if (count != null && count > 0) return `${stars} ${r} (${count})`
  return `${stars} ${r}`
}

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

export function filterDisplayableLocations<T extends { name: string }>(locations: T[]): T[] {
  return locations.filter((loc) => isRealPoiName(loc.name))
}

