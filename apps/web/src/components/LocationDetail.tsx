'use client'

import { useState } from 'react'
import type { LocationDetail, LocationSummary } from '@/types/location'
import { CITIES, parseCity } from '@/lib/cities'
import { friendlySourceLabel, isRealPoiName, starsLabel } from '@/lib/placeFormat'

const typeLabel: Record<string, string> = {
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

function isDetail(loc: LocationSummary | LocationDetail): loc is LocationDetail {
  return (
    'displayAddress' in loc ||
    'cityName' in loc ||
    'hoursTodayLabel' in loc ||
    'website' in loc ||
    'rating' in loc
  )
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
      <aside className="panel" aria-label="Chi tiết địa điểm">
        <div className="top">
          <h2>Địa điểm không khả dụng</h2>
          <button type="button" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </div>
        <p className="muted">
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
    <aside className="panel" aria-label="Chi tiết địa điểm">
      <div className="top">
        <div>
          <h2>{location.name}</h2>
          {detail?.brand && detail.brand !== location.name ? (
            <p className="brand">{detail.brand}</p>
          ) : null}
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng">
          ×
        </button>
      </div>

      <p className="meta">{typeLabel[location.type] || location.type}</p>

      {loading && <p className="loading">Đang tải chi tiết…</p>}

      {typeof rating === 'number' && rating > 0 ? (
        <p className="rating" aria-label={`Đánh giá ${rating}`}>
          {starsLabel(rating, ratingCount)}
        </p>
      ) : (
        !loading && (
          <p className="muted rating-empty">
            Chưa có đánh giá ·{' '}
            <a href={gmaps} target="_blank" rel="noreferrer">
              Xem trên Google Maps
            </a>
          </p>
        )
      )}

      <p className="address">{address}</p>
      {cityName && <p className="muted">{cityName}, Việt Nam</p>}

      {hoursLabel ? (
        <p className={detail?.openNow ? 'hours open' : 'hours closed'}>{hoursLabel}</p>
      ) : openingRaw ? (
        <p className="hours">Giờ: {openingRaw}</p>
      ) : null}

      {location.phone && (
        <p>
          ĐT:{' '}
          <a href={`tel:${location.phone.replace(/\s+/g, '')}`}>{location.phone}</a>
        </p>
      )}
      {detail?.website && (
        <p>
          Web:{' '}
          <a href={detail.website} target="_blank" rel="noreferrer">
            {detail.website.replace(/^https?:\/\//, '')}
          </a>
        </p>
      )}

      {typeof location.distanceKm === 'number' && (
        <p>Cách ~ {location.distanceKm} km</p>
      )}

      <p className="muted">
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

      <div className="links">
        <a href={gmaps} target="_blank" rel="noreferrer">
          Mở Google Maps
        </a>
        {shareUrl && (
          <button type="button" className="share" onClick={() => void onShare()}>
            {copied ? 'Đã copy link' : 'Chia sẻ'}
          </button>
        )}
      </div>
      <style jsx>{`
        .panel {
          position: absolute;
          right: 12px;
          top: 12px;
          width: min(360px, calc(100% - 24px));
          max-height: calc(100% - 24px);
          overflow: auto;
          background: #fff;
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 14px 16px;
          z-index: 1200;
          box-shadow: 0 8px 28px rgba(0, 0, 0, 0.12);
        }
        .top {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          align-items: flex-start;
        }
        h2 {
          margin: 0;
          font-size: 18px;
          line-height: 1.3;
        }
        .brand {
          margin: 2px 0 0;
          font-size: 13px;
          color: var(--muted);
        }
        .meta {
          margin: 6px 0 8px;
          font-size: 13px;
          color: var(--accent, #0b6e4f);
          font-weight: 600;
        }
        .address {
          margin: 0 0 4px;
          font-size: 14px;
          line-height: 1.45;
        }
        .rating {
          margin: 0 0 8px;
          font-size: 14px;
          letter-spacing: 0.02em;
        }
        .rating-empty {
          margin: 0 0 8px;
        }
        .hours {
          margin: 8px 0;
          font-size: 13px;
        }
        .hours.open {
          color: #166534;
        }
        .hours.closed {
          color: #9a3412;
        }
        .loading {
          margin: 0 0 8px;
          font-size: 13px;
          color: var(--muted);
        }
        .muted {
          color: var(--muted);
          font-size: 13px;
        }
        .links {
          display: flex;
          gap: 10px;
          margin-top: 12px;
          align-items: center;
          flex-wrap: wrap;
        }
        .share {
          border: 1px solid var(--border);
          background: #fff;
          border-radius: 8px;
          padding: 6px 10px;
          cursor: pointer;
        }
        button[aria-label='Đóng'] {
          border: none;
          background: transparent;
          font-size: 22px;
          line-height: 1;
          cursor: pointer;
          color: var(--muted);
        }
      `}</style>
    </aside>
  )
}

/** Back-compat export name used by page.tsx */
export { LocationDetailPanel as LocationDetail }
