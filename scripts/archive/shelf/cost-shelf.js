// scripts/cost-shelf.js
// What each shelf line has to sell for to clear the floor. The cost model is
// imported from gate.js and the minimum price is found by bisecting
// maxGoodsCost, so there is no second copy of the algebra to drift.
//
// The unit is the retailer's pack. Most of this shelf is already a multipack,
// and multiplying a 115 tablet tub by twelve invents a thing nobody buys.
// Packs above one are reported only where the name carries no quantity, and
// even then they are a suggestion for the eye, not a decision.
//
// Ranking is on the list price, not on the multiple over cost. The multiple
// falls towards 1.19 as goods cost rises, so ranking on it only ever surfaces
// the most expensive item in the file.
//
//   node scripts/cost-shelf.js --csv=scripts/shelf-hb.csv --out=scripts/shelf-hb-costed.csv
//   node scripts/cost-shelf.js --csv=scripts/shelf-hb.csv --max-list=60 --packs=1,4,6

import { readFileSync, writeFileSync } from 'node:fs'
import { D, BANDS, maxGoodsCost, priceFloor } from './gate.js'

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, ...v] = a.replace(/^--/, '').split('=')
    return [k, v.length ? v.join('=') : true]
  })
)

const CSV = args.csv || 'scripts/shelf-hb.csv'
const OUT = args.out || CSV.replace(/\.csv$/, '-costed.csv')
const PACKS = String(args.packs || '1,3,6').split(',').map(Number).filter(n => n > 0)
const PROFIT = Number(args.profit || D.minProfit)
// Her catalogue took £242.14 across 12 units, so about £20 a sale. Nothing
// above this ceiling has any evidence behind it on her account.
const MAX_LIST = Number(args['max-list'] || 45)
// The fixed stack is £5.62 an order and does not shrink, so a 99p item has to
// ask eight times the shop price. Below this the ask is only credible where the
// buyer cannot price check, which no branded grocery line survives.
const MIN_SHELF = Number(args['min-shelf'] || 3)

function split (line) {
  const out = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out
}

function readCsv (text) {
  const lines = text.split(/\r?\n/).filter(Boolean)
  const head = split(lines[0])
  return lines.slice(1).map(line => {
    const cells = split(line)
    return Object.fromEntries(head.map((h, i) => [h, cells[i] ?? '']))
  })
}

// Millilitres are treated as grams. Where the shop states no size the band is a
// default and the basis column says so.
function weightOf (name) {
  const m = name.match(/(\d+(?:\.\d+)?)\s?(kg|g|ml|l|litre|litres)\b/i)
  if (!m) return null
  const n = Number(m[1])
  const unit = m[2].toLowerCase()
  if (unit === 'kg') return { grams: n * 1000, basis: m[0] }
  if (unit === 'g' || unit === 'ml') return { grams: n, basis: m[0] }
  return { grams: n * 1000, basis: m[0] }
}

// The shop's own name tells you when the pack already exists.
function statedQuantity (name) {
  const patterns = [
    /\bx\s?(\d{2,4})\b/i,
    /\b(\d{2,4})\s?(?:pack|pk|pouches|tabs|tablets|rolls|sheets|wipes|bags|capsules|pods|washes)\b/i,
    /\bpack of (\d+)/i,
    /\b(\d+)\s?x\s?\d/i
  ]
  for (const re of patterns) {
    const m = name.match(re)
    if (m) return m[0].trim()
  }
  return null
}

function bandFor (grams) {
  if (grams == null) return 'evri5'
  if (grams <= 4500) return 'evri5'
  if (grams <= 9500) return 'evri10'
  if (grams <= 14500) return 'evri15'
  return null
}

function minListFor (goods, band) {
  const cfg = { ...D, band, minProfit: PROFIT }
  let lo = 0.01
  let hi = 800
  if (maxGoodsCost(hi, cfg) < goods) return null
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (maxGoodsCost(mid, cfg) >= goods) hi = mid
    else lo = mid
  }
  return Math.ceil(hi * 100) / 100
}

const rows = readCsv(readFileSync(CSV, 'utf8'))
if (!rows.length) {
  console.error(`${CSV} has no rows.`)
  process.exit(1)
}

const priceKey = ['price', 'shelf_price'].find(k => k in rows[0])
const nameKey = ['name', 'displayName'].find(k => k in rows[0])
if (!priceKey || !nameKey) {
  console.error(`${CSV} has no price or name column. Columns: ${Object.keys(rows[0]).join(', ')}`)
  process.exit(1)
}

const floor = priceFloor({ ...D, band: 'evri5', minProfit: PROFIT })
console.log(`Nothing can clear £${PROFIT.toFixed(2)} below £${floor.toFixed(2)} at ${BANDS.evri5.label}.`)

const out = []
let noWeight = 0
let belowFloor = 0
let aboveCeiling = 0
let tooCheap = 0

for (const r of rows) {
  const shelf = Number(r[priceKey])
  if (!Number.isFinite(shelf) || shelf <= 0) continue

  const name = r[nameKey]
  const w = weightOf(name)
  if (!w) noWeight++
  const stated = statedQuantity(name)

  const row = {
    name,
    category: r.category ?? '',
    shelf: shelf.toFixed(2),
    stated_pack: stated ?? '',
    unit_g: w ? Math.round(w.grams) : '',
    basis: w ? w.basis : 'assumed evri5',
    url: r.url ?? ''
  }

  // One is the unit. Larger packs only where the shop has not already packed it.
  const sizes = stated ? [1] : PACKS
  for (const k of PACKS) { row[`list_${k}`] = ''; row[`band_${k}`] = '' }

  for (const k of sizes) {
    const grams = w ? w.grams * k + 200 : null
    const band = bandFor(grams)
    if (!band) continue
    const list = minListFor(shelf * k, band)
    if (list == null) continue
    row[`list_${k}`] = list.toFixed(2)
    row[`band_${k}`] = BANDS[band].label
  }

  const single = Number(row.list_1 || 0)
  if (!single) continue
  if (single > MAX_LIST) { aboveCeiling++; continue }
  if (single < floor) { belowFloor++; continue }
  if (shelf < MIN_SHELF) { tooCheap++; continue }

  row.mult = (single / shelf).toFixed(1)
  row.headroom_note = stated ? 'shop already packs this' : 'single unit'
  out.push(row)
}

out.sort((a, b) => Number(a.list_1) - Number(b.list_1))

const cols = ['name', 'category', 'shelf', 'mult', 'stated_pack', 'headroom_note', 'unit_g', 'basis',
  ...PACKS.flatMap(k => [`list_${k}`, `band_${k}`]), 'url']

const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
writeFileSync(OUT, [cols.join(','), ...out.map(r => cols.map(c => esc(r[c])).join(','))].join('\n'))

console.log(`${OUT} written, ${out.length} lines inside £${floor.toFixed(2)} to £${MAX_LIST.toFixed(2)}.`)
console.log(`${aboveCeiling} above the £${MAX_LIST.toFixed(2)} ceiling, ${belowFloor} below the floor, ${tooCheap} under £${MIN_SHELF.toFixed(2)} on the shelf, ${noWeight} with no size stated.`)

console.log('\nSorted by list price. The multiple is what she has to ask over the shop:\n')
console.log(' list  shelf  mult  pack        name')
for (const r of out.slice(0, 40)) {
  console.log(`${String(r.list_1).padStart(5)}  ${String(r.shelf).padStart(5)}  ${String(r.mult).padStart(4)}  ${String(r.stated_pack || '-').padEnd(10).slice(0, 10)}  ${r.name.slice(0, 58)}`)
}
