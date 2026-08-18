'use client'

import Link from 'next/link'
import { CITIES, type CityCode } from '@/lib/cities'

export function FloatingTopBar({
  city,
  onCityChange,
  cityCounts,
  query,
  onQueryChange,
  onRetry,
}: {
  city: CityCode
  onCityChange: (c: CityCode) => void
  cityCounts?: Partial<Record<CityCode, number>>
  query: string
  onQueryChange: (v: string) => void
  onRetry: () => void
}) {
  return (
    <div className="map-topbar map-sheet" role="banner">
      <Link href="/" className="map-topbar-brand" title="Về trang chủ">
        <strong>MapPlatform</strong>
        <span>Bản đồ quyết định</span>
      </Link>

      <div className="map-topbar-search">
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Tìm tên, địa chỉ…"
          aria-label="Tìm kiếm địa điểm"
        />
        {query.trim() ? (
          <button
            type="button"
            className="clear"
            onClick={() => onQueryChange('')}
            aria-label="Xóa tìm kiếm"
          >
            ×
          </button>
        ) : null}
      </div>

      <select
        className="map-topbar-city"
        value={city}
        aria-label="Chọn thành phố"
        onChange={(e) => onCityChange(e.target.value as CityCode)}
      >
        {(Object.keys(CITIES) as CityCode[]).map((code) => {
          const n = cityCounts?.[code]
          const disabled = typeof n === 'number' && n === 0 && code !== 'hanoi'
          return (
            <option key={code} value={code} disabled={disabled}>
              {CITIES[code].name}
              {typeof n === 'number' ? ` (${n})` : ''}
            </option>
          )
        })}
      </select>

      <button type="button" className="map-topbar-ghost" onClick={onRetry} title="Tải lại dữ liệu">
        Tải lại
      </button>

      <div className="map-topbar-links">
        <a href="/admin">Admin</a>
        <Link href="/ops">Ops</Link>
      </div>
    </div>
  )
}
