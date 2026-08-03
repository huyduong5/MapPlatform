declare module '@/vendor/leaflet.markercluster/leaflet.markercluster.js'

declare module 'leaflet' {
  interface MarkerClusterGroupOptions {
    showCoverageOnHover?: boolean
    maxClusterRadius?: number
    spiderfyOnMaxZoom?: boolean
    disableClusteringAtZoom?: number
  }

  interface MarkerClusterGroup extends LayerGroup {
    clearLayers(): this
    addLayer(layer: Layer): this
  }

  function markerClusterGroup(options?: MarkerClusterGroupOptions): MarkerClusterGroup
}

export {}
