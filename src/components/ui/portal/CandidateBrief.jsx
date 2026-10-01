import { useId, useState } from 'react';
import { Icon } from '@components/ui/icons';
import { REF_WORD } from './GapRail';
import { formatGbp } from '@utils/formatGbp';
import { PACK_RATIO, READY_MIN_SOLD, shopName } from '@lib/assess';
import { ebayItemUrl, ebaySearchUrl } from '@lib/product';
import { SellerGauge } from './SellerGauge';
import { REJECTION_REASONS } from '@utils/constants';
import styles from '@styles/ui/portal/candidate-brief.module.css';

/*
 * An opened card reads as a decision brief. A strip in the lane's colour says why the card sits where it does and
 * carries the one action that moves it; under it, a panel built for that lane's question; then the detail in tabs.
 */

const n = (v) => formatGbp(v);
// Wickes' and Boots', never Wickes's.
const poss = (name) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);

// The most the goods can cost delivered to her and still list at the market price, with her own postage and packing
// to the buyer taken out. The figure Found it cheaper works in.
export function goodsUnder(base) {
  if (base.landsUnder == null) return null;
  const carriage = Number(base.m?.postage ?? 0) + Number(base.m?.packaging ?? 0);
  return Math.round((base.landsUnder - carriage) * 100) / 100;
}

export const LANE_META = {
  ready: { icon: 'IconCheck', title: 'Worth approving' },
  pack: { icon: 'IconBox', title: 'Confirm the pack' },
  slow: { icon: 'IconClock', title: 'Sells slowly' },
  over: { icon: 'IconGauge', title: 'Over the market' },
  price: { icon: 'IconTag', title: 'Check the price' },
  untested: { icon: 'IconInfo', title: 'Entry untested' },
  short: { icon: 'IconFlag', title: 'Keeps under the target' },
  store: { icon: 'IconShop', title: 'To list on the shop' },
  dear: { icon: 'IconGauge', title: 'Over Google\'s price' },
};

const VERDICT = {
  approve: { icon: 'IconCheck', title: 'Approved', tone: 'positive' },
  defer: { icon: 'IconClock', title: 'Saved for later', tone: 'warning' },
  reject: { icon: 'IconX', title: 'Rejected', tone: 'negative' },
};

const dateOf = (v) => (v ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'long' }).format(new Date(v)) : null);

// Why the card is in its lane, in one or two sentences, from the same figures the row shows.
function reasonOf(base, readyMin) {
  const p = base.position;
  const word = p ? REF_WORD[p.refName] ?? p.refName : null;
  const shelf = base.m?.shelf;
  const shop = shopName(base.costFrom?.from ?? shelf?.shop) ?? 'the shop';
  switch (base.lane) {
    case 'ready':
      return <>A small seller is selling it, your price is in the market, and the cost is confirmed. Nothing stands in the way.</>;
    case 'pack':
      return base.packCheck
        ? <>It sells at <b data-num>{base.ratio}</b> times the shelf price, so the eBay listing may be a bigger pack than the one on the shelf.</>
        : <>The cost is {poss(shop)} <b data-num>{n(base.goods)}</b>, but nobody has checked it is the same item and pack as the eBay listing.</>;
    case 'slow':
      return <>Everything checks, but it sells <b data-num>{base.sold ?? 0}</b> a month across the sample, under the <b data-num>{readyMin}</b> that makes a card ready.</>;
    case 'over':
      if (base.entryLoses && p?.inMarket) {
        return <>The small seller at <b data-num>{n(base.entry?.price)}</b> would lose money at the cost you have, so theirs is not a price you can match yet.</>;
      }
      return <>Your price is <b data-num>{n(p?.over)}</b> over {word} at <b data-num>{n(p?.ref)}</b>. Buyers see the cheaper listing first.</>;
    case 'price':
      return <>The small seller is at <b data-num>{n(base.entry?.price)}</b>, outside this search&apos;s prices, so the card is priced against the median instead. Check their listing is the same thing.</>;
    case 'untested':
      return <>No seller your size has sold it recently, so nobody has shown a new account can.</>;
    case 'short':
      return <>You keep <b data-num>{n(base.keep)}</b> a sale, under your <b data-num>{n(base.target)}</b> target.</>;
    case 'store':
      return <>Google ranks it <b data-num>#{(base.g?.rank ?? 0).toLocaleString('en-GB')}</b>{base.g?.months ? <> in {base.g.months} of the months checked</> : null}, {shelf?.shop || base.m?.cost_from?.shop ? <>and a UK shop stocks it</> : <>and no UK shop is on file for it yet</>}.</>;
    case 'dear':
      return base.costOverLow
        ? <>Your price is <b data-num>{n(p?.over)}</b> over Google&apos;s lowest at <b data-num>{n(p?.ref)}</b>, and {poss(shop)} <b data-num>{n(base.cost)}</b> is already above it. The shop page is probably a bigger size or another variant.</>
        : <>Your price is <b data-num>{n(p?.over)}</b> over Google&apos;s lowest at <b data-num>{n(p?.ref)}</b>. Buyers compare on Google and see the cheaper one first.</>;
    default:
      return null;
  }
}

// The strip itself, for any page that opens a card as a brief: a badge in the tone's colour, a kicker, a sentence,
// the action on the right and every check in full across the foot.
export function BriefStrip({ tone, lane, icon, kicker, children, action, checks = [] }) {
  return (
    <div className={styles.strip} data-tone={tone} data-lane={lane}>
      <span className={styles.badge}><Icon name={icon} className={styles.badgeIcon} /></span>
      <div className={styles.text}>
        <p className={styles.kicker}>{kicker}</p>
        <p className={styles.reason}>{children}</p>
      </div>
      {action && <div className={styles.action}>{action}</div>}
      {checks.length > 0 && (
        <ul className={styles.checks} aria-label="Also check">
          <li className={styles.checksLabel} aria-hidden="true">Also check</li>
          {checks.map((ch) => (
            <li key={ch.text} className={styles.check} data-tone={ch.tone}>
              <Icon name={ch.tone === 'info' ? 'IconInfo' : 'IconFlag'} className={styles.checkIcon} />{ch.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// The strip across the top of an opened card. A decided card says what was decided, and when.
export function DecisionStrip({ base, decision, readyMin, action, checks = [] }) {
  if (decision) {
    const v = VERDICT[decision.action] ?? VERDICT.defer;
    const when = dateOf(decision.decided_at);
    return (
      <div className={styles.strip} data-tone={v.tone}>
        <span className={styles.badge}><Icon name={v.icon} className={styles.badgeIcon} /></span>
        <div className={styles.text}>
          <p className={styles.kicker}>{v.title}{when && <span className={styles.when}> on {when}</span>}</p>
          <p className={styles.reason}>
            {decision.reason
              ? <>Reason: {REJECTION_REASONS.find((r) => r.value === decision.reason)?.label ?? decision.reason}.</>
              : 'Undo on the row puts it back in the queue.'}
            {decision.note && <> {decision.note}</>}
          </p>
        </div>
      </div>
    );
  }
  const meta = LANE_META[base.lane] ?? LANE_META.ready;
  return (
    <BriefStrip lane={base.lane} icon={meta.icon} kicker={`Why it is here: ${meta.title}`} action={action} checks={checks}>
      {reasonOf(base, readyMin)}
    </BriefStrip>
  );
}

/*
 * Over the market: how far over, and what the goods would have to cost to close it. The ruler zooms in on the gap,
 * so 34p over reads as clearly as £30. Typing a cost below moves the ruler, and it turns green once the price lands.
 */
export function GapPanel({ a, base, onFill, children, title = 'Gap to the market' }) {
  const p = a.position;
  if (!p) return null;
  const word = REF_WORD[p.refName] ?? p.refName;
  const inNow = p.inMarket;
  const gap = Math.abs(a.price - p.ref);
  const span = Math.max(gap * 1.6, p.ref * 0.08, 0.5);
  const lo = Math.min(p.ref, a.price) - span;
  const hi = Math.max(p.ref, a.price) + span * 0.6;
  const at = (v) => `${((v - lo) / (hi - lo)) * 100}%`;
  const left = Math.min(p.ref, a.price);
  const width = `${(gap / (hi - lo)) * 100}%`;

  // In goods terms, the same terms as Found it cheaper below: what the goods cost delivered to her, with her own
  // postage and packing to the buyer taken out of the figure the market allows.
  const youPost = base.postedBy === 'you';
  const needed = youPost ? goodsUnder(base) : base.landsUnder;
  const now = base.goods ?? null;
  const cut = needed != null && now != null ? now - needed : null;
  const from = shopName(base.costFrom?.from) ?? null;
  const fill = goodsUnder(base);
  const reachable = needed != null && needed > 0;

  return (
    <section className={styles.panel} aria-label={title}>
      <header className={styles.panelHead}>
        <span className={styles.panelTitle}><Icon name="IconGauge" className={styles.panelIcon} />{title}</span>
        <span className={styles.gapBadge} data-in={inNow || undefined} data-num>
          {inNow ? <><Icon name="IconCheck" className={styles.gapBadgeIcon} />In the market</> : `+${n(p.over)} over`}
        </span>
      </header>

      <div className={styles.ruler} data-in={inNow || undefined} role="img"
        aria-label={inNow ? `${n(a.price)}, in the market at ${n(p.ref)}` : `${n(a.price)}, ${n(p.over)} over ${word} at ${n(p.ref)}`}>
        <span className={styles.track} />
        <span className={styles.band} style={{ left: at(left), width }} />
        <span className={styles.pin} data-kind="market" style={{ left: at(p.ref) }}>
          <span className={styles.pinLabel}><b data-num>{n(p.ref)}</b>{word}</span>
        </span>
        <span className={styles.pin} data-kind="you" style={{ left: at(a.price) }}>
          <span className={styles.pinLabel}><b data-num>{n(a.price)}</b>{a.trying ? 'at the cost you typed' : 'your price'}</span>
        </span>
      </div>

      {reachable ? (
        <div className={styles.cost}>
          <div className={styles.costCell}>
            <span className={styles.costLabel}>Goods now</span>
            <span className={styles.costFig} data-num>{now != null ? n(now) : 'Not known'}</span>
            <span className={styles.costSub}>
              {youPost
                ? <>{from ? `${from}, ` : ''}delivered to you</>
                : <>{from ? `${from}, ` : ''}posted to your buyer</>}
            </span>
          </div>
          <span className={styles.arrow} aria-hidden="true">
            <svg viewBox="0 0 40 12"><path d="M1 6h36M32 1.5L37.5 6 32 10.5" /></svg>
            {cut != null && cut > 0 && <span className={styles.cut} data-num>{n(cut)} less</span>}
          </span>
          <div className={`${styles.costCell} ${styles.costNeed}`}>
            <span className={styles.costLabel}>To be in the market</span>
            <span className={styles.costFig} data-num>under {n(needed)}</span>
            <span className={styles.costSub}>{youPost ? 'goods, delivery to you included' : 'posted to your buyer'}</span>
          </div>
          {onFill && !a.trying && fill != null && fill > 0 && (cut == null || cut > 0) && (
            <button type="button" className={styles.fill} onClick={() => onFill(fill)} data-tip="Puts it in Found it cheaper">
              Try <span data-num>{n(fill)}</span>
            </button>
          )}
        </div>
      ) : (
        <p className={styles.dead}>
          <Icon name="IconInfo" className={styles.deadIcon} />
          <span>{base.refLeaves > 0
            ? <>At {n(p.ref)}, fees leave <b data-num>{n(base.refLeaves)}</b> for the goods and your profit, under the <b data-num>{n(base.refProfit)}</b> profit alone. No cost lists it there.</>
            : <>At {n(p.ref)}, fees take the whole price. No cost lists it there.</>}</span>
        </p>
      )}

      {children && <div className={styles.tryIn}>{children}</div>}
    </section>
  );
}

// Sizes and counts in a product title: 85g, 2.5L, 12s, x12, 4 pack, 40 washes, 80 x 85g. Marked on both sides of the
// compare so the eye goes straight to what differs.
const SIZE = /\b\d+(?:\.\d+)?\s?x\s?\d+(?:\.\d+)?\s?(?:g|kg|ml|l|cl)?\b|\bx\s?\d+\b|\bpack of \d+\b|\b\d+(?:\.\d+)?\s?(?:g|kg|ml|l|ltr|litres?|cl|oz|pack|pk|pcs|pieces|tabs|tablets|capsules|pods|washes|sachets|pouches|tins|rolls|sheets|wipes|count|ct|s)\b/gi;

function Marked({ text }) {
  if (!text) return null;
  const out = [];
  let at = 0;
  for (const m of String(text).matchAll(SIZE)) {
    if (m.index > at) out.push(text.slice(at, m.index));
    out.push(<mark key={m.index} className={styles.size}>{m[0]}</mark>);
    at = m.index + m[0].length;
  }
  out.push(text.slice(at));
  return <>{out}</>;
}

// packOf reads grams and millilitres as one scale, so the unit says both.
const packWord = (p) => (p ? (p.kind === 'weight' ? (p.n >= 1000 ? `${p.n / 1000}kg/L` : `${p.n}g/ml`) : `${p.n}`) : null);
const big = (url) => (url ? url.replace(/\/s-l\d+\./, '/s-l500.') : null);

/*
 * Confirm the pack: the listing that proves the market beside the shelf that sets the cost, sizes marked in both
 * titles, and how far apart the prices are. The shop's photo is never kept, so the shelf side is its label.
 */
export function ComparePanel({ base, image, query = null }) {
  const e = base.entry ?? {};
  // No listing kept for this card: eBay's search for the card's query stands in, and says it is a search.
  const listingUrl = ebayItemUrl(e.item_id);
  const searchUrl = listingUrl ? null : ebaySearchUrl(query);
  const shelf = base.m?.shelf ?? {};
  const match = base.match ?? base.m?.match ?? null;
  const shop = shopName(shelf.shop) ?? 'The shop';
  const wide = base.ratio != null && base.ratio > PACK_RATIO;
  const packs = match?.shelf && match?.ebay && match.shelf.kind === match.ebay.kind ? match : null;
  // One title gives a size and the other does not: say which, so she knows which page to look at.
  const oneSide = !packs && (match?.ebay || match?.shelf) ? (match.ebay ? { on: 'eBay', off: 'shelf', p: match.ebay } : { on: 'shelf', off: 'eBay', p: match.shelf }) : null;
  const photo = big(e.image_url ?? image);

  return (
    <section className={styles.panel} aria-label="Same item and pack">
      <header className={styles.panelHead}>
        <span className={styles.panelTitle}><Icon name="IconBox" className={styles.panelIcon} />Same item and pack?</span>
        {base.ratio != null && (
          <span className={styles.gapBadge} data-in={!wide || undefined}>
            <b data-num>{base.ratio}</b> times the shelf price
          </span>
        )}
      </header>

      <div className={styles.compare}>
        <article className={styles.side} data-side="ebay">
          <span className={styles.sideKicker}>On eBay, the small seller</span>
          <div className={styles.sideBody}>
            {photo
              ? <a className={styles.photo} href={listingUrl ?? undefined} target="_blank" rel="noreferrer noopener"><img src={photo} alt="" loading="lazy" /></a>
              : <span className={`${styles.photo} ${styles.photoNone}`} aria-hidden="true" />}
            <div className={styles.sideText}>
              <p className={styles.sideTitle}>
                {e.title ? <Marked text={e.title} /> : <span className={styles.missing}>The listing&apos;s title was not kept for this card. The photo decides.</span>}
              </p>
              <p className={styles.sidePrice} data-num>{e.price != null ? n(e.price) : 'No price'}</p>
              {listingUrl && (
                <a className={styles.sideLink} href={listingUrl} target="_blank" rel="noreferrer noopener">
                  Open listing <Icon name="IconOut" className={styles.sideLinkIcon} />
                </a>
              )}
              {searchUrl && (
                <a className={styles.sideLink} href={searchUrl} target="_blank" rel="noreferrer noopener">
                  Search eBay <Icon name="IconOut" className={styles.sideLinkIcon} />
                </a>
              )}
            </div>
          </div>
        </article>

        <span className={styles.vs} aria-hidden="true">vs</span>

        <article className={`${styles.side} ${styles.shelf}`} data-side="shelf">
          <span className={styles.sideKicker}>On the shelf, {shop}</span>
          <div className={styles.sideText}>
            <p className={styles.sideTitle}>{shelf.product ? <Marked text={shelf.product} /> : <span className={styles.missing}>No product name on the shelf page.</span>}</p>
            <p className={styles.sidePrice} data-num>{shelf.price != null ? n(shelf.price) : 'No price'}</p>
            {shelf.url && (
              <a className={styles.sideLink} href={shelf.url} target="_blank" rel="noreferrer noopener">
                Open the shop page <Icon name="IconOut" className={styles.sideLinkIcon} />
              </a>
            )}
          </div>
        </article>
      </div>

      <p className={styles.packLine} data-tone={packs ? (packs.shelf.n === packs.ebay.n ? 'positive' : 'warning') : wide ? 'warning' : 'muted'}>
        <Icon name={packs && packs.shelf.n === packs.ebay.n ? 'IconCheck' : 'IconInfo'} className={styles.packIcon} />
        <span>{packs
          ? <>{packs.shelf.kind === 'weight' ? 'Size' : 'Pack'} in the titles: shelf <b data-num>{packWord(packs.shelf)}</b>, eBay <b data-num>{packWord(packs.ebay)}</b>.{packs.shelf.n === packs.ebay.n ? ' The same.' : ' Not the same, so the shelf price is not the cost of what eBay sells.'}</>
          : <>
            {oneSide && <>The {oneSide.on} title gives <b data-num>{packWord(oneSide.p)}</b>{oneSide.p.kind === 'count' ? ' in the pack' : ''}, the {oneSide.off} title gives none. </>}
            {wide
              ? <>At <b data-num>{base.ratio}</b> times the shelf price, the eBay listing is usually a bigger pack. Count it on the {oneSide?.off === 'shelf' ? 'shop page' : 'photo'} before confirming.</>
              : oneSide ? <>Check the {oneSide.off === 'shelf' ? 'shop page' : 'eBay photo'} for its size.</> : <>The titles do not both give a pack size, so the photos decide.</>}
          </>}</span>
      </p>
    </section>
  );
}

const fbText = (v) => Number(v).toLocaleString('en-GB');

/*
 * Entry untested: whether an account her size can get in. The gauge runs from starting out to large account, with
 * the door at the feedback that proves entry; the smallest seller who is selling is the dot.
 */
export function EntryPanel({ base, competing }) {
  const e = base.entry;
  const ceiling = base.ceiling ?? 1000;
  let verdict;
  if (!e) {
    verdict = <>Nobody in the sample has sold it recently. <b data-num>{fbText(competing ?? 0)}</b> listings are up, with no sales to learn from.</>;
  } else if (base.entryThin) {
    verdict = <>A seller your size is listed, with <b data-num>{fbText(e.seller_feedback)}</b> feedback, but has sold <b data-num>{e.sold_lifetime ?? 'a few'}</b> in {e.age_days} days. Too few to show a new account can sell it.</>;
  } else {
    verdict = <>The smallest seller selling has <b data-num>{fbText(e.seller_feedback)}</b> feedback, over the <b data-num>{fbText(ceiling)}</b> that shows a new account can get in. Only large accounts are proved here.</>;
  }
  return (
    <section className={styles.panel} aria-label="Can a new account get in">
      <header className={styles.panelHead}>
        <span className={styles.panelTitle}><Icon name="IconPeople" className={`${styles.panelIcon} ${styles.iconSlate}`} />Can a new account get in?</span>
        <span className={styles.gapBadge} data-tone="slate">Untested</span>
      </header>
      <div className={styles.gauge}><SellerGauge entry={e} ceiling={ceiling} /></div>
      {e && (
        <p className={styles.facts}>
          <span><b data-num>{e.sold_lifetime ?? '?'}</b> sold in {e.age_days} days</span>
          <span><b data-num>{base.perMonth != null ? base.perMonth.toLocaleString('en-GB') : 'too new'}</b> a month</span>
          <span><b data-num>{fbText(competing ?? 0)}</b> competing</span>
          {e.price != null && <span>at <b data-num>{n(e.price)}</b></span>}
        </p>
      )}
      <p className={styles.note} data-tone="slate"><Icon name="IconInfo" className={styles.noteIcon} /><span>{verdict} Approving is a test: one listing shows whether it sells for you.</span></p>
    </section>
  );
}

/*
 * Sells slowly: sold a month across the sample on a bar, with the mark that makes a card ready. What the small seller
 * sells, and what that rate would keep her a month.
 */
export function SlowPanel({ base }) {
  const sold = base.sold ?? 0;
  const top = Math.max(READY_MIN_SOLD * 2, sold * 1.25);
  const at = (v) => `${Math.min(100, (v / top) * 100)}%`;
  return (
    <section className={styles.panel} aria-label="How fast it sells">
      <header className={styles.panelHead}>
        <span className={styles.panelTitle}><Icon name="IconClock" className={`${styles.panelIcon} ${styles.iconSage}`} />How fast it sells</span>
        <span className={styles.gapBadge} data-tone="sage"><b data-num>{sold}</b>&nbsp;a month</span>
      </header>
      <div className={styles.meter} role="img" aria-label={`${sold} sold a month, under the ${READY_MIN_SOLD} that makes a card ready`}>
        <span className={styles.meterTrack}><span className={styles.meterFill} style={{ width: at(sold) }} /></span>
        <span className={styles.meterMark} style={{ left: at(READY_MIN_SOLD) }}>
          <span className={styles.meterLabel}><b data-num>{READY_MIN_SOLD}</b> a month makes it ready</span>
        </span>
      </div>
      <p className={styles.facts}>
        <span>across the listings sampled, <b data-num>{sold}</b> sold a month</span>
        {base.perMonth != null && <span>the small seller, <b data-num>{base.perMonth.toLocaleString('en-GB')}</b> a month</span>}
        {base.month != null && <span>at their rate you keep <b data-num className={styles.good}>{n(base.month)}</b> a month</span>}
      </p>
      <p className={styles.note} data-tone="sage"><Icon name="IconInfo" className={styles.noteIcon} /><span>Everything else checks. It sells, just slowly, so approve it if a steady trickle suits you.</span></p>
    </section>
  );
}

/*
 * Keeps under the target: what she keeps against her profit, and the two ways to close it. A cheaper cost, in the
 * same goods terms as Found it cheaper, or a higher price and where that sits against the market.
 */
export function ShortPanel({ a, base, onFill, children }) {
  const short = base.target != null && base.keep != null ? Math.round((base.target - base.keep) * 100) / 100 : null;
  const carriage = Number(base.m?.postage ?? 0) + Number(base.m?.packaging ?? 0);
  const youPost = base.postedBy === 'you';
  // Goods delivered to her, as the quick line reads them: a supplier who posts to the buyer carries her postage.
  const goodsNow = base.goods != null ? (youPost ? base.goods : base.goods - carriage) : null;
  // A cost typed below reprices the card on the market, so the figure to find is the one that lists there with the
  // full profit. With no market price, the shortfall off today's goods.
  const need = base.position && goodsUnder(base) != null ? goodsUnder(base)
    : goodsNow != null && short != null ? Math.round((goodsNow - short) * 100) / 100 : null;
  const from = shopName(base.costFrom?.from) ?? null;
  const p = base.position;
  const floorOver = p && base.floor != null ? Math.round((base.floor - p.ref) * 100) / 100 : null;
  const word = p ? REF_WORD[p.refName] ?? p.refName : null;
  return (
    <section className={styles.panel} aria-label="Short of your profit">
      <header className={styles.panelHead}>
        <span className={styles.panelTitle}><Icon name="IconFlag" className={`${styles.panelIcon} ${styles.iconNeg}`} />Short of your profit</span>
        {short != null && <span className={styles.gapBadge} data-tone="negative"><b data-num>{n(short)}</b>&nbsp;short</span>}
      </header>
      <div className={styles.cost}>
        <div className={styles.costCell}>
          <span className={styles.costLabel}>You keep now</span>
          <span className={styles.costFig} data-num>{n(base.keep)}</span>
          <span className={styles.costSub}>at <span data-num>{n(base.price)}</span>, goods <span data-num>{n(base.goods)}</span>{from ? ` from ${from}` : ''}</span>
        </div>
        <span className={styles.arrow} aria-hidden="true">
          <svg viewBox="0 0 40 12"><path d="M1 6h36M32 1.5L37.5 6 32 10.5" /></svg>
        </span>
        <div className={`${styles.costCell} ${styles.costNeed}`}>
          <span className={styles.costLabel}>Your profit</span>
          <span className={styles.costFig} data-num>{n(base.target)}</span>
          <span className={styles.costSub}>at this price</span>
        </div>
      </div>
      <ol className={styles.routes}>
        {need != null && need > 0 && (
          <li className={styles.route}>
            <span className={styles.routeNo}>1</span>
            <span className={styles.routeText}>Find it for under <b data-num>{n(need)}</b>, delivered to you{p ? <>, and it lists at <span data-num>{n(p.ref)}</span> with your full profit</> : null}.</span>
            {onFill && !a.trying && (
              <button type="button" className={styles.fill} onClick={() => onFill(need)}>Try <span data-num>{n(need)}</span></button>
            )}
          </li>
        )}
        {base.floor != null && (
          <li className={styles.route}>
            <span className={styles.routeNo}>{need != null && need > 0 ? 2 : 1}</span>
            <span className={styles.routeText}>
              Or list at <b data-num>{n(base.floor)}</b>{p
                ? floorOver > 0.009 ? <>, which is <b data-num className={styles.warn}>{n(floorOver)}</b> over {word} at <span data-num>{n(p.ref)}</span>.</> : <>, still in the market.</>
                : '.'}
            </span>
          </li>
        )}
      </ol>
      {children && <div className={styles.tryIn}>{children}</div>}
    </section>
  );
}

// The detail under the brief, one tab open at a time. Controlled when the strip needs to open a tab itself. Arrow
// keys move between tabs, as a tab list should.
export function BriefTabs({ tabs, initial, value, onChange }) {
  const [own, setOwn] = useState(initial ?? tabs[0]?.key);
  const on = value ?? own;
  const pick = (k) => { setOwn(k); onChange?.(k); };
  const id = useId();
  const current = tabs.find((t) => t.key === on) ?? tabs[0];

  function onKey(e) {
    const i = Math.max(0, tabs.findIndex((t) => t.key === (e.target.dataset?.tab ?? current.key)));
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (e.key === 'Home' || e.key === 'End' || step) {
      e.preventDefault();
      e.stopPropagation();
      const next = e.key === 'Home' ? tabs[0] : e.key === 'End' ? tabs[tabs.length - 1] : tabs[(i + step + tabs.length) % tabs.length];
      pick(next.key);
      document.getElementById(`${id}-${next.key}`)?.focus();
    }
  }

  return (
    <section className={styles.tabs}>
      <div className={styles.tabList} role="tablist" aria-label="Card detail" onKeyDown={onKey}>
        {tabs.map((t) => {
          const sel = t.key === current.key;
          return (
            <button key={t.key} type="button" role="tab" id={`${id}-${t.key}`} aria-selected={sel} tabIndex={sel ? 0 : -1}
              aria-controls={`${id}-${t.key}-panel`} className={styles.tab} data-tab={t.key} onClick={() => pick(t.key)}>
              <Icon name={t.icon} className={styles.tabIcon} />
              {t.label}
              {t.count != null && t.count > 0 && <span className={styles.tabCount} data-num>{t.count}</span>}
            </button>
          );
        })}
      </div>
      <div className={styles.tabPanel} role="tabpanel" id={`${id}-${current.key}-panel`} aria-labelledby={`${id}-${current.key}`}>
        {current.body}
      </div>
    </section>
  );
}
