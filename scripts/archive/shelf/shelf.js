// scripts/shelf.js
// Reads a shop's category tree and writes what is on the shelf, with prices.
// Nothing in the output comes from anywhere except the fetched page.
//
// Two readers, tried in order. Schema first because it is the shop's own
// declaration of what a product is. The scan is the fallback and it is blunt:
// a price on a grid is always preceded by the link to the thing it prices.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, ...v] = a.replace(/^--/, '').split('=')
    return [k, v.length ? v.join('=') : true]
  })
)

const ROOTS = (args.roots || '').split(',').filter(Boolean)
const DEPTH = Number(args.depth || 2)
const MAX_PAGES = Number(args['max-pages'] || 60)
const OUT = args.out || 'scripts/shelf.csv'
const RAW = args.raw || 'scripts/shelf-html'
const DELAY = Number(args.delay || 1400)

if (!ROOTS.length) {
  console.error('need --roots=url')
  process.exit(1)
}

const ORIGIN = new URL(ROOTS[0]).origin
const SITE = new URL(ROOTS[0]).hostname.replace(/^www\./, '')

const sleep = ms => new Promise(r => setTimeout(r, ms))

const HEADERS_BASE = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'accept-language': 'en-GB,en;q=0.9',
  'sec-ch-ua': '"Chromium";v="126", "Not:A-Brand";v="24", "Google Chrome";v="126"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-user': '?1',
  'upgrade-insecure-requests': '1'
}

const jar = new Map()
let lastUrl = null

function storeCookies (res) {
  for (const line of res.headers.getSetCookie?.() ?? []) {
    const [pair] = line.split(';')
    const i = pair.indexOf('=')
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim())
  }
}

async function get (url) {
  const headers = { ...HEADERS_BASE, 'sec-fetch-site': lastUrl ? 'same-origin' : 'none' }
  if (lastUrl) headers.referer = lastUrl
  if (jar.size) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ')

  const res = await fetch(url, { headers, redirect: 'follow' })
  storeCookies(res)
  lastUrl = url

  if (res.status === 403 || res.status === 406 || res.status === 425) {
    console.error(`\n${res.status} on ${url}`)
    console.error('Blocked below HTTP. This shop needs a headless browser.')
    process.exit(2)
  }
  if (!res.ok) throw new Error(`${res.status} on ${url}`)
  return res.text()
}

function absolute (href) {
  try {
    return new URL(href, ORIGIN).href.split('#')[0]
  } catch {
    return null
  }
}

// Reader one. Whatever the shop declares as a Product in its own structured data.
function fromSchema (html) {
  const out = []
  const re = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi
  let m
  while ((m = re.exec(html))) {
    let parsed
    try {
      parsed = JSON.parse(m[1].trim())
    } catch {
      continue
    }
    walk(parsed, out)
  }
  return out
}

function walk (node, out) {
  if (Array.isArray(node)) return node.forEach(n => walk(n, out))
  if (!node || typeof node !== 'object') return

  const type = [].concat(node['@type'] || []).join(' ')
  if (/Product/i.test(type) && node.name) {
    const offer = [].concat(node.offers || [])[0] || {}
    const price = Number(offer.price ?? offer.lowPrice ?? node.price)
    if (price > 0) {
      out.push({
        name: String(node.name).trim(),
        price,
        url: absolute(node.url || offer.url || '') || '',
        source: 'schema'
      })
    }
  }
  for (const v of Object.values(node)) walk(v, out)
}

// Reader two. Every price, paired with the nearest link above it.
function fromScan (html) {
  const out = []
  const priceRe = /£\s?(\d{1,4}(?:\.\d{2})?)/g
  let m
  while ((m = priceRe.exec(html))) {
    const before = html.slice(Math.max(0, m.index - 2500), m.index)
    const hrefs = [...before.matchAll(/href="([^"]+)"/gi)]
    if (!hrefs.length) continue
    const href = hrefs[hrefs.length - 1][1]
    const url = absolute(href)
    if (!url || !url.startsWith(ORIGIN)) continue

    const distance = before.length - hrefs[hrefs.length - 1].index
    const slug = url.split('?')[0].split('/').filter(Boolean).pop() || ''
    if (slug.length < 6) continue

    out.push({
      name: slug.replace(/\.html?$/, '').replace(/[-_]/g, ' ').replace(/^./, c => c.toUpperCase()),
      price: Number(m[1]),
      url,
      distance,
      source: 'scan'
    })
  }
  return out
}

function packSize (name) {
  const words = { two: 2, three: 3, four: 4, five: 5, six: 6, eight: 8, ten: 10, twelve: 12 }
  const of = name.match(/pack of (\d+)/i)
  if (of) return Number(of[1])
  const x = name.match(/\b(\d+)\s?(?:pack|pk|s?\b x\b)/i)
  if (x) return Number(x[1])
  const w = name.match(/pack of (\w+)/i)
  if (w && words[w[1].toLowerCase()]) return words[w[1].toLowerCase()]
  return null
}

const seen = new Set()
const rows = new Map()
const emptyPages = []
let schemaPages = 0

async function crawl (url, root, depth) {
  if (seen.has(url) || depth < 0 || seen.size >= MAX_PAGES) return
  seen.add(url)

  const html = await get(url)
  await sleep(DELAY)

  if (!existsSync(RAW)) mkdirSync(RAW, { recursive: true })
  const file = `${SITE}${new URL(url).pathname}`.replace(/[/?&=]/g, '_').slice(0, 120)
  writeFileSync(join(RAW, `${file}.html`), html)

  const schema = fromSchema(html)
  const found = schema.length ? schema : fromScan(html)
  if (schema.length) schemaPages++

  let added = 0
  for (const p of found) {
    if (!p.url || rows.has(p.url)) continue
    rows.set(p.url, { ...p, pack: packSize(p.name), category: new URL(url).pathname })
    added++
  }

  const rootPath = new URL(root).pathname
  const cats = [...new Set(
    [...html.matchAll(/href="([^"]+)"/gi)]
      .map(h => absolute(h[1]))
      .filter(u => u && u.startsWith(ORIGIN) && new URL(u).pathname.startsWith(rootPath))
  )].filter(u => !rows.has(u))

  console.log(`${found.length ? String(found.length).padStart(4) : '   0'} items (${schema.length ? 'schema' : 'scan'})  ${String(added).padStart(4)} new  ${url}`)
  if (!found.length) emptyPages.push(url)

  for (const c of cats) await crawl(c, root, depth - 1)
}

for (const root of ROOTS) await crawl(root, root, DEPTH)

if (rows.size === 0) {
  console.error('\nNothing parsed from any page.')
  console.error(`Raw HTML is in ${RAW}. Fix the reader against it before trusting anything.`)
  process.exit(1)
}

if (emptyPages.length) {
  console.error(`\n${emptyPages.length} pages yielded nothing:`)
  emptyPages.slice(0, 20).forEach(u => console.error(`  ${u}`))
}

const header = 'site,url,name,price,pack_size,unit_price,category,source,scan_distance'
const lines = [...rows.values()]
  .sort((a, b) => a.price - b.price)
  .map(r => [
    SITE,
    r.url,
    `"${r.name.replace(/"/g, '""')}"`,
    r.price.toFixed(2),
    r.pack ?? '',
    r.pack ? (r.price / r.pack).toFixed(4) : '',
    r.category,
    r.source,
    r.distance ?? ''
  ].join(','))

writeFileSync(OUT, [header, ...lines].join('\n'))
console.log(`\n${OUT} written, ${rows.size} products from ${seen.size} pages, ${schemaPages} of them via schema.`)
console.log('Spot check ten rows against the site. Scan rows with a large scan_distance are the ones to check first.')
