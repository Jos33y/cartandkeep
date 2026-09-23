// scripts/hb-probe.js
// www.homebargains.co.uk redirects to home.bargains and discards the path, so
// every URL under it returns the homepage. This tests the apex host directly.
//
//   node scripts/hb-probe.js --headed

import { chromium } from 'playwright'
import { mkdirSync, existsSync, writeFileSync } from 'node:fs'

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, ...v] = a.replace(/^--/, '').split('=')
    return [k, v.length ? v.join('=') : true]
  })
)

const ORIGIN = 'https://home.bargains'
const RAW = 'scripts/hb-json'
if (!existsSync(RAW)) mkdirSync(RAW, { recursive: true })

const CASES = [
  '/category/037/shampoo',
  '/category/118/kitchen',
  '/category/050/laundry-capsules',
  '/category/765/cleaning-and-household',
  '/category/912/bulk-buys',
  '/category/557/incontinence-products'
]

const browser = await chromium.launch({ headless: !args.headed })
const context = await browser.newContext({ locale: 'en-GB', viewport: { width: 1400, height: 1000 } })
const page = await context.newPage()

async function dismissCookies () {
  const tries = [
    () => page.getByRole('button', { name: /accept all/i }).first(),
    () => page.locator('button:has-text("ACCEPT ALL")').first(),
    () => page.locator('[id*="accept" i], [class*="accept" i]').first()
  ]
  for (const make of tries) {
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

async function settle () {
  try {
    await page.waitForSelector('a[href*="/product/"]', { timeout: 20000 })
  } catch {}
  await page.waitForTimeout(2500)
  let last = 0
  for (let i = 0; i < 25; i++) {
    const h = await page.evaluate(() => document.body.scrollHeight)
    if (h === last) break
    last = h
    await page.mouse.wheel(0, h)
    await page.waitForTimeout(900)
  }
}

async function ids () {
  return page.evaluate(() =>
    [...new Set(
      [...document.querySelectorAll('a[href*="/product/"]')]
        .map(a => (a.getAttribute('href') || '').match(/\/product\/([0-9a-f-]{36})/i)?.[1])
        .filter(Boolean)
    )]
  )
}

async function headings () {
  return page.evaluate(() =>
    [...document.querySelectorAll('h1, h2')]
      .map(h => (h.innerText || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean).slice(0, 3).join(' | ').slice(0, 80)
  )
}

await page.goto(`${ORIGIN}/`, { waitUntil: 'domcontentloaded', timeout: 60000 })
console.log('cookie banner dismissed:', await dismissCookies())
await settle()
const home = new Set(await ids())
console.log(`homepage: ${home.size} products, "${await headings()}"\n`)

for (const path of CASES) {
  try {
    await page.goto(ORIGIN + path, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await settle()

    const landed = new URL(page.url()).pathname
    const all = await ids()
    const fresh = all.filter(id => !home.has(id))

    const note = landed === path ? '' : `  REDIRECTED to ${landed}`
    console.log(`${String(all.length).padStart(4)} on page  ${String(fresh.length).padStart(4)} new  "${await headings()}"  ${path}${note}`)

    if (!fresh.length) {
      await page.screenshot({ path: `${RAW}/probe${path.replace(/\//g, '_')}.png` })
      writeFileSync(`${RAW}/probe${path.replace(/\//g, '_')}.html`, await page.content())
    }
  } catch (err) {
    console.log(`   -  failed  ${path}  ${err.message.split('\n')[0]}`)
  }
}

await browser.close()
