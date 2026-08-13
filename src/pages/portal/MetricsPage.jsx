import styles from '@styles/pages/portal/metrics-page.module.css';

const MONEY = [
  {
    term: 'Headroom',
    short: 'What is left of the sale price after the costs of selling, before paying for the product.',
    body: 'It is the sale price less the eBay fee, promoted listings, postage and packaging, each shown as its own line so they add up to the figure. It is not profit. Profit is headroom less what the product costs to buy, so until a supplier is priced the goods line reads not quoted. A product needs at least four pounds of headroom to reach this list at all.',
  },
  {
    term: 'Cost to sell',
    short: 'Everything headroom has already taken off.',
    body: 'Fees, postage and packaging added together. Postage is costed on a small parcel, which is the conservative assumption until a supplier gives real dimensions.',
  },
  {
    term: 'Goods, not quoted',
    short: 'The product cost, until a supplier has been added.',
    body: 'Rather than estimate it and show a profit figure built on a guess, the line says what it is. Add a supplier on the row and it fills in, and the net appears beside the headroom.',
  },
];

const DEMAND = [
  {
    added: '2026-08-12',
    term: 'Units sold',
    short: 'How many of that exact listing sold in the most recent month.',
    body: 'Taken from eBay\u2019s own sold transaction data through Terapeak, not an estimate. There is no minimum to appear here. A product selling three a month is not worth buying stock in, but it is worth a listing if it can be sourced, and that is your call rather than ours.',
  },
  {
    added: '2026-08-12',
    term: 'Holding',
    short: 'How the latest month compares with the product\u2019s own average.',
    body: 'One means it is selling at its usual rate. Below zero point six means it has fallen away. This is what keeps summer products off an August list, and it is the test that separates a product worth holding stock in from one worth listing. It needs at least three months of history, so on a new search term it is blank rather than guessed.',
  },
  {
    term: 'Same product sellers',
    short: 'How many other sellers are listing a matching product.',
    body: 'Measured on title matching, so on a listing with many variations it is a rough figure rather than an exact one. Fewer means less direct competition on a stock buy. More can mean the opposite on a dropship listing, because a product thirty sellers carry is one a supplier will actually have.',
  },
  {
    added: '2026-08-13',
    term: 'Live listings competing',
    short: 'How many listings are up for sale right now against this product.',
    body: 'Same product sellers counts who else has this exact item. This counts how deep the whole search is, which is a different question: two hundred sales across four hundred listings is a different market from two hundred across twenty. It reads eBay\u2019s live listings rather than its sold history, so it is what is on sale today rather than what sold last month. Under a hundred is thin, over two thousand is crowded.',
  },
  {
    added: '2026-08-13',
    term: 'Most of them sell at',
    short: 'The price range the middle half of sellers sit in.',
    body: 'Not the cheapest and not the dearest, because both of those are usually one listing rather than the market. The middle half is what a buyer comparing a page of results actually sees. A narrow range means sellers have converged and the only lever left is price. A wide one means there is room to sell on presentation.',
  },
  {
    added: '2026-08-13',
    term: 'Left on the table',
    short: 'What pricing up to the market would be worth on a product selling below it.',
    body: 'Where a product sells for less than the cheapest of the middle half, the difference is money nobody is collecting. It is shown after eBay fees and promoted listings, so it is what would actually reach headroom rather than the raw gap, and then multiplied by last month\u2019s units. It is an opportunity rather than a promise: pricing up may sell fewer.',
  },
  {
    term: 'Evergreen, rising, new, fading',
    short: 'How the product has behaved across the windows we measured.',
    body: 'Evergreen means it sold in every window we looked at. New means it did not exist a year ago, which is not a fault. Fading means the latest window is well below its own history.',
  },
];

const SOURCING = [
  {
    added: '2026-08-05',
    term: 'A source',
    short: 'Where a product would come from, and what it costs to get.',
    body: 'One product can have several. Each one records who the supplier is, whether they post it to the buyer or you buy stock and post it yourself, the cost a unit, the minimum order, where it ships from and how long it takes. Nothing here is assumed. A source with no price yet says so rather than counting as free.',
  },
  {
    added: '2026-08-05',
    term: 'Landed cost',
    short: 'What a unit really costs by the time it is ready to sell.',
    body: 'Not the same as the price a supplier quotes. On a stock order it is the price at that quantity, plus any duty, plus the freight to get it to you, divided across the units. On a dropship order it is the goods plus what the supplier charges to post it. Comparing two suppliers on the quoted price alone compares two different things.',
  },
  {
    added: '2026-08-05',
    term: 'They post it, or you post it',
    short: 'Who ships decides which costs are yours.',
    body: 'If the supplier posts it to the buyer, the postage inside headroom is not yours to pay and comes back on, and their shipping charge goes on instead. If you buy stock and post it yourself, the postage stands and the freight to get the goods to you is added to the cost of each unit.',
  },
  {
    added: '2026-08-05',
    term: 'Net a unit',
    short: 'Headroom less what the goods actually cost.',
    body: 'This is the profit figure, and it only appears once a supplier has been priced. Until then the page shows headroom and says the goods are not quoted.',
  },
];

const CAVEATS = [
  {
    term: 'Variations',
    short: 'How many size or colour options sit on the listing the figures came from.',
    body: 'On a listing with many variations the sold count covers all of them and the price is an average across whichever sold. A vet bed listing with two hundred variations spans a wide price range, so the money shown is a blend and not a per-size figure. Above ten variations the row says so.',
  },
  {
    added: '2026-08-05',
    term: 'Slipping',
    short: 'Proven, still selling, but below its own average.',
    body: 'A product that sold in every window we measured and is running under sixty per cent of its own usual rate. It is not a reject. It is still selling, and a product that dipped can come back, which is why it is here rather than hidden. It is not one to buy stock in today, and you may know why it dipped when we do not.',
  },
  {
    term: 'Bulky',
    short: 'The product is unlikely to post as a small parcel.',
    body: 'Postage is still costed as a small parcel, so headroom on a bulky product is optimistic until the supplier gives dimensions and weight.',
  },
];

const SCORE = [
  {
    added: '2026-08-12',
    term: 'A month before goods',
    short: 'Units sold last month multiplied by the headroom on each one.',
    body: 'What the product would have been worth over a month at the rate it actually sold, before paying for the goods. Two numbers multiplied together, nothing weighted and nothing hidden, and the line underneath shows both so you can check it. It is what the list is sorted by.',
  },
  {
    added: '2026-08-12',
    term: 'The score, and why it is absent',
    short: 'A weighted number, shown only where there is enough behind it.',
    body: 'The score combines sell-through, margin, direction, competition and postage band into one figure for sorting. Most of those need either several months of history or a supplier price, so on a new search term there is not enough to build it from. Rather than show a number made of two components and call it a score, the row shows nothing and the money is used instead.',
  },
  {
    term: 'The bar',
    short: 'One segment per component. Width is how much it counts, fill is how it scored.',
    body: 'A candidate measured on five things shows five segments. Where a component has no data it is left out rather than counted as zero, so the bar shows what the score was actually made of. Where nothing has been measured yet there is no bar at all.',
  },
];

const SECTIONS = [
  { title: 'The money', items: MONEY },
  { title: 'The demand', items: DEMAND },
  { title: 'Where it comes from', items: SOURCING },
  { title: 'What weakens a figure', items: CAVEATS },
  { title: 'The score and the bar', items: SCORE },
];

// Fourteen days, because she reads this page rarely and a marker that has gone
// by the time she comes back is no marker at all.
const FRESH_DAYS = 14;

const isNew = (added) => {
  if (!added) return false;
  const days = (Date.now() - new Date(added).getTime()) / 86400000;
  return days >= 0 && days <= FRESH_DAYS;
};

const updated = () => {
  const dates = SECTIONS.flatMap((s) => s.items.map((i) => i.added)).filter(Boolean).sort();
  return dates.length ? dates[dates.length - 1] : null;
};

export function MetricsPage() {
  const last = updated();

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className="micro">
          Metrics
          {last && (
            <span className={styles.updated}>
              {' '}
              updated {new Intl.DateTimeFormat('en-GB', {
                timeZone: 'Europe/London', day: 'numeric', month: 'long',
              }).format(new Date(last))}
            </span>
          )}
        </p>
        <h1 className={styles.title}>What the numbers mean</h1>
        <p className={styles.lead}>
          Every figure in the portal comes from eBay sold transaction data or is
          computed from it. Where something is an assumption rather than a
          measurement, it is named as one here and on the row itself.
        </p>
      </header>

      {SECTIONS.map((section) => (
        <section key={section.title} className={styles.section}>
          <h2 className={styles.sectionTitle}>{section.title}</h2>
          <dl className={styles.terms}>
            {section.items.map((item) => (
              <div key={item.term} className={styles.term}>
                <dt className={styles.name}>
                  {item.term}
                  {isNew(item.added) && <span className={styles.new}>new</span>}
                </dt>
                <dd className={styles.short}>{item.short}</dd>
                <dd className={styles.body}>{item.body}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>How a product reaches this list</h2>
        <ol className={styles.steps}>
          <li>A search term is measured on eBay sold data across several months.</li>
          <li>Brand and compliance screens remove what we cannot list, and what
            they removed is kept on this page rather than dropped.</li>
          <li>Anything with less than four pounds of headroom drops out.</li>
          <li>What is left is the list you see. Selling at all is enough, because
            a listing costs nothing to try.</li>
          <li>Anything selling ten or more a month and holding against its own
            history is marked as one worth buying stock in.</li>
          <li>You decide, and add a supplier when you have one.</li>
        </ol>
        <p className={styles.note}>
          Screens are word lists and they get things wrong in both directions, so
          anything removed by a screen is kept and can be reviewed rather than
          disappearing quietly.
        </p>
      </section>
    </div>
  );
}
