// Every shop page at 13 screen sizes, against a stubbed backend. Run: npm run check:pages [-- --only /about --shots]
import { readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, preview } from 'vite';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const STUB = 'http://stub.supabase.test';

export const SIZES = [
  [320, 568], [360, 740], [375, 667], [390, 844], [414, 896], [430, 932],
  [768, 1024], [820, 1180], [1024, 768],
  // A 13 inch laptop at 150% is 1280 by 720, the shortest window a laptop gives.
  [1280, 720], [1366, 768], [1440, 900], [1920, 1080],
];

const PAGES = [
  '/', '/shop', '/about', '/contact', '/blog', '/blog/what-a-house-runs-out-of',
  '/request', '/unsubscribe?t=stub', '/faq', '/legal/terms', '/saved', '/cart', '/orders', '/no-such-page',
];

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const shots = args.includes('--shots');
const skipBuild = args.includes('--no-build');
const pages = only ?? PAGES;

const tenant = JSON.parse(await readFile(join(here, 'fixture.json'), 'utf8'));

// Enough of Supabase for a shop page to render: the shop row, and empty answers for everything else.
async function stub(route) {
  const req = route.request();
  const url = new URL(req.url());
  const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  if (url.pathname.endsWith('/rpc/public_store')) return json(tenant);
  if (url.pathname.startsWith('/rest/v1/tenants')) return json(tenant);
  if (url.pathname.startsWith('/functions/v1/')) return json({ ok: true });
  if (req.method() !== 'GET') return json({}, 201);
  if ((req.headers().accept ?? '').includes('vnd.pgrst.object')) {
    return json({ code: 'PGRST116', message: 'no rows' }, 406);
  }
  return json([]);
}

// Run inside the page: what sticks out sideways, and whether the heading is on the first screen.
function measure() {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const wide = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);

  const clipped = (el) => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const o = getComputedStyle(a).overflowX;
      if (o !== 'visible') return true;
    }
    return false;
  };
  const name = (el) => {
    const cls = typeof el.className === 'string' ? el.className.split(' ')[0] : '';
    return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}`;
  };

  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const s = getComputedStyle(el);
    // Parked off the left edge on purpose, as a honeypot is; it cannot scroll the page.
    if (s.visibility === 'hidden' || s.position === 'fixed' || r.right <= 0) continue;
    if ((r.right > vw + 0.5 || r.left < -0.5) && !clipped(el)) out.push(`${name(el)} ${Math.round(r.left)}..${Math.round(r.right)}`);
    if (out.length >= 4) break;
  }

  const h1 = document.querySelector('main h1');
  const h1Top = h1 ? h1.getBoundingClientRect().top : null;
  return { vw, wide, out, h1: Boolean(h1), h1Visible: h1Top !== null && h1Top < vh - 40 };
}

// Built into the temp folder with a stub backend, so this can never leave a test build in dist.
const outDir = join(tmpdir(), 'ck-pages-dist');
if (!skipBuild) {
  process.env.VITE_SUPABASE_URL = STUB;
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'stub';
  await build({ root, logLevel: 'warn', build: { outDir, emptyOutDir: true } });
}

const server = await preview({ root, build: { outDir }, preview: { port: 4179, strictPort: true }, logLevel: 'warn' });
const base = 'http://localhost:4179';
const browser = await chromium.launch({ executablePath: process.env.CK_CHROMIUM || undefined });
const shotDir = join(tmpdir(), 'ck-pages');
if (shots) await mkdir(shotDir, { recursive: true });

let failed = 0;
let run = 0;
for (const path of pages) {
  for (const [w, h] of SIZES) {
    const context = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route(`${STUB}/**`, stub);
    await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);

    const m = await page.evaluate(measure);
    const problems = [];
    if (m.wide > m.vw + 1) problems.push(`scrolls sideways by ${m.wide - m.vw}px`);
    if (m.out.length) problems.push(`sticks out: ${m.out.join(', ')}`);
    if (!m.h1) problems.push('no heading');
    else if (!m.h1Visible) problems.push('heading below the first screen');
    if (errors.length) problems.push(`script error: ${errors[0]}`);

    run += 1;
    if (problems.length) {
      failed += 1;
      console.log(`FAIL ${path} ${w}x${h}: ${problems.join('; ')}`);
    }
    if (shots) {
      const file = `${path.replace(/[^a-z0-9]+/gi, '_') || 'home'}-${w}x${h}.png`;
      await page.screenshot({ path: join(shotDir, file), fullPage: true });
    }
    await context.close();
  }
}

await browser.close();
server.httpServer.close();
console.log(`${run - failed} of ${run} passed across ${pages.length} pages and ${SIZES.length} sizes${shots ? `. Screenshots in ${shotDir}` : ''}`);
process.exit(failed ? 1 : 0);
