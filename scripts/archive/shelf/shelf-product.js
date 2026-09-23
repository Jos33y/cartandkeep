// scripts/shelf-product.js
// Fills in everything a listing needs from the product page: images, brand,
// description, features, breadcrumb and the current price. The category crawl
// only takes name and price, which is enough to gate and not enough to list.
//
// Give it a gate CSV and a shelf map and it fetches only the queries that
// passed, which is the set that will be imported. Whole-crawl fetches are
// available with --csv but are rarely what you want: 642 pages to list two.
//
//   node scripts/shelf-product.js --gate=gate-hb-1.csv --shelf=scripts/queries-hb-map.csv --out=scripts/products-hb-1.json
//   node scripts/shelf-product.js --csv=scripts/shelf-hb.csv --out=scripts/shelf-hb-full.json
//   node scripts/shelf-product.js --urls=scripts/to-list.txt --headed

import { chromium } from 'playwright'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, ...v] = a.replace(/^--/, '').split('=')
    return [k, v.length ? v.join('=') : true]
  })
)

const OUT = args.out || 'scripts/shelf-hb-full.json'
const RAW = args.raw || 'scripts/hb-products'
const LIMIT = Number(args.limit || 0)
const IMAGE_PX = Number(args.px || 1600)

function splitCsvLine (line) {
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
  const head = splitCsvLine(lines[0])
  return lines.slice(1).map((l) => {
    const c = splitCsvLine(l)
    return Object.fromEntries(head.map((h, i) => [h, c[i] ?? '']))
  })
}

function urlsFromCsv (path) {
  return [...new Set(
    readFileSync(path, 'utf8').split(/\r?\n/)
      .map((l) => (l.match(/https:\/\/[^,"]+\/product\/[^,"]+/) || [])[0])
      .filter(Boolean),
  )]
}

// Only what passed. A gate CSV names the queries, the shelf map turns each one
// back into the product it came from.
function urlsFromGate (gatePath, shelfPath) {
  const shelf = new Map()
  for (const r of readCsv(shelfPath)) {
    const q = (r.query || '').trim()
    const url = (r.url || '').trim()
    if (q && url) shelf.set(q, url)
  }

  const rows = readCsv(gatePath)

  // The gate calls it outcome. Falling back to every row when the filter finds
  // nothing turned a 26 page fetch into a 140 page one, so an empty result is
  // now an error: it means the column moved, not that nothing passed.
  const passed = rows.filter((r) => String(r.outcome ?? '').trim().toLowerCase() === 'pass')
  if (!passed.length) {
    console.error(`No row in ${gatePath} has outcome=pass.`)
    console.error(`Outcomes present: ${[...new Set(rows.map((r) => r.outcome))].join(', ') || 'none'}`)
    process.exit(1)
  }
  const use = passed

  const missing = []
  const urls = []
  for (const r of use) {
    const q = (r.q || r.query || '').trim()
    const url = shelf.get(q)
    if (url) urls.push(url)
    else if (q) missing.push(q)
  }

  console.log(`${use.length} of ${rows.length} queries passed, ${new Set(urls).size} products`)
  if (missing.length) {
    console.log(`${missing.length} with no shelf url, so nothing to fetch: ${missing.slice(0, 5).join(', ')}`)
  }
  return [...new Set(urls)]
}

const urls = args.urls
  ? readFileSync(String(args.urls), 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
  : args.gate
    ? urlsFromGate(String(args.gate), String(args.shelf || 'scripts/queries-hb-map.csv'))
    : urlsFromCsv(args.csv || 'scripts/shelf-hb.csv')

if (!urls.length) {
  console.error('No product URLs found.')
  process.exit(1)
}

const targets = LIMIT ? urls.slice(0, LIMIT) : urls
console.log(`${targets.length} product pages\n`)

if (!existsSync(RAW)) mkdirSync(RAW, { recursive: true })

const browser = await chromium.launch({ headless: !args.headed })
const context = await browser.newContext({ locale: 'en-GB', viewport: { width: 1400, height: 1000 } })
const page = await context.newPage()

// Read by structure rather than by class name, so a restyle does not empty the
// output. Anything not found comes back null and is counted, never invented.
// The product page carries its own state as JSON, the same __FLAREACT_DATA the
// homepage uses for the menu. props.productData is the whole product, properly
// typed. Three rounds of DOM selectors were spent on a page that never needed
// one: the mega menu came back as a breadcrumb and a delivery threshold came
// back as an RRP, both because reading rendered text cannot tell a product
// apart from the page around it.
async function readProduct () {
  const data = await page.evaluate(() => {
    const el = document.getElementById('__FLAREACT_DATA')
    if (!el) return null
    try {
      return JSON.parse(el.textContent)?.props?.productData ?? null
    } catch {
      return null
    }
  })
  if (!data) return null

  // Prices are in pence. A variant is the thing that is actually bought, and a
  // simple product has exactly one.
  const variant = (data.variants ?? [])[0] ?? {}
  const cost = variant.cost ?? {}
  const stock = variant.fulfilment?.homeDelivery?.stock ?? {}

  const cats = data.categories ?? {}

  // categories.primary is the department, not the leaf: a lip balm comes back
  // as Health, Beauty & Fitness when the useful category is Lip Care. The leaf
  // is the most specific entry, which is the one no other entry is a parent of,
  // so take the deepest name rather than the flagged one.
  const trail = [...(cats.other ?? []), cats.primary].filter(Boolean)
  const leaf = trail.reduce(
    (best, c) => ((c.displayName ?? '').length > (best?.displayName ?? '').length ? c : best),
    trail[0] ?? null,
  )

  return {
    id: data.id ?? null,
    // The shop's own name carries stray whitespace often enough to matter, and
    // this becomes an eBay title.
    title: (data.displayName ?? '').replace(/\s+/g, ' ').trim() || null,
    brand: data.brand?.primary?.displayName ?? null,

    // srcZoom is the largest the shop holds, and the size is a parameter, so
    // ask for what eBay wants rather than what the page happened to render.
    images: [...new Set((data.images ?? [])
      .map((i) => i.srcZoom || i.srcMain || i.srcThumb)
      .filter(Boolean))]
      .map((src) => `https://media.home.bargains${src}?x=${IMAGE_PX}&y=${IMAGE_PX}&fit=cover`),

    breadcrumb: trail.map((c) => ({ id: c.id, name: c.displayName, slug: c.slug })),
    category_id: leaf?.id ?? null,
    category_name: leaf?.displayName ?? null,
    department_id: cats.primary?.id ?? null,

    price: cost.price != null ? cost.price / 100 : null,
    rrp: cost.rrp ? cost.rrp / 100 : null,
    unit_price: cost.pricePerMetric || null,
    in_stock: stock.inStock === true ? 'yes' : stock.inStock === false ? 'no' : null,
    max_qty: variant.restrictions?.maxSaleQty ?? null,

    summary: data.smallDescription ?? null,
    description: data.description ?? null,
    // Markdown bullets on the page, a list everywhere else.
    features: Array.isArray(data.features)
      ? data.features
      : String(data.features ?? '')
        .split(/\n|(?:^|\s)\*\s+/)
        .map((s) => s.replace(/\s+/g, ' ').trim())
        .filter(Boolean),
    ingredients: data.ingredients ?? null,
    nutrition: data.nutritionalInformation ?? null,
    safety: data.safetyInformation ?? null,
    product_code: data.code ?? data.as400Code ?? null,
  }
}

const out = []
const failed = []

for (const [i, url] of targets.entries()) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
    // attached, not visible: waitForSelector defaults to visible and a script
    // tag never is.
    await page.waitForSelector('#__FLAREACT_DATA', { state: 'attached', timeout: 20000 })

    const p = await readProduct()
    if (!p) throw new Error('no productData in the page state')
    p.url = url

    writeFileSync(`${RAW}/${url.split('/')[4]}.json`, JSON.stringify(p, null, 1))
    out.push(p)

    const missing = ['title', 'brand', 'price', 'description'].filter(k => !p[k])
    console.log(
      `${String(i + 1).padStart(4)}/${targets.length}  ` +
      `${String(p.images.length).padStart(2)} images  ` +
      `${p.price != null ? `£${p.price.toFixed(2)}` : '   -  '}  ` +
      `${missing.length ? `missing ${missing.join(', ')}  ` : ''}` +
      `${(p.title || url).slice(0, 56)}`,
    )
  } catch (err) {
    console.log(`${String(i + 1).padStart(4)}/${targets.length}  failed  ${url}  ${err.message.split('\n')[0]}`)
    failed.push(url)
  }
}

await browser.close()

if (!out.length) {
  console.error('\nNothing read from any page.')
  process.exit(1)
}

writeFileSync(OUT, JSON.stringify(out, null, 1))

const noImages = out.filter(p => !p.images.length).length
const noBrand = out.filter(p => !p.brand).length
const noDesc = out.filter(p => !p.description).length

console.log(`\n${OUT} written, ${out.length} products.`)
console.log(`${noImages} with no images, ${noBrand} with no brand, ${noDesc} with no description.`)
if (failed.length) console.log(`${failed.length} pages failed and are listed above.`)
