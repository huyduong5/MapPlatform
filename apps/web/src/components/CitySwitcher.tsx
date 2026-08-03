'use client'

import { CITIES, type CityCode } from '@/lib/cities'

export function CitySwitcher({
  city,
  onChange,
  counts,
}: {
  city: CityCode
  onChange: (c: CityCode) => void
  counts?: Partial<Record<CityCode, number>>
}) {
  return (
    <div className="switcher" role="group" aria-label="Chọn thành phố">
      {(Object.keys(CITIES) as CityCode[]).map((code) => {
        const meta = CITIES[code]
        const n = counts?.[code]
        const disabled = typeof n === 'number' && n === 0 && code !== 'hanoi'
        return (
          <button
            key={code}
            type="button"
            className={city === code ? 'active' : undefined}
            disabled={disabled}
            title={disabled ? 'Chưa có dữ liệu' : meta.name}
            onClick={() => onChange(code)}
          >
            {meta.name}
            {typeof n === 'number' ? <span>{n}</span> : null}
          </button>
        )
      })}
      <style jsx>{`
        .switcher {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          padding: 8px 16px;
          background: #f3f6f8;
          border-bottom: 1px solid var(--border);
        }
        button {
          padding: 6px 12px;
          border: 1px solid var(--border);
          border-radius: 999px;
          background: #fff;
          color: var(--ink);
          cursor: pointer;
          font-size: 13px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        button.active {
          background: var(--accent);
          border-color: var(--accent);
          color: #fff;
        }
        button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        span {
          font-size: 11px;
          opacity: 0.85;
        }
      `}</style>
    </div>
  )
}
