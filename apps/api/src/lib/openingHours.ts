/** Opening-hours helpers (OSM simple intervals) + thin-address detection. */

const DAY_KEYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const

export type OpenStatus = {
  openNow: boolean | null
  todayLabel: string | null
  raw: string
}

/** Address too thin to show as a real place card line. */
export function isThinAddress(address: string | null | undefined): boolean {
  if (!address) return true
  const a = address.trim()
  if (a.length < 20) return true
  // e.g. "Hà Nội, Việt Nam" / "Hồ Chí Minh, Việt Nam"
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

/**
 * Best-effort OSM opening_hours parser for common patterns:
 * "Mo-Fr 08:00-17:00; Sa 08:00-12:00" / "24/7" / "Mo-Su 09:00-21:00"
 */
export function parseOpeningHours(raw: string | null | undefined, now = new Date()): OpenStatus {
  if (!raw || !raw.trim()) {
    return { openNow: null, todayLabel: null, raw: '' }
  }
  const text = raw.trim()
  if (/^24\/7$/i.test(text) || /^24 hours$/i.test(text)) {
    return { openNow: true, todayLabel: 'Mở cửa 24/7', raw: text }
  }

  const dayIdx = now.getDay() // 0=Sun
  const dayKey = DAY_KEYS[dayIdx]
  const minutesNow = now.getHours() * 60 + now.getMinutes()

  const segments = text.split(';').map((s) => s.trim()).filter(Boolean)
  let todayRanges: Array<{ open: number; close: number }> = []
  let todayRaw: string | null = null

  for (const seg of segments) {
    // "Mo-Fr 08:00-17:00" or "Sa,Su 09:00-12:00" or "Mo 08:00-12:00,13:00-17:00"
    const m = seg.match(/^([A-Za-z,\-\s]+)\s+(.+)$/)
    if (!m) continue
    const daysPart = m[1].trim()
    const timesPart = m[2].trim()
    if (!dayMatches(daysPart, dayKey)) continue

    const ranges: Array<{ open: number; close: number }> = []
    for (const tr of timesPart.split(',')) {
      const rm = tr.trim().match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/)
      if (!rm) continue
      const open = parseTimeToMinutes(rm[1])
      const close = parseTimeToMinutes(rm[2])
      if (open == null || close == null) continue
      ranges.push({ open, close })
    }
    if (ranges.length) {
      todayRanges = ranges
      todayRaw = timesPart
      break
    }
  }

  if (!todayRanges.length) {
    return { openNow: null, todayLabel: text, raw: text }
  }

  const openNow = todayRanges.some((r) => {
    if (r.close < r.open) {
      // overnight
      return minutesNow >= r.open || minutesNow < r.close
    }
    return minutesNow >= r.open && minutesNow < r.close
  })

  const labelParts = todayRanges.map((r) => {
    const fmt = (n: number) =>
      `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
    return `${fmt(r.open)}–${fmt(r.close)}`
  })

  return {
    openNow,
    todayLabel: openNow
      ? `Đang mở · hôm nay ${labelParts.join(', ')}`
      : `Đã đóng · hôm nay ${labelParts.join(', ')}`,
    raw: text,
  }
}

function dayMatches(daysPart: string, dayKey: string): boolean {
  const tokens = daysPart.split(',').map((t) => t.trim()).filter(Boolean)
  for (const tok of tokens) {
    if (tok.includes('-')) {
      const [a, b] = tok.split('-').map((x) => x.trim())
      const ia = DAY_KEYS.indexOf(a as (typeof DAY_KEYS)[number])
      const ib = DAY_KEYS.indexOf(b as (typeof DAY_KEYS)[number])
      if (ia < 0 || ib < 0) continue
      if (ia <= ib) {
        if (DAY_KEYS.indexOf(dayKey as (typeof DAY_KEYS)[number]) >= ia &&
          DAY_KEYS.indexOf(dayKey as (typeof DAY_KEYS)[number]) <= ib) {
          return true
        }
      } else {
        // wrap e.g. Fr-Mo
        const di = DAY_KEYS.indexOf(dayKey as (typeof DAY_KEYS)[number])
        if (di >= ia || di <= ib) return true
      }
    } else if (tok === dayKey) {
      return true
    }
  }
  return false
}

export function friendlySourceLabel(source: string | null | undefined): string {
  if (!source) return '—'
  if (source.startsWith('osm_overpass') || source.includes('openstreetmap')) return 'OpenStreetMap'
  if (source.includes('vinfast')) return 'VinFast'
  return source
}
