import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
  LineString,
  MultiLineString,
  MultiPolygon,
  Point,
  Polygon,
} from 'geojson'
import type { LatLngTuple } from 'leaflet'
import type { PipelineSegment, Valve, ZoneGeo } from '../store/dashboardStore'

export type MapDataConfig = {
  zonesUrl: string
  pipelinesUrl: string
  valvesUrl: string
}

export type LoadedMapData = {
  zonesGeo: ZoneGeo[]
  pipelines: PipelineSegment[]
  valves: Valve[]
}

function toLatLngTuple(coord: number[]): LatLngTuple {
  // GeoJSON uses [lng, lat]
  const [lng, lat] = coord
  return [lat, lng]
}

function centroidOfLatLng(points: LatLngTuple[]): LatLngTuple {
  if (points.length === 0) return [0, 0]
  let sumLat = 0
  let sumLng = 0
  for (const [lat, lng] of points) {
    sumLat += lat
    sumLng += lng
  }
  return [sumLat / points.length, sumLng / points.length]
}

function getStringProp(props: GeoJsonProperties | null | undefined, key: string) {
  const v = props?.[key]
  return typeof v === 'string' ? v : undefined
}

function getRequiredId(
  feature: Feature<Geometry, GeoJsonProperties>,
  candidates: string[],
  fallback: string,
) {
  for (const c of candidates) {
    const v = getStringProp(feature.properties, c)
    if (v && v.trim()) return v.trim()
  }

  if (typeof feature.id === 'string' && feature.id.trim()) return feature.id.trim()
  return fallback
}

async function fetchGeoJSON<T extends Geometry>(url: string) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`)
  return (await res.json()) as FeatureCollection<T, GeoJsonProperties>
}

function polygonsToRings(geometry: Polygon | MultiPolygon): number[][][] {
  return geometry.type === 'Polygon' ? [geometry.coordinates[0]] : geometry.coordinates.map((p) => p[0])
}

function linesToPaths(geometry: LineString | MultiLineString): number[][] {
  return geometry.type === 'LineString' ? geometry.coordinates : geometry.coordinates.flat(1)
}

export function parseZones(zonesFc: FeatureCollection<Polygon | MultiPolygon, GeoJsonProperties>): ZoneGeo[] {
  const zones: ZoneGeo[] = []
  for (const [idx, f] of zonesFc.features.entries()) {
    if (!f.geometry) continue
    if (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon') continue

    const id = getRequiredId(f, ['zoneId', 'dma', 'DMA', 'id', 'code', 'name'], `ZONE-${idx + 1}`)
    const name = getStringProp(f.properties, 'name') ?? id

    const rings = polygonsToRings(f.geometry)
    // Use the outer ring of the first polygon for display
    const outer = rings[0] ?? []
    const points = outer.map(toLatLngTuple)

    zones.push({
      id,
      name,
      points,
      centroid: centroidOfLatLng(points),
    })
  }
  return zones
}

export function parsePipelines(
  fc: FeatureCollection<LineString | MultiLineString, GeoJsonProperties>,
): PipelineSegment[] {
  const pipelines: PipelineSegment[] = []
  for (const [idx, f] of fc.features.entries()) {
    if (!f.geometry) continue
    if (f.geometry.type !== 'LineString' && f.geometry.type !== 'MultiLineString') continue

    const id = getRequiredId(f, ['pipelineId', 'id', 'code', 'name'], `P-${idx + 1}`)
    const zoneId = getStringProp(f.properties, 'zoneId') ?? getStringProp(f.properties, 'dma') ?? 'DMA-UNKNOWN'

    const coords = linesToPaths(f.geometry)
    const path = coords.map(toLatLngTuple)
    pipelines.push({ id, zoneId, path })
  }
  return pipelines
}

export function parseValves(fc: FeatureCollection<Point, GeoJsonProperties>): Valve[] {
  const valves: Valve[] = []
  for (const [idx, f] of fc.features.entries()) {
    if (!f.geometry) continue
    if (f.geometry.type !== 'Point') continue

    const id = getRequiredId(f, ['valveId', 'id', 'code', 'name'], `V-${idx + 1}`)
    const name = getStringProp(f.properties, 'name') ?? `Valve ${id}`
    const zoneId = getStringProp(f.properties, 'zoneId') ?? getStringProp(f.properties, 'dma') ?? 'DMA-UNKNOWN'
    valves.push({ id, name, zoneId, position: toLatLngTuple(f.geometry.coordinates) })
  }
  return valves
}

export async function loadMapData(cfg: MapDataConfig): Promise<LoadedMapData> {
  const [zonesFc, pipelinesFc, valvesFc] = await Promise.all([
    fetchGeoJSON<Polygon | MultiPolygon>(cfg.zonesUrl),
    fetchGeoJSON<LineString | MultiLineString>(cfg.pipelinesUrl),
    fetchGeoJSON<Point>(cfg.valvesUrl),
  ])

  return {
    zonesGeo: parseZones(zonesFc),
    pipelines: parsePipelines(pipelinesFc),
    valves: parseValves(valvesFc),
  }
}
