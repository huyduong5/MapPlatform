'use client'

import { TYPE_COLORS } from '@/components/mapIcons'

export type LayerKey =
  | 'charging_station'
  | 'store'
  | 'showroom'
  | 'service_center'
  | 'dealer'
  | 'parking'
  | 'rescue_team'
  | 'gas_station'
  | 'university'
  | 'hospital'
  | 'pharmacy'
  | 'atm'
  | 'bank'
  | 'police'
  | 'fire_station'
  | 'school'
  | 'marketplace'

const LABELS: Record<LayerKey, string> = {
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
}

export function LayerControl({
  visibility,
  onToggle,
}: {
  visibility: Record<LayerKey, boolean>
  onToggle: (key: LayerKey) => void
}) {
  return (
    <div className="layers" aria-label="layers">
      {(Object.keys(LABELS) as LayerKey[]).map((key) => (
        <label key={key}>
          <input
            type="checkbox"
            checked={visibility[key]}
            onChange={() => onToggle(key)}
          />
          <span
            className="swatch"
            style={{ background: TYPE_COLORS[key] }}
            aria-hidden
          />
          {LABELS[key]}
        </label>
      ))}
      <style jsx>{`
        .layers {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          padding: 8px 16px;
          background: var(--panel);
          border-bottom: 1px solid var(--border);
          font-size: 13px;
        }
        label {
          display: flex;
          gap: 6px;
          align-items: center;
          cursor: pointer;
        }
        .swatch {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.12);
          flex-shrink: 0;
        }
      `}</style>
    </div>
  )
}
