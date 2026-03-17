/*
Convert a KML export (valves + pipelines, optionally zones) into GeoJSON files
that this app already knows how to load.

Usage (from `frontend/`):
  node scripts/convert-kml-to-geojson.mjs <input.kml> --dataset solapur

Outputs (default):
  public/data/<dataset>/pipelines.geojson
  public/data/<dataset>/valves.geojson
  public/data/<dataset>/zones.geojson (only if polygon features exist)
*/

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import { DOMParser } from '@xmldom/xmldom'
import { kml as kmlToGeoJSON } from '@tmcw/togeojson'

function usage(exitCode = 0) {
  const msg = `\
KML → GeoJSON converter

Usage:
  node scripts/convert-kml-to-geojson.mjs <input.kml> [--dataset <name>] [--outDir <dir>]

Options:
  --dataset <name>   Dataset folder under public/data (default: kml)
  --outDir <dir>     Output directory (default: public/data/<dataset>)
  -h, --help         Show help

Examples:
  node scripts/convert-kml-to-geojson.mjs .\\data\\network.kml --dataset solapur
  node scripts/convert-kml-to-geojson.mjs network.kml --outDir public/data/custom
`
  // eslint-disable-next-line no-console
  console.log(msg)
  process.exit(exitCode)
}

function getArgValue(argv, name) {
  const idx = argv.indexOf(name)
  if (idx < 0) return undefined
  const v = argv[idx + 1]
  if (!v || v.startsWith('-')) return undefined
  return v
}

function hasFlag(argv, name) {
  return argv.includes(name)
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
    getProp(props, [
      'zoneId',
      'ZoneID',
      'ZONEID',
      'ZoneId',
      'zone_id',
      'dma',
      'DMA',
      'Water Zone',
      'WaterZone',
      'WATER_ZONE',
      'Water_Zone',
    ]) ??
    'DMA-UNKNOWN'
  )
}

function normalizeName(props, fallback) {
  return getProp(props, ['name', 'Name', 'NAME', 'AssetName', 'ASSET_NAME', 'SourceName', 'SOURCE_NAME']) ?? fallback
}

function assertFeatureCollection(fc) {
  if (!fc || fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
    throw new Error('Not a GeoJSON FeatureCollection')
  }
}

function toFeature(geometry, properties) {
  return { type: 'Feature', properties, geometry }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function writeFeatureCollection({ filePath, fc, kind, allowEmpty }) {
  assertFeatureCollection(fc)

  if (!allowEmpty && fc.features.length === 0 && (await fileExists(filePath))) {
    // eslint-disable-next-line no-console
    console.log(`Skipping ${kind}: 0 features (kept existing file)`)
    return false
  }

  await fs.writeFile(filePath, JSON.stringify(fc))
  // eslint-disable-next-line no-console
  console.log(`Wrote: ${filePath} (features: ${fc.features.length})`)
  return true
}

function splitAndNormalize(fc) {
  const pipelines = []
  const valves = []
  const zones = []

  let pipelineIdx = 0
  let valveIdx = 0
  let zoneIdx = 0

  for (const f of fc.features) {
    if (!f || !f.geometry) continue

    const g = f.geometry
    const props = { ...(f.properties ?? {}) }

    // Normalize common schema field names found in GIS exports.
    const zoneId = normalizeZoneId(props)
    props.zoneId = zoneId
    if (props.ZoneID != null && props.zoneId === 'DMA-UNKNOWN') props.zoneId = String(props.ZoneID)

    const rawValveId = getProp(props, ['valveId', 'ValveID', 'VALVEID', 'KGISValveID', 'OBJECTID'])
    if (rawValveId && props.valveId == null) props.valveId = rawValveId

    const rawPipelineId = getProp(props, ['pipelineId', 'PipelineID', 'PIPELINEID', 'PipeID', 'PIPEID', 'OBJECTID'])
    if (rawPipelineId && props.pipelineId == null) props.pipelineId = rawPipelineId

    if (g.type === 'LineString' || g.type === 'MultiLineString') {
      if (!getProp(props, ['pipelineId', 'id', 'code', 'name'])) {
        props.pipelineId = `KML-P-${++pipelineIdx}`
      }
      pipelines.push(toFeature(g, props))
      continue
    }

    if (g.type === 'Point') {
      if (!getProp(props, ['valveId', 'id', 'code', 'name'])) {
        props.valveId = `KML-V-${++valveIdx}`
      }
      props.name = normalizeName(props, props.valveId)
      valves.push(toFeature(g, props))
      continue
    }

    // Flatten MultiPoint so the existing map loader (Point-only) can consume it.
    if (g.type === 'MultiPoint') {
      const coords = Array.isArray(g.coordinates) ? g.coordinates : []
      for (const c of coords) {
        const p = { ...props }
        const idBase = getProp(p, ['valveId', 'id', 'code', 'name'])
        p.valveId = idBase ? `${idBase}-${++valveIdx}` : `KML-V-${++valveIdx}`
        p.name = normalizeName(p, p.valveId)
        valves.push(toFeature({ type: 'Point', coordinates: c }, p))
      }
      continue
    }

    if (g.type === 'Polygon' || g.type === 'MultiPolygon') {
      if (!getProp(props, ['zoneId', 'dma', 'DMA', 'id', 'code', 'name'])) {
        props.zoneId = `KML-Z-${++zoneIdx}`
      }
      props.name = normalizeName(props, props.zoneId)
      zones.push(toFeature(g, props))
      continue
    }

    // Ignore other geometry types (e.g., GeometryCollection).
  }

  return {
    pipelinesFc: { type: 'FeatureCollection', features: pipelines },
    valvesFc: { type: 'FeatureCollection', features: valves },
    zonesFc: { type: 'FeatureCollection', features: zones },
  }
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.length === 0 || hasFlag(argv, '--help') || hasFlag(argv, '-h')) usage(0)

  const input = argv.find((a) => !a.startsWith('-'))
  if (!input) usage(1)

  const dataset = (getArgValue(argv, '--dataset') ?? 'kml').trim() || 'kml'
  const outDirArg = getArgValue(argv, '--outDir')
  const outDir = outDirArg ? path.resolve(outDirArg) : path.resolve('public', 'data', dataset)

  const allowEmpty = hasFlag(argv, '--allowEmpty')

  const kmlText = await fs.readFile(path.resolve(input), 'utf8')
  const doc = new DOMParser().parseFromString(kmlText, 'text/xml')

  const fc = kmlToGeoJSON(doc)
  assertFeatureCollection(fc)

  const { pipelinesFc, valvesFc, zonesFc } = splitAndNormalize(fc)

  await fs.mkdir(outDir, { recursive: true })

  const outPipelines = path.join(outDir, 'pipelines.geojson')
  const outValves = path.join(outDir, 'valves.geojson')
  const outZones = path.join(outDir, 'zones.geojson')

  await writeFeatureCollection({ filePath: outPipelines, fc: pipelinesFc, kind: 'pipelines', allowEmpty })
  await writeFeatureCollection({ filePath: outValves, fc: valvesFc, kind: 'valves', allowEmpty })

  // Zones are optional in some exports. If we have polygon zones, write them.
  // If not, ensure an empty `zones.geojson` exists so the app can still load.
  if (zonesFc.features.length > 0) {
    await writeFeatureCollection({ filePath: outZones, fc: zonesFc, kind: 'zones', allowEmpty })
  } else if (!(await fileExists(outZones))) {
    await writeFeatureCollection({
      filePath: outZones,
      fc: { type: 'FeatureCollection', features: [] },
      kind: 'zones',
      allowEmpty: true,
    })
  }
}

await main()
