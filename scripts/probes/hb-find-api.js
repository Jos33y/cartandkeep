// scripts/hb-find-api.js
// The site routes client side, so no HTML holds a product grid. The request that
// does is described in the JS bundles. This reads them and reports candidates.
// It decides nothing. It prints what is in the files.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs'

const ORIGIN = 'https://www.homebargains.co.uk'
const OUT = 'scripts/hb-api-candidates.txt'
const RAW = 'scripts/hb-js'

const BUNDLES = [
  '/_flareact/static/xopI4FwsqnuWZe_bmnBu3/_buildManifest.js',
  '/_flareact/static/pages/index.6f9393c3901734ef2ff6.js',
  '/_flareact/static/pages/_app.f1c9bb307265e3db57cb.js',
  '/_flareact/static/main.1425a01f1da30d4fdf36.js',
  '/_flareact/static/commons.d40d450220e82c94fbd8.js',
  '/_flareact/static/3f12d12c2ca2c251253e4ca909f65c90c41a8894.148f6184c8a21deaa909.js',
  '/_flareact/static/787fb6bcb9428ef73917f40999a15c12993cf00d.63c545b904216064f093.js',
  '/_flareact/static/7a2601b2da85dcfb9dd3dd2a59eba8dc81067a5a.caf63fe9f01bfef92383.js',
  '/_flareact/static/7bbb7079.90f3509e754c9926a387.js',
  '/_flareact/static/83440df74eded99bc5fbe3b940d9de01a0b9eb3c.784fc0ded29d430a8778.js',
  '/_flareact/static/9772e848a0103f6863e5c9289be8faa0d5cbb396.f925e5f8a2d85e4e69c2.js',
  '/_flareact/static/bbddbb27ed578f0792afcd931e7f99c8f23dfc11.6e4683bb03d92a01c95e.js',
  '/_flareact/static/e11c0bd1a240c4e84b7a87993f4781a15abdbdae.c01280441820aa0cd68c.js',
  '/_flareact/static/fc356f57344974ec5f87eeb506b467352a497d66.990ad477045bbadbbd35.js'
]

const HEADERS = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  accept: '*/*',
  'accept-language': 'en-GB,en;q=0.9',
  referer: ORIGIN + '/'
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

const PATTERNS = [
  [/https?:\/\/[a-z0-9.-]*(?:api|search|graph|algolia|klevu|attraqt|constructor|bloomreach|elastic|cdn)[a-z0-9.\-/]*/gi, 'absolute service url'],
  [/["'`](\/api\/[a-z0-9\-_/{}$.:]+)["'`]/gi, 'relative /api path'],
  [/["'`](\/v\d\/[a-z0-9\-_/{}$.:]+)["'`]/gi, 'versioned path'],
  [/["'`]([a-z0-9\-_/]*(?:categor|product|listing|plp|search)[a-z0-9\-_/{}$.:]*)["'`]/gi, 'path with a product word'],
  [/graphql/gi, 'graphql mention'],
  [/x-api-key|apikey|api_key|subscription-key/gi, 'key header name']
]

const hits = new Map()

for (const path of BUNDLES) {
  const url = ORIGIN + path
  try {
    const res = await fetch(url, { headers: HEADERS })
    if (!res.ok) {
      console.log(`${res.status}  ${path}`)
      continue
    }
    const js = await res.text()

    if (!existsSync(RAW)) mkdirSync(RAW, { recursive: true })
    writeFileSync(`${RAW}/${path.split('/').pop()}`, js)

    let count = 0
    for (const [re, label] of PATTERNS) {
      for (const m of js.matchAll(re)) {
        const value = (m[1] || m[0]).trim()
        if (value.length < 5 || value.length > 200) continue
        if (/\.(png|jpg|jpeg|svg|webp|woff2?|css)$/i.test(value)) continue
        const key = `${label}\t${value}`
        hits.set(key, (hits.get(key) || 0) + 1)
        count++
      }
    }
    console.log(`${String(Math.round(js.length / 1024)).padStart(5)}kb  ${String(count).padStart(4)} hits  ${path.split('/').pop()}`)
  } catch (err) {
    console.log(`fail  ${path}  ${err.cause?.code || err.message}`)
  }
  await sleep(600)
}

const sorted = [...hits.entries()].sort((a, b) => b[1] - a[1])
writeFileSync(OUT, sorted.map(([k, n]) => `${String(n).padStart(4)}  ${k}`).join('\n'))

console.log(`\n${OUT} written, ${sorted.length} distinct candidates.`)
console.log('\nTop 40:')
sorted.slice(0, 40).forEach(([k, n]) => console.log(`${String(n).padStart(4)}  ${k}`))
