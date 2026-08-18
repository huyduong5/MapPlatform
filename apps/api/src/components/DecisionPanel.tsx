'use client'

import { useEffect, useMemo, useState } from 'react'
import type { DecideResult, TravelMode, VehicleKind } from '@/services/decisionApi'
import type { GeolocationStatus } from '@/hooks/useGeolocation'
import { DecisionResult } from '@/components/map/DecisionResult'

const VEHICLE_OPTIONS: Array<{ kind: VehicleKind; label: string }> = [
  { kind: 'ev_car', label: 'Ô tô điện' },
  { kind: 'ev_moto', label: 'Xe máy điện' },
  { kind: 'ice_car', label: 'Ô tô xăng/dầu' },
  { kind: 'ice_moto', label: 'Xe máy xăng' },
]

const TRAVEL_OPTIONS: Array<{ mode: TravelMode; label: string; needsVehicle: boolean }> = [
  { mode: 'drive', label: 'Ô tô', needsVehicle: true },
  { mode: 'moto', label: 'Xe máy', needsVehicle: true },
  { mode: 'walk', label: 'Đi bộ', needsVehicle: false },
  { mode: 'bike', label: 'Xe đạp', needsVehicle: false },
  { mode: 'transit', label: 'Bus / Metro', needsVehicle: false },
]

const EXAMPLES: Record<VehicleKind, string[]> = {
  ev_car: [
    'Pin còn 12%, tìm trạm sạc gần nhất.',
    'Tôi muốn đi vi vu tại Hồ Hoàn Kiếm Hà Nội, đề xuất cho tôi.',
  ],
  ev_moto: [
    'Pin yếu, tìm điểm sạc xe máy quanh đây.',
    'Pin còn 15%, tìm trạm sạc gần Hồ Hoàn Kiếm.',
  ],
  ice_car: [
    'Xe tôi sắp hết xăng, đề xuất nơi đổ xăng gần nhất.',
    'Tôi muốn đi vi vu tại Hồ Hoàn Kiếm Hà Nội thì bạn đề xuất cho tôi.',
  ],
  ice_moto: [
    'Xe máy sắp hết xăng, tìm cây xăng gần nhất.',
    'Muốn đi chơi quanh Hồ Hoàn Kiếm, gợi ý giúp tôi.',
  ],
}

const MODE_EXAMPLES: Partial<Record<TravelMode, string[]>> = {
  walk: ['Đi bộ vui chơi quanh Hồ Hoàn Kiếm.', 'Tìm ATM gần Hồ Hoàn Kiếm, đi bộ.'],
  bike: ['Đạp xe dạo quanh Hồ Hoàn Kiếm.', 'Tìm chỗ đậu xe gần Times City bằng xe đạp.'],
  transit: ['Đi bus/metro tới Hồ Hoàn Kiếm vui chơi.', 'Tìm đại học gần, đi xe buýt.'],
}

function geoHint(
  status: GeolocationStatus | undefined,
  accuracy: number | undefined,
  source?: 'browser' | 'ip',
  label?: string,
): string | null {
  if (status === 'locating') return 'Đang lấy vị trí…'
  if (status === 'active' && source === 'ip') {
    return `Ước lượng IP${label ? ` · ${label}` : ''} (±${Math.round((accuracy || 25_000) / 1000)}km). GPS trình duyệt không khả dụng.`
  }
  if (status === 'active' && accuracy != null) {
    return `Đã có vị trí (±${Math.round(accuracy)}m).`
  }
  if (status === 'active') return 'Đã có vị trí của bạn.'
  if (status === 'denied') {
    return 'Trình duyệt đang chặn vị trí — mở ổ khóa URL → Site settings → Location → Allow.'
  }
  if (status === 'unavailable' || status === 'error') {
    return 'Chưa lấy được GPS. Bấm nút vị trí góc phải bản đồ.'
  }
  return null
}

export function DecisionPanel({
  onDecide,
  onClearResult,
  result,
  loading,
  onSelectRecommendation,
  onSelectRoutePersona,
  activeRouteId,
  activeRoutePersona,
  geoStatus,
  geoAccuracy,
  geoSource,
  geoLabel,
  onRequestLocation,
  defaultOpen = false,
}: {
  onDecide: (params: {
    query: string
    useMyLocation: boolean
    vehicleKind?: VehicleKind
    travelMode: TravelMode
    batteryPercent?: number
  }) => void
  /** Clear AI routes / unlock normal map browsing */
  onClearResult?: () => void
  result: DecideResult | null
  loading: boolean
  onSelectRecommendation?: (id: string) => void
  onSelectRoutePersona?: (persona: 'fastest' | 'smart' | 'experience') => void
  activeRouteId?: string | null
  activeRoutePersona?: 'fastest' | 'smart' | 'experience'
  geoStatus?: GeolocationStatus
  geoAccuracy?: number
  geoSource?: 'browser' | 'ip'
  geoLabel?: string
  onRequestLocation?: () => void
  /** Open wizard on mount (e.g. ?focus=decide) */
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [travelMode, setTravelMode] = useState<TravelMode>('drive')
  const [vehicleKind, setVehicleKind] = useState<VehicleKind | null>(null)
  const [query, setQuery] = useState('')
  const [useMyLocation, setUseMyLocation] = useState(true)
  const [gateError, setGateError] = useState<string | null>(null)

  useEffect(() => {
    if (defaultOpen) setOpen(true)
  }, [defaultOpen])

  const needsVehicle = travelMode === 'drive' || travelMode === 'moto'

  const examples = useMemo(() => {
    if (!needsVehicle) return MODE_EXAMPLES[travelMode] || []
    return vehicleKind ? EXAMPLES[vehicleKind] : []
  }, [needsVehicle, travelMode, vehicleKind])

  const locationReady = geoStatus === 'active'
  const hint = geoHint(geoStatus, geoAccuracy, geoSource, geoLabel)

  const canSubmit =
    (!needsVehicle || Boolean(vehicleKind)) &&
    query.trim().length > 0 &&
    (useMyLocation || /gần|gan|tại|tai|ở|o\s+/i.test(query))

  const exitToMap = () => {
    if (result) onClearResult?.()
    setOpen(false)
  }

  const collapseOnly = () => {
    setOpen(false)
  }

  const submit = () => {
    if (needsVehicle && !vehicleKind) {
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
    if (useMyLocation && !locationReady) {
      setGateError('Đang lấy vị trí… Bấm nút vị trí góc phải, chờ xong rồi gửi lại.')
      onRequestLocation?.()
      return
    }
    setGateError(null)
    const bat = query.match(/(\d{1,3})\s*%/)
    onDecide({
      query: query.trim(),
      useMyLocation,
      vehicleKind: needsVehicle ? vehicleKind || undefined : undefined,
      travelMode,
      batteryPercent: bat ? Number(bat[1]) : undefined,
    })
  }

  if (!open) {
    return (
      <aside
        className="map-sheet map-sheet--ai map-sheet--collapsed map-sheet--ai-cta dw-cta"
        aria-label="AI tìm đường"
      >
        {result ? (
          <>
            <h2>Đang giữ kết quả AI trên bản đồ</h2>
            <p>
              Tuyến và điểm gợi ý vẫn hiện. Mở lại để xem chi tiết, hoặc về bản đồ thường để duyệt mọi
              địa điểm.
            </p>
            <div className="dw-cta-row">
              <button type="button" className="dw-submit" onClick={() => setOpen(true)}>
                Xem lại kết quả
              </button>
              <button type="button" className="dw-btn-secondary" onClick={exitToMap}>
                Về bản đồ thường
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>Cần trợ giúp tìm đường?</h2>
            <p>
              Chọn cách đi — AI gợi ý điểm phù hợp và tuyến đường kèm tiện ích dọc đường.
            </p>
            <button type="button" className="dw-submit" onClick={() => setOpen(true)}>
              Tìm đường với AI
            </button>
          </>
        )}
      </aside>
    )
  }

  return (
    <aside className="map-sheet map-sheet--ai" aria-label="AI tìm đường">
      <div className="map-sheet-body">
        <div className="dw-title">
          <strong>Tìm đường với AI</strong>
          <div className="dw-title-actions">
            {result ? (
              <button
                type="button"
                className="dw-ghost dw-ghost-accent"
                onClick={exitToMap}
                title="Xóa tuyến AI và hiện lại mọi địa điểm"
              >
                Về bản đồ
              </button>
            ) : null}
            <button
              type="button"
              className="dw-ghost"
              onClick={collapseOnly}
              title="Thu gọn panel (giữ kết quả trên map)"
            >
              Thu gọn
            </button>
          </div>
        </div>

        <p className="dw-step">1. Bạn đi bằng gì?</p>
        <div className="dw-chips" role="radiogroup" aria-label="Phương thức di chuyển">
          {TRAVEL_OPTIONS.map((t) => (
            <button
              key={t.mode}
              type="button"
              className={travelMode === t.mode ? 'dw-chip on' : 'dw-chip'}
              aria-pressed={travelMode === t.mode}
              onClick={() => {
                setTravelMode(t.mode)
                setGateError(null)
                if (!t.needsVehicle) {
                  setVehicleKind(null)
                  setQuery((MODE_EXAMPLES[t.mode] || [])[0] || '')
                } else if (vehicleKind) {
                  setQuery(EXAMPLES[vehicleKind][0])
                }
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {needsVehicle && (
          <>
            <p className="dw-step">1b. Loại xe</p>
            <div className="dw-chips" role="radiogroup" aria-label="Loại xe">
              {VEHICLE_OPTIONS.filter((v) =>
                travelMode === 'moto' ? v.kind.includes('moto') : v.kind.includes('car'),
              ).map((v) => (
                <button
                  key={v.kind}
                  type="button"
                  className={vehicleKind === v.kind ? 'dw-chip on' : 'dw-chip'}
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
          </>
        )}

        <p className="dw-step">2. Nêu rõ nhu cầu</p>
        <textarea
          className="dw-textarea"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={3}
          placeholder="Mô tả nhu cầu bằng tiếng Việt…"
          aria-label="Câu hỏi quyết định"
          disabled={needsVehicle && !vehicleKind}
        />
        {examples.length > 0 && (
          <div className="dw-chips" style={{ marginTop: 8 }}>
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                className="dw-chip ghost"
                onClick={() => setQuery(ex)}
              >
                {ex.length > 42 ? `${ex.slice(0, 40)}…` : ex}
              </button>
            ))}
          </div>
        )}

        <p className="dw-step">3. Vị trí hiện tại</p>
        <label className="dw-check">
          <input
            type="checkbox"
            checked={useMyLocation}
            onChange={(e) => {
              const on = e.target.checked
              setUseMyLocation(on)
              setGateError(null)
              if (on && !locationReady) onRequestLocation?.()
            }}
          />
          Dùng vị trí của tôi (khuyến nghị)
        </label>

        {hint && <p className={locationReady ? 'dw-ok' : 'dw-hint'}>{hint}</p>}
        {gateError && <p className="dw-err">{gateError}</p>}

        <button
          type="button"
          className="dw-submit"
          disabled={loading || !canSubmit}
          onClick={submit}
        >
          {loading ? 'Đang phân tích…' : 'Gợi ý điểm & tuyến'}
        </button>

        {result && (
          <div style={{ marginTop: 16 }}>
            <DecisionResult
              result={result}
              activeRouteId={activeRouteId}
              activeRoutePersona={activeRoutePersona}
              onSelectRecommendation={onSelectRecommendation}
              onSelectRoutePersona={onSelectRoutePersona}
            />
            <button type="button" className="dw-btn-secondary dw-btn-block" onClick={exitToMap}>
              Xóa kết quả · về bản đồ thường
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
