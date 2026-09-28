/*
 * For the studio, not the shop: a morning pull that failed, or started
 * working again. One per change, never one per morning.
 */
import { button, esc, facts, h1, kicker, mail, p, row, small } from '../kit.ts';
import { type Shop, shopFooter } from '../context.ts';
import { when } from '../dates.ts';

const NAMES: Record<string, string> = { ebay_traffic: 'eBay traffic', ebay_sales: 'eBay sales' };

export function pull(a: { tenant: string; source: string; state: string; error?: string | null; last_ok_at?: string | null }, shop: Shop) {
  const what = NAMES[a.source] ?? a.source;
  const recovered = a.state === 'recovered';
  const last = a.last_ok_at ? when(new Date(a.last_ok_at)) : null;
  const reconnect = /reconnect/i.test(a.error ?? '');

  const body = recovered ? row(`
  ${kicker('Updating again')}
  ${h1(`${esc(what)} for ${esc(a.tenant)} is updating again.`)}
  ${p('Nothing to do. You will hear again only if it stops.')}
`) : row(`
  ${kicker('Did not update', 'terra')}
  ${h1(`${esc(what)} for ${esc(a.tenant)} did not update this morning.`)}
  ${facts([
    ['Reason', esc(a.error ?? 'No reason was recorded.')],
    ['Last good update', esc(last ?? 'Not yet')],
    ['Meanwhile', 'The portal shows the figures from that update.'],
  ], 24)}
  ${button(`${shop.portal}/${reconnect ? 'settings' : 'ebay/traffic'}`, reconnect ? 'Reconnect eBay in Settings' : 'Open the portal')}
  ${small('You will not get this again while it keeps failing. You will get one email when it works again.', 16)}
`);

  return mail({
    subject: recovered ? `${a.tenant}: ${what} is updating again` : `${a.tenant}: ${what} did not update this morning`,
    preheader: recovered ? 'Nothing to do.' : `${String(a.error ?? 'No reason recorded').replace(/\.$/, '')}.${last ? ` Last good update ${last}.` : ''}`,
    body,
    brand: shop.brand,
    footer: shopFooter(shop, 'Sent to the studio by the morning pull.'),
  });
}
