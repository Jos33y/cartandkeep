/*
 * The Send to Cart & Keep button: a bookmark she presses on a supplier's product page, on any shop.
 *
 * Some shops refuse to be read by a server. Her own browser already has the page open, so the button reads it there
 * and opens the portal with what it found in the address after the #, which never leaves her browser.
 *
 * Amazon is read by its own markup: the gallery of the colour chosen, the bullets, the details tables and the
 * description, never the sponsored or "customers also bought" parts. Any other shop is read the way a person sees
 * it: the product's structured data, every large photo outside the header, footer and recommendation strips at its
 * biggest size, the specification tables and the description. Keepr's photo check and writing sort what came.
 *
 * Plain old JavaScript, because it runs on someone else's page. Block comments only and no percent signs: the
 * bookmark is one line, and a percent sign in a javascript: address is read as an escape.
 */
function collect(origin, path) {
  if (location.origin === origin || /(^|\.)cartandkeep\.com$/.test(location.hostname)) {
    alert('Open your supplier\'s product page first, then press Send to Cart & Keep there.');
    return;
  }
  var q = function (s, root) { return (root || document).querySelector(s); };
  var all = function (s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); };
  var clean = function (x) { return String(x || '').replace(/[​-‏ ]/g, ' ').replace(/\s+/g, ' ').trim(); };
  var t = function (e) { return e ? clean(e.textContent) : ''; };
  var abs = function (u) { try { return new URL(String(u).trim(), location.href).href; } catch (e) { return ''; } };
  var json = function (x) { try { return JSON.parse(x); } catch (e) { return null; } };
  var host = location.hostname.replace(/^www\./, '');
  var amazon = /(^|\.)amazon\.[a-z.]+$/.test(host) || Boolean(document.getElementById('productTitle') && document.querySelector('#landingImage, #feature-bullets, #ASIN'));
  var out = { url: location.href.split('?')[0].split('#')[0], shop: host, title: '', brand: '', variant: [], bullets: [], details: [], description: '', images: [] };
  var NOT_FACT = /customer reviews|best ?sellers rank|date first available|^asin\b|amazon bestsellers|^reviews?\b|^rating/i;
  var detail = function (k, v) {
    k = clean(k).replace(/\s*:\s*$/, '');
    v = clean(v);
    if (k && v && k !== v && k.length < 60 && v.length < 400 && !NOT_FACT.test(k)) out.details.push(k + ': ' + v);
  };

  if (amazon) {
    var asin = (q('#ASIN') || {}).value || (/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i.exec(location.pathname) || [])[1];
    if (asin) out.url = location.origin + '/dp/' + String(asin).toUpperCase();
    out.title = t(q('#productTitle')) || t(q('#title'));
    out.brand = t(q('#bylineInfo')).replace(/^(visit the|brand:)\s*/i, '').replace(/\s*store$/i, '');
    /* The colour or size chosen: the gallery and the facts are for that one. */
    all('[id^="variation_"]').forEach(function (d) {
      var v = t(q('.selection', d));
      if (v) out.variant.push(t(q('label', d)).replace(/:\s*$/, '') + ': ' + v);
    });
    all('[id^="inline-twister-expanded-dimension-text-"]').forEach(function (d) {
      var key = d.id.replace('inline-twister-expanded-dimension-text-', '');
      var label = t(q('[id="inline-twister-dim-title-' + key + '"]')).replace(/:.*$/, '');
      if (t(d)) out.variant.push((label || key.replace(/_name$/, '').replace(/_/g, ' ')) + ': ' + t(d));
    });
    all('#feature-bullets ul li, #featurebullets_feature_div ul li').forEach(function (li) {
      if (li.id === 'replacementPartsFitmentBullet' || li.closest('.aok-hidden')) return;
      var x = t(q('.a-list-item', li) || li);
      if (x && !/^make sure this fits/i.test(x)) out.bullets.push(x);
    });
    all('#productOverview_feature_div tr, #prodDetails tr, #technicalSpecifications_feature_div tr, table.prodDetTable tr, [id^="productDetails_"] tr').forEach(function (tr) {
      var cells = all('th, td', tr);
      if (cells.length === 2) detail(t(cells[0]), t(cells[1]));
    });
    all('#detailBullets_feature_div li, #detailBulletsWrapper_feature_div li').forEach(function (li) {
      var x = t(li);
      var at = x.indexOf(':');
      if (at > 0) detail(x.slice(0, at), x.slice(at + 1));
    });
    out.description = t(q('#productDescription'));
    /* The gallery as Amazon loads it for the chosen colour; the thumbnails on show when that is missing. Never every
       "hiRes" in the page: those include the other colours. */
    var gallery = [];
    /* The array is cut out by counting brackets: its entries hold brackets of their own. */
    var arrayAt = function (text, from) {
      var depth = 0;
      var quote = '';
      for (var i = from; i < text.length; i++) {
        var c = text.charAt(i);
        if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue; }
        if (c === '"' || c === "'") quote = c;
        else if (c === '[') depth++;
        else if (c === ']' && --depth === 0) return text.slice(from, i + 1);
      }
      return '';
    };
    all('script').some(function (s) {
      var text = s.textContent || '';
      var m = /["']colorImages["']\s*:\s*\{\s*["']initial["']\s*:\s*\[/.exec(text);
      var list = m && json(arrayAt(text, m.index + m[0].length - 1));
      if (!list) return false;
      list.forEach(function (i) { gallery.push(i && (i.hiRes || i.large || i.mainUrl)); });
      return true;
    });
    if (!gallery.length) {
      var main = q('#landingImage') || q('#imgBlkFront');
      var sizes = main && json(main.getAttribute('data-a-dynamic-image'));
      if (main) gallery.push(main.getAttribute('data-old-hires') || (sizes && Object.keys(sizes)[0]));
      all('#altImages li:not(.videoThumbnail) img, #imageBlockThumbs img').forEach(function (i) { gallery.push(i.src); });
    }
    out.images = gallery.filter(function (u) { return u && /\/images\/I\//.test(u); })
      .map(function (u) { return abs(u).replace(/\._[^./]+_\.(jpe?g|png|webp)$/i, '.$1'); });
  } else {
    /* Not the product: the header, footer and menus, and strips of other products, reviews, logos and badges.
       Matched as whole words, so a "preview" gallery is not taken for reviews. */
    var NOT_PRODUCT = /(^|[\s_-])(related|recommend\w*|similar|upsell|cross-?sell|also|reviews?|ratings?|logos?|icons?|badges?|payments?|cart|footer|header|menu|breadcrumbs?)([\s_-]|$)/i;
    var inPage = function (el) {
      for (var n = el; n && n !== document.body; n = n.parentElement) {
        if (/^(HEADER|FOOTER|NAV|ASIDE)$/.test(n.tagName) || /banner|contentinfo|navigation/.test(n.getAttribute('role') || '')) return false;
        var cls = n.className && n.className.baseVal !== undefined ? n.className.baseVal : n.className;
        if (NOT_PRODUCT.test(String(cls || '') + ' ' + (n.id || ''))) return false;
      }
      return true;
    };
    var lists = [];
    /* The shop's own data for the product, when it gives it. */
    all('script[type="application/ld+json"]').forEach(function (s) {
      var j = json(s.textContent);
      if (!j) return;
      [].concat(j['@graph'] || j).forEach(function (p) {
        var type = [].concat(p && p['@type']);
        if (type.indexOf('Product') < 0 && type.indexOf('ProductGroup') < 0) return;
        out.title = out.title || clean(p.name);
        out.brand = out.brand || clean(p.brand && (p.brand.name || p.brand));
        if (p.description) out.description = out.description || clean(p.description);
        [].concat(p.image || []).forEach(function (i) { lists.push(typeof i === 'string' ? i : i && (i.contentUrl || i.url)); });
        var code = p.gtin13 || p.gtin12 || p.gtin14 || p.gtin8 || p.gtin;
        if (code) detail('Barcode', code);
        if (p.mpn) detail('Model', p.mpn);
        if (p.color) detail('Colour', p.color);
        if (p.material) detail('Material', p.material);
        [].concat(p.additionalProperty || []).forEach(function (a) { if (a) detail(a.name, a.value); });
      });
    });
    /* AliExpress keeps the whole gallery in the page's data. */
    try {
      var ae = (window.runParams && window.runParams.data && window.runParams.data.imageModule) || (window._d_c_ && window._d_c_.DCData);
      if (ae && ae.imagePathList) lists = ae.imagePathList.concat(lists);
    } catch (e) { /* not AliExpress */ }

    /* The page's own heading before the link-preview title, which usually carries the shop's name. */
    var h1 = q('h1');
    out.title = out.title || (h1 && inPage(h1) && t(h1).length > 8 ? t(h1) : '') || clean((q('meta[property="og:title"]') || {}).content) || clean(document.title);
    out.brand = out.brand || clean((q('meta[property="product:brand"]') || {}).content);

    /* Every large photo of the product on the page, at the biggest size it offers. A gallery's thumbnails count
       even when small or not loaded yet. */
    var biggest = function (el) {
      var best = '';
      var w = 0;
      String(el.getAttribute('srcset') || el.getAttribute('data-srcset') || '').split(',').forEach(function (part) {
        var bits = part.trim().split(/\s+/);
        var n = parseFloat(bits[1]) || 1;
        if (bits[0] && n >= w) { w = n; best = bits[0]; }
      });
      return el.getAttribute('data-zoom-image') || el.getAttribute('data-large_image') || el.getAttribute('data-zoom') || el.getAttribute('data-full')
        || el.getAttribute('data-original') || best || el.getAttribute('data-src') || el.getAttribute('data-lazy') || el.currentSrc || el.src || '';
    };
    var galleryish = /gallery|slider|carousel|swiper|thumb|product.?image|product.?media|media|zoom|preview/i;
    var dom = [];
    all('img').forEach(function (img) {
      if (!inPage(img)) return;
      var r = img.getBoundingClientRect();
      var size = Math.max(img.naturalWidth || 0, r.width || 0, parseInt(img.getAttribute('width'), 10) || 0);
      var high = Math.max(img.naturalHeight || 0, r.height || 0, parseInt(img.getAttribute('height'), 10) || 0);
      var inGallery = false;
      for (var el = img.parentElement, i = 0; el && i < 6 && !inGallery; el = el.parentElement, i++) inGallery = galleryish.test((el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) + ' ' + el.id);
      if (!inGallery && size < 250) return;
      if (size && high && (size / high > 3 || high / size > 3)) return;
      dom.push(biggest(img));
    });
    all('a[href]').forEach(function (a) {
      if (inPage(a) && /\.(jpe?g|png|webp)(\?|$)/i.test(a.getAttribute('href')) && galleryish.test(a.className + ' ' + (a.parentElement ? a.parentElement.className : ''))) dom.push(a.getAttribute('href'));
    });
    var og = all('meta[property="og:image"], meta[name="twitter:image"]').map(function (m) { return m.content; });
    out.images = lists.concat(dom, og).map(abs);

    /* The specifications, as tables, definition lists or label and value pairs. */
    all('table tr').forEach(function (tr) {
      if (!inPage(tr)) return;
      var cells = all('th, td', tr);
      if (cells.length === 2) detail(t(cells[0]), t(cells[1]));
    });
    all('dl').forEach(function (dl) {
      if (inPage(dl)) all('dt', dl).forEach(function (dt) { if (dt.nextElementSibling) detail(t(dt), t(dt.nextElementSibling)); });
    });
    /* A label beside its value, as most shops lay out specifications: an element with exactly two parts, neither of
       which holds a pair of its own. */
    var single = function (k) { return k.children.length < 2 && !all('*', k).some(function (d) { return d.children.length >= 2; }); };
    all('[class*="specification" i] *, [class*="spec" i] *, [class*="attribute" i] *, [class*="propert" i] *, [class*="detail" i] li').forEach(function (el) {
      if (!inPage(el)) return;
      var kids = Array.prototype.slice.call(el.children);
      if (kids.length === 2 && kids.every(single)) detail(t(kids[0]), t(kids[1]));
      else if (!kids.length && el.tagName === 'LI') { var x = t(el); var at = x.indexOf(':'); if (at > 0) detail(x.slice(0, at), x.slice(at + 1)); }
    });
    all('[class*="feature" i] li, [class*="highlight" i] li, [class*="key-point" i] li').forEach(function (li) {
      var x = t(li);
      if (inPage(li) && x.length > 3 && x.length < 300) out.bullets.push(x);
    });
    if (!out.description) {
      var longest = '';
      all('[itemprop="description"], #description, [id*="description" i], [class*="description" i], [class*="product-detail" i]').forEach(function (d) {
        var x = t(d);
        if (inPage(d) && x.length > longest.length) longest = x;
      });
      out.description = longest || clean((q('meta[name="description"]') || {}).content);
    }
  }

  /* The biggest version of each photo on the image hosts that shrink by address, once each, the best first. */
  var seen = {};
  out.images = out.images.map(function (u) {
    return String(u || '')
      .replace(/^\/\//, 'https://')
      .replace(/(\.(jpe?g|png|webp))_[^/]*$/i, '$1')
      .replace(/_(\d+x\d*|\d*x\d+|pico|icon|thumb|small|compact|medium|large|grande)(@2x)?(?=\.(jpe?g|png|webp))/i, '')
      .replace(/(\/wp-content\/uploads\/.+)-\d{2,4}x\d{2,4}(?=\.(jpe?g|png|webp)$)/i, '$1');
  }).filter(function (u) {
    if (!/^https:\/\//.test(u) || /\.svg(\?|$)|sprite|placeholder|spinner|loading|blank\.gif|data:/i.test(u)) return false;
    var k = u.split('?')[0].replace(/\._[^./]+_\./, '.');
    if (seen[k]) return false;
    seen[k] = 1;
    return true;
  }).slice(0, 12);

  out.bullets = out.bullets.filter(function (b, i, a) { return a.indexOf(b) === i; }).slice(0, 12);
  out.details = out.details.filter(function (d, i, a) { return a.indexOf(d) === i; }).slice(0, 40);
  out.description = out.description.slice(0, 1500);
  out.text = [
    out.title,
    out.brand && ('Brand: ' + out.brand),
    out.variant.join('\n'),
    out.bullets.map(function (b) { return '- ' + b; }).join('\n'),
    out.details.join('\n'),
    out.description,
  ].filter(Boolean).join('\n').slice(0, 6000);
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
