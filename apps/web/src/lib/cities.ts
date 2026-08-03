/** Mirror of API city registry for the web app */
export type CityCode = 'hanoi' | 'hcm' | 'danang' | 'haiphong' | 'cantho' | 'hue'

export type CityBbox = {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

export type CityMeta = {
  code: CityCode
  name: string
  latitude: number
  longitude: number
  zoom: number
  bbox: CityBbox
}

export const CITIES: Record<CityCode, CityMeta> = {
  hanoi: {
    code: 'hanoi',
    name: 'Hà Nội',
    latitude: 21.0285,
    longitude: 105.8542,
    zoom: 12,
    bbox: { minLat: 20.53, maxLat: 21.23, minLng: 105.29, maxLng: 106.02 },
  },
  hcm: {
    code: 'hcm',
    name: 'Hồ Chí Minh',
    latitude: 10.7769,
    longitude: 106.7009,
    zoom: 12,
    bbox: { minLat: 10.65, maxLat: 10.9, minLng: 106.55, maxLng: 106.85 },
  },
  danang: {
    code: 'danang',
    name: 'Đà Nẵng',
    latitude: 16.0544,
    longitude: 108.2022,
    zoom: 12,
    bbox: { minLat: 15.95, maxLat: 16.15, minLng: 108.1, maxLng: 108.3 },
  },
  haiphong: {
    code: 'haiphong',
    name: 'Hải Phòng',
    latitude: 20.8449,
    longitude: 106.6881,
    zoom: 12,
    bbox: { minLat: 20.7, maxLat: 20.95, minLng: 106.55, maxLng: 106.85 },
  },
  cantho: {
    code: 'cantho',
    name: 'Cần Thơ',
    latitude: 10.0452,
    longitude: 105.7469,
    zoom: 12,
    bbox: { minLat: 9.95, maxLat: 10.15, minLng: 105.65, maxLng: 105.85 },
  },
  hue: {
    code: 'hue',
    name: 'Huế',
    latitude: 16.4637,
    longitude: 107.5909,
    zoom: 12,
    bbox: { minLat: 16.35, maxLat: 16.55, minLng: 107.45, maxLng: 107.7 },
  },
}

export function parseCity(v: string | null | undefined): CityCode {
  if (
    v === 'hcm' ||
    v === 'danang' ||
    v === 'hanoi' ||
    v === 'haiphong' ||
    v === 'cantho' ||
    v === 'hue'
  ) {
    return v
  }
  return 'hanoi'
}

export function cityContains(city: CityCode, lat: number, lng: number): boolean {
  const b = CITIES[city].bbox
  return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng
}
