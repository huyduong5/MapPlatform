'use client'

import { useMemo, useState } from 'react'
import type { DecideResult, VehicleKind } from '@/services/decisionApi'

const VEHICLE_OPTIONS: Array<{ kind: VehicleKind; label: string }> = [
  { kind: 'ev_car', label: 'Ô tô điện' },
  { kind: 'ev_moto', label: 'Xe máy điện' },
  { kind: 'ice_car', label: 'Ô tô xăng/dầu' },
  { kind: 'ice_moto', label: 'Xe máy xăng' },
]

const EXAMPLES: Record<VehicleKind, string[]> = {
  ev_car: [
    'Pin còn 12%, tìm trạm sạc gần nhất.',
    'Xe gần Times City, pin 10%, tìm trạm sạc phù hợp nhất.',
  ],
  ev_moto: [
    'Pin yếu, tìm điểm sạc xe máy quanh đây.',
    'Pin còn 15%, tìm trạm sạc gần Hồ Hoàn Kiếm.',
  ],
  ice_car: [
    'Hết xăng gần Times City, tìm cây xăng.',
    'Tìm cây xăng gần Royal City.',
  ],
  ice_moto: [
    'Xe máy sắp hết xăng, tìm cây xăng gần nhất.',
    'Tìm cây xăng quanh Cầu Giấy.',
  ],
}

export function DecisionPanel({
  onDecide,
  result,
  loading,
  onSelectRecommendation,
  activeRouteId,
}: {
  onDecide: (params: {
    query: string
    useMyLocation: boolean
    vehicleKind: VehicleKind
    batteryPercent?: number
  }) => void
  result: DecideResult | null
  loading: boolean
  onSelectRecommendation?: (id: string) => void
  activeRouteId?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [vehicleKind, setVehicleKind] = useState<VehicleKind | null>(null)
  const [query, setQuery] = useState('')
  const [useMyLocation, setUseMyLocation] = useState(true)
  const [gateError, setGateError] = useState<string | null>(null)

  const examples = useMemo(
    () => (vehicleKind ? EXAMPLES[vehicleKind] : []),
    [vehicleKind],
  )

  const canSubmit =
    Boolean(vehicleKind) &&
    query.trim().length > 0 &&
    (useMyLocation || /gần|gan|tại|tai|ở|o\s+/i.test(query))

  const submit = () => {
    if (!vehicleKind) {
      setGateError('Chọn loại xe để AI đề xuất đúng điểm.')
      return
    }
    if (!query.trim()) {
      setGateError('Hãy mô tả ngắn nhu cầu của bạn.')
      return
    }
    if (!useMyLocation && !/gần|gan|tại|tai|ở/i.test(query)) {
      setGateError('Bật vị trí hoặc ghi rõ địa danh (vd. Times City) trong câu hỏi.')
      return
    }
    setGateError(null)
    const bat = query.match(/(\d{1,3})\s*%/)
    onDecide({
      query: query.trim(),
      useMyLocation,
      vehicleKind,
      batteryPercent: bat ? Number(bat[1]) : undefined,
    })
  }

  if (!open) {
    return (
      <aside className="panel cta" aria-label="AI tìm đường">
        <h2>Bạn cần trợ giúp tìm đường không?</h2>
        <p className="sub">
          Chọn loại xe, mô tả nhu cầu, rồi bật vị trí hiện tại — AI sẽ gợi ý điểm phù hợp và lộ
          trình tối ưu.
        </p>
        <button type="button" className="primary" onClick={() => setOpen(true)}>
          Tìm đường với AI
        </button>
        <style jsx>{panelStyles}</style>
      </aside>
    )
  }

  return (
    <aside className="panel" aria-label="AI tìm đường">
      <div className="title">
        <strong>Tìm đường với AI</strong>
        <button type="button" className="ghost mini" onClick={() => setOpen(false)}>
          Thu gọn
        </button>
      </div>

      <p className="step">1. Bạn đang đi xe gì?</p>
      <div className="vehicles" role="radiogroup" aria-label="Loại xe">
        {VEHICLE_OPTIONS.map((v) => (
          <button
            key={v.kind}
            type="button"
            className={vehicleKind === v.kind ? 'chip on' : 'chip'}
            aria-pressed={vehicleKind === v.kind}
            onClick={() => {
              setVehicleKind(v.kind)
              setQuery(EXAMPLES[v.kind][0])
              setGateError(null)
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      <p className="step">2. Nêu rõ nhu cầu</p>
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        rows={3}
        placeholder="Mô tả nhu cầu bằng tiếng Việt…"
        aria-label="Câu hỏi quyết định"
        disabled={!vehicleKind}
      />
      {examples.length > 0 && (
        <div className="examples">
          {examples.map((ex) => (
            <button key={ex} type="button" className="chip ghost" onClick={() => setQuery(ex)}>
              {ex.length > 42 ? `${ex.slice(0, 40)}…` : ex}
            </button>
          ))}
        </div>
      )}

      <p className="step">3. Vị trí hiện tại</p>
      <label className="check">
        <input
          type="checkbox"
          checked={useMyLocation}
          onChange={(e) => setUseMyLocation(e.target.checked)}
        />
        Bật vị trí của tôi (khuyến nghị)
      </label>

      {gateError && <p className="err">{gateError}</p>}

      <div className="row">
        <button type="button" disabled={loading || !canSubmit} onClick={submit}>
          {loading ? 'Đang phân tích…' : 'Gợi ý điểm & đường đi'}
        </button>
      </div>

      {result && (
        <div className="result">
          <p className="explain">{result.explanation.replace(/\*\*/g, '')}</p>
          <ul>
            {result.recommendations.map((r) => {
              const dist =
                r.roadDistanceKm != null
                  ? `~${r.roadDistanceKm.toFixed(1)} km đường`
                  : `${r.distanceKm.toFixed(2)} km`
              const eta =
                r.etaMinutes != null ? ` · ~${Math.round(r.etaMinutes)} phút` : ''
              const active = activeRouteId === r.id
              return (
                <li key={r.id} className={active ? 'active' : undefined}>
                  <button
                    type="button"
                    className="pick"
                    onClick={() => onSelectRecommendation?.(r.id)}
                  >
                    <span className="rank">#{r.rank}</span>
                    <div>
                      <strong>{r.name}</strong>
                      <div className="meta">
                        {dist}
                        {eta}
                      </div>
                      <div className="why">{r.reasons.slice(0, 2).join(' · ')}</div>
                    </div>
                  </button>
                  {r.directionsUrl && (
                    <a
                      className="dir"
                      href={r.directionsUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Chỉ đường
                    </a>
                  )}
                </li>
              )
            })}
          </ul>
          <div className="meta">
            Xe: {result.vehicle?.kind || '—'} · neo: {result.anchor.label} · route:{' '}
            {result.routingProvider || '—'} · NLU: {result.intent.source}
          </div>
        </div>
      )}
      <style jsx>{panelStyles}</style>
    </aside>
  )
}

const panelStyles = `
  .panel {
    position: absolute;
    z-index: 1000;
    top: 12px;
    left: 12px;
    width: min(380px, calc(100% - 24px));
    max-height: calc(100% - 24px);
    overflow: auto;
    background: rgba(255, 255, 255, 0.97);
    border: 1px solid var(--border, #d8dee6);
    border-radius: 12px;
    padding: 14px;
    box-shadow: 0 8px 24px rgba(20, 33, 43, 0.12);
  }
  .cta h2 {
    margin: 0 0 8px;
    font-size: 1.05rem;
    line-height: 1.35;
  }
  .sub {
    margin: 0 0 12px;
    font-size: 0.88rem;
    color: #4a5560;
    line-height: 1.45;
  }
  .title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .step {
    margin: 10px 0 6px;
    font-size: 0.8rem;
    font-weight: 600;
    color: #2c3640;
  }
  .vehicles, .examples {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
  }
  .chip {
    border: 1px solid #c9d2dc;
    background: #fff;
    border-radius: 999px;
    padding: 6px 10px;
    font-size: 0.78rem;
    cursor: pointer;
  }
  .chip.on {
    border-color: #0b6e4f;
    background: #e7f6ef;
    color: #0b6e4f;
    font-weight: 600;
  }
  .chip.ghost {
    background: #f4f6f8;
  }
  textarea {
    width: 100%;
    resize: vertical;
    border: 1px solid #c9d2dc;
    border-radius: 8px;
    padding: 8px;
    font: inherit;
  }
  .check {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 0.85rem;
    margin: 4px 0 8px;
  }
  .row {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }
  button.primary, .row > button {
    background: #0b6e4f;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 9px 12px;
    font-weight: 600;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .ghost {
    background: transparent;
    border: none;
    color: #4a5560;
    cursor: pointer;
  }
  .mini { font-size: 0.8rem; }
  .err {
    color: #b42318;
    font-size: 0.82rem;
    margin: 4px 0;
  }
  .result {
    margin-top: 12px;
    border-top: 1px solid #e6ebf0;
    padding-top: 10px;
  }
  .explain {
    font-size: 0.86rem;
    line-height: 1.4;
    margin: 0 0 8px;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  li {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 6px;
    align-items: start;
    padding: 8px 0;
    border-bottom: 1px solid #eef2f6;
  }
  li.active {
    background: #f0faf5;
    margin: 0 -8px;
    padding: 8px;
    border-radius: 8px;
  }
  .pick {
    display: flex;
    gap: 8px;
    text-align: left;
    border: none;
    background: transparent;
    cursor: pointer;
    padding: 0;
    font: inherit;
  }
  .rank {
    font-weight: 700;
    color: #0b6e4f;
  }
  .meta, .why {
    font-size: 0.75rem;
    color: #5b6670;
    margin-top: 2px;
  }
  .dir {
    font-size: 0.78rem;
    color: #0b6e4f;
    font-weight: 600;
    white-space: nowrap;
  }
`
