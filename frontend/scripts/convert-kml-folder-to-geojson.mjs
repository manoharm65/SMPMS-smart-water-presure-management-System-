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
  node scripts/convert-kml-folder-to-geojson.mjs <folderPath> [--dataset <name>] [--kengeri] [--bbox <minLng,minLat,maxLng,maxLat>] [--defaultDiameterMm <mm>]

Options:
  --dataset <name>   Output dataset folder under public/data (default: solapur)
  --kengeri          Filter features to the Kengeri area (Bengaluru)
  --bbox <...>       Custom bbox filter in WGS84 lng/lat
  --defaultDiameterMm <mm>  Attach this diameter (mm) to ALL pipeline features (when missing)
  -h, --help         Show help
`)
  process.exit(exitCode)
}

// Default bbox for Kengeri, Bengaluru (WGS84 lng/lat)
// Format: [minLng, minLat, maxLng, maxLat]
// Tightened to reduce payload and improve frontend map performance.
const KENGERI_BBOX = [77.46, 12.89, 77.53, 12.96]

function createBoundsTracker() {
  return {
    minLng: Infinity,
    minLat: Infinity,
    maxLng: -Infinity,
    maxLat: -Infinity,
    count: 0,
  }
}

function updateBoundsCoord(bounds, coord) {
  if (!coord || coord.length < 2) return
  const [lng, lat] = coord
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return
  bounds.minLng = Math.min(bounds.minLng, lng)
  bounds.minLat = Math.min(bounds.minLat, lat)
  bounds.maxLng = Math.max(bounds.maxLng, lng)
  bounds.maxLat = Math.max(bounds.maxLat, lat)
  bounds.count++
}

function updateBoundsFromLine(bounds, coords) {
  const arr = Array.isArray(coords) ? coords : []
  for (const c of arr) updateBoundsCoord(bounds, c)
}

function updateBoundsFromPolygon(bounds, rings) {
  const rr = Array.isArray(rings) ? rings : []
  for (const ring of rr) {
    const coords = Array.isArray(ring) ? ring : []
    for (const c of coords) updateBoundsCoord(bounds, c)
  }
}

function formatBbox(bbox) {
  const [minLng, minLat, maxLng, maxLat] = bbox
  return `${minLng.toFixed(5)},${minLat.toFixed(5)},${maxLng.toFixed(5)},${maxLat.toFixed(5)}`
}

function parseBboxArg(v) {
  if (!v) return undefined
  const parts = v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length !== 4) return undefined
  const nums = parts.map((p) => Number(p))
  if (nums.some((n) => !Number.isFinite(n))) return undefined
  const [minLng, minLat, maxLng, maxLat] = nums
  if (minLng >= maxLng || minLat >= maxLat) return undefined
  return nums
}

function parsePositiveNumber(v) {
  if (!v) return undefined
  const n = Number(v)
  if (!Number.isFinite(n)) return undefined
  if (n <= 0) return undefined
  return n
}

function coordInBbox(coord, bbox) {
  if (!coord || coord.length < 2) return false
  const [lng, lat] = coord
  const [minLng, minLat, maxLng, maxLat] = bbox
  return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat
}

function geometryIntersectsBbox(g, bbox) {
  if (!g || !bbox) return true

  if (g.type === 'Point') return coordInBbox(g.coordinates, bbox)

  if (g.type === 'MultiPoint') {
    return (Array.isArray(g.coordinates) ? g.coordinates : []).some((c) => coordInBbox(c, bbox))
  }

  if (g.type === 'LineString') {
    return (Array.isArray(g.coordinates) ? g.coordinates : []).some((c) => coordInBbox(c, bbox))
  }

  if (g.type === 'MultiLineString') {
    const lines = Array.isArray(g.coordinates) ? g.coordinates : []
    return lines.some((line) => (Array.isArray(line) ? line : []).some((c) => coordInBbox(c, bbox)))
  }

  if (g.type === 'Polygon') {
    const rings = Array.isArray(g.coordinates) ? g.coordinates : []
    return rings.some((ring) => (Array.isArray(ring) ? ring : []).some((c) => coordInBbox(c, bbox)))
  }

  if (g.type === 'MultiPolygon') {
    const polys = Array.isArray(g.coordinates) ? g.coordinates : []
    return polys.some((poly) => (Array.isArray(poly) ? poly : []).some((ring) => (Array.isArray(ring) ? ring : []).some((c) => coordInBbox(c, bbox))))
  }

  return true
}

function clipLineStringCoords(coords, bbox) {
  const arr = Array.isArray(coords) ? coords : []
  return arr.filter((c) => coordInBbox(c, bbox))
}

function clipLineGeometry(g, bbox) {
  if (!g || !bbox) return g

  if (g.type === 'LineString') {
    const coords = clipLineStringCoords(g.coordinates, bbox)
    return coords.length >= 2 ? { ...g, coordinates: coords } : null
  }

  if (g.type === 'MultiLineString') {
    const lines = Array.isArray(g.coordinates) ? g.coordinates : []
    const clipped = []
    for (const line of lines) {
      const coords = clipLineStringCoords(line, bbox)
      if (coords.length >= 2) clipped.push(coords)
    }
    return clipped.length > 0 ? { ...g, coordinates: clipped } : null
  }

  return g
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

function extractDiameterMm(props) {
  const raw = getProp(props, [
    'diameterMm',
    'diameter',
    'Diameter',
    'DIA',
    'dia',
    'pipe_dia',
    'pipeDia',
    'PIPE_DIA',
    'PIPE_DIA_MM',
  ])

  const candidates = [
    raw,
    getProp(props, ['name', 'Name', 'PIPE_SIZE', 'PipeSize', 'PIPE_DIAMETER', 'PipeDiameter']),
  ].filter(Boolean)

  for (const c of candidates) {
    const s = String(c)
    const match = s.match(/(\d{2,4})\s*(?:mm)?/i)
    if (!match) continue
    const mm = Number(match[1])
    if (Number.isFinite(mm) && mm > 0) return mm
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

function mergeCollections({ kmlFileName, fc, out, bbox, defaultDiameterMm }) {
  let valveIdx = out.valveIdx
  let pipelineIdx = out.pipelineIdx
  let zoneIdx = out.zoneIdx

  for (const f of fc.features) {
    if (!f || !f.geometry) continue

    let g = f.geometry
    const props = { ...(f.properties ?? {}) }

    if (bbox && !geometryIntersectsBbox(g, bbox)) continue

    props.zoneId = normalizeZoneId(props)
    props.sourceFile = kmlFileName

    if (g.type === 'Point') {
      if (bbox && !coordInBbox(g.coordinates, bbox)) continue
      const rawValveId = getProp(props, ['valveId', 'ValveID', 'VALVEID', 'KGISValveID', 'OBJECTID'])
      props.valveId = rawValveId ?? props.valveId
      if (!getProp(props, ['valveId', 'id', 'code', 'name'])) props.valveId = `KML-V-${++valveIdx}`
      props.name = normalizeName(props, props.valveId)
      out.valves.push(toFeature(g, props))
      if (out.bounds) updateBoundsCoord(out.bounds, g.coordinates)
      continue
    }

    if (g.type === 'MultiPoint') {
      const coords = Array.isArray(g.coordinates) ? g.coordinates : []
      for (const c of coords) {
        if (bbox && !coordInBbox(c, bbox)) continue
        const p = { ...props }
        const rawValveId = getProp(p, ['valveId', 'ValveID', 'VALVEID', 'KGISValveID', 'OBJECTID'])
        const base = rawValveId ?? getProp(p, ['id', 'name', 'Name'])
        p.valveId = base ? `${base}-${++valveIdx}` : `KML-V-${++valveIdx}`
        p.name = normalizeName(p, p.valveId)
        out.valves.push(toFeature({ type: 'Point', coordinates: c }, p))
        if (out.bounds) updateBoundsCoord(out.bounds, c)
      }
      continue
    }

    if (g.type === 'LineString' || g.type === 'MultiLineString') {
      if (bbox) {
        const clipped = clipLineGeometry(g, bbox)
        if (!clipped) continue
        g = clipped
      }
      const rawPipelineId = getProp(props, ['pipelineId', 'PipelineID', 'PIPELINEID', 'PipeID', 'PIPEID', 'OBJECTID'])
      props.pipelineId = rawPipelineId ?? props.pipelineId
      if (!getProp(props, ['pipelineId', 'id', 'code', 'name'])) props.pipelineId = `KML-P-${++pipelineIdx}`
      props.name = normalizeName(props, props.pipelineId)

      const diameterMm = extractDiameterMm(props) ?? defaultDiameterMm
      if (diameterMm) props.diameterMm = diameterMm

      out.pipelines.push(toFeature(g, props))

      if (out.bounds) {
        if (g.type === 'LineString') updateBoundsFromLine(out.bounds, g.coordinates)
        if (g.type === 'MultiLineString') {
          const lines = Array.isArray(g.coordinates) ? g.coordinates : []
          for (const line of lines) updateBoundsFromLine(out.bounds, line)
        }
      }
      continue
    }

    if (g.type === 'Polygon' || g.type === 'MultiPolygon') {
      const rawZoneId = getProp(props, ['zoneId', 'ZoneID', 'DMA', 'OBJECTID', 'name', 'Name'])
      props.zoneId = rawZoneId ?? props.zoneId
      if (!getProp(props, ['zoneId', 'id', 'code', 'name'])) props.zoneId = `KML-Z-${++zoneIdx}`
      props.name = normalizeName(props, props.zoneId)
      out.zones.push(toFeature(g, props))

      if (out.bounds) {
        if (g.type === 'Polygon') updateBoundsFromPolygon(out.bounds, g.coordinates)
        if (g.type === 'MultiPolygon') {
          const polys = Array.isArray(g.coordinates) ? g.coordinates : []
          for (const poly of polys) updateBoundsFromPolygon(out.bounds, poly)
        }
      }
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
  const bboxArg = getArgValue(argv, '--bbox')
  const defaultDiameterMm = parsePositiveNumber(getArgValue(argv, '--defaultDiameterMm'))
  const bbox = hasFlag(argv, '--kengeri') ? KENGERI_BBOX : parseBboxArg(bboxArg)
  if (bboxArg && !bbox) {
    throw new Error('Invalid --bbox. Expected: minLng,minLat,maxLng,maxLat')
  }
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
    bounds: bbox ? createBoundsTracker() : null,
  }

  // eslint-disable-next-line no-console
  console.log(`Reading ${kmlFiles.length} KML files from: ${folderPath}`)

  for (const fileName of kmlFiles) {
    const abs = path.join(folderPath, fileName)
    const text = await fs.readFile(abs, 'utf8')
    const fc = parseKmlTextToFc(text)
    mergeCollections({ kmlFileName: fileName, fc, out, bbox, defaultDiameterMm })
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

  if (bbox) {
    // eslint-disable-next-line no-console
    console.log(`Filter bbox (lng,lat): ${formatBbox(bbox)}`)
    if (out.bounds && out.bounds.count > 0) {
      const outBbox = [out.bounds.minLng, out.bounds.minLat, out.bounds.maxLng, out.bounds.maxLat]
      // eslint-disable-next-line no-console
      console.log(`Output bounds (lng,lat): ${formatBbox(outBbox)}`)
    } else {
      // eslint-disable-next-line no-console
      console.log('Output bounds: (no coordinates kept)')
    }
  }
}

await main()
