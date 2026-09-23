// scripts/hb-paging-probe.js
// The products are in data.props.productData, twenty a page, and the page
// count is in data.props.pagination.totalPages. What is unknown is how the
// site asks for page two: the query parameter is ignored.
//
// This tries the candidates and reports which one returns different products.
// It decides nothing.
//
//   node scripts/hb-paging-probe.js --cid=939 --slug=health-and-wellbeing

import { chromium } from 'playwright'

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, ...v] = a.replace(/^--/, '').split('=')
    return [k, v.length ? v.join('=') : true]
  })
)

const ORIGIN = 'https://home.bargains'
const cid = String(args.cid || '939')
const slug = String(args.slug || 'health-and-wellbeing')
const base = `/category/${cid}/${slug}`

const browser = await chromium.launch({ headless: !args.headed })
const page = await browser.newPage({ locale: 'en-GB', viewport: { width: 1400, height: 1000 } })

const blob = () => page.evaluate(() => {
  const el = document.getElementById('__FLAREACT_DATA')
  if (!el) return null
  try {
    const d = JSON.parse(el.textContent)
    return {
      ids: (d?.props?.productData ?? []).map(p => p.id),
      totalPages: d?.props?.pagination?.totalPages ?? null,
      pagination: d?.props?.pagination ?? null,
      buildId: d?.buildId ?? d?.props?.buildId ?? null,
      topKeys: Object.keys(d ?? {}),
      propKeys: Object.keys(d?.props ?? {})
    }
  } catch { return null }
})

const load = async (path) => {
  await page.goto(ORIGIN + path, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(2500)
  return blob()
}

await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded', timeout: 60000 })
try {
  const accept = page.getByRole('button', { name: /accept all/i }).first()
  if (await accept.isVisible({ timeout: 2000 })) await accept.click()
} catch {}

const first = await load(base)
if (!first) {
  console.error('\nNo page data on the category. The blob has moved.\n')
  await browser.close()
  process.exit(1)
}

console.log(`\n${base}`)
console.log(`  ${first.ids.length} products, totalPages ${first.totalPages}`)
console.log(`  pagination: ${JSON.stringify(first.pagination)}`)
console.log(`  buildId: ${first.buildId ?? 'not in the blob'}`)
console.log(`  props: ${first.propKeys.join(', ')}`)

const candidates = [
  `${base}?page=2`,
  `${base}?p=2`,
  `${base}?pageNumber=2`,
  `${base}?pageNo=2`,
  `${base}?offset=20`,
  `${base}?start=20`,
  `${base}/2`,
  `${base}/page/2`,
  `${base}?page=2&size=20`
]

console.log('\ntrying page two:')
for (const path of candidates) {
  try {
    const next = await load(path)
    const same = !next || next.ids[0] === first.ids[0]
    const overlap = next ? next.ids.filter(id => first.ids.includes(id)).length : 0
    console.log(`  ${same ? 'same   ' : 'DIFFERENT'} ${String(next?.ids.length ?? 0).padStart(3)} products, `
      + `${overlap} shared   ${path}`)
  } catch (e) {
    console.log(`  failed  ${path}  ${e.message.split('\n')[0]}`)
  }
}

// Where the browser itself goes when paging is used, which settles it if none
// of the guesses above do.
console.log('\nwatching the requests the page makes when it pages itself:')
await load(base)
const seen = new Set()
page.on('request', r => {
  const u = r.url()
  if (/page|offset|graphql|api|category/i.test(u) && !u.match(/\.(png|jpg|webp|svg|css|woff2?)/i)) seen.add(`${r.method()} ${u.slice(0, 160)}`)
})

const pager = page.locator('a[href*="page"], button[aria-label*="age"], nav a').filter({ hasText: /^2$|next/i }).first()
if (await pager.count()) {
  console.log(`  clicking "${(await pager.innerText()).trim()}"`)
  await pager.click({ timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(4000)
  const after = await blob()
  console.log(`  now on ${new URL(page.url()).pathname}${new URL(page.url()).search}`)
  console.log(`  ${after?.ids.length ?? 0} products, first ${after?.ids[0] === first.ids[0] ? 'unchanged' : 'changed'}`)
} else {
  console.log('  no numbered pager or next link found on the page')
}

;[...seen].slice(0, 15).forEach(u => console.log(`  ${u}`))

await browser.close()
console.log('')
