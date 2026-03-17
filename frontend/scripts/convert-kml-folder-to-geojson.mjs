/*
Convert ALL KML files in a folder into merged GeoJSON layers for this app.

- Any Point features become valves
- Any LineString/MultiLineString features become pipelines
- Any Polygon/MultiPolygon features become zones

Usage (from repo root):
  node frontend/scripts/convert-kml-folder-to-geojson.mjs "frontend/banglore data" --dataset solapur

Outputs:
  frontend/public/data/<dataset>/valves.geojson
  frontend/public/data/<dataset>/pipelines.geojson
  frontend/public/data/<dataset>/zones.geojson
*/

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import { DOMParser } from '@xmldom/xmldom'
import { kml as kmlToGeoJSON } from '@tmcw/togeojson'

function usage(exitCode = 0) {
  // eslint-disable-next-line no-console
  console.log(`\
KML folder → GeoJSON layers

Usage:
  node scripts/convert-kml-folder-to-geojson.mjs <folderPath> [--dataset <name>]

Options:
  --dataset <name>   Output dataset folder under public/data (default: solapur)
  -h, --help         Show help
`)
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
  return getProp(props, ['name', 'Name', 'NAME', 'ValveID', 'PipelineID', 'OBJECTID']) ?? fallback
}

function parseKmlTextToFc(kmlText) {
  const doc = new DOMParser().parseFromString(kmlText, 'text/xml')
  const fc = kmlToGeoJSON(doc)
  assertFeatureCollection(fc)
  return fc
}

function toFeature(geometry, properties) {
  return { type: 'Feature', geometry, properties }
}

function mergeCollections({ kmlFileName, fc, out }) {
  let valveIdx = out.valveIdx
  let pipelineIdx = out.pipelineIdx
  let zoneIdx = out.zoneIdx

  for (const f of fc.features) {
    if (!f || !f.geometry) continue

    const g = f.geometry
    const props = { ...(f.properties ?? {}) }

    props.zoneId = normalizeZoneId(props)
    props.sourceFile = kmlFileName

    if (g.type === 'Point') {
      const rawValveId = getProp(props, ['valveId', 'ValveID', 'VALVEID', 'KGISValveID', 'OBJECTID'])
      props.valveId = rawValveId ?? props.valveId
      if (!getProp(props, ['valveId', 'id', 'code', 'name'])) props.valveId = `KML-V-${++valveIdx}`
      props.name = normalizeName(props, props.valveId)
      out.valves.push(toFeature(g, props))
      continue
    }

    if (g.type === 'MultiPoint') {
      const coords = Array.isArray(g.coordinates) ? g.coordinates : []
      for (const c of coords) {
        const p = { ...props }
        const rawValveId = getProp(p, ['valveId', 'ValveID', 'VALVEID', 'KGISValveID', 'OBJECTID'])
        const base = rawValveId ?? getProp(p, ['id', 'name', 'Name'])
        p.valveId = base ? `${base}-${++valveIdx}` : `KML-V-${++valveIdx}`
        p.name = normalizeName(p, p.valveId)
        out.valves.push(toFeature({ type: 'Point', coordinates: c }, p))
      }
      continue
    }

    if (g.type === 'LineString' || g.type === 'MultiLineString') {
      const rawPipelineId = getProp(props, ['pipelineId', 'PipelineID', 'PIPELINEID', 'PipeID', 'PIPEID', 'OBJECTID'])
      props.pipelineId = rawPipelineId ?? props.pipelineId
      if (!getProp(props, ['pipelineId', 'id', 'code', 'name'])) props.pipelineId = `KML-P-${++pipelineIdx}`
      props.name = normalizeName(props, props.pipelineId)
      out.pipelines.push(toFeature(g, props))
      continue
    }

    if (g.type === 'Polygon' || g.type === 'MultiPolygon') {
      const rawZoneId = getProp(props, ['zoneId', 'ZoneID', 'DMA', 'OBJECTID', 'name', 'Name'])
      props.zoneId = rawZoneId ?? props.zoneId
      if (!getProp(props, ['zoneId', 'id', 'code', 'name'])) props.zoneId = `KML-Z-${++zoneIdx}`
      props.name = normalizeName(props, props.zoneId)
      out.zones.push(toFeature(g, props))
      continue
    }
  }

  out.valveIdx = valveIdx
  out.pipelineIdx = pipelineIdx
  out.zoneIdx = zoneIdx
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.length === 0 || hasFlag(argv, '--help') || hasFlag(argv, '-h')) usage(0)

  const folderPathArg = argv.find((a) => !a.startsWith('-'))
  if (!folderPathArg) usage(1)

  const dataset = (getArgValue(argv, '--dataset') ?? 'solapur').trim() || 'solapur'
  const folderPath = path.resolve(folderPathArg)

  const entries = await fs.readdir(folderPath, { withFileTypes: true })
  const kmlFiles = entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.kml'))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b))

  if (kmlFiles.length === 0) {
    throw new Error(`No .kml files found in: ${folderPath}`)
  }

  const out = {
    valves: [],
    pipelines: [],
    zones: [],
    valveIdx: 0,
    pipelineIdx: 0,
    zoneIdx: 0,
  }

  // eslint-disable-next-line no-console
  console.log(`Reading ${kmlFiles.length} KML files from: ${folderPath}`)

  for (const fileName of kmlFiles) {
    const abs = path.join(folderPath, fileName)
    const text = await fs.readFile(abs, 'utf8')
    const fc = parseKmlTextToFc(text)
    mergeCollections({ kmlFileName: fileName, fc, out })
    // eslint-disable-next-line no-console
    console.log(`  + ${fileName}`)
  }

  const outDir = path.resolve('public', 'data', dataset)
  await fs.mkdir(outDir, { recursive: true })

  const valvesFc = { type: 'FeatureCollection', features: out.valves }
  const pipelinesFc = { type: 'FeatureCollection', features: out.pipelines }
  const zonesFc = { type: 'FeatureCollection', features: out.zones }

  await fs.writeFile(path.join(outDir, 'valves.geojson'), JSON.stringify(valvesFc))
  await fs.writeFile(path.join(outDir, 'pipelines.geojson'), JSON.stringify(pipelinesFc))
  await fs.writeFile(path.join(outDir, 'zones.geojson'), JSON.stringify(zonesFc))

  // eslint-disable-next-line no-console
  console.log(`Wrote ${dataset} valves: ${out.valves.length}`)
  // eslint-disable-next-line no-console
  console.log(`Wrote ${dataset} pipelines: ${out.pipelines.length}`)
  // eslint-disable-next-line no-console
  console.log(`Wrote ${dataset} zones: ${out.zones.length}`)
}

await main()
