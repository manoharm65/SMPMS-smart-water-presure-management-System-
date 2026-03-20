import type { FeatureCollection, Polygon } from 'geojson'

export interface ZoneFeatureProperties {
  id: string
  name: string
  centroid: [number, number]
}

export type ZoneFeatureCollection = FeatureCollection<Polygon, ZoneFeatureProperties>

export async function loadZonesGeoJSON(): Promise<ZoneFeatureCollection> {
  const res = await fetch('/src/data/zones.json')
  if (!res.ok) {
    throw new Error(`Failed to load zones.json: ${res.status}`)
  }
  return res.json() as Promise<ZoneFeatureCollection>
}
