import { useMemo, useState } from 'react';
import { Icon } from '@components/ui/icons';
import styles from '@styles/pages/portal/metrics-page.module.css';

const SECTIONS = [
  {
    id: 'row',
    title: 'On a candidate',
    terms: [
      {
        term: 'You keep',
        short: 'What one sale leaves you, after everything except your time.',
        body: 'The listing price less eBay\u2019s fee, the promoted listings allowance, postage, packaging, a returns allowance and the price of the goods. Every one of those is shown as its own line when you open the row, so the figure can be checked rather than trusted.',
      },
      {
        term: 'Keeps a month',
        short: 'What you would keep in a month at the rate a small seller is actually selling.',
        body: 'Their price and their rate, both read off the same listing. It is blank where no small seller is proved to be selling, because there is no rate to multiply. It is never the whole market\u2019s volume dressed up as yours.',
      },
      {
        term: 'Sold a month',
        short: 'How many the whole sampled market sells in a month.',
        body: 'Added up across the ten listings the check sampled. It says how big the market is, not what you would take from it.',
      },
      {
        term: 'A small seller is converting',
        short: 'Somebody starting out is selling this right now.',
        body: 'A listing under 90 days old, from a seller under 1,000 feedback, that is genuinely selling. This is the only competition test that decides anything. A large account selling proves demand; it proves nothing about whether a new account can get in.',
      },
      {
        term: 'Only large accounts selling',
        short: 'People are buying, but nobody your size is proved to be selling it.',
        body: 'Not a refusal. The market is live and the product may still be worth listing, but the evidence that a new account can rank on it is missing.',
      },
      {
        term: 'Check pack size',
        short: 'The price on eBay is far above the shelf price, so the packs may differ.',
        body: 'Where a converting listing is more than three and a half times the shelf price, it is usually a bigger pack. Until that is checked, the figures compare two different products, so the row is kept out of Worth approving.',
      },
      {
        term: 'Branded, open market',
        short: 'How the product would be bought, not whether it is worth buying.',
        body: 'Branded means buying the genuine article from a shop or a UK distributor. Open market means most of the listings carry no real brand, so a generic supplier can make it. Both are workable and neither is a refusal.',
      },
    ],
  },
  {
    id: 'refusals',
    title: 'Why a product does not reach you',
    terms: [
      {
        term: 'Too many listings to rank on',
        short: 'Over 250 live listings on that search.',
        body: 'Not because a busy market cannot be entered, but because reaching page one there costs more in promoted listings than the 3% the pricing allows.',
      },
      {
        term: 'Nothing selling',
        short: 'None of the sampled listings has sold a unit.',
        body: 'People are listing it and nobody is buying.',
      },
      {
        term: 'New sellers are not selling',
        short: 'Recent listings exist, and none of them is selling.',
        body: 'A new listing would join a group already failing to sell. This is the clearest refusal there is.',
      },
      {
        term: 'Market too small',
        short: 'The sampled market moves under 10 a month.',
        body: 'A listing slot and the sourcing time cost more than that returns.',
      },
      {
        term: 'Sells below the cost of selling',
        short: 'At the market price, the fees and postage use up the whole sale.',
        body: 'Before a penny is spent on the goods. No supplier price can rescue a product here.',
      },
      {
        term: 'Shelf price too high',
        short: 'The market works, but the shop wants too much for the goods.',
        body: 'Measured at your listing price and at the price a small seller is being paid. If either leaves under £2 a sale, it is held back rather than sent to you.',
      },
      {
        term: 'Must buy under £5',
        short: 'The goods would have to cost less than £5 for it to pay.',
        body: 'UK stock rarely does, so these are set aside rather than searched for.',
      },
      {
        term: 'Same as another search',
        short: 'Two searches found the same listing.',
        body: 'Kept once, under the tighter of the two searches.',
      },
    ],
  },
  {
    id: 'money',
    title: 'The cost model',
    terms: [
      {
        term: 'What comes off a sale',
        short: 'eBay 12.8% plus 30p, a 3% promoted listings allowance, postage, packaging and 30p for returns.',
        body: 'The same model runs in the research, in the portal and on the page where a price is set, so the three can never disagree.',
      },
      {
        term: 'Postage band',
        short: 'Postage is a property of the product, not a flat figure.',
        body: 'Evri to 5kg at £2.62 covers most of what is listed. Letters cost less, heavier parcels more. Costing everything at one rate is what once refused products that were fine.',
      },
      {
        term: 'The £2 target',
        short: 'What a sale has to leave before a product is sent to you.',
        body: 'A studio working figure rather than a rule of eBay\u2019s. Raise it and fewer products qualify; lower it and the queue fills with products that are not worth the postage.',
      },
      {
        term: 'Buy under',
        short: 'The most the goods can cost and still leave the target.',
        body: 'The number to hold in your head standing in front of a shelf. It is reported rather than assumed, so no percentage of the selling price is ever guessed as the cost.',
      },
    ],
  },
  {
    id: 'sources',
    title: 'Where the numbers come from',
    terms: [
      {
        term: 'The sample',
        short: 'The ten live listings eBay returns first for that search.',
        body: 'Each one is read individually for its price, its lifetime sales, its age and its seller. The market figures, the median and the price range all come from those ten.',
      },
      {
        term: 'A sales rate',
        short: 'Lifetime sales divided by the listing\u2019s own age.',
        body: 'Available on the first run, with no waiting. It is ignored on a listing under seven days old, where one sale would read as four a month.',
      },
      {
        term: 'Most sell at',
        short: 'The price range the middle half of listings sit in.',
        body: 'Not the cheapest and not the dearest, because each of those is usually one listing rather than the market.',
      },
      {
        term: 'The shelf price',
        short: 'Read from the shop\u2019s own product page on the day it was checked.',
        body: 'A clearance price can revert, so it is worth re-checking before a restock rather than assuming it holds.',
      },
      {
        term: 'How fresh this is',
        short: 'Market evidence goes stale in about a week.',
        body: 'On a recent re-check of 22 products, 15 of them had no listing left in common with the sample taken seven days earlier. A figure older than that is history rather than a market read.',
      },
    ],
  },
];

export function MetricsPage() {
  const [find, setFind] = useState('');

  const shown = useMemo(() => {
    const q = find.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS
      .map((s) => ({ ...s, terms: s.terms.filter((t) => `${t.term} ${t.short} ${t.body}`.toLowerCase().includes(q)) }))
      .filter((s) => s.terms.length);
  }, [find]);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className="micro">Metrics</p>
        <h1 className={styles.title}>What the numbers mean</h1>
        <p className={styles.lead}>
          Every figure in the portal is read from eBay&apos;s live listings or worked out from the cost model.
          Where something is an assumption rather than a measurement, it says so here and on the row itself.
        </p>
      </header>

      <div className={styles.controls}>
        <span className={styles.findWrap}>
          <Icon name="IconSearch" className={styles.findIcon} />
          <input className={styles.find} value={find} placeholder="Find a term"
            onChange={(e) => setFind(e.target.value)} aria-label="Find a term" />
        </span>
        <nav className={styles.jump} aria-label="Sections">
          {SECTIONS.map((s) => <a key={s.id} href={`#${s.id}`} className={styles.jumpLink}>{s.title}</a>)}
        </nav>
      </div>

      {shown.map((s) => (
        <section key={s.id} id={s.id} className={styles.section}>
          <h2 className={styles.sectionTitle}>{s.title}</h2>
          <dl className={styles.terms}>
            {s.terms.map((t) => (
              <div key={t.term} className={styles.term}>
                <dt className={styles.name}>{t.term}</dt>
                <dd className={styles.meaning}>
                  <p className={styles.short}>{t.short}</p>
                  <p className={styles.body}>{t.body}</p>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      {shown.length === 0 && <p className={styles.none}>Nothing here matches that.</p>}
    </div>
  );
}
