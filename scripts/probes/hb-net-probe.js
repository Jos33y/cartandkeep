// scripts/hb-net-probe.js
// The query parameters are ignored and the path form 404s, yet the page data
// carries nextPage and perPage. Something fetches page two. This watches every
// request the page makes, and prints whatever markup mentions pagination.
//
//   node scripts/hb-net-probe.js --cid=939 --slug=health-and-wellbeing
//   node scripts/hb-net-probe.js --cid=939 --slug=health-and-wellbeing --headed

import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, ...v] = a.replace(/^--/, '').split('=')
    return [k, v.length ? v.join('=') : true]
  })
)

const ORIGIN = 'https://home.bargains'
const cid = String(args.cid || '939')
const slug = String(args.slug || 'health-and-wellbeing')
const path = `/category/${cid}/${slug}`

const browser = await chromium.launch({ headless: !args.headed })
const page = await browser.newPage({ locale: 'en-GB', viewport: { width: 1400, height: 1000 } })

const calls = []
page.on('request', r => {
  const u = r.url()
  if (/\.(png|jpe?g|webp|svg|gif|css|woff2?|ico)(\?|$)/i.test(u)) return
  calls.push({ method: r.method(), url: u, type: r.resourceType(), body: r.postData()?.slice(0, 300) ?? null })
})

await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded', timeout: 60000 })
try {
  const accept = page.getByRole('button', { name: /accept all/i }).first()
  if (await accept.isVisible({ timeout: 2000 })) await accept.click()
} catch {}

calls.length = 0
await page.goto(ORIGIN + path, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(2000)

const onLoad = calls.length
console.log(`\n${path}`)
console.log(`\n${onLoad} requests on load. The ones that are not the page itself:`)
calls.filter(c => c.type !== 'document' && c.type !== 'script' && c.type !== 'stylesheet')
  .slice(0, 20)
  .forEach(c => console.log(`  ${c.method} ${c.type.padEnd(6)} ${c.url.slice(0, 150)}`))

// Anything the page itself calls pagination, in its own words.
const markup = await page.evaluate(() => {
  const hits = []
  const sel = '[class*="pagin" i], [class*="Pagin" i], [data-testid*="pag" i], [aria-label*="pag" i], [class*="loadmore" i], [class*="LoadMore" i]'
  for (const el of document.querySelectorAll(sel)) {
    hits.push({ tag: el.tagName, cls: el.className?.toString().slice(0, 80), html: el.outerHTML.slice(0, 400) })
  }
  const bottom = document.body.innerText.split('\n').filter(Boolean).slice(-25)
  return { hits: hits.slice(0, 6), bottom }
})

console.log(`\nmarkup mentioning pagination: ${markup.hits.length}`)
markup.hits.forEach(h => console.log(`  <${h.tag} class="${h.cls}">\n    ${h.html.replace(/\s+/g, ' ')}`))

console.log('\nthe last lines of text on the page:')
markup.bottom.forEach(l => console.log(`  ${l.slice(0, 90)}`))

// Scroll to the very bottom and watch for anything fetched on the way.
calls.length = 0
for (let i = 0; i < 25; i++) {
  await page.mouse.wheel(0, 2000)
  await page.waitForTimeout(600)
}
await page.waitForTimeout(3000)

const fetched = calls.filter(c => c.type === 'fetch' || c.type === 'xhr')
console.log(`\nfetched while scrolling: ${fetched.length}`)
fetched.slice(0, 15).forEach(c => {
  console.log(`  ${c.method} ${c.url.slice(0, 160)}`)
  if (c.body) console.log(`      body: ${c.body.replace(/\s+/g, ' ')}`)
})

const count = await page.evaluate(() => {
  const el = document.getElementById('__FLAREACT_DATA')
  try { return JSON.parse(el.textContent)?.props?.productData?.length ?? 0 } catch { return 0 }
})
console.log(`\nproducts in the page data after scrolling: ${count}`)

writeFileSync('scripts/hb-net-probe.json', JSON.stringify(calls, null, 2))
console.log('\nevery request written to scripts/hb-net-probe.json\n')

await browser.close()
