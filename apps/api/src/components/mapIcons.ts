import L from 'leaflet'
import type { LocationType } from '@/types/location'
import { TYPE_COLORS } from '@/components/mapColors'

export { TYPE_COLORS }

const REC_RING = '#c2410c'

/** Compact glyphs (viewBox 0 0 24 24), white fill inside pin head. */
const GLYPHS: Record<LocationType, string> = {
  charging_station:
    '<path class="bolt" d="M13.4 2.2 6.8 13.4h4.4L9.6 21.8l8-12.4h-4.6z" fill="#fff"/>',
  store:
    '<path d="M4.5 9.2 6 5.5h12l1.5 3.7v1.1c0 1-.8 1.8-1.8 1.8-.6 0-1.1-.3-1.4-.7-.3.4-.8.7-1.4.7s-1.1-.3-1.4-.7c-.3.4-.8.7-1.4.7s-1.1-.3-1.4-.7c-.3.4-.8.7-1.4.7-1 0-1.8-.8-1.8-1.8V9.2zm1.2 4.2V19h4.2v-3.4h4.2V19h4.2v-5.6" fill="#fff"/>',
  showroom:
    '<path d="M5 20V7.5L12 4l7 3.5V20h-4.2v-5.2h-5.6V20H5zm4.2-8.4h1.8V9.8H9.2v1.8zm3.8 0h1.8V9.8H13v1.8zm-3.8 3.6h1.8v-1.8H9.2v1.8zm3.8 0h1.8v-1.8H13v1.8z" fill="#fff"/>',
  service_center:
    '<path d="M14.8 4.2a3.6 3.6 0 0 0-4.9 3.3c0 .5.1 1 .3 1.4L5 14.1a2 2 0 0 0 2.8 2.8l5.2-5.2c.4.2.9.3 1.4.3a3.6 3.6 0 0 0 3.3-4.9l-2.2 2.2-1.8-.4-.4-1.8 2.2-2.2a3.5 3.5 0 0 0-1.7-.7z" fill="#fff"/>',
  dealer:
    '<path d="M12 3.2 5.5 5.8v5.2c0 4 2.7 6.9 6.5 8.2 3.8-1.3 6.5-4.2 6.5-8.2V5.8L12 3.2zm0 3.3 3.8 1.5v3c0 2.4-1.5 4.3-3.8 5.3-2.3-1-3.8-2.9-3.8-5.3v-3L12 6.5z" fill="#fff"/>',
  parking:
    '<path d="M9.2 5.5h5.1c2.4 0 4.2 1.7 4.2 4.1S16.7 13.7 14.3 13.7h-2.6V18.5H9.2V5.5zm2.5 2.2v3.8h2.4c1.1 0 1.9-.7 1.9-1.9s-.8-1.9-1.9-1.9h-2.4z" fill="#fff"/>',
  rescue_team:
    '<path d="M9.6 4.5h4.8v5.1h5.1v4.8h-5.1v5.1H9.6v-5.1H4.5V9.6h5.1z" fill="#fff"/>',
  gas_station:
    '<path d="M6.5 4.5h7.2v12.2H6.5V4.5zm1.6 1.6v4.2h4V6.1h-4zM15.2 7.2h1.4v8.4c0 1.2.8 2.1 2 2.1s2-.9 2-2.1V9.4l-1.4-1.4V6.2l2.8 2.8v6.6c0 2.1-1.6 3.8-3.6 3.8s-3.6-1.7-3.6-3.8V7.2h.4zM7.2 17.8h5.8V19.5H7.2v-1.7z" fill="#fff"/>',
  university:
    '<path d="M12 4.2 3.5 8.5l8.5 4.3 7.2-3.6v4.8h1.8V8.5L12 4.2zm-5.2 9.2v3.1c0 .9 2.3 2.2 5.2 2.2s5.2-1.3 5.2-2.2v-3.1l-5.2 2.6-5.2-2.6z" fill="#fff"/>',
  hospital:
    '<path d="M5 20V6.2h4.2V4.5h5.6v1.7H19V20H5zm6.2-10.5h1.6v2.2h2.2v1.6h-2.2v2.2h-1.6v-2.2H9V11.7h2.2V9.5z" fill="#fff"/>',
  pharmacy:
    '<path d="M8.5 4.5h7v3.2h3.2v7H15.5v4.8h-7v-4.8H5.3v-7H8.5V4.5zm2.2 5.4H9.1v2.2h1.6v1.6h2.2v-1.6h1.6v-2.2h-1.6V9.9h-2.2v0z" fill="#fff"/>',
  atm:
    '<path d="M5 7.5h14v11H5V7.5zm2 2.2v6.6h10V9.7H7zm1.5 1.5h3.2v1.4H8.5V11.2zm0 2.4h7v1.4h-7v-1.4z" fill="#fff"/>',
  bank:
    '<path d="M12 3.5 4.5 7.2v2.1h15V7.2L12 3.5zM5.5 10.8v6.2H7.2v-6.2H5.5zm3.8 0v6.2h1.7v-6.2H9.3zm3.8 0v6.2h1.7v-6.2H13.1zm3.8 0v6.2h1.7v-6.2h-1.7zM4.5 18.5h15v1.5h-15V18.5z" fill="#fff"/>',
  police:
    '<path d="M12 3.2 5 6.5v4.8c0 4.2 2.9 7.4 7 8.7 4.1-1.3 7-4.5 7-8.7V6.5L12 3.2zm0 3.2 4.2 1.9v3.2c0 2.2-1.3 4-4.2 5.1-2.9-1.1-4.2-2.9-4.2-5.1V8.3L12 6.4z" fill="#fff"/>',
  fire_station:
    '<path d="M12 3.5c2.8 3.2 5.5 5.4 5.5 8.6 0 3.2-2.3 5.4-5.5 5.4S6.5 15.3 6.5 12.1c0-3.2 2.7-5.4 5.5-8.6zm0 5.2c-.9 1.2-1.8 2.2-1.8 3.4 0 1.2.8 2 1.8 2s1.8-.8 1.8-2c0-1.2-.9-2.2-1.8-3.4z" fill="#fff"/>',
  school:
    '<path d="M4.5 10.2 12 5.5l7.5 4.7v1.5L12 7.2 4.5 11.7v-1.5zm1.2 3.1h2.2V19H5.7v-5.7zm4.2 0h4.2V19h-4.2v-5.7zm6.4 0h2.2V19h-2.2v-5.7zM3.5 19.5h17v1.3h-17v-1.3z" fill="#fff"/>',
  marketplace:
    '<path d="M4.5 8.2 6 4.8h12l1.5 3.4v1.8H4.5V8.2zM5.5 11.5h13V19h-3.2v-4.2H8.7V19H5.5v-7.5z" fill="#fff"/>',
  bus_stop:
    '<path d="M7 4.5h10c1.2 0 2 .8 2 2v8.2c0 .9-.5 1.6-1.3 1.9L17 19.5h-1.6l-.6-2.2H9.2l-.6 2.2H7l-.7-2.7C5.5 16.3 5 15.6 5 14.7V6.5c0-1.2.8-2 2-2zm1.2 2.2v5.5h7.6V6.7H8.2zM8 15.2a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2zm8 0a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2z" fill="#fff"/>',
  subway_station:
    '<path d="M6 4.5h12v2.2H6V4.5zm1.5 3.5h9v9.2c0 1.4-1.1 2.5-2.5 2.5H10c-1.4 0-2.5-1.1-2.5-2.5V8zm2.2 2.2v5.5h1.6V13h2.4v2.7h1.6V10.2h-1.6v2.2h-2.4v-2.2H9.7z" fill="#fff"/>',
  park:
    '<path d="M12 3.5c2.2 2.4 4.5 4.2 4.5 7.2 0 2.6-2 4.5-4.5 4.5S7.5 13.3 7.5 10.7c0-3 2.3-4.8 4.5-7.2zm-6 14.2h12v1.8H6v-1.8z" fill="#fff"/>',
  tourist_attraction:
    '<path d="M12 3.2 13.8 8h5.2l-4.2 3.2 1.6 5.1L12 13.4 7.6 16.3 9.2 11.2 5 8h5.2L12 3.2z" fill="#fff"/>',
}

function colorFor(type: string): string {
  return TYPE_COLORS[type as LocationType] ?? TYPE_COLORS.charging_station
}

function glyphFor(type: string): string {
  return GLYPHS[type as LocationType] ?? GLYPHS.charging_station
}

/** Teardrop pin path — tip at bottom center (matches iconAnchor). */
function pinPath(): string {
  // Head centered ~ (16, 13), tip at (16, 30)
  return 'M16 2.2c-6.1 0-11 4.9-11 11 0 8.2 11 16.6 11 16.6S27 21.4 27 13.2c0-6.1-4.9-11-11-11z'
}

export type TypeIconOpts = {
  recommended?: boolean
  selected?: boolean
}

function buildSvgHtml(type: string, recommended: boolean, selected: boolean): string {
  const color = colorFor(type)
  // Selected wins visually over recommendation pulse
  const size = selected ? 40 : recommended ? 36 : 32
  const vbW = 32
  const vbH = 34
  const safeType = type.replace(/[^a-z0-9_]/gi, '_')

  const classes = [
    'mp-marker',
    `mp-marker--type-${safeType}`,
    recommended && !selected ? 'mp-marker--rec' : '',
    selected ? 'mp-marker--selected' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const recHalo =
    recommended && !selected
      ? `<circle cx="16" cy="13" r="12.6" fill="none" stroke="${REC_RING}" stroke-width="2.2"/>`
      : ''

  const ripples = selected
    ? `<span class="mp-marker-ripple" style="--mp-marker-color:${color}"></span>
       <span class="mp-marker-ripple mp-marker-ripple--delay" style="--mp-marker-color:${color}"></span>`
    : ''

  // Glyph sits in the circular head of the pin
  const glyphScale = selected ? 0.72 : 0.68
  const glyphTx = 16 - 12 * glyphScale
  const glyphTy = 13 - 12 * glyphScale

  return `<div class="${classes}" style="width:${size}px;height:${size}px;line-height:0">
${ripples}
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${vbW} ${vbH}" aria-hidden="true">
  ${recHalo}
  <path d="${pinPath()}" fill="#fff" transform="translate(16 16.5) scale(1.1) translate(-16 -16.5)"/>
  <path d="${pinPath()}" fill="${color}"${selected ? ' stroke="#fff" stroke-width="1.2"' : ''}/>
  <g transform="translate(${glyphTx} ${glyphTy}) scale(${glyphScale})">${glyphFor(type)}</g>
</svg></div>`
}

const iconCache = new Map<string, L.DivIcon>()

export function makeTypeIcon(type: string, opts?: TypeIconOpts): L.DivIcon {
  const recommended = Boolean(opts?.recommended)
  const selected = Boolean(opts?.selected)
  const key = `${type}:${recommended ? 1 : 0}:${selected ? 1 : 0}`
  const cached = iconCache.get(key)
  if (cached) return cached

  const size = selected ? 40 : recommended ? 36 : 32
  // Tip of pin ≈ bottom center of icon box
  const icon = new L.DivIcon({
    className: 'mp-marker-wrap',
    html: buildSvgHtml(type, recommended, selected),
    iconSize: [size, size],
    iconAnchor: [size / 2, size - 1],
    popupAnchor: [0, -size + 8],
  })
  iconCache.set(key, icon)
  return icon
}

const USER_COLOR = '#2563eb'
let userIconCache: L.DivIcon | null = null

/** Blue-dot “you are here” — distinct from POI type icons. */
export function makeUserLocationIcon(): L.DivIcon {
  if (userIconCache) return userIconCache
  const size = 22
  const html = `<div class="mp-user-marker" style="width:${size}px;height:${size}px;line-height:0">
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
  <circle cx="16" cy="16" r="14" fill="${USER_COLOR}" fill-opacity="0.22"/>
  <circle cx="16" cy="16" r="8.5" fill="#fff"/>
  <circle cx="16" cy="16" r="6.2" fill="${USER_COLOR}"/>
  <circle cx="16" cy="16" r="2.2" fill="#fff"/>
</svg></div>`
  userIconCache = new L.DivIcon({
    className: 'mp-marker-wrap',
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 + 2],
  })
  return userIconCache
}
