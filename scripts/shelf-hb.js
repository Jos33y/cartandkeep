// scripts/shelf-hb.js
// Home Bargains. The apex host home.bargains serves real pages; the www host
// redirects to the root and discards the path.
//
// Products come from data.props.productData rather than the rendered grid: the
// grid gave a price parsed out of card text, which read a 69p lip balm as
// having a £17.25 RRP because that was the largest number on the card.
//
// Paging is ?sortby=newest&currentpage=2&perpage=40, all lowercase. The names
// matter: page, p and offset are all ignored and return page one, which is how
// a category of six pages read as twenty products.
//
//   node scripts/shelf-hb.js --tree
//   node scripts/shelf-hb.js --sample --only=939
//   node scripts/shelf-hb.js --only=939,766 --out=scripts/shelf-hb.csv
//   node scripts/shelf-hb.js --out=scripts/shelf-hb.csv --seasonal

import { chromium } from 'playwright'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, ...v] = a.replace(/^--/, '').split('=')
    return [k, v.length ? v.join('=') : true]
  })
)

const ORIGIN = 'https://home.bargains'
const OUT = args.out || 'scripts/shelf-hb.csv'
const RAW = args.raw || 'scripts/hb-json'
const MAX_PAGES = Number(args['max-pages'] || 60)
const PER_PAGE = Number(args.perpage || 40)
const ONLY = String(args.only || '').split(',').filter(Boolean)

// Seasonal departments, kept out by default because a line that is gone in
// January cannot be restocked. --seasonal takes them, which is what Halloween
// and Christmas buying needs.
const SEASONAL = new Set(['654', '676', '598', '123', '164'])

function flatten (menu, seasonal) {
  const out = []
  const walk = (node, top) => {
    out.push({ cid: node.cid, name: node.displayName, slug: node.slug, top })
    for (const kid of node.children || []) walk(kid, top)
  }
  for (const dept of menu) {
    if (!seasonal && SEASONAL.has(dept.cid)) continue
    walk(dept, dept.cid)
  }
  return out
}

const pageUrl = (path, n) =>
  `${ORIGIN}${path}?sortby=newest&currentpage=${n}&perpage=${PER_PAGE}`

// cost.price is pence: an Olbas oil at £4.99 arrives as 499, with rrp 885.
// A miss names the keys it saw rather than writing a figure that looks like a
// price and is a hundred times it.
function priceOf (p) {
  const c = p.cost
  const num = v => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : null)
  const pounds = v => (v == null ? null : Math.round(v) / 100)

  if (c && typeof c === 'object' && num(c.price) != null) {
    const price = pounds(num(c.price))
    const was = pounds(num(c.rrp))
    return {
      price,
      was: was && was > price ? was : null,
      unit: typeof c.pricePerMetric === 'string' && c.pricePerMetric !== '0' ? c.pricePerMetric : ''
    }
  }
  return { price: null, keys: c && typeof c === 'object' ? Object.keys(c) : typeof c }
}

// The shop's own brand tag, which decides whether a market is worth chasing as
// a generic or has to be bought as the genuine article.
const brandOf = p => (p?.filters?.brand ?? []).find(b => b.value)?.code ?? ''

// What a shop will sell one person. Anything the research needs more of a
// month than this is a line that cannot be restocked.
const maxQtyOf = p => p?.fulfilment?.homeDelivery?.stock?.maxSaleQty
  ?? p?.variants?.[0]?.restrictions?.maxSaleQty ?? ''

const inStockOf = p => (p?.fulfilment?.homeDelivery?.stock?.inStock === false ? 'no' : 'yes')

const imageOf = p => {
  const src = p?.images?.[0]?.srcMain ?? p?.images?.[0]?.srcBasket ?? ''
  return src ? `https://media.home.bargains${src}` : ''
}

const browser = await chromium.launch({ headless: !args.headed })
const context = await browser.newContext({ locale: 'en-GB', viewport: { width: 1400, height: 1000 } })
const page = await context.newPage()

if (!existsSync(RAW)) mkdirSync(RAW, { recursive: true })

const blob = () => page.evaluate(() => {
  const el = document.getElementById('__FLAREACT_DATA')
  if (!el) return null
  try {
    const d = JSON.parse(el.textContent)
    return {
      products: d?.props?.productData ?? [],
      page: d?.props?.pagination?.currentPage ?? null,
      pages: d?.props?.pagination?.totalPages ?? null,
      menu: d?.props?.ui?.menuHierarchy ?? null
    }
  } catch { return null }
})

async function dismissCookies () {
  for (const make of [
    () => page.getByRole('button', { name: /accept all/i }).first(),
    () => page.locator('button:has-text("ACCEPT ALL")').first(),
    () => page.locator('[id*="accept" i], [class*="accept" i]').first()
  ]) {
    try {
      const el = make()
      if (await el.isVisible({ timeout: 1200 })) {
        await el.click({ timeout: 3000 })
        await page.waitForTimeout(600)
        return true
      }
    } catch {}
  }
  return false
}

async function readPage (path, n) {
  await page.goto(pageUrl(path, n), { waitUntil: 'domcontentloaded', timeout: 60000 })
  const landed = new URL(page.url()).pathname
  if (landed !== path) throw new Error(`redirected to ${landed}`)
  await page.waitForTimeout(900)
  return blob()
}

async function collect (path) {
  const found = new Map()
  const bad = new Set()
  const first = await readPage(path, 1)
  if (!first) throw new Error('no page data')

  const take = (items) => {
    for (const p of items) {
      if (!p?.id || found.has(p.id)) continue
      const cost = priceOf(p)
      if (cost.price == null) { bad.add(JSON.stringify(cost.keys)); continue }
      found.set(p.id, {
        id: p.id,
        slug: p.slug,
        name: String(p.displayName ?? p.slug ?? '').replace(/\s+/g, ' ').trim(),
        price: cost.price,
        was: cost.was ?? '',
        unit: cost.unit ?? '',
        brand: brandOf(p),
        maxQty: maxQtyOf(p),
        inStock: inStockOf(p),
        image: imageOf(p),
        variants: Array.isArray(p.variants) ? p.variants.length : ''
      })
    }
  }

  take(first.products)
  const pages = Math.min(Number(first.pages) || 1, MAX_PAGES)

  for (let n = 2; n <= pages; n++) {
    const next = await readPage(path, n)
    // The same first product on a new page number means the parameter was
    // ignored, which is the failure this whole rewrite exists to stop.
    if (!next?.products?.length) break
    if (next.page !== n && next.products[0]?.id === first.products[0]?.id) break
    take(next.products)
  }

  return { items: [...found.values()], pages, bad: [...bad] }
}

await page.goto(`${ORIGIN}/`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await dismissCookies()
await page.waitForTimeout(1200)

const home = await blob()
if (!Array.isArray(home?.menu)) {
  console.error('menuHierarchy is not where it was.')
  await browser.close()
  process.exit(1)
}

const all = flatten(home.menu, Boolean(args.seasonal))

if (args.tree) {
  for (const c of all) console.log(`${c.cid.padEnd(9)} ${c.name}`)
  console.log(`\n${all.length} categories${args.seasonal ? ', seasonal included' : ', seasonal excluded'}.`)
  await browser.close()
  process.exit(0)
}

const targets = ONLY.length ? all.filter(c => ONLY.includes(c.cid) || ONLY.includes(c.top)) : all
if (!targets.length) {
  console.error(`Nothing matched --only=${args.only}. Run --tree for the cids.`)
  await browser.close()
  process.exit(1)
}

// One product, whole, so the fields can be read rather than assumed.
if (args.sample) {
  const c = targets[0]
  const one = await readPage(`/category/${c.cid}/${c.slug}`, 1)
  console.log(`\n${c.cid} ${c.name}: ${one?.products?.length ?? 0} products, page ${one?.page} of ${one?.pages}\n`)
  console.log(JSON.stringify(one?.products?.[0] ?? null, null, 2).slice(0, 2500))
  await browser.close()
  process.exit(0)
}

const rows = new Map()
const empty = []
const unreadable = new Set()

for (const c of targets) {
  const path = `/category/${c.cid}/${c.slug}`
  try {
    const { items, pages, bad } = await collect(path)
    bad.forEach(b => unreadable.add(b))

    let added = 0
    for (const p of items) {
      if (rows.has(p.id)) continue
      rows.set(p.id, { ...p, url: `${ORIGIN}/product/${p.id}/${p.slug}`, category: c.name, cid: c.cid })
      added++
    }
    console.log(`${String(items.length).padStart(4)} in category  ${String(added).padStart(4)} new  `
      + `${String(pages).padStart(2)} pages  ${c.cid.padEnd(9)} ${c.name}`)
    if (!items.length) empty.push(`${c.cid} ${c.name}`)
  } catch (err) {
    console.log(`   -  failed                                  ${c.cid.padEnd(9)} ${c.name}  ${err.message.split('\n')[0]}`)
    empty.push(`${c.cid} ${c.name}  ${err.message.split('\n')[0]}`)
  }
}

await browser.close()

if (!rows.size) {
  console.error('\nNo products from any category.')
  process.exit(1)
}

if (unreadable.size) {
  console.error(`\nSome products carried a cost this does not read: ${[...unreadable].join(' ')}`)
  console.error('Run --sample to see one whole product and teach priceOf the shape.')
}

if (empty.length) {
  console.error(`\n${empty.length} categories yielded nothing:`)
  empty.forEach(e => console.error(`  ${e}`))
}

const header = 'id,name,price,rrp,unit_price,brand,max_qty,in_stock,variants,cid,category,image,url'
const lines = [...rows.values()]
  .sort((a, b) => a.price - b.price)
  .map(r => [
    r.id,
    `"${r.name.replace(/"/g, '""')}"`,
    r.price.toFixed(2),
    r.was === '' ? '' : Number(r.was).toFixed(2),
    `"${String(r.unit).replace(/"/g, '""')}"`,
    r.brand,
    r.maxQty,
    r.inStock,
    r.variants,
    r.cid,
    `"${r.category.replace(/"/g, '""')}"`,
    r.image,
    r.url
  ].join(','))

writeFileSync(OUT, [header, ...lines].join('\n'))
const buckets = new Set([...rows.values()].map(r => r.cid))
console.log(`\n${OUT} written, ${rows.size} products across ${buckets.size} categories.`)
