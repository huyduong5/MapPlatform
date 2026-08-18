'use client'

import { useState } from 'react'
import type { LocationDetail, LocationSummary } from '@/types/location'
import { CITIES, parseCity } from '@/lib/cities'
import { friendlySourceLabel, isRealPoiName, starsLabel } from '@/lib/placeFormat'
import { LAYER_LABELS } from '@/components/map/layerMeta'
import type { LayerKey } from '@/components/LayerControl'

function isDetail(loc: LocationSummary | LocationDetail): loc is LocationDetail {
  return (
    'displayAddress' in loc ||
    'cityName' in loc ||
    'hoursTodayLabel' in loc ||
    'website' in loc ||
    'rating' in loc
  )
}

function typeLabelOf(type: string): string {
  if (type in LAYER_LABELS) return LAYER_LABELS[type as LayerKey]
  return type
}

export function LocationDetailPanel({
  location,
  onClose,
  shareUrl,
  loading,
}: {
  location: LocationSummary | LocationDetail
  onClose: () => void
  shareUrl?: string
  loading?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const gmaps = `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`
  const detail = isDetail(location) ? location : null
  const cityCode = parseCity(String(location.city || 'hanoi'))
  const cityName = detail?.cityName || CITIES[cityCode]?.name || String(location.city || '')
  const address =
    detail?.displayAddress ||
    detail?.addressNormalized ||
    location.address ||
    cityName
  const sourceLabel =
    detail?.sourceLabel || friendlySourceLabel(location.source || null)
  const hoursLabel = detail?.hoursTodayLabel
  const openingRaw = location.openingHours || detail?.openingHours
  const rating = detail?.rating
  const ratingCount = detail?.ratingCount

  if (!isRealPoiName(location.name)) {
    return (
      <aside className="map-sheet map-sheet--detail" aria-label="Chi tiết địa điểm">
        <div className="ld-top">
          <h2>Địa điểm không khả dụng</h2>
          <button type="button" className="ld-close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </div>
        <p className="ld-muted">
          Địa điểm này chưa có tên hợp lệ trên bản đồ (dữ liệu OSM thiếu tên).
        </p>
      </aside>
    )
  }

  const onShare = async () => {
    if (!shareUrl) return
    try {
      if (navigator.share) {
        await navigator.share({ title: location.name, url: shareUrl })
        return
      }
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* user cancelled share */
    }
  }

  return (
    <aside className="map-sheet map-sheet--detail" aria-label="Chi tiết địa điểm">
      <p className="ld-type">{typeLabelOf(location.type)}</p>
      <div className="ld-top">
        <div>
          <h2>{location.name}</h2>
          {detail?.brand && detail.brand !== location.name ? (
            <p className="ld-brand">{detail.brand}</p>
          ) : null}
        </div>
        <button type="button" className="ld-close" onClick={onClose} aria-label="Đóng">
          ×
        </button>
      </div>

      {loading && <p className="ld-muted">Đang tải chi tiết…</p>}

      {typeof rating === 'number' && rating > 0 ? (
        <p aria-label={`Đánh giá ${rating}`} style={{ margin: '8px 0', fontSize: '0.9rem' }}>
          {starsLabel(rating, ratingCount)}
        </p>
      ) : (
        !loading && (
          <p className="ld-muted" style={{ margin: '8px 0' }}>
            Chưa có đánh giá ·{' '}
            <a href={gmaps} target="_blank" rel="noreferrer">
              Xem trên Google Maps
            </a>
          </p>
        )
      )}

      <p className="ld-address">{address}</p>
      {cityName && <p className="ld-muted">{cityName}, Việt Nam</p>}

      {hoursLabel ? (
        <p
          style={{
            margin: '8px 0',
            fontSize: '0.85rem',
            color: detail?.openNow ? '#166534' : '#9a3412',
            fontWeight: 600,
          }}
        >
          {hoursLabel}
        </p>
      ) : openingRaw ? (
        <p className="ld-muted" style={{ margin: '8px 0' }}>
          Giờ: {openingRaw}
        </p>
      ) : null}

      {location.phone && (
        <p style={{ margin: '6px 0', fontSize: '0.9rem' }}>
          ĐT:{' '}
          <a href={`tel:${location.phone.replace(/\s+/g, '')}`}>{location.phone}</a>
        </p>
      )}
      {detail?.website && (
        <p style={{ margin: '6px 0', fontSize: '0.9rem' }}>
          Web:{' '}
          <a href={detail.website} target="_blank" rel="noreferrer">
            {detail.website.replace(/^https?:\/\//, '')}
          </a>
        </p>
      )}

      {typeof location.distanceKm === 'number' && (
        <p className="ld-muted">Cách ~ {location.distanceKm} km</p>
      )}

      <p className="ld-muted" style={{ marginTop: 8 }}>
        Nguồn: {sourceLabel}
        {location.sourceUrl ? (
          <>
            {' · '}
            <a href={location.sourceUrl} target="_blank" rel="noreferrer">
              OSM
            </a>
          </>
        ) : null}
      </p>

      <div className="ld-actions">
        <a className="primary" href={gmaps} target="_blank" rel="noreferrer">
          Chỉ đường
        </a>
        {shareUrl && (
          <button type="button" onClick={() => void onShare()}>
            {copied ? 'Đã copy' : 'Chia sẻ'}
          </button>
        )}
      </div>
    </aside>
  )
}

/** Back-compat export name used by page.tsx */
export { LocationDetailPanel as LocationDetail }
