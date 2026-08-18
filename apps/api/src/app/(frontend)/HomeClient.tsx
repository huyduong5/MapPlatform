'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LocationDetail as LocationDetailData, LocationSummary } from '@/types/location'
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
import { decide, type DecideResult, type TravelMode, type VehicleKind } from '@/services/decisionApi'
import { type LayerKey } from '@/components/LayerControl'
import { LocationDetailPanel } from '@/components/LocationDetail'
import { DecisionPanel } from '@/components/DecisionPanel'
import { FloatingTopBar } from '@/components/map/FloatingTopBar'
import { LayersDrawer, MapFabs } from '@/components/map/LayersDrawer'
import { CITIES, cityContains, parseCity, type CityCode } from '@/lib/cities'
import { filterDisplayableLocations, isRealPoiName } from '@/lib/placeFormat'
import { useGeolocation } from '@/hooks/useGeolocation'
import '@/components/map/map-chrome.css'

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
  bus_stop: true,
  subway_station: true,
  park: true,
  tourist_attraction: true,
}

function readCityFromUrl(): CityCode {
  if (typeof window === 'undefined') return 'hanoi'
  return parseCity(new URLSearchParams(window.location.search).get('city'))
}

function readIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('id')
}

function layerFromUrl(): LayerKey | null {
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('layer')
  if (!raw) return null
  return raw in ALL_ON ? (raw as LayerKey) : null
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
  const [selected, setSelected] = useState<LocationSummary | LocationDetailData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const detailAbortRef = useRef<AbortController | null>(null)
  const [query, setQuery] = useState('')
  const [decision, setDecision] = useState<DecideResult | null>(null)
  const [deciding, setDeciding] = useState(false)
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null)
  const [activeRoutePersona, setActiveRoutePersona] = useState<'fastest' | 'smart' | 'experience'>(
    'fastest',
  )
  const [flyToUserToken, setFlyToUserToken] = useState(0)
  const [layersOpen, setLayersOpen] = useState(false)
  const [decideOpenDefault] = useState(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).get('focus') === 'decide'
  })
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
  const lastFlyAccRef = useRef<number | null>(null)

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

  /** Landing deep-links: ?layer=rescue_team · ?focus=decide (open handled via decideOpenDefault) */
  useEffect(() => {
    const layer = layerFromUrl()
    if (layer) {
      const next = { ...ALL_ON }
      for (const k of Object.keys(next) as LayerKey[]) next[k] = k === layer
      setVisibility(next)
    }
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

  const requestUserLocation = useCallback(async () => {
    // Always go through startGeo — it reuses positionRef / joins in-flight (click-safe)
    setError(null)
    try {
      const pos = await startGeo()
      lastFlyAccRef.current = pos.accuracy
      bumpFlyToUser()
      setError(null)
      if (pos.source === 'ip') {
        setInfo(
          `Đã hiện vị trí ước lượng${pos.label ? ` (${pos.label})` : ''} ±${Math.round(pos.accuracy / 1000)}km.`,
        )
      } else {
        setInfo(`Đã hiện vị trí của bạn (±${Math.round(pos.accuracy)}m).`)
      }
      return pos
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không lấy được vị trí'
      if (msg === 'cancelled') return Promise.reject(e)
      setInfo(null)
      setError(msg)
      throw e
    }
  }, [startGeo, bumpFlyToUser])

  // When watchPosition refines from coarse → GPS, re-center
  useEffect(() => {
    if (geoStatus !== 'active' || !userLocation) {
      if (geoStatus === 'idle') lastFlyAccRef.current = null
      return
    }
    const acc = userLocation.accuracy
    const prev = lastFlyAccRef.current
    if (prev == null) {
      lastFlyAccRef.current = acc
      return
    }
    if (acc <= prev * 0.5 && prev >= 150) {
      lastFlyAccRef.current = acc
      bumpFlyToUser()
      if (acc <= 1_000) setInfo(null)
    }
  }, [geoStatus, userLocation, bumpFlyToUser])

  const onShowMyLocation = useCallback(() => {
    // Never cancel on re-click. Extra clicks join the same in-flight locate / reuse fix.
    void (async () => {
      try {
        setQuery('')
        setDecision(null)
        setError(null)
        setInfo((prev) => prev || 'Đang lấy vị trí…')

        const pos = await requestUserLocation()

        if (!cityContains(city, pos.latitude, pos.longitude)) {
          setInfo(
            pos.source === 'ip'
              ? `Bạn đang ngoài ${cityMeta.name} (ước lượng IP${pos.label ? `: ${pos.label}` : ''} ±${Math.round(pos.accuracy / 1000)}km).`
              : `Bạn đang ngoài ${cityMeta.name} (±${Math.round(pos.accuracy)}m).`,
          )
        } else if (pos.source === 'ip') {
          setInfo(
            `Đã hiện vị trí ước lượng${pos.label ? ` (${pos.label})` : ''} ±${Math.round(pos.accuracy / 1000)}km.`,
          )
        } else {
          setInfo(`Đã hiện vị trí của bạn (±${Math.round(pos.accuracy)}m).`)
        }

        try {
          await getNearbyLocations({
            latitude: pos.latitude,
            longitude: pos.longitude,
            radius: 5000,
            city,
            limit: 50,
          })
        } catch {
          /* marker + fly is enough */
        }

        if (boundsRef.current) void load(boundsRef.current, city)
      } catch {
        /* requestUserLocation already setError (unless cancelled) */
      }
    })()
  }, [requestUserLocation, city, cityMeta.name, load])

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

  const onRetry = () => {
    setQuery('')
    setDecision(null)
    setActiveRouteId(null)
    setActiveRoutePersona('fastest')
    setInfo(null)
    void load(boundsRef.current, city, { skipCache: true })
  }

  /** Exit AI session: remove routes/highlights, unlock POI refetch, restore layers. */
  const clearDecisionSession = useCallback(() => {
    setDecision(null)
    setActiveRouteId(null)
    setActiveRoutePersona('fastest')
    setSelected(null)
    detailAbortRef.current?.abort()
    setDetailLoading(false)
    setVisibility({ ...ALL_ON })
    setInfo('Đã trở lại bản đồ thường — các địa điểm đã hiện lại.')
    if (typeof window !== 'undefined') {
      const u = new URL(window.location.href)
      if (u.searchParams.has('focus')) {
        u.searchParams.delete('focus')
        window.history.replaceState({}, '', u.toString())
      }
    }
    void load(boundsRef.current, city)
  }, [city, load])

  const onDecide = (params: {
    query: string
    useMyLocation: boolean
    vehicleKind?: VehicleKind
    travelMode: TravelMode
    batteryPercent?: number
  }) => {
    const run = async (lat?: number, lng?: number) => {
      setDeciding(true)
      setError(null)
      setInfo(null)
      try {
        const data = await decide({
          query: params.query,
          latitude: lat,
          longitude: lng,
          limit: 3,
          city,
          travelMode: params.travelMode,
          vehicle: params.vehicleKind
            ? {
                kind: params.vehicleKind,
                batteryPercent: params.batteryPercent,
              }
            : undefined,
        })
        setDecision(data)
        setActiveRouteId(data.recommendations[0]?.id || null)
        setActiveRoutePersona('fastest')
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

    if (params.useMyLocation) {
      void (async () => {
        try {
          const pos =
            geoStatus === 'active' && userLocation
              ? userLocation
              : await requestUserLocation()
          await run(pos.latitude, pos.longitude)
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Không lấy được vị trí')
        }
      })()
      return
    }
    void run()
  }

  const activeRec = useMemo(() => {
    if (!decision?.recommendations.length) return null
    const id = activeRouteId || decision.recommendations[0]?.id
    return decision.recommendations.find((r) => r.id === id) || decision.recommendations[0]
  }, [decision, activeRouteId])

  const activeRouteOption = useMemo(() => {
    const routes = activeRec?.routes
    if (!routes?.length) return null
    return (
      routes.find((r) => r.persona === activeRoutePersona) ||
      routes.find((r) => r.persona === 'experience' || r.persona === 'smart') ||
      routes[0]
    )
  }, [activeRec, activeRoutePersona])

  const altRouteOption = useMemo(() => {
    const routes = activeRec?.routes
    if (!routes || routes.length < 2) return null
    const active = activeRouteOption?.persona || 'fastest'
    return routes.find((r) => r.persona !== active) || null
  }, [activeRec, activeRouteOption])

  const routeGeometry = useMemo(
    () => activeRouteOption?.geometry?.coordinates || activeRec?.route?.coordinates || null,
    [activeRouteOption, activeRec],
  )

  const altRouteGeometry = useMemo(
    () => altRouteOption?.geometry?.coordinates || null,
    [altRouteOption],
  )

  const routeAmenities = useMemo(
    () => activeRouteOption?.amenities || [],
    [activeRouteOption],
  )

  const showEmptyBanner =
    !loading && !error && mapLocations.length === 0 && !resultLock
  const showSearchEmpty = !loading && !error && mapLocations.length === 0 && searchActive
  const emptyText = layersAllOff
    ? 'Đã tắt hết lớp hiển thị. Bật lại bằng nút lớp bản đồ (góc phải).'
    : showSearchEmpty
      ? 'Không tìm thấy địa điểm phù hợp.'
      : info && mapLocations.length === 0
        ? info
        : 'Không có địa điểm phù hợp trong khung nhìn.'

  return (
    <div className="map-shell">
      <div className="map-shell-canvas">
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
          routeGeometry={routeGeometry}
          altRouteGeometry={altRouteGeometry}
          routeAmenities={routeAmenities}
          onBoundsChange={onBoundsChange}
          onZoomChange={onZoomChange}
          lockFit={!resultLock}
          userLocation={userLocation}
          flyToUserToken={flyToUserToken}
        />
      </div>

      <FloatingTopBar
        city={city}
        onCityChange={onCityChange}
        cityCounts={cityCounts}
        query={query}
        onQueryChange={(v) => {
          setQuery(v)
          if (!v.trim()) {
            setInfo(null)
            void load(boundsRef.current, city)
          }
        }}
        onRetry={onRetry}
      />

      {(error ||
        (loading && locations.length === 0) ||
        info ||
        showEmptyBanner ||
        showSearchEmpty ||
        layersAllOff) && (
        <div className="map-toasts" aria-live="polite">
          {error && (
            <div className="map-toast map-toast--error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={onRetry}>
                Thử lại
              </button>
            </div>
          )}
          {loading && locations.length === 0 && !error && (
            <div className="map-toast map-toast--soft">Đang tải địa điểm…</div>
          )}
          {loading && locations.length > 0 && !error && (
            <div className="map-toast map-toast--soft">Đang cập nhật khung nhìn…</div>
          )}
          {info && !error && (
            <div className="map-toast map-toast--info">
              <span>{info}</span>
              <button type="button" onClick={() => setInfo(null)}>
                Đóng
              </button>
            </div>
          )}
          {(showEmptyBanner || showSearchEmpty || layersAllOff) && !error && !loading && (
            <div className="map-toast">{emptyText}</div>
          )}
        </div>
      )}

      <DecisionPanel
        defaultOpen={decideOpenDefault}
        onDecide={onDecide}
        onClearResult={clearDecisionSession}
        result={decision}
        loading={deciding}
        activeRouteId={activeRouteId}
        activeRoutePersona={activeRoutePersona}
        geoStatus={geoStatus}
        geoAccuracy={userLocation?.accuracy}
        geoSource={userLocation?.source}
        geoLabel={userLocation?.label}
        onRequestLocation={() => {
          void requestUserLocation().catch(() => undefined)
        }}
        onSelectRecommendation={(id) => {
          setActiveRouteId(id)
          setActiveRoutePersona('fastest')
          const rec = decision?.recommendations.find((r) => r.id === id)
          if (rec) setSelected(rec)
        }}
        onSelectRoutePersona={(persona) => setActiveRoutePersona(persona)}
      />

      {selected && (
        <LocationDetailPanel
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

      <MapFabs
        onLocate={onShowMyLocation}
        onToggleLayers={() => setLayersOpen((o) => !o)}
        layersOpen={layersOpen}
        geoBusy={geoStatus === 'locating'}
        geoDenied={geoStatus === 'denied'}
        locateActive={geoStatus === 'active' || Boolean(userLocation)}
      />

      <LayersDrawer
        open={layersOpen}
        onClose={() => setLayersOpen(false)}
        visibility={visibility}
        onToggle={(key) => setVisibility((v) => ({ ...v, [key]: !v[key] }))}
        onSetAll={(on) =>
          setVisibility((v) => {
            const next = { ...v }
            for (const k of Object.keys(next) as LayerKey[]) next[k] = on
            return next
          })
        }
      />
    </div>
  )
}
