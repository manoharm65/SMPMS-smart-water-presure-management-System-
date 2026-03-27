import { kml } from '@tmcw/togeojson'
import type { FeatureCollection } from 'geojson'

export interface PipeData {
  id: string
  coordinates: [number, number][]
  diameter?: number
}

export interface ValveData {
  id: string
  name: string
  lat: number
  lng: number
  diameter?: number
  status?: string
}

// Cluster of multiple valves
export interface ValveCluster {
  lat: number
  lng: number
  count: number
  valves: ValveData[]
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

export interface ValveFeature {
  lat: number
  lng: number
  data: ValveData
}

// Grid cell size in degrees per zoom level
function gridCellSize(zoom: number): number {
  return 360 / Math.pow(2, zoom + 4)
}

// Spatial index for O(n) bounding-box queries with grid-based clustering
export class SpatialIndex {
  private allValves: ValveFeature[] = []
  private minLat = Infinity
  private maxLat = -Infinity
  private minLng = Infinity
  private maxLng = -Infinity

  addValve(valve: ValveData) {
    const feature: ValveFeature = { lat: valve.lat, lng: valve.lng, data: valve }
    this.allValves.push(feature)
    this.minLat = Math.min(this.minLat, valve.lat)
    this.maxLat = Math.max(this.maxLat, valve.lat)
    this.minLng = Math.min(this.minLng, valve.lng)
    this.maxLng = Math.max(this.maxLng, valve.lng)
  }

  // Get all valves within a bounding box
  getValvesInBounds(minLat: number, maxLat: number, minLng: number, maxLng: number): ValveFeature[] {
    return this.allValves.filter(v =>
      v.lat >= minLat && v.lat <= maxLat &&
      v.lng >= minLng && v.lng <= maxLng
    )
  }

  // Cluster valves using grid approach — O(n) where n = visible valves
  clusterValves(zoom: number, minLat: number, maxLat: number, minLng: number, maxLng: number): ValveCluster[] {
    const visible = this.getValvesInBounds(minLat, maxLat, minLng, maxLng)
    if (visible.length === 0) return []

    if (zoom >= 14) {
      // No clustering at high zoom — return individual valves as single-item clusters
      return visible.map(v => ({
        lat: v.lat,
        lng: v.lng,
        count: 1,
        valves: [v.data],
        minLat: v.lat,
        maxLat: v.lat,
        minLng: v.lng,
        maxLng: v.lng,
      }))
    }

    // Grid-based clustering: group valves within same grid cell
    const cellSize = gridCellSize(zoom)
    const clusters = new Map<string, ValveCluster>()

    for (const v of visible) {
      const cellLat = Math.floor(v.lat / cellSize)
      const cellLng = Math.floor(v.lng / cellSize)
      const key = `${cellLat},${cellLng}`

      if (!clusters.has(key)) {
        clusters.set(key, {
          lat: 0, lng: 0, count: 0, valves: [],
          minLat: Infinity, maxLat: -Infinity, minLng: Infinity, maxLng: -Infinity,
        })
      }
      const cluster = clusters.get(key)!
      cluster.lat += v.lat
      cluster.lng += v.lng
      cluster.count += 1
      cluster.valves.push(v.data)
      cluster.minLat = Math.min(cluster.minLat, v.lat)
      cluster.maxLat = Math.max(cluster.maxLat, v.lat)
      cluster.minLng = Math.min(cluster.minLng, v.lng)
      cluster.maxLng = Math.max(cluster.maxLng, v.lng)
    }

    // Compute centroid for each cluster
    return Array.from(clusters.values()).map(c => ({
      lat: c.lat / c.count,
      lng: c.lng / c.count,
      count: c.count,
      valves: c.valves,
      minLat: c.minLat,
      maxLat: c.maxLat,
      minLng: c.minLng,
      maxLng: c.maxLng,
    }))
  }
}

// Check if a pipe (LineString) intersects the given bounds
function pipeIntersectsBounds(pipe: PipeData, minLat: number, maxLat: number, minLng: number, maxLng: number): boolean {
  for (const [lat, lng] of pipe.coordinates) {
    if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
      return true
    }
  }
  return false
}

// Get pipes within bounds (with margin for partially visible pipes)
export function getPipesInBounds(pipes: PipeData[], minLat: number, maxLat: number, minLng: number, maxLng: number): PipeData[] {
  return pipes.filter(pipe => pipeIntersectsBounds(pipe, minLat, maxLat, minLng, maxLng))
}

export interface KMLFilterOptions {
  valveTypeIds?: number[]
  minPipeDiameter?: number
}

export async function parseValvesFromKML(xml: XMLDocument, opts: KMLFilterOptions = {}): Promise<ValveData[]> {
  const gj = kml(xml) as FeatureCollection
  const valves: ValveData[] = []
  const { valveTypeIds } = opts

  for (const feature of gj.features) {
    if (feature.geometry?.type === 'Point') {
      const [lng, lat] = feature.geometry.coordinates as [number, number]
      const props = feature.properties ?? {}

      const typeId = props.TypeID !== undefined && props.TypeID !== '' ? Number(props.TypeID) : NaN
      if (valveTypeIds && valveTypeIds.length > 0 && !valveTypeIds.includes(typeId)) {
        continue
      }

      valves.push({
        id: String(props.ValveID ?? props.OBJECTID ?? valves.length + 1),
        name: String(props.ValveID ?? `Valve ${valves.length + 1}`),
        lat,
        lng,
        diameter: props.Diameter ? Number(props.Diameter) : undefined,
        status: props.Status ?? undefined,
      })
    }
  }

  return valves
}

export async function parsePipesFromKML(xml: XMLDocument, opts: KMLFilterOptions = {}): Promise<PipeData[]> {
  const gj = kml(xml) as FeatureCollection
  const pipes: PipeData[] = []
  const { minPipeDiameter } = opts

  for (const feature of gj.features) {
    if (feature.geometry?.type === 'LineString') {
      const coords = feature.geometry.coordinates as [number, number][]
      const latLng = coords.map(([lng, lat]) => [lat, lng] as [number, number])
      const props = feature.properties ?? {}

      const diameter = props.Diameter !== undefined && props.Diameter !== '' ? Number(props.Diameter) : undefined
      if (minPipeDiameter !== undefined && diameter !== undefined && diameter < minPipeDiameter) {
        continue
      }

      pipes.push({
        id: String(pipes.length + 1),
        coordinates: latLng,
        diameter,
      })
    }
  }

  return pipes
}

export async function loadAllKMLData(opts: KMLFilterOptions = {}): Promise<{
  pipes: PipeData[]
  valves: ValveData[]
}> {
  const kmlFiles = [
    'data/1c11262f-2cfb-424d-b4bb-a9cdd86d0c52.kml',
    'data/4f999482-f969-484e-9209-64e54fba9055.kml',
    'data/f6c32921-8975-44d3-9b55-2174396e0991.kml',
  ]

  const valves: ValveData[] = []
  const pipes: PipeData[] = []

  for (const file of kmlFiles) {
    try {
      const res = await fetch(`/${file}`)
      const text = await res.text()
      const parser = new DOMParser()
      const xml = parser.parseFromString(text, 'text/xml')

      if (file.includes('1c11262f')) {
        valves.push(...(await parseValvesFromKML(xml, opts)))
      } else {
        pipes.push(...(await parsePipesFromKML(xml, opts)))
      }
    } catch (e) {
      console.warn(`Failed to load KML file: ${file}`, e)
    }
  }

  return { pipes, valves }
}
