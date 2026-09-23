// scripts/hb-page-probe.js
// Why a category stops at twenty. Reports what the page does rather than
// assuming: what the data blob holds, what the grid renders, whether a load
// more button exists, and whether the page parameter changes anything.
//
//   node scripts/hb-page-probe.js --cid=766 --slug=dishwashing-and-washing-up
//   node scripts/hb-page-probe.js --cid=939 --slug=health-and-wellbeing --headed

import { chromium } from 'playwright'

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, ...v] = a.replace(/^--/, '').split('=')
    return [k, v.length ? v.join('=') : true]
  })
)

const ORIGIN = 'https://home.bargains'
const cid = String(args.cid || '766')
const slug = String(args.slug || 'dishwashing-and-washing-up')
const path = `/category/${cid}/${slug}`

const browser = await chromium.launch({ headless: !args.headed })
const page = await browser.newPage({ locale: 'en-GB', viewport: { width: 1400, height: 1000 } })

const countLinks = () => page.evaluate(() =>
  new Set([...document.querySelectorAll('a[href*="/product/"]')]
    .map(a => (a.getAttribute('href') || '').split('/')[2])).size)

const scrollToEnd = async (rounds = 25) => {
  let last = 0
  for (let i = 0; i < rounds; i++) {
    const h = await page.evaluate(() => document.body.scrollHeight)
    await page.mouse.wheel(0, h)
    await page.waitForTimeout(1200)
    const now = await page.evaluate(() => document.body.scrollHeight)
    if (now === last && now === h) break
    last = h
  }
}

await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded', timeout: 60000 })
try {
  const accept = page.getByRole('button', { name: /accept all/i }).first()
  if (await accept.isVisible({ timeout: 2000 })) await accept.click()
} catch {}

await page.goto(ORIGIN + path, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(3000)

console.log(`\n${path}`)
console.log(`landed on ${new URL(page.url()).pathname}`)

// What the page itself says it holds. The homepage keeps its menu here, so a
// category may keep its products and its total in the same place.
const blob = await page.evaluate(() => {
  const el = document.getElementById('__FLAREACT_DATA')
  if (!el) return null
  let data
  try { data = JSON.parse(el.textContent) } catch { return { parsed: false } }

  const arrays = []
  const numbers = []
  const walk = (node, at, depth) => {
    if (depth > 6 || node == null) return
    if (Array.isArray(node)) {
      if (node.length && typeof node[0] === 'object' && node[0] !== null) {
        arrays.push({ at, length: node.length, keys: Object.keys(node[0]).slice(0, 12) })
      }
      return
    }
    if (typeof node !== 'object') return
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === 'number' && /total|count|pages|size|limit|offset/i.test(k)) numbers.push(`${at}.${k} = ${v}`)
      walk(v, `${at}.${k}`, depth + 1)
    }
  }
  walk(data, 'data', 0)
  return { parsed: true, arrays: arrays.slice(0, 12), numbers: numbers.slice(0, 20) }
})

if (!blob) console.log('\nno __FLAREACT_DATA on this page')
else if (!blob.parsed) console.log('\n__FLAREACT_DATA present and did not parse')
else {
  console.log('\narrays of objects in the page data:')
  blob.arrays.forEach(a => console.log(`  ${String(a.length).padStart(4)}  ${a.at}  [${a.keys.join(', ')}]`))
  console.log('\ncounts in the page data:')
  blob.numbers.forEach(n => console.log(`  ${n}`))
}

console.log(`\nproduct links before scrolling: ${await countLinks()}`)
await scrollToEnd()
console.log(`after scrolling to the end:      ${await countLinks()}`)

const more = page.locator('button, a').filter({ hasText: /load more|show more|view more|more products|next/i })
const moreCount = await more.count()
console.log(`\nbuttons matching load or next:   ${moreCount}`)
for (let i = 0; i < Math.min(moreCount, 4); i++) {
  console.log(`  "${(await more.nth(i).innerText()).replace(/\s+/g, ' ').trim()}"`)
}

if (moreCount) {
  await more.first().click({ timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(2500)
  await scrollToEnd(6)
  console.log(`after clicking the first one:    ${await countLinks()}`)
}

// The page parameter, and whether it returns a different first product.
const firstId = () => page.evaluate(() =>
  (document.querySelector('a[href*="/product/"]')?.getAttribute('href') || '').split('/')[2] || null)

const one = await firstId()
await page.goto(`${ORIGIN}${path}?page=2`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(3000)
await scrollToEnd(6)
const two = await firstId()
console.log(`\n?page=2 renders ${await countLinks()} products, first product ${two === one ? 'is the same' : 'is different'}`)

const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))
const claim = text.match(/(\d[\d,]*)\s+(products|items|results)/i)
console.log(`page text claims: ${claim ? claim[0] : 'no count stated'}`)

await browser.close()
console.log('')
