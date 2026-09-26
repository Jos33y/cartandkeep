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
//   node scripts/shelf-queries.js --csv=research/shelf/shelf-qdstores.csv,research/shelf/shelf-savers.csv --out=research/queries/queries-shops
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
// The shelf price is a lead, not a cost, so it does not decide which products get a query.
const MIN = Number(args.min || 0)
const MAX = Number(args.max || Infinity)
const MIN_QTY = Number(args['min-qty'] || 4)
// Dearest first. The fee stack takes about £3.62 before a penny of goods, so a
// £3 product needs the market to pay £10 and a £20 one needs £28. The second
// is a market; the first is a supermarket aisle.
const ORDER = String(args.order || 'price')

// Sizing is the one thing the gate cannot see. Food and toiletries used to be
// cut here too; Dentastix and Flexitol came from exactly those. --all keeps these.
const SIZED = /clothing|nightwear|socks|fashion|footwear|shoes|slippers|lingerie|underwear|workwear/i
// Anything worn because of a need, not a fashion, is a care product first: diabetic slippers,
// gripper socks, compression stockings, knee supports. Sizing never cuts these.
const AID = /\b(aids?|mobility|care|elderly|disabled|disability|orthopaedic|orthopedic|diabetic|wide fit|extra wide|swollen|oedema|edema|compression|gripper|non[- ]?slip|anti[- ]?slip|hospital|post[- ]?op|surgical|incontinence|arthritis|arthritic|supports?|braces?|bariatric|daily living|bed socks|dementia|plantar|bunion|pressure relief)\b/i
const SIZED_NAME = /\b(hoodie|sweatshirt|jacket|trousers|jeans|pyjamas?|pajamas|leggings|nightie|nightdress|onesie|knickers|briefs|boxers|bra|slippers|socks|trainers|size \d+)\b/i

/*
 * The postage band, from the category and the name.
 *
 * One band for everything is how a sandpit came to be costed at £2.62, which
 * makes its buying ceiling read high and then fails it for being expensive.
 * Nothing here is a weight: it is a guess at which band a product belongs in,
 * and it is stated on the row so it can be corrected by eye before a call is
 * spent.
 */
const BULKY = /\b(?:furniture|tv unit|sideboard|chest of drawers|drawer chest|\d drawer|cabinet|cupboard|desk|dresser|display shelf|shelving|bookcase|sofa|ottoman|headboard|console table|greenhouse|polytunnel|potting bench|garden bench|mattress|bed frame|folding bed|curtain|rug|duvet|pillow|throw|cushion|heater|appliance|microwave|kettle|fryer|hoover|vacuum|outdoor play|sandpit|slide|swing|tent|table|chair|bookshelf|storage chest|wardrobe|garden|patio|paddling|christmas tree|tree skirt|bulk buy|litter|cat food|dog food|bird food|bird feed|compost)(?:e?s)?\b/i
const LIGHT = /\b(?:stationery|pen|pencil|marker|notebook|card|battery|batteries|dental|denture|floss|hair accessor\w*|phone accessor\w*|cable|charger|seed|sewing|haberdashery|knitting|yarn|craft|sticker|balloon|gift wrap|wallpaper sample|lip|nail)(?:e?s)?\b/i

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

/*
 * Every shelf in the Home Bargains shape the rest of this file reads.
 * Shopify rows carry variant_id and available; page-data rows carry availability
 * and a breadcrumb that ends with the product itself.
 */
function normalise (r, fileShop) {
  if ('in_stock' in r && 'id' in r) return { ...r, shop: r.shop || fileShop }
  const shop = r.shop || fileShop
  const inStock = 'available' in r
    ? (r.available === 'false' ? 'no' : 'yes')
    : (/OutOfStock|SoldOut|Discontinued/i.test(r.availability || '') ? 'no' : 'yes')
  let category = r.category || ''
  if (category.includes(' > ')) category = category.split(' > ').filter(c => c !== 'Home' && c !== r.name).join(' > ')
  if (r.tags) category = [category, r.tags.replace(/\|/g, ', ')].filter(Boolean).join(', ')
  return {
    id: `${shop}:${r.variant_id || r.sku || r.url}`,
    name: r.name || '',
    price: r.price,
    unit_price: r.unit_price || '',
    brand: r.brand || '',
    gtin: r.gtin || '',
    max_qty: '',
    in_stock: inStock,
    category,
    url: r.url,
    shop
  }
}

function readShelves (list) {
  return String(list).split(',').map(s => s.trim()).filter(Boolean).flatMap(file => {
    const fileShop = (file.match(/shelf-([^\\/]+?)\.csv$/i) || [])[1] || 'shop'
    return readCsv(file).map(r => normalise(r, fileShop))
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

  const cols = ['query', 'band', 'brand', 'shelf', 'unit_price', 'max_qty', 'shop', 'gtin', 'name', 'category', 'url']
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
  (args.done ? readShelves(args.done) : []).map(r => r.id).filter(Boolean)
)
const doneQueries = new Set(
  (args['done-map'] ? String(args['done-map']).split(',').map(f => f.trim()).filter(Boolean).flatMap(f => readCsv(f)) : [])
    .map(r => (r.query || '').trim()).filter(Boolean)
)

const rows = readShelves(args.csv || 'scripts/shelf-hb.csv')
if (!rows.length || !('price' in rows[0])) {
  console.error('\n  That file does not look like a collected shelf. Expected a price column.\n')
  process.exit(1)
}

// A part or model number: letters with digits (507A, UCA222) or a long number (46580000), never a size like 350ml or 18V.
const UNIT = /^\d+(\.\d+)?(mm|cm|m|m2|v|w|kw|l|ml|g|kg|pk|pc|pcs|x|in|ft|mah|ah|hz|psi|bar)$/i
const AMPS = /^\d{1,2}a$/i
function modelOf (name) {
  const hits = String(name || '').match(/\b[A-Za-z0-9][A-Za-z0-9-]{2,}\b/g) || []
  const hit = hits.find(t => {
    const bare = t.replace(/-/g, '')
    if (UNIT.test(bare) || AMPS.test(bare)) return false
    return (/\d/.test(t) && /[A-Za-z]/.test(t) && t.length >= 4) || /^\d{5,10}$/.test(t)
  })
  // Region suffixes narrow the eBay search to one seller's listing.
  return hit ? hit.replace(/-(gb|uk|eu)$/i, '') : null
}

// Everything from the first size token onwards is size and variant.
const SIZE = /\b(\d+(\.\d+)?\s?(ml|l|g|kg|cm|mm|litre|litres)|\d+\s?(s|pk|pack|pads|tabs|tablets|washes|sheets|wipes|pouches|rolls|capsules|pods|sticks|chews|pcs|pieces|count|sachets)|x\s?\d+|\d+\s?x\s?\d+)\b/i
const JOINERS = new Set(['and', 'the', 'with', 'for', 'of', 'in', 'to', 'a', 'an', 'plus'])
// A colour narrows eBay's match to one seller's listing and says nothing about the market.
const COLOURS = new Set(['black', 'white', 'grey', 'gray', 'navy', 'blue', 'red', 'pink', 'green', 'beige', 'cream', 'brown', 'silver', 'gold', 'purple', 'yellow', 'orange', 'charcoal', 'teal'])

// Whole words: "table" in "portable" sent a hand-wash sink to the 15kg band.
// Marketplace titles carry their extras after the product: "Potting Bench with 2 Removable Wheels".
const EXTRAS = /\s(?:with|w\/)\s|\s[-–|]\s|,|\(/i

function words (name) {
  // Accents folded, not dropped: "Cafetière" was drafting as "cafeti re".
  return name.split(EXTRAS)[0].split(SIZE)[0]
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter(w => !JOINERS.has(w) && !COLOURS.has(w))
}

const refused = { done: 0, sized: 0, price: 0, capped: 0, stock: 0, short: 0 }
const drafted = new Map()

for (const r of rows) {
  const price = Number(r.price)
  const cap = r.max_qty === '' ? null : Number(r.max_qty)

  if (doneIds.has(r.id)) { refused.done++; continue }
  // The name as well: Home Bargains filed ladies pyjamas somewhere that never said clothing.
  const aid = AID.test(`${r.name || ''} ${r.category || ''}`)
  if (!args.all && !aid && (SIZED.test(r.category || '') || SIZED_NAME.test(r.name || ''))) { refused.sized++; continue }
  if (!Number.isFinite(price) || price < MIN || price > MAX) { refused.price++; continue }
  // --with-out-of-stock keeps lines listed ahead of their stock: Lakeland's Christmas range read
  // "unavailable, more stock expected 5th October", which is when it is worth being ready.
  if (r.in_stock === 'no' && !args['with-out-of-stock']) { refused.stock++; continue }
  // A shop that sells one person three of something cannot restock a listing.
  if (cap != null && cap < MIN_QTY) { refused.capped++; continue }

  // Sellers' notes in a title are not the product: "Eligible for VAT relief".
  r.name = String(r.name || '').replace(/[-/]?\s*(not\s+)?eligible for vat relief/ig, '').replace(/\s{2,}/g, ' ').trim()
  const w = words(r.name)
  // The shelf gives the brand, so it is removed rather than detected.
  // A shop filing its own name as the brand ("Essential Aids") is no brand at all, and hid the model rule.
  const squashed = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const host = squashed(String(r.url || '').replace(/^https?:\/\/(www\.)?/, '').split(/[./]/)[0])
  const ownName = host && squashed(r.brand) && (host.includes(squashed(r.brand)) || squashed(r.brand).includes(host))
  const brand = ownName ? '' : (r.brand || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').trim()
  const brandWords = brand ? brand.split(/\s+/) : []
  const body = brandWords.length && w.slice(0, brandWords.length).join(' ') === brand
    ? w.slice(brandWords.length)
    : w

  if (!body.length) { refused.short++; continue }

  // The product noun ends a retailer title, so it is read from the end.
  // An aid's need words lead its name ("diabetic wide fit slippers"), so keep one more.
  const core = body.slice(-(aid ? WORDS + 1 : WORDS)).join(' ')
  // One word is too loose on its own, but with a named brand it is the product: "comfycrutch pair".
  const oneWord = core.split(' ').length < 2
  if (oneWord && !(brand && ` ${w.join(' ')} `.includes(` ${brand} `))) { refused.short++; continue }

  // A brand missing from the title is the shop's own label, and nobody searches eBay for "b m sideboard".
  const named = brand && ` ${w.join(' ')} `.includes(` ${brand} `)
  // Forced search is typed as brand and model: "dewalt dch133p1", not "sds hammer drill".
  const model = modelOf(r.name)
  // Names read off a sitemap carry no brand field; the first word of a trade name is nearly always it.
  const lead = named ? brand : (!brand && model ? words(r.name)[0] : null)
  const extra = model && lead && lead !== model.toLowerCase() ? [`${lead} ${model.toLowerCase()}`] : []
  // One query per product: two or three were mostly the same market asked twice, at a call each.
  // The strongest one wins: model number, then brand and product, then the product alone.
  const best = extra.length ? extra : (oneWord || named ? [`${brand} ${core}`] : [core])
  const plain = oneWord ? [`${brand} ${core}`] : (named ? [core, `${brand} ${core}`] : [core])
  for (const q of args['all-queries'] ? [...plain, ...extra] : best) {
    if (doneQueries.has(q)) continue
    // The same product on two shelves drafts one query, priced at the cheaper shop.
    const prev = drafted.get(q)
    // A priced shelf beats one known only by name.
    const rank = (v) => (v > 0 ? v : Infinity)
    if (prev && rank(prev.sort) <= rank(price)) continue
    drafted.set(q, {
      query: q,
      band: bandOf(r),
      brand: brand && q.startsWith(brand) ? brand : '',
      shelf: price > 0 ? price.toFixed(2) : '',
      unit_price: r.unit_price,
      max_qty: r.max_qty,
      shop: r.shop,
      gtin: r.gtin || '',
      name: r.name,
      category: r.category,
      url: r.url,
      sort: price
    })
  }
}

const all = [...drafted.values()]
// Nothing is cut on price, but it is scanned in order of how likely it is to be bought: the £3 to £60
// band first, dearest first, then names with no price, then the rest. A £2,700 boiler fails the goods
// ceiling at the gate; it should not spend the first calls of the night.
// £45 on the shelf is about where the goods pass the £40 the gate buys at.
const tier = (p) => (p >= 3 && p <= 45 ? 0 : p > 0 && p < 3 ? 2 : p > 45 ? 3 : 1)
if (ORDER === 'price') all.sort((a, b) => tier(a.sort) - tier(b.sort) || b.sort - a.sort)

console.log(`\n${rows.length} shelf products`)
if (doneIds.size || doneQueries.size) {
  console.log(`  ${refused.done} already scanned, from ${doneIds.size} products and ${doneQueries.size} queries done before`)
}
console.log(`  ${refused.sized} sized, clothing or footwear`)
console.log(`  ${refused.price} ${MIN || Number.isFinite(MAX) ? `priced outside £${MIN} to £${MAX}` : 'with no price'}`)
console.log(`  ${refused.stock} out of stock, ${refused.capped} capped under ${MIN_QTY} a customer`)
console.log(`  ${refused.short} with nothing left after the brand and the size\n`)

writeFiles(all)

console.log('\nThese are a draft. Correct the query column, blank a row to drop it,')
console.log(`then rerun with --from-map=${OUT}-map.csv\n`)
all.slice(0, 30).forEach(r => console.log(`  ${r.query.padEnd(34)} ${String(r.shelf).padStart(6)}  ${String(r.shop).padEnd(10)} ${r.name.slice(0, 40)}`))
