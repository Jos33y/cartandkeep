/*
 * The Send to Cart & Keep button: a bookmark she presses on a supplier's product page.
 *
 * Amazon, and some other shops, refuse to be read by a server. Her own browser already has the page open, so the
 * button reads it there: the title, the brand, the bullet points, the product details and the photos, from the page
 * she is looking at. It opens the portal with them in the address after the #, which never leaves her browser, and
 * the Approved page puts them on the card she picks. Written as plain old JavaScript, because it runs on someone
 * else's page.
 */
function collect(origin, path) {
  var q = function (s) { return document.querySelector(s); };
  var all = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var t = function (e) { return e ? String(e.textContent || '').replace(/\s+/g, ' ').trim() : ''; };
  var out = { url: location.href.split('?')[0].split('#')[0], shop: location.hostname.replace(/^www\./, ''), title: '', brand: '', bullets: [], details: [], images: [] };

  all('script[type="application/ld+json"]').forEach(function (s) {
    try {
      var j = JSON.parse(s.textContent);
      [].concat(j['@graph'] || j).forEach(function (p) {
        if ([].concat(p['@type']).indexOf('Product') < 0) return;
        out.title = out.title || p.name || '';
        out.brand = out.brand || (p.brand && (p.brand.name || p.brand)) || '';
        [].concat(p.image || []).forEach(function (i) { out.images.push(typeof i === 'string' ? i : i && i.url); });
        if (p.description) out.details.push(String(p.description).replace(/\s+/g, ' ').slice(0, 1500));
      });
    } catch (e) { /* not this block */ }
  });

  if (q('#productTitle')) {
    out.title = t(q('#productTitle'));
    out.brand = t(q('#bylineInfo')).replace(/^(visit the|brand:)\s*/i, '').replace(/\s*store$/i, '');
    all('#feature-bullets ul li').forEach(function (li) { var x = t(li); if (x) out.bullets.push(x); });
    all('#productOverview_feature_div tr, #productDetails_techSpec_section_1 tr, #productDetails_techSpec_section_2 tr, #productDetails_detailBullets_sections1 tr').forEach(function (tr) {
      var k = t(tr.querySelector('th, td:first-child'));
      var v = t(tr.querySelector('td:last-child'));
      if (k && v && k !== v && !/customer reviews|best sellers rank|date first available/i.test(k)) out.details.push(k + ': ' + v);
    });
    all('#detailBullets_feature_div li').forEach(function (li) {
      var x = t(li).replace(/\s*:\s*/, ': ');
      if (x && !/customer reviews|best sellers rank|date first available/i.test(x)) out.details.push(x);
    });
    var hires = [];
    all('script').forEach(function (s) {
      var m;
      var re = /"hiRes":"(https:[^"]+)"/g;
      while ((m = re.exec(s.textContent || ''))) hires.push(m[1]);
    });
    var main = q('#landingImage');
    if (main && main.getAttribute('data-old-hires')) hires.unshift(main.getAttribute('data-old-hires'));
    if (!hires.length) all('#altImages img').forEach(function (i) { hires.push(String(i.src).replace(/\._[^.]+_\./, '.')); });
    out.images = hires.concat(out.images);
  }

  if (!out.title) out.title = (q('meta[property="og:title"]') || {}).content || document.title;
  var og = q('meta[property="og:image"]');
  if (og && og.content) out.images.push(og.content);
  var seen = {};
  out.images = out.images.filter(function (u) {
    if (!u || !/^https:\/\//.test(u)) return false;
    var k = u.replace(/\._[^.]+_\./, '.');
    if (seen[k]) return false;
    seen[k] = 1;
    return true;
  }).slice(0, 8);
  out.bullets = out.bullets.slice(0, 12);
  out.details = out.details.filter(function (d, i, a) { return a.indexOf(d) === i; }).slice(0, 30);
  out.text = [out.title, out.brand && ('Brand: ' + out.brand), out.bullets.map(function (b) { return '- ' + b; }).join('\n'), out.details.join('\n')]
    .filter(Boolean).join('\n').slice(0, 6000);
  window.open(origin + path + '#send=' + encodeURIComponent(JSON.stringify(out)), '_blank');
}

// The bookmark's address: the function above, with this portal's address in it.
export function bookmarkletFor(origin, path) {
  return `javascript:(${collect.toString()})(${JSON.stringify(origin)},${JSON.stringify(path)});void 0`;
}

// What the button sent, read off the address once and then taken off it.
export function readSent(hash) {
  const m = /^#send=(.+)$/.exec(hash ?? '');
  if (!m) return null;
  try {
    const v = JSON.parse(decodeURIComponent(m[1]));
    return v && typeof v === 'object' && v.url ? v : null;
  } catch {
    return null;
  }
}

// The card it is most likely for: the supplier link with the same Amazon product number, else the most shared words.
export function likelyCard(sent, rows) {
  const asin = /\/dp\/([A-Z0-9]{10})/i.exec(sent?.url ?? '')?.[1];
  if (asin) {
    const hit = rows.find((r) => (r.sources ?? []).some((s) => String(s.url ?? '').includes(asin)) || String(r.draft?.page ?? '').includes(asin));
    if (hit) return hit.id;
  }
  const words = (x) => new Set(String(x ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2));
  const mine = words(sent?.title);
  let best = null;
  let score = 0;
  for (const r of rows) {
    const theirs = words(`${r.draft?.title ?? ''} ${r.draft?.entry?.title ?? ''} ${r.title ?? ''}`);
    const n = [...mine].filter((w) => theirs.has(w)).length;
    if (n > score) { best = r.id; score = n; }
  }
  return score >= 2 ? best : null;
}
