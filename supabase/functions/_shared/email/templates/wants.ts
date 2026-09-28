// deno-lint-ignore-file no-explicit-any
/*
 * Someone wants something the shop does not sell. From "Can't find it? Ask
 * us for it". The ask goes in the subject line, because it is worth reading
 * on a lock screen.
 */
import { C, button, esc, facts, figure, kicker, mail, money, row, small } from '../kit.ts';
import { type Shop, shopFooter } from '../context.ts';

export function wants(req: any, shop: Shop) {
  const wanted = String(req.wanted ?? '');
  const list: Array<[string, string]> = [];
  if (req.paying) list.push(['They pay now', `about ${money(req.paying)}`]);
  if (req.seen_at) list.push(['They buy it at', esc(req.seen_at)]);
  if (req.source) list.push(['Asked from', esc(req.source)]);
  if (req.name) list.push(['Their name', esc(req.name)]);
  list.push(['Their email', req.email
    ? `<a href="mailto:${esc(req.email)}" style="color:${C.terraText};">${esc(req.email)}</a>`
    : `<span style="color:${C.faint};font-weight:400;">They left no email, so the answer is the thing appearing in the shop.</span>`]);

  const body = row(`
  ${kicker('Someone wants')}
  ${figure(`&ldquo;${esc(wanted)}&rdquo;`, 30)}
  ${facts(list, 24)}
  ${req.email ? button(`mailto:${req.email}?subject=${encodeURIComponent(wanted.slice(0, 60))}`, 'Reply to them') : ''}
  ${small(req.email
    ? 'If you stock it, telling them is the sale. If you would rather not, one line saying so is kinder than silence.'
    : 'Worth a look when a few people ask for the same thing. They are all in Requests in the portal.', 16)}
`);

  return mail({
    subject: `Someone wants: ${wanted.slice(0, 60)}`,
    preheader: [
      req.paying ? `They pay about ${money(req.paying)} now${req.seen_at ? `, at ${req.seen_at}` : ''}.` : '',
      req.email ? 'They left an email.' : 'No email left.',
    ].filter(Boolean).join(' '),
    body,
    brand: shop.brand,
    footer: shopFooter(shop, 'Sent to you by your portal for each request.'),
  });
}
