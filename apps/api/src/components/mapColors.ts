import type { LocationType } from '@/types/location'

/** Brand-adjacent palette — distinct per type (no Leaflet; safe for SSR). */
export const TYPE_COLORS: Record<LocationType, string> = {
  charging_station: '#0b6e4f',
  store: '#1d4ed8',
  showroom: '#7c3aed',
  service_center: '#b45309',
  dealer: '#0e7490',
  parking: '#475569',
  rescue_team: '#dc2626',
  gas_station: '#ca8a04',
  university: '#1e3a8a',
  hospital: '#be123c',
  pharmacy: '#059669',
  atm: '#64748b',
  bank: '#0369a1',
  police: '#1e40af',
  fire_station: '#ea580c',
  school: '#4f46e5',
  marketplace: '#a16207',
  bus_stop: '#0f766e',
  subway_station: '#7e22ce',
  park: '#15803d',
  tourist_attraction: '#c2410c',
}
