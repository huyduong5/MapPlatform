import type { CityCode } from '@/lib/cities'

export type PlaceAlias = { lat: number; lng: number; label: string }

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
}

/** Hà Nội — offline aliases (stable coords). Bare «vincom» is NOT here — PlaceIndex ranks branches. */
export const HANOI_PLACE_ALIASES: Record<string, PlaceAlias> = {
  // Malls / landmarks
  'times city': { lat: 20.995, lng: 105.8682, label: 'Times City' },
  'vincom times city': { lat: 20.995, lng: 105.8682, label: 'Vincom Mega Mall Times City' },
  'vincom mega mall times city': { lat: 20.995, lng: 105.8682, label: 'Vincom Mega Mall Times City' },
  'vincom nguyễn chí thanh': { lat: 21.0072, lng: 105.8106, label: 'Vincom Center Nguyễn Chí Thanh' },
  'vincom nguyen chi thanh': { lat: 21.0072, lng: 105.8106, label: 'Vincom Center Nguyễn Chí Thanh' },
  'vincom nct': { lat: 21.0072, lng: 105.8106, label: 'Vincom Center Nguyễn Chí Thanh' },
  'vincom ba triệu': { lat: 21.0115, lng: 105.8495, label: 'Vincom Center Ba Triệu' },
  'vincom ba trieu': { lat: 21.0115, lng: 105.8495, label: 'Vincom Center Ba Triệu' },
  'vincom royal city': { lat: 21.0028, lng: 105.8155, label: 'Vincom Mega Mall Royal City' },
  'aeon mall long biên': { lat: 21.0278, lng: 105.8995, label: 'AEON Mall Long Biên' },
  'aeon mall long bien': { lat: 21.0278, lng: 105.8995, label: 'AEON Mall Long Biên' },
  'royal city': { lat: 21.0028, lng: 105.8155, label: 'Royal City' },
  'big c thắng lợi': { lat: 21.0025, lng: 105.815, label: 'Big C Thăng Lợi' },
  'big c thang loi': { lat: 21.0025, lng: 105.815, label: 'Big C Thăng Lợi' },

  // Iconic
  'hoàn kiếm': { lat: 21.0285, lng: 105.8542, label: 'Hồ Hoàn Kiếm' },
  'hoan kiem': { lat: 21.0285, lng: 105.8542, label: 'Hồ Hoàn Kiếm' },
  'hồ hoàn kiếm': { lat: 21.0285, lng: 105.8542, label: 'Hồ Hoàn Kiếm' },
  'lăng bác': { lat: 21.0368, lng: 105.8347, label: 'Lăng Chủ tịch Hồ Chí Minh' },
  'lang bac': { lat: 21.0368, lng: 105.8347, label: 'Lăng Chủ tịch Hồ Chí Minh' },
  'ga hà nội': { lat: 21.0245, lng: 105.8412, label: 'Ga Hà Nội' },
  'ga ha noi': { lat: 21.0245, lng: 105.8412, label: 'Ga Hà Nội' },
  'sân bay nội bài': { lat: 21.2187, lng: 105.8042, label: 'Sân bay Nội Bài' },
  'noi bai': { lat: 21.2187, lng: 105.8042, label: 'Sân bay Nội Bài' },
  'cầu giấy': { lat: 21.0305, lng: 105.782, label: 'Cầu Giấy' },
  'cau giay': { lat: 21.0305, lng: 105.782, label: 'Cầu Giấy' },
  'gia lâm': { lat: 21.0095, lng: 105.9382, label: 'Gia Lâm' },
  'gia lam': { lat: 21.0095, lng: 105.9382, label: 'Gia Lâm' },

  // Universities (from crawler seeds)
  'đại học khoa học tự nhiên': {
    lat: 20.9959393,
    lng: 105.8080085,
    label: 'Trường Đại học Khoa học Tự nhiên',
  },
  'dai hoc khoa hoc tu nhien': {
    lat: 20.9959393,
    lng: 105.8080085,
    label: 'Trường Đại học Khoa học Tự nhiên',
  },
  'trường đại học khoa học tự nhiên': {
    lat: 20.9959393,
    lng: 105.8080085,
    label: 'Trường Đại học Khoa học Tự nhiên',
  },
  'dh khtn': { lat: 20.9959393, lng: 105.8080085, label: 'Trường Đại học Khoa học Tự nhiên' },
  'khoa học tự nhiên': {
    lat: 20.9959393,
    lng: 105.8080085,
    label: 'Trường Đại học Khoa học Tự nhiên',
  },
  hus: { lat: 20.9959393, lng: 105.8080085, label: 'Trường Đại học Khoa học Tự nhiên' },

  'đại học quốc gia hà nội': { lat: 21.0383, lng: 105.7824, label: 'Đại học Quốc gia Hà Nội' },
  'dai hoc quoc gia ha noi': { lat: 21.0383, lng: 105.7824, label: 'Đại học Quốc gia Hà Nội' },
  'đhqghn': { lat: 21.0383, lng: 105.7824, label: 'Đại học Quốc gia Hà Nội' },
  'dhqghn': { lat: 21.0383, lng: 105.7824, label: 'Đại học Quốc gia Hà Nội' },
  'dhqg hn': { lat: 21.0383, lng: 105.7824, label: 'Đại học Quốc gia Hà Nội' },
  'vnu': { lat: 21.0383, lng: 105.7824, label: 'Đại học Quốc gia Hà Nội' },
  'vnu hanoi': { lat: 21.0383, lng: 105.7824, label: 'Đại học Quốc gia Hà Nội' },

  'đại học bách khoa hà nội': { lat: 21.0043689, lng: 105.8455332, label: 'Đại học Bách khoa Hà Nội' },
  'bach khoa': { lat: 21.0043689, lng: 105.8455332, label: 'Đại học Bách khoa Hà Nội' },
  'hust': { lat: 21.0043689, lng: 105.8455332, label: 'Đại học Bách khoa Hà Nội' },
}

export const HCM_PLACE_ALIASES: Record<string, PlaceAlias> = {
  'quận 1': { lat: 10.7769, lng: 106.7009, label: 'Quận 1' },
  'quan 1': { lat: 10.7769, lng: 106.7009, label: 'Quận 1' },
  'landmark 81': { lat: 10.7951, lng: 106.722, label: 'Landmark 81' },
  bitexco: { lat: 10.7716, lng: 106.7043, label: 'Bitexco' },
  'quận 7': { lat: 10.7295, lng: 106.7218, label: 'Quận 7' },
  'quan 7': { lat: 10.7295, lng: 106.7218, label: 'Quận 7' },
  'vincom đồng khởi': { lat: 10.778, lng: 106.7015, label: 'Vincom Center Đồng Khởi' },
  'vincom dong khoi': { lat: 10.778, lng: 106.7015, label: 'Vincom Center Đồng Khởi' },
}

export const DANANG_PLACE_ALIASES: Record<string, PlaceAlias> = {
  'cầu rồng': { lat: 16.061, lng: 108.227, label: 'Cầu Rồng' },
  'cau rong': { lat: 16.061, lng: 108.227, label: 'Cầu Rồng' },
  'sơn trà': { lat: 16.0615, lng: 108.247, label: 'Sơn Trà' },
  'son tra': { lat: 16.0615, lng: 108.247, label: 'Sơn Trà' },
  'hải châu': { lat: 16.0544, lng: 108.2022, label: 'Hải Châu' },
  'hai chau': { lat: 16.0544, lng: 108.2022, label: 'Hải Châu' },
}

const CITY_CATALOG: Partial<Record<CityCode, Record<string, PlaceAlias>>> = {
  hanoi: HANOI_PLACE_ALIASES,
  hcm: HCM_PLACE_ALIASES,
  danang: DANANG_PLACE_ALIASES,
}

/** Backward-compatible export used by intent/geocode. */
export const LANDMARK_ALIASES = HANOI_PLACE_ALIASES

export function getCityAliasTable(city: CityCode = 'hanoi'): Record<string, PlaceAlias> {
  return CITY_CATALOG[city] || HANOI_PLACE_ALIASES
}

/**
 * Resolve place from alias catalog.
 * Prefer exact / longest alias contained in the query text.
 * Never match short key via alias.includes(key) (avoids «vincom» → Times City).
 */
export function lookupPlaceAlias(
  landmark: string | null,
  city: CityCode = 'hanoi',
): { lat: number; lng: number; label: string } | null {
  if (!landmark) return null
  const key = fold(landmark).trim()
  if (!key) return null
  const table = getCityAliasTable(city)

  const exact = table[key] || table[landmark.toLowerCase().trim()]
  if (exact) return exact

  let best: { alias: string; val: PlaceAlias } | null = null
  for (const [alias, val] of Object.entries(table)) {
    const a = fold(alias)
    if (a.length < 3) continue
    // Query contains full alias (longest wins)
    if (key.includes(a)) {
      if (!best || a.length > fold(best.alias).length) best = { alias, val }
    }
  }
  if (best) return best.val

  // Abbreviation / prefix only when a single unique label matches (avoid bare «vincom» → any branch)
  if (key.length >= 3) {
    const prefixHits: PlaceAlias[] = []
    const seen = new Set<string>()
    for (const [alias, val] of Object.entries(table)) {
      const a = fold(alias)
      if (a === key || a.startsWith(`${key} `) || a.startsWith(`${key}-`)) {
        if (!seen.has(val.label)) {
          seen.add(val.label)
          prefixHits.push(val)
        }
      }
    }
    if (prefixHits.length === 1) return prefixHits[0]
  }
  return null
}

/** Longest alias label found as substring of the full user query. */
export function matchAliasInQuery(
  query: string,
  city: CityCode = 'hanoi',
): { key: string; label: string; lat: number; lng: number } | null {
  const q = fold(query)
  const table = getCityAliasTable(city)
  let best: { key: string; val: PlaceAlias } | null = null
  for (const [alias, val] of Object.entries(table)) {
    const a = fold(alias)
    if (a.length < 3) continue
    if (q.includes(a)) {
      if (!best || a.length > fold(best.key).length) best = { key: alias, val }
    }
  }
  if (!best) return null
  return { key: best.key, label: best.val.label, lat: best.val.lat, lng: best.val.lng }
}
