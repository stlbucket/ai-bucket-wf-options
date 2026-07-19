<script setup lang="ts">
import { Popup } from 'mapbox-gl'
import type { GeoJSONSource } from 'mapbox-gl'
import type { BreweryMapPoint } from '@function-bucket/fnb-types'

const props = defineProps<{
  points: BreweryMapPoint[]
  ungeocodedCount: number
  fetching: boolean
}>()

const MAP_ID = 'breweries-map'
// default viewport = continental US (user decision, index.ui.md)
const US_CENTER: [number, number] = [-98.5795, 39.8283]
const US_ZOOM = 3.5

function toGeoJson(points: BreweryMapPoint[]) {
  return {
    type: 'FeatureCollection' as const,
    features: points.map((p) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
      properties: { id: p.id, name: p.name, breweryType: p.breweryType },
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
  if (map.getSource('breweries')) return
  const primary = resolvedPrimary()

  map.addSource('breweries', {
    type: 'geojson',
    data: toGeoJson(props.points),
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 50,
  })

  map.addLayer({
    id: 'brewery-clusters',
    type: 'circle',
    source: 'breweries',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': primary,
      'circle-opacity': 0.8,
      'circle-radius': ['step', ['get', 'point_count'], 16, 50, 22, 250, 30],
    },
  })

  map.addLayer({
    id: 'brewery-cluster-counts',
    type: 'symbol',
    source: 'breweries',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-size': 12,
    },
    paint: { 'text-color': '#ffffff' },
  })

  map.addLayer({
    id: 'brewery-points',
    type: 'circle',
    source: 'breweries',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': primary,
      'circle-radius': 6,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#ffffff',
    },
  })

  map.on('click', 'brewery-clusters', (e) => {
    const feature = map.queryRenderedFeatures(e.point, { layers: ['brewery-clusters'] })[0]
    const clusterId = feature?.properties?.cluster_id
    if (clusterId == null) return
    const source = map.getSource('breweries') as GeoJSONSource
    source.getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err || zoom == null) return
      map.easeTo({
        center: (feature.geometry as GeoJSON.Point).coordinates as [number, number],
        zoom,
      })
    })
  })

  map.on('click', 'brewery-points', (e) => {
    const feature = e.features?.[0]
    if (!feature) return
    const { id, name, breweryType } = feature.properties ?? {}

    const content = document.createElement('div')
    const link = document.createElement('a')
    link.textContent = String(name)
    link.href = `/tenant/datasets/breweries/${id}`
    link.className = 'font-medium underline'
    link.addEventListener('click', (ev) => {
      ev.preventDefault()
      navigateTo(`/datasets/breweries/${id}`)
    })
    const typeLine = document.createElement('div')
    typeLine.textContent = String(breweryType).toLowerCase()
    typeLine.className = 'text-xs'
    content.appendChild(link)
    content.appendChild(typeLine)

    new Popup()
      .setLngLat((feature.geometry as GeoJSON.Point).coordinates as [number, number])
      .setDOMContent(content)
      .addTo(map)
  })

  for (const layer of ['brewery-clusters', 'brewery-points']) {
    map.on('mouseenter', layer, () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', layer, () => {
      map.getCanvas().style.cursor = ''
    })
  }
})

// the points query resolves after the map is up — keep the source in sync
watch(
  () => props.points,
  (points) => {
    useMapbox(MAP_ID, (map) => {
      const source = map.getSource('breweries') as GeoJSONSource | undefined
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
    <p
      v-else-if="ungeocodedCount > 0"
      class="text-xs text-muted"
    >
      {{ ungeocodedCount.toLocaleString() }} breweries have no coordinates and are not shown
    </p>
  </div>
</template>
