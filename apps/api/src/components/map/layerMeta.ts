import type { LayerKey } from '@/components/LayerControl'

export const LAYER_LABELS: Record<LayerKey, string> = {
  charging_station: 'Trạm sạc',
  store: 'Cửa hàng',
  showroom: 'Showroom',
  service_center: 'Xưởng DV',
  dealer: 'Đại lý',
  parking: 'Đỗ xe',
  rescue_team: 'Cứu hộ',
  gas_station: 'Cây xăng',
  university: 'Đại học',
  hospital: 'Bệnh viện',
  pharmacy: 'Nhà thuốc',
  atm: 'ATM',
  bank: 'Ngân hàng',
  police: 'Công an',
  fire_station: 'PCCC',
  school: 'Trường học',
  marketplace: 'Chợ/TTTM',
  bus_stop: 'Điểm bus',
  subway_station: 'Ga metro',
  park: 'Công viên',
  tourist_attraction: 'Tham quan',
}

export type LayerGroupId = 'energy' | 'vehicle' | 'safety' | 'life' | 'transit' | 'explore'

export const LAYER_GROUPS: Array<{
  id: LayerGroupId
  title: string
  keys: LayerKey[]
}> = [
  {
    id: 'energy',
    title: 'Năng lượng',
    keys: ['charging_station', 'gas_station'],
  },
  {
    id: 'vehicle',
    title: 'Xe & dịch vụ',
    keys: ['store', 'showroom', 'service_center', 'dealer', 'parking'],
  },
  {
    id: 'safety',
    title: 'An toàn',
    keys: ['rescue_team', 'police', 'fire_station', 'hospital', 'pharmacy'],
  },
  {
    id: 'life',
    title: 'Đời sống',
    keys: ['university', 'school', 'atm', 'bank'],
  },
  {
    id: 'transit',
    title: 'Giao thông',
    keys: ['bus_stop', 'subway_station'],
  },
  {
    id: 'explore',
    title: 'Khám phá',
    keys: ['marketplace', 'park', 'tourist_attraction'],
  },
]
