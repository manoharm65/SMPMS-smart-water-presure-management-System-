import fs from 'node:fs/promises'

const BASE = 'https://smcgis.solapurcorporation.org/Web_Pages/PM_GATI_SHAKTI/Water_Supply_Network/'
const LAYERS = [
  'layers/Water_Treatment_Plant_2.js',
  'layers/Water_Source_3.js',
  'layers/Storage_Tank_4.js',
  'layers/Raw_Water_Station_5.js',
  'layers/Pipeline_Network_6.js',
  'layers/SMC_Bore_7.js',
]

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
      if (ch === '"') inString = false
      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }

    if (ch === '{') depth++
    else if (ch === '}') depth--

    if (depth === 0) return jsText.slice(start, i + 1)
  }

  throw new Error('Unbalanced braces while extracting JSON')
}

async function fetchText(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Fetch failed ${res.status} ${url}`)
  return await res.text()
}

for (const rel of LAYERS) {
  const url = new URL(rel, BASE).toString()
  const jsText = await fetchText(url)
  const jsonLiteral = extractJsonObjectLiteral(jsText)
  const fc = JSON.parse(jsonLiteral)

  const typeCounts = new Map()
  for (const f of fc.features ?? []) {
    const t = f?.geometry?.type ?? 'null'
    typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1)
  }

  const sorted = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])
  console.log(rel)
  console.log('  features:', (fc.features ?? []).length)
  console.log('  geometry:', sorted.map(([t, c]) => `${t}:${c}`).join(', '))
}

// Keep the script from being optimized away in some runners
await fs.stat(new URL(import.meta.url))
