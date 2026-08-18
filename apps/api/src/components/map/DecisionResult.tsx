'use client'

import { useEffect, useRef } from 'react'
import type { DecideResult } from '@/services/decisionApi'

const PURPOSE_LABEL: Record<string, string> = {
  leisure: 'Vui chơi',
  navigate: 'Chỉ đường',
  need_urgent: 'Khẩn cấp',
  need_normal: 'Nhu cầu',
}

const MODE_LABEL: Record<string, string> = {
  drive: 'Ô tô',
  moto: 'Xe máy',
  walk: 'Đi bộ',
  bike: 'Xe đạp',
  transit: 'Bus / Metro',
}

function renderBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    const m = part.match(/^\*\*([^*]+)\*\*$/)
    if (m) return <strong key={i}>{m[1]}</strong>
    return <span key={i}>{part}</span>
  })
}

export function DecisionResult({
  result,
  activeRouteId,
  activeRoutePersona,
  onSelectRecommendation,
  onSelectRoutePersona,
}: {
  result: DecideResult
  activeRouteId?: string | null
  activeRoutePersona?: 'fastest' | 'smart' | 'experience'
  onSelectRecommendation?: (id: string) => void
  onSelectRoutePersona?: (persona: 'fastest' | 'smart' | 'experience') => void
}) {
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (!activeRouteId || !listRef.current) return
    const el = listRef.current.querySelector(`[data-pick-id="${activeRouteId}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeRouteId])

  const purpose = result.tripPurpose || result.intent.tripPurpose
  const mode = result.travelMode

  return (
    <div className="dr-result">
      <div className="dr-summary">
        <div className="dr-summary-badges">
          {purpose ? (
            <span className="dr-badge">{PURPOSE_LABEL[purpose] || purpose}</span>
          ) : null}
          {mode ? <span className="dr-badge dr-badge--muted">{MODE_LABEL[mode] || mode}</span> : null}
        </div>
        <p className="dr-explain">{renderBold(result.explanation)}</p>
        {result.destination && (
          <div className="dr-dest">Đích: {result.destination.label}</div>
        )}
      </div>

      {result.routingDegraded && (
        <p className="dr-warn">
          Tuyến đang ước lượng (chưa snap mạng đường). Bấm «Chỉ đường» để xem trên Google Maps.
        </p>
      )}
      {result.transitDegraded && (
        <p className="dr-warn">Transit ước lượng — mở «Chỉ đường» để xem bus/metro trên Maps.</p>
      )}

      <ul className="dr-picks" ref={listRef}>
        {result.recommendations.map((r) => {
          const dist =
            r.roadDistanceKm != null
              ? `~${r.roadDistanceKm.toFixed(1)} km`
              : `${r.distanceKm.toFixed(1)} km`
          const eta = r.etaMinutes != null ? Math.round(r.etaMinutes) : null
          const active = activeRouteId === r.id
          const routes = r.routes?.length ? r.routes : null
          const urgentSingle =
            result.tripPurpose === 'need_urgent' || (routes && routes.length === 1)

          return (
            <li key={r.id} className={`dr-pick${active ? ' active' : ''}`} data-pick-id={r.id}>
              <button
                type="button"
                className="dr-pick-btn"
                onClick={() => onSelectRecommendation?.(r.id)}
              >
                <span className="dr-rank">{r.rank}</span>
                <div>
                  <p className="dr-pick-name">{r.name}</p>
                  {result.recommendationMode === 'destination' ? (
                    <span className="dr-tag">Điểm đến</span>
                  ) : null}
                  {r.reasons.length > 0 && (
                    <div className="dr-tags">
                      {r.reasons.slice(0, 3).map((reason) => (
                        <span key={reason} className="dr-tag">
                          {reason}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="dr-pick-metrics">
                  {eta != null ? <span className="dr-eta">{eta}′</span> : null}
                  <span className="dr-dist">{dist}</span>
                </div>
              </button>

              {routes && active && (
                <div className="dr-routes">
                  {routes.map((opt) => {
                    const on =
                      (activeRoutePersona || 'fastest') === opt.persona ||
                      (Boolean(urgentSingle) && opt.persona === 'fastest')
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        className={`dr-route${on ? ' on' : ''}`}
                        onClick={() => onSelectRoutePersona?.(opt.persona)}
                      >
                        <div className="dr-route-head">
                          <strong>{opt.label}</strong>
                          <span>
                            ~{Math.round(opt.etaMinutes)}′ · {opt.distanceKm.toFixed(1)} km
                          </span>
                        </div>
                        {opt.hook && (
                          <div className="dr-hook">
                            <em>{opt.hook.title}</em>
                            <span>{opt.hook.detail}</span>
                          </div>
                        )}
                        {opt.deltas?.highlight && opt.persona !== 'fastest' && (
                          <div className="dr-delta">{opt.deltas.highlight}</div>
                        )}
                        {opt.badges && opt.badges.length > 0 && (
                          <div className="dr-chips">
                            {opt.badges.map((b) => (
                              <span key={b} className="dr-tag">
                                {b}
                              </span>
                            ))}
                          </div>
                        )}
                        {opt.amenities && opt.amenities.length > 0 && (
                          <div className="dr-chips">
                            {opt.amenities.slice(0, 4).map((a) => (
                              <span key={a.id} className="dr-tag">
                                {a.name}
                              </span>
                            ))}
                          </div>
                        )}
                        {on && opt.steps && opt.steps.length > 0 && (
                          <details className="dr-turns">
                            <summary>Hướng dẫn rẽ ({Math.min(opt.steps.length, 12)} bước)</summary>
                            <ol>
                              {opt.steps.slice(0, 12).map((s, i) => (
                                <li key={`${opt.id}-step-${i}`}>
                                  {s.instruction}
                                  {s.distanceM != null && s.distanceM > 0
                                    ? ` · ${
                                        s.distanceM >= 1000
                                          ? `${(s.distanceM / 1000).toFixed(1)} km`
                                          : `${Math.round(s.distanceM)} m`
                                      }`
                                    : ''}
                                </li>
                              ))}
                            </ol>
                          </details>
                        )}
                        <a
                          className="dr-dir"
                          href={opt.directionsUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Chỉ đường trên Maps →
                        </a>
                      </button>
                    )
                  })}
                </div>
              )}

              {!routes && r.directionsUrl && (
                <div style={{ padding: '0 12px 12px' }}>
                  <a className="dr-dir" href={r.directionsUrl} target="_blank" rel="noreferrer">
                    Chỉ đường trên Maps →
                  </a>
                </div>
              )}
              {active && !routes && (
                <p className="dw-hint" style={{ padding: '0 12px 12px' }}>
                  Chưa có hình học tuyến — thử lại hoặc mở Chỉ đường.
                </p>
              )}
            </li>
          )
        })}
      </ul>

      {process.env.NODE_ENV === 'development' && (
        <details className="dr-tech">
          <summary>Chi tiết kỹ thuật</summary>
          <p>
            Purpose: {result.tripPurpose || result.intent.tripPurpose || '—'} · Mode:{' '}
            {result.travelMode || '—'} · xe: {result.vehicle?.kind || '—'} · neo:{' '}
            {result.anchor.label} · route: {result.routingProvider || '—'} · NLU:{' '}
            {result.intent.source}
          </p>
        </details>
      )}
    </div>
  )
}
