// Velocity has no API on either side: eBay gates it, Zik only pushes outward.
// So it arrives as a file, normalised into the same Signal shape as any API source.

import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (field !== '' || row.length) {
        row.push(field)
        rows.push(row)
        row = []
        field = ''
      }
      if (c === '\r' && text[i + 1] === '\n') i++
    } else field += c
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }

  if (!rows.length) return []
  const header = rows[0].map((h) => h.trim().toLowerCase())
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])))
}

async function latestFile(dir, prefix) {
  const names = (await readdir(dir))
    .filter((n) => n.toLowerCase().startsWith(prefix) && n.toLowerCase().endsWith('.csv'))
    .sort()
  if (!names.length) throw new Error(`no ${prefix}*.csv found in ${dir}`)
  return path.join(dir, names[names.length - 1])
}

const num = (v) => {
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

// Normalise within the batch, not against a fixed ceiling, or beauty and pet
// accessories get ranked on a scale that suits neither.
function normaliseWithin(values) {
  const max = Math.max(...values, 1)
  return (v) => Math.max(0, Math.min(1, v / max))
}

function makeCsvAdapter({ id, prefix, columns, kind }) {
  return {
    id,
    provides: [kind],
    async fetch({ config }) {
      const dir = config.dropDir
      if (!dir) throw new Error(`${id}: config.dropDir not set`)

      const file = await latestFile(dir, prefix)
      const rows = parseCsv(await readFile(file, 'utf8'))
      if (!rows.length) return []

      const counts = rows.map((r) => num(r[columns.sold]))
      const norm = normaliseWithin(counts)

      return rows
        .map((r, i) => ({
          externalRef: r[columns.ref] || r[columns.title],
          title: r[columns.title],
          category: columns.category ? r[columns.category] : undefined,
          kind,
          value: norm(counts[i]),
          price: columns.price ? num(r[columns.price]) : undefined,
          raw: { file: path.basename(file), sold: counts[i] },
        }))
        .filter((s) => s.externalRef && s.title)
    },
  }
}

export const zikExport = makeCsvAdapter({
  id: 'zik_export',
  prefix: 'zik',
  kind: 'velocity',
  columns: {
    ref: 'item id',
    title: 'title',
    category: 'category',
    sold: 'sold',
    price: 'price',
  },
})

export const terapeakExport = makeCsvAdapter({
  id: 'terapeak_export',
  prefix: 'terapeak',
  kind: 'velocity',
  columns: {
    ref: 'item number',
    title: 'title',
    sold: 'total sold',
    price: 'avg sold price',
  },
})
