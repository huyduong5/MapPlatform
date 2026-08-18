'use client'

import { TYPE_COLORS } from '@/components/mapColors'
import type { LayerKey } from '@/components/LayerControl'
import { LAYER_GROUPS, LAYER_LABELS } from '@/components/map/layerMeta'

export function LayersDrawer({
  open,
  onClose,
  visibility,
  onToggle,
  onSetAll,
}: {
  open: boolean
  onClose: () => void
  visibility: Record<LayerKey, boolean>
  onToggle: (key: LayerKey) => void
  onSetAll: (on: boolean) => void
}) {
  if (!open) return null

  return (
    <>
      <div className="map-layers-backdrop" onClick={onClose} aria-hidden />
      <aside className="map-layers-drawer map-sheet" aria-label="Lớp bản đồ" role="dialog">
        <div className="map-layers-head">
          <strong>Lớp bản đồ</strong>
          <button type="button" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </div>
        <div className="map-layers-body map-sheet-scroll">
          <div className="map-layers-actions">
            <button type="button" onClick={() => onSetAll(true)}>
              Bật tất cả
            </button>
            <button type="button" onClick={() => onSetAll(false)}>
              Tắt tất cả
            </button>
          </div>
          {LAYER_GROUPS.map((g) => (
            <div key={g.id} className="map-layer-group">
              <h4>{g.title}</h4>
              {g.keys.map((key) => (
                <label key={key} className="map-layer-row">
                  <input
                    type="checkbox"
                    checked={visibility[key]}
                    onChange={() => onToggle(key)}
                  />
                  <span
                    className="map-layer-swatch"
                    style={{ background: TYPE_COLORS[key] }}
                    aria-hidden
                  />
                  {LAYER_LABELS[key]}
                </label>
              ))}
            </div>
          ))}
        </div>
      </aside>
    </>
  )
}

export function MapFabs({
  onLocate,
  onToggleLayers,
  layersOpen,
  geoBusy,
  geoDenied,
  locateActive,
}: {
  onLocate: () => void
  onToggleLayers: () => void
  layersOpen: boolean
  geoBusy?: boolean
  geoDenied?: boolean
  locateActive?: boolean
}) {
  return (
    <div className="map-fabs">
      <button
        type="button"
        className={`map-fab${layersOpen ? ' on' : ''}`}
        onClick={onToggleLayers}
        title="Lớp bản đồ"
        aria-label="Lớp bản đồ"
        aria-pressed={layersOpen}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M12 2 2 7l10 5 10-5-10-5Z" />
          <path d="m2 17 10 5 10-5" />
          <path d="m2 12 10 5 10-5" />
        </svg>
      </button>
      <button
        type="button"
        className={`map-fab${locateActive ? ' on' : ''}${geoBusy ? ' busy' : ''}${geoDenied ? ' bad' : ''}`}
        onClick={onLocate}
        title="Vị trí của tôi"
        aria-label="Vị trí của tôi"
        aria-busy={geoBusy}
        aria-pressed={locateActive}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          <circle cx="12" cy="12" r="8" />
        </svg>
      </button>
    </div>
  )
}
