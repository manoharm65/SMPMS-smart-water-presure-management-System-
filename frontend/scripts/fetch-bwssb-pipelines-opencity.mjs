/*
Fetch BWSSB water supply line KMLs from OpenCity and build a merged
GeoJSON pipelines layer for this app.

This app expects GeoJSON at:
  public/data/solapur/pipelines.geojson

Usage (from repo root):
  npm --prefix frontend run fetch:bwssb-pipelines

Or (from frontend/):
  node scripts/fetch-bwssb-pipelines-opencity.mjs
*/

import fs from 'node:fs/promises'
import path from 'node:path'

import { DOMParser } from '@xmldom/xmldom'
import { kml as kmlToGeoJSON } from '@tmcw/togeojson'

const KML_GT_300_URL =
  'https://data.opencity.in/dataset/97e5e83e-3c77-4de1-9221-97a3ab1f7784/resource/6c3e5957-82bf-4922-8513-b3ee622f1125/download/f6c32921-8975-44d3-9b55-2174396e0991.kml'

const KML_LTE_300_URL =
  'https://data.opencity.in/dataset/97e5e83e-3c77-4de1-9221-97a3ab1f7784/resource/439d1c8b-aa78-4f5a-917c-62b3d6db77b0/download/4f999482-f969-484e-9209-64e54fba9055.kml'

const OUT_DIR = path.resolve('public', 'data', 'solapur')
const OUT_PIPELINES = path.join(OUT_DIR, 'pipelines.geojson')

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

function normalizePipelines(fc, sourceTag) {
  assertFeatureCollection(fc)

  const features = []
  let idx = 0

  for (const f of fc.features) {
    if (!f || !f.geometry) continue
    const t = f.geometry.type
    if (t !== 'LineString' && t !== 'MultiLineString') continue

    const props = { ...(f.properties ?? {}) }
    props.zoneId = normalizeZoneId(props)
    props.source = sourceTag

    const baseId =
      getProp(props, ['pipelineId', 'PipelineID', 'PIPELINEID', 'PipeID', 'PIPEID', 'OBJECTID', 'objectid']) ??
      getProp(props, ['id', 'Id', 'ID', 'name', 'Name', 'NAME'])

    if (!getProp(props, ['pipelineId', 'id', 'code', 'name'])) {
      props.pipelineId = baseId ? `BWSSB-P-${baseId}` : `BWSSB-P-${++idx}`
    } else if (!props.pipelineId) {
      props.pipelineId = baseId ? `BWSSB-P-${baseId}` : `BWSSB-P-${++idx}`
    }

    features.push({
      type: 'Feature',
      properties: props,
      geometry: f.geometry,
    })
  }

  return { type: 'FeatureCollection', features }
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.google-earth.kml+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
    },
  })
  if (!res.ok) throw new Error(`Fetch failed ${res.status} ${url}`)
  return await res.text()
}

function parseKmlToGeoJSON(kmlText) {
  const doc = new DOMParser().parseFromString(kmlText, 'text/xml')
  const fc = kmlToGeoJSON(doc)
  assertFeatureCollection(fc)
  return fc
}

async function main() {
  // eslint-disable-next-line no-console
  console.log('Downloading BWSSB pipeline KMLs from OpenCity...')

  const [kmlGtText, kmlLteText] = await Promise.all([
    fetchText(KML_GT_300_URL),
    fetchText(KML_LTE_300_URL),
  ])

  // eslint-disable-next-line no-console
  console.log('Converting KML → GeoJSON...')

  const fcGtRaw = parseKmlToGeoJSON(kmlGtText)
  const fcLteRaw = parseKmlToGeoJSON(kmlLteText)

  const fcGt = normalizePipelines(fcGtRaw, 'opencity:gt300')
  const fcLte = normalizePipelines(fcLteRaw, 'opencity:lte300')

  const merged = {
    type: 'FeatureCollection',
    features: [...fcGt.features, ...fcLte.features],
  }

  await fs.mkdir(OUT_DIR, { recursive: true })
  await fs.writeFile(OUT_PIPELINES, JSON.stringify(merged))

  // eslint-disable-next-line no-console
  console.log(`Wrote: ${OUT_PIPELINES} (features: ${merged.features.length})`)
}

await main()
