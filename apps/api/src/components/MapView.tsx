'use client'

import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { useEffect, useRef } from 'react'
import type { LocationSummary } from '@/types/location'
import { isRealPoiName } from '@/lib/placeFormat'
import type { MapBounds } from '@/services/locationApi'
import { makeTypeIcon, makeUserLocationIcon } from '@/components/mapIcons'
import { zoomForAccuracy } from '@/hooks/useGeolocation'
import 'leaflet/dist/leaflet.css'
import '@/vendor/leaflet.markercluster/MarkerCluster.css'
import '@/vendor/leaflet.markercluster/MarkerCluster.Default.css'

// Side-effect: extends L with markerClusterGroup
import '@/vendor/leaflet.markercluster/leaflet.markercluster.js'

const TILE_URL =
  process.env.NEXT_PUBLIC_MAP_TILE_URL ||
  'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
const ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '© OpenStreetMap contributors © CARTO'
const DEFAULT_LAT = Number(process.env.NEXT_PUBLIC_MAP_DEFAULT_LAT || 21.0285)
const DEFAULT_LNG = Number(process.env.NEXT_PUBLIC_MAP_DEFAULT_LNG || 105.8542)
const DEFAULT_ZOOM = Number(process.env.NEXT_PUBLIC_MAP_DEFAULT_ZOOM || 12)

const USER_COLOR = '#2563eb'
const ACCURACY_MIN = 5
/** Cap blue-circle radius so coarse IP fixes don't paint the whole city. */
const ACCURACY_MAX = 20_000

export type UserLocationPoint = {
  latitude: number
  longitude: number
  accuracy?: number
  source?: 'browser' | 'ip'
  label?: string
}

function FitBounds({
  locations,
  focusIds,
  anchor,
  lockFit,
  routeGeometry,
  altRouteGeometry,
}: {
  locations: LocationSummary[]
  focusIds?: Set<string>
  anchor?: { latitude: number; longitude: number } | null
  lockFit?: boolean
  routeGeometry?: Array<[number, number]> | null
  altRouteGeometry?: Array<[number, number]> | null
}) {
  const map = useMap()
  useEffect(() => {
    if (lockFit) return

    const routePts: [number, number][] = []
    const addGeom = (g?: Array<[number, number]> | null) => {
      if (!g || g.length < 2) return
      for (const [lng, lat] of g) routePts.push([lat, lng])
    }
    addGeom(routeGeometry)
    addGeom(altRouteGeometry)

    // Prefer fitting the road polyline so turns/alleys are visible
    if (routePts.length >= 3) {
      map.fitBounds(L.latLngBounds(routePts).pad(0.15))
      return
    }

    const focus = focusIds?.size
      ? locations.filter((l) => focusIds.has(l.id))
      : locations
    const pts: [number, number][] = focus.map((l) => [l.latitude, l.longitude])
    if (anchor) pts.push([anchor.latitude, anchor.longitude])
    if (!pts.length) {
      map.setView([DEFAULT_LAT, DEFAULT_LNG], DEFAULT_ZOOM)
      return
    }
    if (pts.length === 1) {
      map.setView(pts[0], 15)
      return
    }
    map.fitBounds(L.latLngBounds(pts).pad(0.2))
  }, [locations, focusIds, anchor, map, lockFit, routeGeometry, altRouteGeometry])
  return null
}

function BoundsWatcher({
  onBounds,
  onZoom,
}: {
  onBounds?: (b: MapBounds) => void
  onZoom?: (z: number) => void
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const map = useMap()

  const emit = () => {
    if (!onBounds) return
    const size = map.getSize()
    if (size.x < 32 || size.y < 32) return
    const b = map.getBounds()
    const bounds: MapBounds = {
      minLat: b.getSouth(),
      maxLat: b.getNorth(),
      minLng: b.getWest(),
      maxLng: b.getEast(),
    }
    if (
      !(bounds.maxLat > bounds.minLat) ||
      !(bounds.maxLng > bounds.minLng) ||
      bounds.maxLat - bounds.minLat < 1e-6 ||
      bounds.maxLng - bounds.minLng < 1e-6
    ) {
      return
    }
    onZoom?.(map.getZoom())
    onBounds(bounds)
  }

  useMapEvents({
    moveend: () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(emit, 350)
    },
    zoomend: () => {
      onZoom?.(map.getZoom())
    },
  })

  useEffect(() => {
    const t = setTimeout(emit, 100)
    const onResize = () => {
      map.invalidateSize()
      emit()
    }
    window.addEventListener('resize', onResize)
    return () => {
      clearTimeout(t)
      if (timer.current) clearTimeout(timer.current)
      window.removeEventListener('resize', onResize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

function InvalidateSize() {
  const map = useMap()
  useEffect(() => {
    const run = () => map.invalidateSize()
    run()
    const t1 = setTimeout(run, 50)
    const t2 = setTimeout(run, 250)
    const t3 = setTimeout(run, 800)
    window.addEventListener('resize', run)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      window.removeEventListener('resize', run)
    }
  }, [map])
  return null
}

function FlyToUser({
  userLocation,
  flyToUserToken,
}: {
  userLocation: UserLocationPoint | null | undefined
  flyToUserToken?: number
}) {
  const map = useMap()
  const lastToken = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (flyToUserToken == null || flyToUserToken === 0) return
    if (flyToUserToken === lastToken.current) return
    if (!userLocation) return
    lastToken.current = flyToUserToken
    const z = zoomForAccuracy(userLocation.accuracy ?? 100)
    map.flyTo([userLocation.latitude, userLocation.longitude], z, { duration: 0.6 })
  }, [flyToUserToken, userLocation, map])

  return null
}

function ClusteredPoiMarkers({
  locations,
  selected,
  onSelect,
  highlightIds,
}: {
  locations: LocationSummary[]
  selected: LocationSummary | null
  onSelect: (loc: LocationSummary) => void
  highlightIds?: Set<string>
}) {
  const map = useMap()
  const markerById = useRef(new Map<string, L.Marker>())
  const prevSelectedId = useRef<string | null>(null)

  // Full rebuild when POI set / highlights change
  useEffect(() => {
    const clusterGroup = (
      L as typeof L & {
        markerClusterGroup: (o?: object) => L.LayerGroup
      }
    ).markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 55,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 17,
    })

    markerById.current.clear()

    for (const loc of locations) {
      if (!isRealPoiName(loc.name)) continue
      const recommended = Boolean(highlightIds?.has(loc.id))
      const isSelected = selected?.id === loc.id
      const icon = makeTypeIcon(loc.type, { recommended, selected: isSelected })
      const m = L.marker([loc.latitude, loc.longitude], {
        icon,
        opacity: highlightIds?.size
          ? recommended || isSelected
            ? 1
            : 0.35
          : selected && !isSelected
            ? 0.5
            : 1,
        zIndexOffset: isSelected ? 800 : recommended ? 500 : 0,
      })
      // Detail panel handles content — no auto popup (keeps click animation visible)
      m.on('click', () => onSelect(loc))
      clusterGroup.addLayer(m)
      markerById.current.set(loc.id, m)
    }

    prevSelectedId.current = selected?.id ?? null
    map.addLayer(clusterGroup)
    return () => {
      map.removeLayer(clusterGroup)
      markerById.current.clear()
    }
    // selected handled in a lighter effect below when only selection changes
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid full remount on select-only
  }, [map, locations, onSelect, highlightIds])

  // Lightweight select swap: update prev + next marker icons without remounting cluster
  useEffect(() => {
    const prevId = prevSelectedId.current
    const nextId = selected?.id ?? null
    if (prevId === nextId) return

    const apply = (id: string | null, on: boolean) => {
      if (!id) return
      const m = markerById.current.get(id)
      if (!m) return
      const loc = locations.find((l) => l.id === id)
      if (!loc) return
      const recommended = Boolean(highlightIds?.has(id))
      m.setIcon(makeTypeIcon(loc.type, { recommended, selected: on }))
      m.setZIndexOffset(on ? 800 : recommended ? 500 : 0)
      m.setOpacity(
        highlightIds?.size
          ? recommended || on
            ? 1
            : 0.35
          : selected && !on
            ? 0.5
            : 1,
      )
    }

    apply(prevId, false)
    apply(nextId, true)

    // Dim / restore siblings when entering or leaving a selection
    if (prevId == null || nextId == null) {
      for (const [id, m] of markerById.current) {
        if (id === nextId) continue
        const recommended = Boolean(highlightIds?.has(id))
        m.setOpacity(
          highlightIds?.size
            ? recommended
              ? 1
              : 0.35
            : nextId
              ? 0.5
              : 1,
        )
      }
    }

    prevSelectedId.current = nextId
  }, [selected, locations, highlightIds])

  return null
}

function accuracyRadius(accuracy: number | undefined): number | null {
  if (accuracy == null || !Number.isFinite(accuracy)) return null
  if (accuracy < ACCURACY_MIN) return ACCURACY_MIN
  return Math.min(accuracy, ACCURACY_MAX)
}

export function MapView({
  locations,
  selected,
  onSelect,
  highlightIds,
  anchor,
  radiusMeters,
  routeGeometry,
  altRouteGeometry,
  routeAmenities,
  onBoundsChange,
  onZoomChange,
  lockFit,
  center,
  zoom,
  userLocation,
  flyToUserToken,
}: {
  locations: LocationSummary[]
  selected: LocationSummary | null
  onSelect: (loc: LocationSummary) => void
  highlightIds?: Set<string>
  anchor?: { latitude: number; longitude: number } | null
  radiusMeters?: number | null
  /** Active route GeoJSON LineString coordinates [lng, lat][] */
  routeGeometry?: Array<[number, number]> | null
  /** Alternate route (dimmed) */
  altRouteGeometry?: Array<[number, number]> | null
  routeAmenities?: Array<{
    id: string
    name: string
    type: string
    latitude: number
    longitude: number
  }>
  onBoundsChange?: (b: MapBounds) => void
  onZoomChange?: (z: number) => void
  lockFit?: boolean
  center?: [number, number]
  zoom?: number
  userLocation?: UserLocationPoint | null
  flyToUserToken?: number
}) {
  const mapCenter = center || ([DEFAULT_LAT, DEFAULT_LNG] as [number, number])
  const mapZoom = zoom ?? DEFAULT_ZOOM
  const userAcc = userLocation ? accuracyRadius(userLocation.accuracy) : null
  const userIcon = makeUserLocationIcon()
  const routeLatLngs =
    routeGeometry && routeGeometry.length >= 2
      ? routeGeometry.map(([lng, lat]) => [lat, lng] as [number, number])
      : null
  const altLatLngs =
    altRouteGeometry && altRouteGeometry.length >= 2
      ? altRouteGeometry.map(([lng, lat]) => [lat, lng] as [number, number])
      : null

  return (
    <div className="mp-map-shell">
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        style={{ height: '100%', width: '100%', minHeight: 320 }}
        scrollWheelZoom
      >
        <InvalidateSize />
        <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
        <BoundsWatcher onBounds={onBoundsChange} onZoom={onZoomChange} />
        <FitBounds
          locations={locations}
          focusIds={highlightIds}
          anchor={anchor}
          lockFit={lockFit}
          routeGeometry={routeGeometry}
          altRouteGeometry={altRouteGeometry}
        />
        <FlyToUser userLocation={userLocation} flyToUserToken={flyToUserToken} />
        {anchor && radiusMeters ? (
          <Circle
            center={[anchor.latitude, anchor.longitude]}
            radius={radiusMeters}
            pathOptions={{ color: '#0b6e4f', weight: 1, fillOpacity: 0.06 }}
          />
        ) : null}
        {altLatLngs ? (
          <>
            <Polyline
              positions={altLatLngs}
              pathOptions={{ color: '#ffffff', weight: 8, opacity: 0.7 }}
            />
            <Polyline
              positions={altLatLngs}
              pathOptions={{ color: '#94a3b8', weight: 4, opacity: 0.65, dashArray: '8 10' }}
            />
          </>
        ) : null}
        {routeLatLngs ? (
          <>
            <Polyline
              positions={routeLatLngs}
              pathOptions={{ color: '#ffffff', weight: 10, opacity: 0.85 }}
            />
            <Polyline
              positions={routeLatLngs}
              pathOptions={{ color: '#0b6e4f', weight: 6, opacity: 0.95 }}
            />
          </>
        ) : null}
        {routeAmenities?.map((a) => (
          <Marker
            key={`amenity-${a.id}`}
            position={[a.latitude, a.longitude]}
            icon={makeTypeIcon(a.type as LocationSummary['type'], { recommended: true })}
            zIndexOffset={600}
          >
            <Popup>
              <strong>{a.name}</strong>
              <div>{a.type}</div>
            </Popup>
          </Marker>
        ))}
        {userLocation && userAcc != null ? (
          <Circle
            center={[userLocation.latitude, userLocation.longitude]}
            radius={userAcc}
            pathOptions={{ color: USER_COLOR, weight: 1, fillColor: USER_COLOR, fillOpacity: 0.12 }}
          />
        ) : null}
        {userLocation ? (
          <Marker
            position={[userLocation.latitude, userLocation.longitude]}
            icon={userIcon}
            zIndexOffset={1000}
          >
            <Popup>
              {userLocation.source === 'ip'
                ? `Ước lượng IP${userLocation.label ? ` · ${userLocation.label}` : ''}`
                : 'Vị trí của bạn'}
              {userLocation.accuracy != null
                ? ` (±${Math.round(userLocation.accuracy)}m)`
                : ''}
            </Popup>
          </Marker>
        ) : null}
        <ClusteredPoiMarkers
          locations={locations}
          selected={selected}
          onSelect={onSelect}
          highlightIds={highlightIds}
        />
      </MapContainer>
    </div>
  )
}
