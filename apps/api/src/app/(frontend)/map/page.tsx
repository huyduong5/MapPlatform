import HomeClient from '../HomeClient'

/** Avoid static prerender — Leaflet / map UI needs the browser. */
export const dynamic = 'force-dynamic'

export default function MapPage() {
  return <HomeClient />
}
