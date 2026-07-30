'use client'

import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { useEffect, useRef } from 'react'
import type { LocationSummary } from '@/types/location'
import { isRealPoiName } from '@/lib/placeFormat'
import type { MapBounds } from '@/services/locationApi'
import { makeTypeIcon, makeUserLocationIcon } from '@/components/mapIcons'
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
const ACCURACY_MAX = 5000

export type UserLocationPoint = {
  latitude: number
  longitude: number
  accuracy?: number
}

function FitBounds({
  locations,
  focusIds,
  anchor,
  lockFit,
}: {
  locations: LocationSummary[]
  focusIds?: Set<string>
  anchor?: { latitude: number; longitude: number } | null
  lockFit?: boolean
}) {
  const map = useMap()
  useEffect(() => {
    if (lockFit) return
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
  }, [locations, focusIds, anchor, map, lockFit])
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
    map.flyTo([userLocation.latitude, userLocation.longitude], 16, { duration: 0.6 })
  }, [flyToUserToken, userLocation, map])

  return null
}

function LocateControl({
  locateActive,
  locateBusy,
  onToggleLocate,
}: {
  locateActive: boolean
  locateBusy: boolean
  onToggleLocate?: () => void
}) {
  const map = useMap()

  useEffect(() => {
    if (!onToggleLocate) return

    const Control = L.Control.extend({
      onAdd() {
        const wrap = L.DomUtil.create('div', 'leaflet-bar mp-locate-control')
        const btn = L.DomUtil.create('button', 'mp-locate-btn', wrap) as HTMLButtonElement
        btn.type = 'button'
        btn.title = locateActive ? 'Tắt định vị' : 'Bật định vị'
        btn.setAttribute('aria-label', btn.title)
        btn.setAttribute('aria-pressed', locateActive ? 'true' : 'false')
        btn.textContent = '◎'
        if (locateActive) btn.classList.add('is-active')
        if (locateBusy) btn.disabled = true

        L.DomEvent.disableClickPropagation(wrap)
        L.DomEvent.on(btn, 'click', (e) => {
          L.DomEvent.stop(e)
          onToggleLocate()
        })
        return wrap
      },
    })

    const control = new Control({ position: 'topleft' })
    map.addControl(control)
    return () => {
      map.removeControl(control)
    }
  }, [map, onToggleLocate, locateActive, locateBusy])

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

    for (const loc of locations) {
      if (!isRealPoiName(loc.name)) continue
      const recommended = Boolean(highlightIds?.has(loc.id))
      const icon = makeTypeIcon(loc.type, { recommended })
      const m = L.marker([loc.latitude, loc.longitude], {
        icon,
        opacity: highlightIds?.size
          ? recommended
            ? 1
            : 0.35
          : selected && selected.id !== loc.id
            ? 0.55
            : 1,
        zIndexOffset: recommended ? 500 : 0,
      })
      m.bindPopup(
        `<strong>${escapeHtml(loc.name)}</strong>` +
          `<div style="font-size:12px;margin-top:4px">${escapeHtml(loc.type)}</div>` +
          `<div style="font-size:12px;margin-top:4px">${escapeHtml(loc.address || '')}</div>`,
      )
      m.on('click', () => onSelect(loc))
      clusterGroup.addLayer(m)
    }

    map.addLayer(clusterGroup)
    return () => {
      map.removeLayer(clusterGroup)
    }
  }, [map, locations, selected, onSelect, highlightIds])

  return null
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function accuracyRadius(accuracy: number | undefined): number | null {
  if (accuracy == null || !Number.isFinite(accuracy)) return null
  if (accuracy < ACCURACY_MIN || accuracy > ACCURACY_MAX) return null
  return accuracy
}

export function MapView({
  locations,
  selected,
  onSelect,
  highlightIds,
  anchor,
  radiusMeters,
  onBoundsChange,
  onZoomChange,
  lockFit,
  center,
  zoom,
  userLocation,
  flyToUserToken,
  locateActive = false,
  locateBusy = false,
  onToggleLocate,
}: {
  locations: LocationSummary[]
  selected: LocationSummary | null
  onSelect: (loc: LocationSummary) => void
  highlightIds?: Set<string>
  anchor?: { latitude: number; longitude: number } | null
  radiusMeters?: number | null
  onBoundsChange?: (b: MapBounds) => void
  onZoomChange?: (z: number) => void
  lockFit?: boolean
  center?: [number, number]
  zoom?: number
  userLocation?: UserLocationPoint | null
  flyToUserToken?: number
  locateActive?: boolean
  locateBusy?: boolean
  onToggleLocate?: () => void
}) {
  const mapCenter = center || ([DEFAULT_LAT, DEFAULT_LNG] as [number, number])
  const mapZoom = zoom ?? DEFAULT_ZOOM
  const userAcc = userLocation ? accuracyRadius(userLocation.accuracy) : null
  const userIcon = makeUserLocationIcon()

  return (
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
      />
      <FlyToUser userLocation={userLocation} flyToUserToken={flyToUserToken} />
      <LocateControl
        locateActive={locateActive}
        locateBusy={locateBusy}
        onToggleLocate={onToggleLocate}
      />
      {anchor && radiusMeters ? (
        <Circle
          center={[anchor.latitude, anchor.longitude]}
          radius={radiusMeters}
          pathOptions={{ color: '#0b6e4f', weight: 1, fillOpacity: 0.06 }}
        />
      ) : null}
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
          <Popup>Vị trí của bạn</Popup>
        </Marker>
      ) : null}
      <ClusteredPoiMarkers
        locations={locations}
        selected={selected}
        onSelect={onSelect}
        highlightIds={highlightIds}
      />
    </MapContainer>
  )
}
