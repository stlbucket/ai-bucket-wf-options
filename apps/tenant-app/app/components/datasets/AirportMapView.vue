<script setup lang="ts">
import { Popup } from 'mapbox-gl'
import type { GeoJSONSource } from 'mapbox-gl'
import type { AirportMapPoint } from '@function-bucket/fnb-types'

const props = defineProps<{
  points: AirportMapPoint[]
  fetching: boolean
}>()

const MAP_ID = 'airports-map'
// default viewport = continental US (index.ui.md)
const US_CENTER: [number, number] = [-98.5795, 39.8283]
const US_ZOOM = 3.5

function toGeoJson(points: AirportMapPoint[]) {
  return {
    type: 'FeatureCollection' as const,
    features: points.map((p) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
      properties: { id: p.id, name: p.name, ident: p.ident, airportType: p.type },
    })),
  }
}

// UC6 — pull the resolved Nuxt UI primary token rather than hardcoding a hex.
// The theme variable resolves to oklch(...), which Mapbox GL's color parser rejects
// (layers fail silently — no pins). Resolve it to rgb() through a probe element.
function resolvedPrimary(): string {
  const fallback = '#00c16a'
  if (typeof window === 'undefined') return fallback
  const probe = document.createElement('span')
  probe.style.display = 'none'
  probe.style.color = 'var(--ui-primary)'
  document.body.appendChild(probe)
  const rgb = getComputedStyle(probe).color
  probe.remove()
  return /^(rgb|#|hsl)/.test(rgb) ? rgb : fallback
}

useMapbox(MAP_ID, (map) => {
  if (map.getSource('airports')) return
  const primary = resolvedPrimary()

  map.addSource('airports', {
    type: 'geojson',
    data: toGeoJson(props.points),
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 50,
  })

  map.addLayer({
    id: 'airport-clusters',
    type: 'circle',
    source: 'airports',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': primary,
      'circle-opacity': 0.8,
      'circle-radius': ['step', ['get', 'point_count'], 16, 50, 22, 250, 30],
    },
  })

  map.addLayer({
    id: 'airport-cluster-counts',
    type: 'symbol',
    source: 'airports',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-size': 12,
    },
    paint: { 'text-color': '#ffffff' },
  })

  map.addLayer({
    id: 'airport-points',
    type: 'circle',
    source: 'airports',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': primary,
      'circle-radius': 6,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#ffffff',
    },
  })

  map.on('click', 'airport-clusters', (e) => {
    const feature = map.queryRenderedFeatures(e.point, { layers: ['airport-clusters'] })[0]
    const clusterId = feature?.properties?.cluster_id
    if (clusterId == null) return
    const source = map.getSource('airports') as GeoJSONSource
    source.getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err || zoom == null) return
      map.easeTo({
        center: (feature.geometry as GeoJSON.Point).coordinates as [number, number],
        zoom,
      })
    })
  })

  map.on('click', 'airport-points', (e) => {
    const feature = e.features?.[0]
    if (!feature) return
    const { id, name, ident, airportType } = feature.properties ?? {}

    const content = document.createElement('div')
    const link = document.createElement('a')
    link.textContent = String(name)
    link.href = `/tenant/datasets/airports/${id}`
    link.className = 'font-medium underline'
    link.addEventListener('click', (ev) => {
      ev.preventDefault()
      navigateTo(`/datasets/airports/${id}`)
    })
    const identLine = document.createElement('div')
    identLine.textContent = String(ident)
    identLine.className = 'text-xs font-mono'
    const typeLine = document.createElement('div')
    typeLine.textContent = airportTypeLabel(String(airportType) as never)
    typeLine.className = 'text-xs'
    content.appendChild(link)
    content.appendChild(identLine)
    content.appendChild(typeLine)

    new Popup()
      .setLngLat((feature.geometry as GeoJSON.Point).coordinates as [number, number])
      .setDOMContent(content)
      .addTo(map)
  })

  for (const layer of ['airport-clusters', 'airport-points']) {
    map.on('mouseenter', layer, () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', layer, () => {
      map.getCanvas().style.cursor = ''
    })
  }
})

// the points query resolves after the map is up (and re-runs when include-closed toggles) —
// keep the source in sync
watch(
  () => props.points,
  (points) => {
    useMapbox(MAP_ID, (map) => {
      const source = map.getSource('airports') as GeoJSONSource | undefined
      source?.setData(toGeoJson(points))
    })
  },
)
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="h-[70vh] w-full rounded-lg overflow-hidden">
      <MapboxMap
        :map-id="MAP_ID"
        class="w-full h-full"
        :options="{
          style: 'mapbox://styles/mapbox/streets-v12',
          center: US_CENTER,
          zoom: US_ZOOM,
        }"
      />
    </div>
    <p
      v-if="fetching"
      class="text-xs text-muted"
    >
      Loading map points…
    </p>
  </div>
</template>
