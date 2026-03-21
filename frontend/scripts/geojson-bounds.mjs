/*
Print dataset bounds (lng/lat) for a GeoJSON FeatureCollection.

Usage (from frontend/):
  node scripts/geojson-bounds.mjs public/data/kengeri/valves.geojson
*/

import fs from 'node:fs'

function usage() {
  // eslint-disable-next-line no-console
  console.log('Usage: node scripts/geojson-bounds.mjs <geojsonFilePath>')
  process.exit(1)
}

const filePath = process.argv[2]
if (!filePath) usage()

const obj = JSON.parse(fs.readFileSync(filePath, 'utf8'))
if (!obj || obj.type !== 'FeatureCollection' || !Array.isArray(obj.features)) {
  throw new Error('Not a GeoJSON FeatureCollection')
}

let minLng = Infinity
let minLat = Infinity
let maxLng = -Infinity
let maxLat = -Infinity
let n = 0

function upd(coord) {
  if (!coord || coord.length < 2) return
  const [lng, lat] = coord
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return
  minLng = Math.min(minLng, lng)
  minLat = Math.min(minLat, lat)
  maxLng = Math.max(maxLng, lng)
  maxLat = Math.max(maxLat, lat)
  n++
}

function walkGeometry(g) {
  if (!g) return
  const t = g.type
  const c = g.coordinates
  if (t === 'Point') return upd(c)
  if (t === 'MultiPoint' || t === 'LineString') {
    for (const p of c ?? []) upd(p)
    return
  }
  if (t === 'MultiLineString' || t === 'Polygon') {
    for (const ring of c ?? []) for (const p of ring ?? []) upd(p)
    return
  }
  if (t === 'MultiPolygon') {
    for (const poly of c ?? []) for (const ring of poly ?? []) for (const p of ring ?? []) upd(p)
  }
}

for (const f of obj.features) walkGeometry(f?.geometry)

// eslint-disable-next-line no-console
console.log(filePath)
// eslint-disable-next-line no-console
console.log('features:', obj.features.length)
// eslint-disable-next-line no-console
console.log('coords:', n)
// eslint-disable-next-line no-console
console.log('bbox(lng,lat):', [minLng, minLat, maxLng, maxLat].map((x) => x.toFixed(6)).join(','))
