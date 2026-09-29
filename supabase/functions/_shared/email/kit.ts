/*
 * The parts every email is built from.
 *
 * Tables and inline styles throughout, because Outlook and Gmail read email
 * like it is 2005. Every part here has a twin on the site: the reference
 * ticket, the three stops, the parcel label, the terracotta button. An email
 * should look like the shop that sent it.
 *
 * Fonts: Archivo and Inter load in Apple Mail and iOS. Gmail and Outlook drop
 * web fonts and fall back to Helvetica and Arial, which the sizes and weights
 * here are chosen to survive.
 *
 * Nothing in this folder reads the database or sends anything. A template
 * takes data and returns { subject, preheader, html, text }, so the preview
 * script renders exactly what the functions send.
 */

export const C = {
  cream: '#FAF6EF', card: '#FFFFFF', line: '#E8E0D3', lineMid: '#D6CAB5',
  ink: '#2A2723', soft: '#55504A', faint: '#857D70',
  sage: '#5E7359', sageWash: '#EEF2EC', sageLine: '#CDD9C9',
  terra: '#BA5A3D', terraText: '#AD5438', terraWash: '#FAEEE9',
  kraft: '#E3D3B6', paper: '#FFFDF8',
  goldWash: '#F7EEDC', gold: '#8A6420',
};

export const DISPLAY = "'Archivo','Helvetica Neue',Helvetica,Arial,sans-serif";
export const TEXT = "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
export const MONO = "'SFMono-Regular',Menlo,Consolas,'Liberation Mono',monospace";

export const esc = (v: unknown) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const money = (n: unknown) => `£${Number(n ?? 0).toFixed(2)}`;

// Somebody's own words: escaped, and their line breaks kept, or three short paragraphs arrive as one run-on line.
export const lines = (s: unknown) => esc(s).replace(/\r?\n/g, '<br>');

/*
 * An address as plain text. Gmail and Apple Mail turn anything shaped like an
 * address into a blue underlined map link, which breaks the parcel label and
 * the legal lines. An invisible joiner after each digit stops them spotting a
 * house number or postcode; nobody reading it can see the difference.
 */
export const plain = (v: unknown) => esc(v).replace(/(\d)/g, '$1&zwnj;');

export const strong = (html: string) => `<b style="color:${C.ink};font-weight:600;">${html}</b>`;

export type Brand = {
  name: string;   // "Cart & Keep"
  site: string;   // "https://cartandkeep.com"
  logo: string;   // absolute URL of the 3x lockup, shown at 150 x 31
  mark: string;   // absolute URL of the square mark
};

export type Mail = { subject: string; preheader: string; html: string; text: string };

// --- the frame -------------------------------------------------------------------

/*
 * The card on the cream table, the logo at its head and the footer under it.
 * `preheader` is the grey line an inbox shows after the subject. Without it an
 * inbox shows whatever text comes first, which used to be "Cart & Keep".
 */
export function shell({ title, preheader, body, brand, footer = '' }: {
  title: string; preheader: string; body: string; brand: Brand; footer?: string;
}) {
  return `<!doctype html>
<html lang="en-GB" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@112,650;112,700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  body { margin: 0; padding: 0; }
  a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
  @media (max-width: 620px) {
    .px { padding-left: 22px !important; padding-right: 22px !important; }
    .h1 { font-size: 27px !important; line-height: 32px !important; }
    .stack { display: block !important; width: 100% !important; }
    .stack-gap { padding-top: 12px !important; padding-left: 0 !important; text-align: left !important; }
    .hide-sm { display: none !important; }
    .thumb { width: 52px !important; height: 52px !important; }
    .btn { white-space: normal !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.cream};">
<div class="preheader" style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(preheader)}${'&#847;&zwnj;&nbsp;'.repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.cream};">
<tr><td align="center" style="padding:28px 12px 36px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
    <tr><td style="padding:0 8px 18px;">
      <a href="${esc(brand.site)}" style="text-decoration:none;"><img src="${esc(brand.logo)}" width="150" height="31" alt="${esc(brand.name)}" style="display:block;border:0;width:150px;height:auto;"></a>
    </td></tr>
    <tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:18px;overflow:hidden;">
      ${body}
    </td></tr>
    ${footer}
  </table>
</td></tr>
</table>
</body>
</html>`;
}

// A padded section of the card.
export const row = (inner: string, { top = 34, bottom = 34, bg = '' } = {}) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"${bg ? ` style="background:${bg};"` : ''}>
<tr><td class="px" style="padding:${top}px 36px ${bottom}px;">${inner}</td></tr>
</table>`;

type Tone = 'sage' | 'terra' | 'gold' | 'faint';
const toneColour = (t: Tone) => (t === 'sage' ? C.sage : t === 'terra' ? C.terraText : t === 'gold' ? C.gold : C.faint);

// The small uppercase line over a heading, in the colour of what it says.
export const kicker = (text: string, tone: Tone = 'sage') =>
  `<p style="margin:0 0 10px;font:700 12px/16px ${TEXT};letter-spacing:0.12em;text-transform:uppercase;color:${toneColour(tone)};">${esc(text)}</p>`;

// Takes HTML: callers escape names and use <br> for a deliberate second line.
export const h1 = (html: string) =>
  `<h1 class="h1" style="margin:0;font:700 32px/37px ${DISPLAY};letter-spacing:-0.02em;color:${C.ink};">${html}</h1>`;

// A figure as the headline: the sale amount, or what somebody wants.
export const figure = (html: string, size = 46) =>
  `<p style="margin:0;font:700 ${size}px/${Math.round(size * 1.12)}px ${DISPLAY};letter-spacing:-0.02em;color:${C.ink};">${html}</p>`;

export const p = (html: string, { size = 16, color = C.soft, top = 14 } = {}) =>
  `<p style="margin:${top}px 0 0;font:400 ${size}px/${Math.round(size * 1.6)}px ${TEXT};color:${color};">${html}</p>`;

export const small = (html: string, top = 16) => p(html, { size: 13, color: C.faint, top });

// A section head inside the card.
export const label = (text: string, top = 30) =>
  `<p style="margin:${top}px 0 0;font:700 12px/16px ${TEXT};letter-spacing:0.12em;text-transform:uppercase;color:${C.faint};">${esc(text)}</p>`;

export const rule = (top = 0) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding-top:${top}px;border-bottom:1px solid ${C.line};font-size:0;line-height:0;">&nbsp;</td></tr></table>`;

/*
 * The reference, set the way the order page sets it: a ticket stub with a
 * dashed edge, the label small and the code large, so it reads as the thing to
 * quote rather than a caption. The right cell carries a figure when there is
 * one to give, such as what was paid or when to pack by.
 */
export function ticket({ label: name = 'Order', reference, sub = '', rightLabel = '', rightValue = '' }: {
  label?: string; reference: string; sub?: string; rightLabel?: string; rightValue?: string;
}) {
  const right = rightValue ? `
    <td class="stack stack-gap" valign="middle" align="right" style="padding-left:16px;">
      <p style="margin:0;font:700 11px/14px ${TEXT};letter-spacing:0.12em;text-transform:uppercase;color:${C.faint};">${esc(rightLabel)}</p>
      <p style="margin:4px 0 0;font:700 26px/30px ${DISPLAY};letter-spacing:-0.01em;color:${C.ink};">${esc(rightValue)}</p>
    </td>` : '';
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
<tr>
  <td class="stack" valign="middle">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:12px 18px;border:1.5px dashed ${C.lineMid};border-radius:12px;background:${C.paper};">
      <p style="margin:0;font:700 11px/14px ${TEXT};letter-spacing:0.12em;text-transform:uppercase;color:${C.faint};">${esc(name)}</p>
      <p style="margin:4px 0 0;font:700 21px/26px ${DISPLAY};letter-spacing:0.04em;color:${C.ink};">${esc(reference)}</p>
      ${sub ? `<p style="margin:3px 0 0;font:400 12px/16px ${TEXT};color:${C.faint};">${esc(sub)}</p>` : ''}
    </td></tr></table>
  </td>${right}
</tr>
</table>`;
}

export type Stop = { label: string; date: string; state: 'done' | 'next' | 'later' };

/*
 * The three stops, as on the checkout label and the order page: sage and ticked
 * when done, a terracotta ring for the one that is next, hollow for later.
 */
export function journey(stops: Stop[]) {
  const dot = (state: Stop['state']) => {
    if (state === 'done') return `<td width="22" height="22" align="center" valign="middle" style="width:22px;height:22px;border-radius:11px;background:${C.sage};color:#fff;font:700 12px/22px ${TEXT};">&#10003;</td>`;
    if (state === 'next') return `<td width="22" height="22" align="center" valign="middle" style="width:18px;height:18px;border-radius:11px;border:2px solid ${C.terra};background:${C.terraWash};font-size:0;line-height:0;"><span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:${C.terra};"></span></td>`;
    return `<td width="22" height="22" style="width:18px;height:18px;border-radius:11px;border:2px solid ${C.lineMid};background:#fff;font-size:0;line-height:0;">&nbsp;</td>`;
  };
  const leg = (done: boolean) => `<td style="padding:0 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:2px ${done ? 'solid' : 'dashed'} ${done ? C.sage : C.lineMid};font-size:0;line-height:0;">&nbsp;</td></tr></table></td>`;
  const cols = stops.map((s, i) => `
    <td valign="top" width="33%" style="padding-right:8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${dot(s.state)}${i < stops.length - 1 ? leg(s.state === 'done') : '<td>&nbsp;</td>'}</tr></table>
      <p style="margin:10px 0 0;font:600 14px/19px ${TEXT};color:${s.state === 'later' ? C.soft : C.ink};">${esc(s.label)}</p>
      <p style="margin:2px 0 0;font:${s.state === 'next' ? 500 : 400} 13px/18px ${TEXT};color:${s.state === 'next' ? C.terraText : C.faint};">${esc(s.date)}</p>
    </td>`).join('');
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:26px;">
<tr>${cols}</tr>
</table>`;
}

export type Line = { title: string; variant?: string | null; qty: number; unit?: number; total?: number; image?: string | null };

const thumb = (src: string | null | undefined, size = 60) => src
  ? `<img class="thumb" src="${esc(src)}" width="${size}" height="${size}" alt="" style="display:block;width:${size}px;height:${size}px;border-radius:10px;border:1px solid ${C.line};object-fit:cover;">`
  : `<div style="width:${size}px;height:${size}px;border-radius:10px;background:${C.line};"></div>`;

// What was bought, with photographs. Prices only where the reader is the buyer or the shop.
export function items(list: Line[], { prices = true, top = 22 } = {}) {
  const body = list.map((i, n) => `
<tr>
  <td width="74" valign="top" style="padding:${n ? 14 : 0}px 14px 0 0;">${thumb(i.image)}</td>
  <td valign="middle" style="padding:${n ? 14 : 0}px 0 0;">
    <p style="margin:0;font:500 15px/21px ${TEXT};color:${C.ink};">${esc(i.title)}</p>
    <p style="margin:2px 0 0;font:400 13px/18px ${TEXT};color:${C.faint};">${i.variant ? `${esc(i.variant)}, ` : ''}${prices ? `${esc(i.qty)} &times; ${money(i.unit)}` : `${esc(i.qty)} ${Number(i.qty) === 1 ? 'item' : 'items'}`}</p>
  </td>
  ${prices ? `<td valign="middle" align="right" style="padding:${n ? 14 : 0}px 0 0 12px;font:500 15px/21px ${TEXT};color:${C.ink};white-space:nowrap;">${money(i.total)}</td>` : ''}
</tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:${top}px;">${body}</table>`;
}

export type Sum = { label: string; value: string; grand?: boolean; free?: boolean };

export function totals(list: Sum[]) {
  const body = list.map((r) => r.grand ? `
<tr>
  <td style="padding:14px 0 0;border-top:1px solid ${C.lineMid};font:600 16px/22px ${TEXT};color:${C.ink};">${esc(r.label)}</td>
  <td align="right" style="padding:14px 0 0;border-top:1px solid ${C.lineMid};font:700 24px/28px ${DISPLAY};color:${C.ink};white-space:nowrap;">${esc(r.value)}</td>
</tr>` : `
<tr>
  <td style="padding:0 0 8px;font:400 15px/21px ${TEXT};color:${C.soft};">${esc(r.label)}</td>
  <td align="right" style="padding:0 0 8px;font:400 15px/21px ${TEXT};color:${r.free ? C.sage : C.ink};white-space:nowrap;">${esc(r.value)}</td>
</tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;border-top:1px solid ${C.line};"><tr><td style="padding-top:16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${body}</table></td></tr></table>`;
}

/*
 * The parcel label, as checked at checkout: kraft board, paper label, the
 * outward code large in the corner the way a sorting office reads it, and a
 * gift stamp when there is one.
 */
export function parcel({ shop, name, address, postcode, gift = false, from = '', heading = 'Deliver to' }: {
  shop: string; name: string; address: string[]; postcode: string; gift?: boolean; from?: string; heading?: string;
}) {
  const code = String(postcode ?? '').toUpperCase().replace(/\s+/g, '');
  const outward = code.length > 3 ? code.slice(0, -3) : code;
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
<tr><td style="padding:8px;background:${C.kraft};border-radius:14px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.paper};border-radius:9px;">
  <tr><td style="padding:16px 20px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td valign="bottom" style="font:600 13px/18px ${DISPLAY};color:${C.ink};">${esc(shop)}</td>
      <td valign="bottom" align="right" style="font:700 28px/28px ${DISPLAY};letter-spacing:0.02em;color:${C.ink};">${esc(outward)}</td>
    </tr>
    <tr><td colspan="2" style="padding-top:10px;border-bottom:2px solid ${C.ink};font-size:0;line-height:0;">&nbsp;</td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:14px 20px 18px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td valign="top">
        <p style="margin:0;font:700 11px/14px ${TEXT};letter-spacing:0.12em;text-transform:uppercase;color:${C.faint};">${esc(heading)}</p>
        <p style="margin:6px 0 0;font:600 19px/24px ${TEXT};color:${C.ink};">${esc(name)}</p>
        ${address.length ? `<p style="margin:3px 0 0;font:400 15px/22px ${TEXT};color:${C.ink};">${address.map(plain).join('<br>')}</p>` : ''}
        ${postcode ? `<p style="margin:4px 0 0;font:700 17px/22px ${TEXT};letter-spacing:0.08em;color:${C.ink};">${plain(String(postcode).toUpperCase())}</p>` : ''}
        ${from ? `<p style="margin:10px 0 0;font:400 13px/18px ${TEXT};color:${C.soft};">From ${esc(from)}</p>` : ''}
      </td>
      ${gift ? `<td valign="bottom" align="right" class="hide-sm"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="transform:rotate(-7deg);"><tr><td style="padding:6px 10px 5px;border:2px solid ${C.terra};border-radius:4px;text-align:center;color:${C.terra};font:700 14px/16px ${DISPLAY};letter-spacing:0.06em;text-transform:uppercase;">A gift<br><span style="font:600 9px/12px ${TEXT};letter-spacing:0.1em;">No prices inside</span></td></tr></table></td>` : ''}
    </tr></table>
  </td></tr>
  </table>
</td></tr>
</table>`;
}

/*
 * The button. A table cell with the colour on it, so Outlook draws a button
 * rather than a blue underlined word, and the whole block is the link.
 */
export function button(href: string, text: string, { tone = 'terra', top = 26 }: { tone?: 'terra' | 'ghost'; top?: number } = {}) {
  const solid = tone === 'terra';
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:${top}px;">
<tr><td align="center" bgcolor="${solid ? C.terra : '#ffffff'}" style="border-radius:10px;${solid ? '' : `border:1.5px solid ${C.ink};`}">
  <a class="btn" href="${esc(href)}" style="display:inline-block;padding:14px 26px;font:600 16px/20px ${TEXT};color:${solid ? '#ffffff' : C.ink};text-decoration:none;border-radius:10px;white-space:nowrap;">${esc(text)}&nbsp;&nbsp;&rarr;</a>
</td></tr>
</table>`;
}

// Two buttons side by side, stacked on a phone.
export const buttons = (first: string, second: string, top = 24) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
  <td class="stack" style="padding-right:12px;">${first.replace(/margin-top:\d+px/, `margin-top:${top}px`)}</td>
  <td class="stack">${second.replace(/margin-top:\d+px/, `margin-top:${top}px`)}</td>
</tr></table>`;

export const link = (href: string, text: string, colour = C.terraText) =>
  `<a href="${esc(href)}" style="color:${colour};text-decoration:underline;text-underline-offset:3px;">${esc(text)}</a>`;

// A panel in one of the page's tones: sage for good news, warm for an ask, gold for keep this, terra for something wrong.
export function panel(html: string, tone: 'sage' | 'warm' | 'gold' | 'terra' | 'plain' = 'sage', top = 22) {
  const bg = { sage: C.sageWash, warm: C.terraWash, gold: C.goldWash, terra: C.terraWash, plain: C.cream }[tone];
  const bd = { sage: C.sageLine, warm: '#EFD3C8', gold: '#ECD9B4', terra: '#E7C4BD', plain: C.line }[tone];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:${top}px;"><tr><td style="padding:16px 18px;background:${bg};border:1px solid ${bd};border-radius:12px;font:400 15px/23px ${TEXT};color:${C.ink};">${html}</td></tr></table>`;
}

// A message, as a card with who wrote it and when.
export function bubble({ who, when, body, shop = false }: { who: string; when: string; body: string; shop?: boolean }) {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
<tr><td style="padding:16px 18px;background:${shop ? C.sageWash : C.cream};border:1px solid ${shop ? C.sageLine : C.line};border-radius:4px 14px 14px 14px;">
  <p style="margin:0;font:600 13px/18px ${TEXT};color:${shop ? C.sage : C.soft};">${esc(who)}<span style="font-weight:400;color:${C.faint};">&nbsp;&nbsp;${esc(when)}</span></p>
  <p style="margin:8px 0 0;font:400 16px/25px ${TEXT};color:${C.ink};">${lines(body)}</p>
</td></tr>
</table>`;
}

// One thing, as a photo and its name, for emails about a single product.
export function about(title: string, image: string | null | undefined, sub = '') {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;"><tr>
  <td valign="middle" style="padding-right:14px;">${thumb(image, 52)}</td>
  <td valign="middle">
    <p style="margin:0;font:500 15px/21px ${TEXT};color:${C.ink};">${esc(title)}</p>
    ${sub ? `<p style="margin:2px 0 0;font:400 13px/18px ${TEXT};color:${C.faint};">${esc(sub)}</p>` : ''}
  </td>
</tr></table>`;
}

// Facts in two columns, for the shop's emails. Values are HTML.
export function facts(list: Array<[string, string]>, top = 22) {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:${top}px;">
${list.map(([k, v], i) => `<tr>
  <td valign="top" style="padding:${i ? 10 : 0}px 16px 0 0;width:38%;font:400 14px/20px ${TEXT};color:${C.faint};">${esc(k)}</td>
  <td valign="top" style="padding:${i ? 10 : 0}px 0 0;font:500 15px/21px ${TEXT};color:${C.ink};">${v}</td>
</tr>`).join('')}
</table>`;
}

// The footer under the card: who sent it, how to answer, and the legal identity line.
export function footer({ brand, identity = '', links = [], note = '' }: {
  brand: Brand; identity?: string; links?: Array<[string, string]>; note?: string;
}) {
  return `
<tr><td align="center" style="padding:26px 20px 0;">
  <img src="${esc(brand.mark)}" width="28" height="28" alt="" style="display:block;border:0;width:28px;height:28px;margin:0 auto;">
  <p style="margin:12px 0 0;font:400 13px/20px ${TEXT};color:${C.soft};">${note || 'Reply to this email and a person at the shop answers it.'}</p>
  ${links.length ? `<p style="margin:10px 0 0;font:500 13px/20px ${TEXT};color:${C.soft};">${links.map(([href, text]) => `<a href="${esc(href)}" style="color:${C.soft};text-decoration:underline;text-underline-offset:3px;">${esc(text)}</a>`).join('&nbsp;&nbsp;&middot;&nbsp;&nbsp;')}</p>` : ''}
  ${identity ? `<p style="margin:14px 0 0;font:400 12px/18px ${TEXT};color:${C.faint};">${plain(identity)}</p>` : ''}
</td></tr>`;
}

// --- plain text ------------------------------------------------------------------

/*
 * The text part, made from the HTML so the two cannot say different things.
 * Sent alongside the HTML because a message with no text part scores worse
 * with spam filters, and some people read mail as text.
 */
export function toText(html: string) {
  const entities: Record<string, string> = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ',
    '&middot;': '·', '&times;': '×', '&rarr;': '', '&#10003;': '', '&#9733;': '', '&zwnj;': '', '&#847;': '',
  };
  return html
    .replace(/<head[\s\S]*?<\/head>/i, '')
    .replace(/<div class="preheader"[\s\S]*?<\/div>/i, '')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, inner) => {
      const words = inner.replace(/<[^>]+>/g, '').replace(/&nbsp;|&rarr;/g, ' ').replace(/\s+/g, ' ').trim();
      const url = href.replace(/&amp;/g, '&');
      if (!words) return '';
      return url.startsWith('mailto:') || words === url ? words : `${words}: ${url}`;
    })
    // A blank line between sections and before each section head; one line break everywhere else.
    .replace(/<td class="px"|<h1|<p style="margin:\d+px 0 0;font:(700 12px|400 16px)|<table role="presentation"[^>]*margin-top:2[2-6]px/gi, (m) => `\u0000${m}`)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h1|tr|table)>/gi, '\n')
    .replace(/<\/td>/gi, '  ')
    .replace(/<[^>]+>/g, '')
    .replace(/&[#a-z0-9]+;/gi, (e) => entities[e] ?? '')
    .split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n')
    .replace(/\n?\u0000\n?/g, '\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function mail({ subject, preheader, body, brand, footer: foot }: {
  subject: string; preheader: string; body: string; brand: Brand; footer: string;
}): Mail {
  const html = shell({ title: subject, preheader, body, brand, footer: foot });
  return { subject, preheader, html, text: toText(html) };
}
