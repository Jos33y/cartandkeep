// scripts/shelf-queries.js
// Gate queries from a collected shelf.
//
// The brand used to be guessed by counting repeated first words, and the
// product noun by its position in the title. The shelf now carries the shop's
// own brand tag and category, so neither is guessed.
//
// What it refuses before anything costs a call: departments a UK seller cannot
// post or compete in, prices outside the buying window, and lines the shop
// caps at a handful per customer, which cannot be restocked.
//
//   node scripts/shelf-queries.js --csv=scripts/shelf-hb.csv --out=scripts/queries-hb
//   node scripts/shelf-queries.js --csv=scripts/shelf-hb-seasonal.csv \\
//     --done=scripts/shelf-hb.csv --done-map=scripts/queries-hb-map.csv \\
//     --out=scripts/queries-hb-seasonal
//   ...correct the query column in scripts/queries-hb-map.csv, blank a row to drop it...
//   node scripts/shelf-queries.js --from-map=scripts/queries-hb-map.csv --out=scripts/queries-hb

import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, ...v] = a.replace(/^--/, '').split('=')
    return [k, v.length ? v.join('=') : true]
  })
)

const OUT = args.out || 'scripts/queries-hb'
const WORDS = Number(args.words || 3)
const PER_DAY = Number(args['per-day'] || 450)
const MIN = Number(args.min || 3)
const MAX = Number(args.max || 40)
const MIN_QTY = Number(args['min-qty'] || 4)
// Dearest first. The fee stack takes about £3.62 before a penny of goods, so a
// £3 product needs the market to pay £10 and a £20 one needs £28. The second
// is a market; the first is a supermarket aisle.
const ORDER = String(args.order || 'price')

// Food, drink and clothing. Perishable, heavy for the money, or sized, and
// every one of them is a market of supermarkets. --all keeps them.
const SKIP_CATEGORY = /chocolate|sweets|crisps|biscuit|snack|treats|groceries|drinks|baking|confection|clothing|nightwear|socks|fashion|baby food|toddler food/i

// Everyday branded toiletries, where Boots and the supermarkets set the price
// and an eBay listing competes with a shelf down the road. --toiletries keeps
// them.
const SKIP_TOILETRIES = /shampoo|conditioner|toothpaste|toothbrush|deodorant|anti-perspirant|shower gel|body wash|bubble bath|hand wash|soap|skin care|face|lip care|hand cream|shaving|razor|sanitary|tampon|hair dye|hair treat|mouthwash|floss|make up|nails|body mist|body spray/i

/*
 * The postage band, from the category and the name.
 *
 * One band for everything is how a sandpit came to be costed at £2.62, which
 * makes its buying ceiling read high and then fails it for being expensive.
 * Nothing here is a weight: it is a guess at which band a product belongs in,
 * and it is stated on the row so it can be corrected by eye before a call is
 * spent.
 */
const BULKY = /furniture|mattress|bed frame|folding bed|curtain|rug|duvet|pillow|throw|cushion|heater|appliance|microwave|kettle|fryer|hoover|vacuum|outdoor play|sandpit|slide|swing|tent|table|chair|bookshelf|storage chest|wardrobe|garden|patio|paddling|christmas tree|tree skirt|bulk buy|litter|cat food|dog food|bird food|bird feed|compost/i
const LIGHT = /stationery|pen|pencil|marker|notebook|card|battery|batteries|dental|denture|floss|hair accessor|phone accessor|cable|charger|seed|sewing|haberdashery|knitting|yarn|craft|sticker|balloon|gift wrap|wallpaper sample|lip|nail/i

function bandOf (row) {
  const text = `${row.category || ''} ${row.name || ''}`
  if (BULKY.test(text)) return 'evri15'
  if (LIGHT.test(text)) return 'letter500'
  return 'evri5'
}

const split = (line) => {
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

function readCsv (path) {
  const lines = readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean)
  const head = split(lines[0].replace(/^\uFEFF/, ''))
  return lines.slice(1).map(l => {
    const c = split(l)
    return Object.fromEntries(head.map((h, i) => [h, c[i] ?? '']))
  })
}

const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`

function writeFiles (rows) {
  const live = rows.filter(r => (r.query || '').trim().length > 1)

  // One file per band, because the band is what the scan and the gate cost
  // everything at, and a file mixing them costs a sandpit as a parcel.
  const byBand = new Map()
  for (const r of live) {
    const band = r.band || 'evri5'
    if (!byBand.has(band)) byBand.set(band, [])
    byBand.get(band).push(r)
  }

  for (const [band, all] of [...byBand.entries()].sort((a, b) => b[1].length - a[1].length)) {
    for (let i = 0; i < all.length; i += PER_DAY) {
      const batch = all.slice(i, i + PER_DAY)
      const n = Math.floor(i / PER_DAY) + 1
      const file = `${OUT}-${band}-${n}.txt`
      writeFileSync(file, batch.map(r => r.query.trim()).join('\n') + '\n')
      console.log(`${file}  ${String(batch.length).padStart(4)} queries`)
      console.log(`  node scripts/scan.js --file=${file} --csv=scan-${band}-${n}.csv `
        + `--out=scripts/queries-gated-${band}-${n}.txt --band=${band}`)
    }
  }

  const cols = ['query', 'band', 'brand', 'shelf', 'unit_price', 'max_qty', 'name', 'category', 'url']
  writeFileSync(`${OUT}-map.csv`, [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n'))
  console.log(`${OUT}-map.csv  ${live.length} live of ${rows.length} rows`)
  return live
}

if (args['from-map']) {
  const path = String(args['from-map'])
  if (!existsSync(path)) {
    console.error(`${path} not found.`)
    process.exit(1)
  }
  const live = writeFiles(readCsv(path))
  const long = live.filter(r => r.query.trim().split(/\s+/).length > 4)
  if (long.length) {
    console.log(`\n${long.length} queries are over four words. eBay matches every word, so those`)
    console.log('risk returning almost nothing:')
    long.slice(0, 15).forEach(r => console.log(`  ${r.query}`))
  }
  process.exit(0)
}

/*
 * What has already been through the scan.
 *
 * The seasonal collection holds the whole year-round shop as well, so drafting
 * it whole would re-scan 3,836 products already paid for. --done takes a shelf
 * already drafted and skips its products by id; --done-map skips any query
 * already written, which catches the same product reached from another
 * category.
 */
const doneIds = new Set(
  (args.done ? readCsv(String(args.done)) : []).map(r => r.id).filter(Boolean)
)
const doneQueries = new Set(
  (args['done-map'] ? readCsv(String(args['done-map'])) : [])
    .map(r => (r.query || '').trim()).filter(Boolean)
)

const rows = readCsv(args.csv || 'scripts/shelf-hb.csv')
if (!rows.length || !('price' in rows[0])) {
  console.error('\n  That file does not look like a collected shelf. Expected a price column.\n')
  process.exit(1)
}

// Everything from the first size token onwards is size and variant.
const SIZE = /\b(\d+(\.\d+)?\s?(ml|l|g|kg|cm|mm|litre|litres)|\d+\s?(s|pk|pack|pads|tabs|tablets|washes|sheets|wipes|pouches|rolls|capsules|pods)|x\s?\d+|\d+\s?x\s?\d+)\b/i
const JOINERS = new Set(['and', 'the', 'with', 'for', 'of', 'in', 'to', 'a', 'an', 'plus'])

function words (name) {
  return name.split(SIZE)[0]
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter(w => !JOINERS.has(w))
}

const refused = { done: 0, category: 0, toiletries: 0, price: 0, capped: 0, stock: 0, short: 0 }
const drafted = new Map()

for (const r of rows) {
  const price = Number(r.price)
  const cap = r.max_qty === '' ? null : Number(r.max_qty)

  if (doneIds.has(r.id)) { refused.done++; continue }
  if (!args.all && SKIP_CATEGORY.test(r.category || '')) { refused.category++; continue }
  if (!args.toiletries && !args.all && SKIP_TOILETRIES.test(r.category || '')) { refused.toiletries++; continue }
  if (!Number.isFinite(price) || price < MIN || price > MAX) { refused.price++; continue }
  if (r.in_stock === 'no') { refused.stock++; continue }
  // A shop that sells one person three of something cannot restock a listing.
  if (cap != null && cap < MIN_QTY) { refused.capped++; continue }

  const w = words(r.name)
  // The shelf gives the brand, so it is removed rather than detected.
  const brand = (r.brand || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').trim()
  const brandWords = brand ? brand.split(/\s+/) : []
  const body = brandWords.length && w.slice(0, brandWords.length).join(' ') === brand
    ? w.slice(brandWords.length)
    : w

  if (!body.length) { refused.short++; continue }

  // The product noun ends a retailer title, so it is read from the end.
  const core = body.slice(-WORDS).join(' ')
  if (core.split(' ').length < 2) { refused.short++; continue }

  for (const q of brand ? [core, `${brand} ${core}`] : [core]) {
    if (drafted.has(q) || doneQueries.has(q)) continue
    drafted.set(q, {
      query: q,
      band: bandOf(r),
      brand: brand && q.startsWith(brand) ? brand : '',
      shelf: price.toFixed(2),
      unit_price: r.unit_price,
      max_qty: r.max_qty,
      name: r.name,
      category: r.category,
      url: r.url,
      sort: price
    })
  }
}

const all = [...drafted.values()]
if (ORDER === 'price') all.sort((a, b) => b.sort - a.sort)

console.log(`\n${rows.length} shelf products`)
if (doneIds.size || doneQueries.size) {
  console.log(`  ${refused.done} already scanned, from ${doneIds.size} products and ${doneQueries.size} queries done before`)
}
console.log(`  ${refused.category} in a department we do not sell into`)
console.log(`  ${refused.toiletries} everyday toiletries, priced by the supermarkets`)
console.log(`  ${refused.price} priced outside £${MIN} to £${MAX}`)
console.log(`  ${refused.stock} out of stock, ${refused.capped} capped under ${MIN_QTY} a customer`)
console.log(`  ${refused.short} with nothing left after the brand and the size\n`)

writeFiles(all)

console.log('\nThese are a draft. Correct the query column, blank a row to drop it,')
console.log(`then rerun with --from-map=${OUT}-map.csv\n`)
all.slice(0, 30).forEach(r => console.log(`  ${r.query.padEnd(34)} ${String(r.shelf).padStart(6)}  ${r.name.slice(0, 48)}`))
