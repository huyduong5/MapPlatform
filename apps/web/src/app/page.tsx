'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LocationDetail, LocationSummary } from '@/types/location'
import {
  getCities,
  getLocationById,
  getLocations,
  getNearbyLocations,
  isAbortError,
  peekCachedLocations,
  searchLocations,
  type MapBounds,
} from '@/services/locationApi'
import { invalidateLocationCache } from '@/services/locationCache'
import { decide, type DecideResult } from '@/services/decisionApi'
import { Header } from '@/components/Header'
import { LayerControl, type LayerKey } from '@/components/LayerControl'
import { LocationDetail } from '@/components/LocationDetail'
import { DecisionPanel } from '@/components/DecisionPanel'
import { CitySwitcher } from '@/components/CitySwitcher'
import { CITIES, cityContains, parseCity, type CityCode } from '@/lib/cities'
import { filterDisplayableLocations, isRealPoiName } from '@/lib/placeFormat'
import { useGeolocation } from '@/hooks/useGeolocation'

const MapView = dynamic(() => import('@/components/MapView').then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="map-loading">Đang tải bản đồ…</div>,
})

const ALL_ON: Record<LayerKey, boolean> = {
  charging_station: true,
  store: true,
  showroom: true,
  service_center: true,
  dealer: true,
  parking: true,
  rescue_team: true,
  gas_station: true,
  university: true,
  hospital: true,
  pharmacy: true,
  atm: true,
  bank: true,
  police: true,
  fire_station: true,
  school: true,
  marketplace: true,
}

function readCityFromUrl(): CityCode {
  if (typeof window === 'undefined') return 'hanoi'
  return parseCity(new URLSearchParams(window.location.search).get('city'))
}

function readIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('id')
}

function writeDeepLink(city: CityCode, id: string | null) {
  if (typeof window === 'undefined') return
  const u = new URL(window.location.href)
  u.searchParams.set('city', city)
  if (id) u.searchParams.set('id', id)
  else u.searchParams.delete('id')
  window.history.replaceState({}, '', u.toString())
}

export default function HomePage() {
  const [city, setCity] = useState<CityCode>('hanoi')
  const [cityCounts, setCityCounts] = useState<Partial<Record<CityCode, number>>>({})
  const [locations, setLocations] = useState<LocationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [visibility, setVisibility] = useState(ALL_ON)
  const [selected, setSelected] = useState<LocationSummary | LocationDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const detailAbortRef = useRef<AbortController | null>(null)
  const [query, setQuery] = useState('')
  const [decision, setDecision] = useState<DecideResult | null>(null)
  const [deciding, setDeciding] = useState(false)
  const [flyToUserToken, setFlyToUserToken] = useState(0)
  const boundsRef = useRef<MapBounds | null>(null)
  const zoomRef = useRef<number>(12)
  const deepLinkHandled = useRef(false)
  const loadAbortRef = useRef<AbortController | null>(null)
  const loadSeqRef = useRef(0)
  const searchAbortRef = useRef<AbortController | null>(null)
  const cityRef = useRef(city)
  cityRef.current = city

  const searchActive = query.trim().length > 0
  /** Search / decision freeze viewport refetch; Near Me does not. */
  const resultLock = searchActive || Boolean(decision)
  const cityMeta = CITIES[city]
  const {
    status: geoStatus,
    position: userLocation,
    start: startGeo,
    stop: stopGeo,
  } = useGeolocation()

  const abortLoad = useCallback(() => {
    loadAbortRef.current?.abort()
    loadAbortRef.current = null
  }, [])

  const load = useCallback(
    async (
      bounds?: MapBounds | null,
      cityCode: CityCode = city,
      opts?: { clearMarkers?: boolean; skipCache?: boolean },
    ) => {
      abortLoad()
      const ac = new AbortController()
      loadAbortRef.current = ac
      const seq = ++loadSeqRef.current

      if (opts?.clearMarkers) setLocations([])

      const z = zoomRef.current
      const limit = z < 12 ? 200 : z < 14 ? 350 : 500

      if (bounds && !opts?.skipCache && !opts?.clearMarkers) {
        const peeked = peekCachedLocations({
          status: 'active',
          limit,
          bounds,
          city: cityCode,
        })
        if (peeked?.length) setLocations(peeked)
      }

      setLoading(true)
      setError(null)
      try {
        const res = await getLocations(
          {
            status: 'active',
            limit,
            bounds: bounds || undefined,
            city: cityCode,
            withTotal: false,
            zoom: z,
          },
          { signal: ac.signal, skipCache: opts?.skipCache },
        )
        if (seq !== loadSeqRef.current || ac.signal.aborted) return
        if (cityRef.current !== cityCode) return
        setLocations(res.data)
      } catch (e) {
        if (isAbortError(e) || ac.signal.aborted || seq !== loadSeqRef.current) return
        setError(e instanceof Error ? e.message : 'Không tải được dữ liệu')
      } finally {
        if (seq === loadSeqRef.current) setLoading(false)
      }
    },
    [city, abortLoad],
  )

  useEffect(() => {
    const initial = readCityFromUrl()
    setCity(initial)
    void (async () => {
      try {
        const res = await getCities()
        const counts: Partial<Record<CityCode, number>> = {}
        for (const c of res.data) counts[c.code] = c.locationCount
        setCityCounts(counts)
      } catch {
        /* non-fatal */
      }
    })()
  }, [])

  // City change / mount: prefer bbox from BoundsWatcher; fallback city-wide if no bounds
  useEffect(() => {
    writeDeepLink(city, selected?.id || null)
    setLoading(true)
    const t = setTimeout(() => {
      if (!boundsRef.current) void load(null, city)
    }, 700)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, load])

  useEffect(() => {
    if (deepLinkHandled.current) return
    const id = readIdFromUrl()
    if (!id) {
      deepLinkHandled.current = true
      return
    }
    deepLinkHandled.current = true
    void (async () => {
      try {
        const res = await getLocationById(id)
        if (!isRealPoiName(res.data.name)) {
          setInfo('Địa điểm chưa có tên hợp lệ hoặc không còn hiển thị.')
          return
        }
        setSelected(res.data)
        if (res.data.city) setCity(parseCity(String(res.data.city)))
      } catch (e) {
        const code = (e as { code?: string }).code
        if (code === 'UNNAMED_POI' || code === 'LOCATION_NOT_FOUND') {
          setInfo('Địa điểm chưa có tên hợp lệ hoặc không còn hiển thị.')
        }
      }
    })()
  }, [])

  useEffect(() => {
    writeDeepLink(city, selected?.id || null)
  }, [city, selected])

  useEffect(() => {
    if (!searchActive) return
    searchAbortRef.current?.abort()
    const ac = new AbortController()
    searchAbortRef.current = ac
    const t = setTimeout(() => {
      void (async () => {
        try {
          const res = await searchLocations(query.trim(), city, { signal: ac.signal })
          if (ac.signal.aborted) return
          setLocations(res.data)
          setError(null)
          setInfo(null)
        } catch (e) {
          if (isAbortError(e) || ac.signal.aborted) return
          setError(e instanceof Error ? e.message : 'Lỗi tìm kiếm')
        }
      })()
    }, 400)
    return () => {
      clearTimeout(t)
      ac.abort()
    }
  }, [query, searchActive, city])

  const onBoundsChange = useCallback(
    (b: MapBounds) => {
      if (!(b.maxLat > b.minLat) || !(b.maxLng > b.minLng)) return
      if (b.maxLat - b.minLat < 1e-5 || b.maxLng - b.minLng < 1e-5) return
      boundsRef.current = b
      if (resultLock) return
      void load(b, city)
    },
    [resultLock, load, city],
  )

  const onZoomChange = useCallback((z: number) => {
    zoomRef.current = z
  }, [])

  const onCityChange = (next: CityCode) => {
    if (next === city) return
    abortLoad()
    searchAbortRef.current?.abort()
    stopGeo()
    setFlyToUserToken(0)
    invalidateLocationCache(city)
    setLocations([])
    setCity(next)
    setSelected(null)
    setDecision(null)
    setQuery('')
    setInfo(null)
    setError(null)
    boundsRef.current = null
  }

  const onSelectLocation = useCallback((loc: LocationSummary) => {
    if (!isRealPoiName(loc.name)) {
      setSelected(null)
      setInfo('Địa điểm chưa có tên hợp lệ.')
      return
    }
    setSelected(loc)
    detailAbortRef.current?.abort()
    const ac = new AbortController()
    detailAbortRef.current = ac
    setDetailLoading(true)
    void (async () => {
      try {
        const res = await getLocationById(loc.id, { signal: ac.signal })
        if (ac.signal.aborted) return
        if (!isRealPoiName(res.data.name)) {
          setSelected(null)
          setInfo('Địa điểm chưa có tên hợp lệ.')
          return
        }
        setSelected(res.data)
      } catch (e) {
        if (isAbortError(e) || ac.signal.aborted) return
        const code = (e as { code?: string }).code
        if (code === 'UNNAMED_POI') {
          setSelected(null)
          setInfo('Địa điểm chưa có tên hợp lệ.')
          return
        }
        /* keep optimistic summary */
      } finally {
        if (!ac.signal.aborted) setDetailLoading(false)
      }
    })()
  }, [])

  const bumpFlyToUser = useCallback(() => setFlyToUserToken((n) => n + 1), [])

  const onToggleLocate = useCallback(() => {
    if (geoStatus === 'locating') return
    if (geoStatus === 'active' || userLocation) {
      stopGeo()
      return
    }
    void (async () => {
      try {
        await startGeo()
        bumpFlyToUser()
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Không lấy được vị trí')
      }
    })()
  }, [geoStatus, userLocation, startGeo, stopGeo, bumpFlyToUser])

  const highlightIds = useMemo(
    () => new Set(decision?.recommendations.map((r) => r.id) || []),
    [decision],
  )

  const filtered = filterDisplayableLocations(
    locations.filter((l) => {
      const key = l.type as LayerKey
      if (key in visibility) return visibility[key]
      return true
    }),
  )

  const layersAllOff = locations.length > 0 && filtered.length === 0

  const mapLocations = useMemo(() => {
    if (!decision?.recommendations.length) return filtered
    const byId = new Map(filtered.map((l) => [l.id, l]))
    for (const r of decision.recommendations) {
      if (!byId.has(r.id)) byId.set(r.id, r)
    }
    return Array.from(byId.values())
  }, [filtered, decision])

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined' || !selected) return undefined
    const u = new URL(window.location.href)
    u.searchParams.set('city', city)
    u.searchParams.set('id', selected.id)
    return u.toString()
  }, [city, selected])

  const onNearMe = () => {
    void (async () => {
      try {
        // Unlock viewport: clear search/decision freeze
        setQuery('')
        setDecision(null)
        setError(null)

        const pos = await startGeo()
        bumpFlyToUser()

        if (!cityContains(city, pos.latitude, pos.longitude)) {
          setInfo(
            `Vị trí của bạn nằm ngoài ${cityMeta.name}. Đang hiện địa điểm theo khung bản đồ.`,
          )
        } else {
          try {
            const res = await getNearbyLocations({
              latitude: pos.latitude,
              longitude: pos.longitude,
              radius: 5000,
              city,
              limit: 50,
            })
            if (res.data.length === 0) {
              setInfo(
                `Không có điểm trong bán kính 5km tại ${cityMeta.name} — đang hiện theo khung bản đồ.`,
              )
            } else {
              setInfo(null)
            }
          } catch {
            setInfo(null)
          }
        }

        // Do not replace dataset with nearby-only; moveend after flyTo loads bbox
        if (boundsRef.current) void load(boundsRef.current, city)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Lỗi Near Me')
      }
    })()
  }

  const onRetry = () => {
    setQuery('')
    setDecision(null)
    setInfo(null)
    void load(boundsRef.current, city, { skipCache: true })
  }

  const onDecide = (q: string, useMyLocation: boolean) => {
    const run = async (lat?: number, lng?: number) => {
      setDeciding(true)
      setError(null)
      setInfo(null)
      try {
        const data = await decide({
          query: q,
          latitude: lat,
          longitude: lng,
          limit: 3,
          city,
        })
        setDecision(data)
        setLocations((prev) => {
          const byId = new Map(prev.map((l) => [l.id, l]))
          for (const r of data.recommendations) byId.set(r.id, r)
          return Array.from(byId.values())
        })
        if (data.recommendations[0]) setSelected(data.recommendations[0])
        const t = data.intent.locationType as LayerKey | null
        if (t) setVisibility((v) => ({ ...v, [t]: true }))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Lỗi Decision Engine')
      } finally {
        setDeciding(false)
      }
    }

    if (useMyLocation) {
      void (async () => {
        try {
          const pos = await startGeo()
          bumpFlyToUser()
          await run(pos.latitude, pos.longitude)
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Không lấy được vị trí')
        }
      })()
      return
    }
    void run()
  }

  const showEmptyBanner =
    !loading && !error && mapLocations.length === 0 && !resultLock
  const showSearchEmpty = !loading && !error && mapLocations.length === 0 && searchActive
  const emptyText = layersAllOff
    ? 'Đã tắt hết lớp hiển thị. Bật lại trong bảng điều khiển lớp.'
    : showSearchEmpty
      ? 'Không tìm thấy địa điểm phù hợp.'
      : info && mapLocations.length === 0
        ? info
        : 'Không có địa điểm phù hợp trong khung nhìn.'

  return (
    <div className="shell">
      <Header
        cityLabel={cityMeta.name}
        query={query}
        onQueryChange={(v) => {
          setQuery(v)
          if (!v.trim()) {
            setInfo(null)
            void load(boundsRef.current, city)
          }
        }}
        onNearMe={onNearMe}
        onRetry={onRetry}
      />
      <CitySwitcher city={city} onChange={onCityChange} counts={cityCounts} />
      <LayerControl
        visibility={visibility}
        onToggle={(key) => setVisibility((v) => ({ ...v, [key]: !v[key] }))}
      />
      <div className="map-wrap">
        {(error || (loading && locations.length === 0) || info || showEmptyBanner || showSearchEmpty || layersAllOff) && (
          <div className="banners" aria-live="polite">
            {error && (
              <div className="banner error" role="alert">
                {error}{' '}
                <button type="button" onClick={onRetry}>
                  Thử lại
                </button>
              </div>
            )}
            {loading && locations.length === 0 && !error && (
              <div className="banner">Đang tải địa điểm…</div>
            )}
            {loading && locations.length > 0 && !error && (
              <div className="banner soft">Đang cập nhật khung nhìn…</div>
            )}
            {info && !error && (
              <div className="banner info">
                {info}{' '}
                <button type="button" onClick={() => setInfo(null)}>
                  Đóng
                </button>
              </div>
            )}
            {(showEmptyBanner || showSearchEmpty || layersAllOff) && !error && !loading && (
              <div className="banner">{emptyText}</div>
            )}
          </div>
        )}
        <DecisionPanel onDecide={onDecide} result={decision} loading={deciding} />
        <MapView
          key={city}
          center={[cityMeta.latitude, cityMeta.longitude]}
          zoom={cityMeta.zoom}
          locations={mapLocations}
          selected={selected}
          onSelect={onSelectLocation}
          highlightIds={highlightIds}
          anchor={decision?.anchor || null}
          radiusMeters={decision?.radiusMeters || null}
          onBoundsChange={onBoundsChange}
          onZoomChange={onZoomChange}
          lockFit={!resultLock}
          userLocation={userLocation}
          flyToUserToken={flyToUserToken}
          locateActive={geoStatus === 'active' || Boolean(userLocation)}
          locateBusy={geoStatus === 'locating'}
          onToggleLocate={onToggleLocate}
        />
        {selected && (
          <LocationDetail
            location={selected}
            onClose={() => {
              detailAbortRef.current?.abort()
              setDetailLoading(false)
              setSelected(null)
            }}
            shareUrl={shareUrl}
            loading={detailLoading}
          />
        )}
      </div>
      <style jsx>{`
        .shell {
          height: 100dvh;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .map-wrap {
          flex: 1 1 auto;
          min-height: 320px;
          position: relative;
          width: 100%;
        }
        .banners {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1100;
          pointer-events: none;
        }
        .banners :global(button) {
          pointer-events: auto;
        }
        .banner {
          padding: 8px 16px;
          background: #e8f2ec;
          border-bottom: 1px solid var(--border);
          font-size: 14px;
        }
        .banner.soft {
          background: #f0f4f2;
          color: var(--muted, #5a6b63);
          font-size: 13px;
        }
        .banner.info {
          background: #eef4fb;
          color: #1e3a5f;
        }
        .banner.error {
          background: #fdecea;
          color: var(--danger);
        }
        .banner button {
          margin-left: 8px;
        }
        :global(.map-wrap .leaflet-container) {
          position: absolute !important;
          inset: 0;
          height: auto !important;
          width: auto !important;
          min-height: 0;
          background: #dce3e8;
          z-index: 1;
        }
        :global(.map-loading) {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          color: var(--muted);
        }
      `}</style>
    </div>
  )
}
