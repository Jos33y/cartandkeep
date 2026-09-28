// deno-lint-ignore-file no-explicit-any
/*
 * Renders every email the functions send, from the same templates, with
 * sample data, and checks them before anything is deployed.
 *
 *   npx -y deno run --allow-read --allow-write scripts/email/preview.ts
 *
 * Writes scripts/email/out/index.html (an inbox with desktop, phone and
 * Gmail-font views) and one .html and .txt per email. Exits with an error if
 * any email breaks a rule below, so a change that would send a broken email
 * is caught here rather than in somebody's inbox.
 */
import * as E from '../../supabase/functions/_shared/email/index.ts';

const here = new URL('./', import.meta.url);
const root = new URL('../../', import.meta.url);
const out = new URL('./out/', here);

// --- sample data -------------------------------------------------------------------

const cfg = {
  domain: 'cartandkeep.com',
  email: 'hello@cartandkeep.com',
  delivery: { cutoff_hour: 14, transit_min: 2, transit_max: 3 },
  returns: { days: 30 },
  trader: {
    trading_as: 'Cart & Keep',
    legal_name: 'Sample Trader Ltd',
    address: '1 Sample Street, Liverpool L1 1AA',
    email: 'hello@cartandkeep.com',
  },
};
const shop = E.shopFrom(cfg);

const IMG = { massager: 'sample:massager', mirror: 'sample:mirror', magnesium: 'sample:magnesium' };
const items = [
  { title: 'Handheld neck and shoulder massager', variant_label: 'Graphite', qty: 1, unit_price: 17.99, line_total: 17.99, image_url: IMG.massager, returns_class: 'standard' },
  { title: 'Round wall mirror with oak frame', variant_label: null, qty: 1, unit_price: 11.90, line_total: 11.90, image_url: IMG.mirror, returns_class: 'standard' },
  { title: 'Magnesium bath flakes', variant_label: '250g', qty: 2, unit_price: 3.95, line_total: 7.90, image_url: IMG.magnesium, returns_class: 'sealed' },
];
const order = {
  reference: 'CK-3HCV-AB7M', access_token: 'sample-token', status: 'paid',
  email: 'joseey@example.com', name: 'Joseey Joseph',
  address: { line1: '12 Kirkby Row', line2: null, city: 'Liverpool', postcode: 'L33 7XP' },
  is_gift: false, subtotal: 37.79, delivery: 3.95, total: 41.74,
  paid_at: '2026-09-28T17:31:00Z', dispatched_at: null,
  carrier: 'Royal Mail', tracking_number: 'QF123456789GB', tracking_url: 'https://www.royalmail.com/track-your-item#/tracking-results/QF123456789GB',
  items,
};
const gift = {
  ...order, reference: 'CK-9GFT-P2LQ', is_gift: true, notify_recipient: true,
  recipient_name: 'Ada Friend', recipient_email: 'ada@example.com',
  address: { line1: 'Flat 3, 41 Mill Lane', line2: 'Didsbury', city: 'Manchester', postcode: 'M20 2PQ' },
  gift_message: 'Happy new flat. Something for the bath and something for the wall. J x',
};
const sent = { ...order, dispatched_at: '2026-09-29T09:12:00Z' };
const sold = { ...gift, items: items.map((i, n) => ({ ...i, stock: n === 0 ? -1 : 4 })) };

const product = { title: 'Handheld neck and shoulder massager', image_url: IMG.massager, price: 17.99, stock: 6 };
const thread = { name: 'Charles Okafor', email: 'charles@example.com' };
const question = { body: 'Does it come with a UK plug, or a USB cable? And how long does one charge last?', created_at: '2026-09-28T10:04:00Z' };
const answer = { body: 'It charges by USB-C, cable in the box, no plug. One charge lasts about two hours on the middle setting.\n\nSince you are buying two, I can do them at £15.00 each.', created_at: '2026-09-28T13:20:00Z', author_name: 'Cart & Keep' };
const basket = [
  { title: 'Handheld neck and shoulder massager', variant_label: 'Graphite', qty: 2, price: 17.99, image_url: IMG.massager },
  { title: 'Magnesium bath flakes', variant_label: '250g', qty: 1, price: 3.95, image_url: IMG.magnesium },
];
const link = 'https://cartandkeep.com/thread/sample?token=sample-token';
const at = (s: string) => new Date(s);
const noIdentity = E.shopFrom({ ...cfg, trader: { trading_as: 'Cart & Keep', email: 'hello@cartandkeep.com' } });

type Row = { id: string; group: string; to: string; when: string; trigger: string; m: E.Mail };
const rows: Row[] = [
  { id: 'confirmation', group: 'Customer', to: order.email, when: 'Mon 18:31', trigger: 'The moment Stripe says the payment went through.', m: E.confirmation(order, shop, at('2026-09-28T17:31:30Z')) },
  { id: 'confirmation-gift', group: 'Customer', to: order.email, when: 'Mon 18:31', trigger: 'The same email when the order is a gift.', m: E.confirmation(gift, shop, at('2026-09-28T17:31:30Z')) },
  { id: 'dispatch', group: 'Customer', to: order.email, when: 'Tue 10:12', trigger: 'When she marks it sent in the portal.', m: E.dispatch(sent, shop, at('2026-09-29T09:12:30Z')) },
  { id: 'recipient', group: 'Customer', to: 'ada@example.com', when: 'Tue 10:12', trigger: 'On a gift, when it leaves, and only if the buyer ticked "tell them it is coming".', m: E.recipient({ ...gift, dispatched_at: sent.dispatched_at }, shop, at('2026-09-29T09:12:30Z')) },
  { id: 'review', group: 'Customer', to: order.email, when: 'Tue 6 Oct', trigger: 'Seven days after it left.', m: E.review(sent, shop, at('2026-10-06T09:00:00Z')) },
  { id: 'asked', group: 'Customer', to: thread.email, when: 'Mon 11:04', trigger: 'Once, on the first message of a conversation.', m: E.asked(question, { product }, link, shop) },
  { id: 'reply', group: 'Customer', to: thread.email, when: 'Mon 14:20', trigger: 'Each time the shop answers. The price panel only when she gives one.', m: E.reply(answer, { product }, link, { price: 15, expires_at: '2026-10-01T22:59:00Z' }, shop) },
  { id: 'reply-basket', group: 'Customer', to: thread.email, when: 'Mon 14:20', trigger: 'The same, about a basket, with no price given.', m: E.reply({ ...answer, body: 'All three are in stock and would go out together tomorrow.' }, { basket }, link, null, shop) },
  { id: 'sale', group: 'Shop', to: cfg.email, when: 'Mon 18:31', trigger: 'Every paid order, straight after the customer\'s confirmation.', m: E.sale(gift, shop, at('2026-09-28T17:31:30Z')) },
  { id: 'sale-warn', group: 'Shop', to: cfg.email, when: 'Mon 18:31', trigger: 'The same when something needs her before she packs.', m: E.sale(sold, noIdentity, at('2026-09-28T17:31:30Z')) },
  { id: 'to-shop', group: 'Shop', to: cfg.email, when: 'Mon 11:04', trigger: 'Each message a customer sends.', m: E.toShop(question, thread, { product }, shop) },
  { id: 'to-shop-basket', group: 'Shop', to: cfg.email, when: 'Mon 11:04', trigger: 'The same, about a basket.', m: E.toShop({ ...question, body: 'Could these three go out together, and is there anything off for all of them?' }, thread, { basket }, shop) },
  { id: 'stock', group: 'Shop', to: cfg.email, when: 'Tue 09:00', trigger: 'Once per drop, when something with a count runs low.', m: E.stock([{ title: 'Round wall mirror with oak frame', stock: 1, image_url: IMG.mirror }, { title: 'Magnesium bath flakes', label: '250g', stock: 3, image_url: IMG.magnesium }], shop) },
  { id: 'wants', group: 'Shop', to: cfg.email, when: 'Sun 21:47', trigger: 'When a shopper uses "Ask us for it".', m: E.wants({ wanted: 'Refill heads for the neck massager', paying: 8, seen_at: 'Amazon', email: 'tolu@example.com', source: '/p/neck-massager' }, shop) },
  { id: 'pull', group: 'Studio', to: 'studio@example.com', when: 'Tue 08:02', trigger: 'To the studio: once when a morning pull fails.', m: E.pull({ tenant: 'Cart & Keep', source: 'ebay_sales', state: 'failing', error: 'eBay says the connection has expired. Reconnect it in Settings.', last_ok_at: '2026-09-28T07:02:00Z' }, shop) },
  { id: 'pull-ok', group: 'Studio', to: 'studio@example.com', when: 'Wed 08:02', trigger: 'And once when it works again.', m: E.pull({ tenant: 'Cart & Keep', source: 'ebay_sales', state: 'recovered' }, shop) },
];

// --- checks --------------------------------------------------------------------------

// Gmail clips anything over 102KB behind "View entire message", and the rights section is at the bottom.
const LIMIT = 100 * 1024;
const problems: string[] = [];
for (const { id, m } of rows) {
  const all = `${m.subject}\n${m.preheader}\n${m.html}\n${m.text}`;
  const size = new TextEncoder().encode(m.html).length;
  if (size > LIMIT) problems.push(`${id}: ${Math.round(size / 1024)}KB, over Gmail's clipping limit`);
  if (/[\u2013\u2014]/.test(all)) problems.push(`${id}: contains an en or em dash`);
  for (const bad of ['undefined', 'NaN', '[object ', '>null<', ' null ', 'Invalid Date']) {
    if (all.includes(bad)) problems.push(`${id}: contains "${bad.trim()}"`);
  }
  if (!m.preheader.trim()) problems.push(`${id}: no preheader`);
  if (m.subject.length > 90) problems.push(`${id}: subject is ${m.subject.length} characters`);
  if (!m.text.includes(m.subject.split(':')[0]) && m.text.length < 80) problems.push(`${id}: text part looks empty`);
}

// --- write -----------------------------------------------------------------------------

await Deno.mkdir(out, { recursive: true });
const b64 = async (u: URL) => btoa(Array.from(await Deno.readFile(u), (c) => String.fromCharCode(c)).join(''));
const swaps: Record<string, string> = {
  [shop.brand.logo]: `data:image/png;base64,${await b64(new URL('public/email/logo.png', root))}`,
  [shop.brand.mark]: `data:image/png;base64,${await b64(new URL('public/email/mark.png', root))}`,
};
for (const k of Object.keys(IMG) as Array<keyof typeof IMG>) swaps[IMG[k]] = `data:image/jpeg;base64,${await b64(new URL(`samples/${k}.jpg`, here))}`;
// Images go in as data URIs for looking at on this machine. The emails themselves link to the site.
const local = (html: string) => Object.entries(swaps).reduce((h, [from, to]) => h.split(from).join(to), html);

for (const [n, r] of rows.entries()) {
  const name = `${String(n + 1).padStart(2, '0')}-${r.id}`;
  await Deno.writeTextFile(new URL(`${name}.html`, out), local(r.m.html));
  await Deno.writeTextFile(new URL(`${name}.txt`, out), `Subject: ${r.m.subject}\n\n${r.m.text}\n`);
}

// One copy of each image for the inbox page, referenced by number.
const pool = Object.values(swaps);
const emails = rows.map((r) => ({
  id: r.id, group: r.group, to: r.to, when: r.when, trigger: r.trigger, subject: r.m.subject, preheader: r.m.preheader,
  html: Object.entries(swaps).reduce((h, [from, to]) => h.split(from).join(`%%IMG${pool.indexOf(to)}%%`), r.m.html),
}));
const page = (await Deno.readTextFile(new URL('preview.html', here)))
  .replace('/*DATA*/null', () => JSON.stringify({ pool, emails }).replace(/</g, '\\u003c'));
await Deno.writeTextFile(new URL('index.html', out), page);

for (const r of rows) console.log(`${r.id.padEnd(16)} ${String(Math.round(new TextEncoder().encode(r.m.html).length / 1024)).padStart(3)}KB  ${r.m.subject}`);
console.log(`\nWritten to ${out.pathname}`);
if (problems.length) {
  console.error(`\n${problems.length} problem${problems.length === 1 ? '' : 's'}:\n${problems.map((p) => `  ${p}`).join('\n')}`);
  Deno.exit(1);
}
console.log('All checks passed.');
