// scripts/shelf-probe.js
// Which shops will talk to this machine. Nothing is collected here.
//
// Only shops that publish prices online are listed. B&M and Home Bargains are
// deliberately absent for the same reason they are absent from CandidateRow:
// their stock is not online, so no shelf file and no price re-check is possible.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

const HEADERS = {
  'user-agent': UA,
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'accept-language': 'en-GB,en;q=0.9',
  'sec-ch-ua': '"Chromium";v="126", "Not:A-Brand";v="24", "Google Chrome";v="126"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'sec-fetch-user': '?1',
  'upgrade-insecure-requests': '1'
}

// From cksuppliers.csv, the rows that survive product shape and the pack model
const FROM_SUPPLIER_LIST = [
  'https://www.tofs.com/',
  'https://www.theworks.co.uk/',
  'https://www.robertdyas.co.uk/',
  'https://www.ethicalsuperstore.com/',
  'https://www.zooplus.co.uk/',
  'https://www.garden.co.uk/',
  'https://www.kmsdirect.co.uk/',
  'https://www.qdstores.co.uk/',
  'https://direct.asda.com/',
  'https://www.matalan.co.uk/',
  'https://www.costco.co.uk/'
]

// Discounters and grocers that publish prices, absent from the supplier list
const DISCOUNTERS = [
  'https://www.therange.co.uk/',
  'https://www.wilko.com/',
  'https://www.poundland.co.uk/',
  'https://www.savers.co.uk/',
  'https://www.superdrug.com/',
  'https://www.homebargains.co.uk/',
  'https://www.homestoreandmore.co.uk/',
  'https://www.argos.co.uk/',
  'https://www.dunelm.com/',
  'https://www.wickes.co.uk/',
  'https://www.screwfix.com/',
  'https://www.toolstation.com/',
  'https://www.tesco.com/',
  'https://www.sainsburys.co.uk/',
  'https://groceries.asda.com/',
  'https://www.iceland.co.uk/',
  'https://www.ocado.com/'
]

const CANDIDATES = [...FROM_SUPPLIER_LIST, ...DISCOUNTERS]

const sleep = ms => new Promise(r => setTimeout(r, ms))

// A page that comes back but carries no price is a challenge page, not a shelf.
function priceCount (html) {
  return (html.match(/£\s?\d+(\.\d{2})?/g) || []).length
}

const open = []

for (const url of CANDIDATES) {
  try {
    const started = Date.now()
    const res = await fetch(url, { headers: HEADERS, redirect: 'follow' })
    const html = res.ok ? await res.text() : ''
    const prices = html ? priceCount(html) : 0
    const ms = Date.now() - started
    const verdict = res.ok && prices > 0 ? 'OPEN' : res.ok ? 'served, no prices' : 'blocked'
    if (verdict === 'OPEN') open.push(url)
    console.log(
      `${String(res.status).padEnd(4)} ${verdict.padEnd(18)} ${String(prices).padStart(4)} prices  ${String(ms).padStart(5)}ms  ${url}`
    )
  } catch (err) {
    console.log(`---  ${'unreachable'.padEnd(18)}    -          -  ${url}  ${err.cause?.code || err.message}`)
  }
  await sleep(1200)
}

console.log(`\n${open.length} of ${CANDIDATES.length} returned a page with prices on it.`)
open.forEach(u => console.log(`  ${u}`))
if (!open.length) {
  console.log('\nNothing is open to a plain client. Playwright is the answer, not a different shop.')
  process.exit(2)
}
