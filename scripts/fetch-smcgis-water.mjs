/*
Fetches Solapur Municipal Corporation (SMCGIS) Water Supply Network layers
(from the public qgis2web/OpenLayers export) and converts embedded GeoJSON
objects from `layers/*.js` into real GeoJSON files for this app.

Usage:
  node scripts/fetch-smcgis-water.mjs

Outputs:
  public/data/solapur/pipelines.geojson
  public/data/solapur/valves.geojson

Notes:
- `dist/` is build output; do not edit it. This writes to `public/`.
- SMCGIS layers include properties like "Water Zone"; we normalize to `zoneId`.
*/

import fs from 'node:fs/promises'
import path from 'node:path'

const BASE = 'https://smcgis.solapurcorporation.org/Web_Pages/PM_GATI_SHAKTI/Water_Supply_Network/'

const OUT_DIR = path.resolve('public', 'data', 'solapur')
const OUT_PIPELINES = path.join(OUT_DIR, 'pipelines.geojson')
const OUT_VALVES = path.join(OUT_DIR, 'valves.geojson')

const PIPELINE_LAYER = 'layers/Pipeline_Network_6.js'
const POINT_LAYERS = [
  'layers/Water_Treatment_Plant_2.js',
  'layers/Water_Source_3.js',
  'layers/Storage_Tank_4.js',
  'layers/Raw_Water_Station_5.js',
  'layers/SMC_Bore_7.js',
]

function assertFeatureCollection(fc) {
  if (!fc || fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
    throw new Error('Not a GeoJSON FeatureCollection')
  }
}

function getProp(obj, keys) {
  if (!obj) return undefined
  for (const key of keys) {
    const v = obj[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  }
  return undefined
}

function normalizeZoneId(props) {
  return (
    getProp(props, ['zoneId', 'dma', 'DMA', 'Water Zone', 'WaterZone', 'WATER_ZONE', 'Water_Zone']) ??
    'DMA-UNKNOWN'
  )
}

function normalizeName(props, fallback) {
  return (
    getProp(props, ['name', 'Name', 'NAME', 'AssetName', 'ASSET_NAME', 'SourceName', 'SOURCE_NAME']) ??
    fallback
  )
}

function extractJsonObjectLiteral(jsText) {
  const m = /var\s+json_[A-Za-z0-9_]+\s*=\s*/.exec(jsText)
  if (!m) throw new Error('Could not find `var json_* =` in layer JS')

  const startSearch = m.index + m[0].length
  const start = jsText.indexOf('{', startSearch)
  if (start < 0) throw new Error('Could not find JSON object start')

  let depth = 0
  let inString = false
  let escape = false

  for (let i = start; i < jsText.length; i++) {
    const ch = jsText[i]

    if (inString) {
      if (escape) {
        escape = false
        continue
      }
      if (ch === '\\') {
        escape = true
        continue
      }
      if (ch === '"') {
        inString = false
      }
      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }

    if (ch === '{') depth++
    else if (ch === '}') depth--

    if (depth === 0) {
      return jsText.slice(start, i + 1)
    }
  }

  throw new Error('Unbalanced braces while extracting JSON')
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      Accept: 'text/html,application/javascript,application/json;q=0.9,*/*;q=0.8',
    },
  })
  if (!res.ok) throw new Error(`Fetch failed ${res.status} ${url}`)
  return await res.text()
}

async function fetchLayerFeatureCollection(relativeUrl) {
  const url = new URL(relativeUrl, BASE).toString()
  const jsText = await fetchText(url)
  const jsonLiteral = extractJsonObjectLiteral(jsText)
  const fc = JSON.parse(jsonLiteral)
  assertFeatureCollection(fc)
  return fc
}

function normalizePipelines(fc) {
  const features = []
  let idx = 0

  for (const f of fc.features) {
    if (!f || !f.geometry) continue
    const t = f.geometry.type
    if (t !== 'LineString' && t !== 'MultiLineString') continue

    const props = { ...(f.properties ?? {}) }
    props.zoneId = normalizeZoneId(props)
    if (!getProp(props, ['pipelineId', 'id', 'code', 'name'])) {
      props.pipelineId = `SMC-P-${++idx}`
    }

    features.push({
      type: 'Feature',
      properties: props,
      geometry: f.geometry,
    })
  }

  return { type: 'FeatureCollection', features }
}

function normalizePoints(layerName, fc) {
  const features = []
  let idx = 0

  for (const f of fc.features) {
    if (!f || !f.geometry) continue
    if (f.geometry.type !== 'Point') continue

    const props = { ...(f.properties ?? {}) }
    props.zoneId = normalizeZoneId(props)
    props.sourceLayer = layerName.replace(/^layers\//, '').replace(/\.js$/i, '')

    const baseId = props.sourceLayer.toUpperCase().replace(/[^A-Z0-9]+/g, '_')
    if (!getProp(props, ['valveId', 'id', 'code', 'name'])) {
      props.valveId = `SMC-${baseId}-${++idx}`
    }

    props.name = normalizeName(props, props.valveId)

    features.push({
      type: 'Feature',
      properties: props,
      geometry: f.geometry,
    })
  }

  return features
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true })

  console.log('Fetching pipelines...')
  const pipelineFcRaw = await fetchLayerFeatureCollection(PIPELINE_LAYER)
  const pipelineFc = normalizePipelines(pipelineFcRaw)
  await fs.writeFile(OUT_PIPELINES, JSON.stringify(pipelineFc))
  console.log(`Wrote ${OUT_PIPELINES} (features: ${pipelineFc.features.length})`)

  console.log('Fetching point assets (sources/tanks/bores/WTP/stations)...')
  const allPoints = []
  for (const layer of POINT_LAYERS) {
    const fc = await fetchLayerFeatureCollection(layer)
    allPoints.push(...normalizePoints(layer, fc))
    console.log(`  + ${layer} (points: ${allPoints.length})`)
  }

  const valvesFc = { type: 'FeatureCollection', features: allPoints }
  await fs.writeFile(OUT_VALVES, JSON.stringify(valvesFc))
  console.log(`Wrote ${OUT_VALVES} (features: ${valvesFc.features.length})`)

  console.log('Done.')
}

await main()
