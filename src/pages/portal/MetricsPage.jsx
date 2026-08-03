import styles from '@styles/pages/portal/metrics-page.module.css';

const MONEY = [
  {
    term: 'Headroom',
    short: 'What is left of the sale price after the costs of selling, before paying for the product.',
    body: 'It is the sale price less the eBay fee, the payment fee, promoted listings, postage and packaging. It is not profit. Profit is headroom less what the product costs to buy, and no supplier has quoted us yet, so that line reads not quoted. A product needs at least four pounds of headroom to reach this list at all.',
  },
  {
    term: 'Cost to sell',
    short: 'Everything headroom has already taken off.',
    body: 'Fees, postage and packaging added together. Postage is costed on a small parcel, which is the conservative assumption until a supplier gives real dimensions.',
  },
  {
    term: 'Goods, not quoted',
    short: 'The product cost, which we do not have yet.',
    body: 'Rather than estimate it and show a profit figure built on a guess, the line says what it is. It fills in once a supplier quotes.',
  },
];

const DEMAND = [
  {
    term: 'Units sold',
    short: 'How many of that exact listing sold in the most recent month.',
    body: 'Taken from eBay\u2019s own sold transaction data through Terapeak, not an estimate. Ten in the latest month is the minimum to appear here.',
  },
  {
    term: 'Holding',
    short: 'How the latest month compares with the product\u2019s own average.',
    body: 'One means it is selling at its usual rate. Below zero point six means it has fallen away, and those are excluded. This is what keeps summer products off an August list.',
  },
  {
    term: 'Same product sellers',
    short: 'How many other sellers are listing a matching product.',
    body: 'Fewer is better. It is measured on title matching, so on a listing with many variations it is a rough figure rather than an exact one.',
  },
  {
    term: 'Evergreen, rising, new, fading',
    short: 'How the product has behaved across the windows we measured.',
    body: 'Evergreen means it sold in every window we looked at. New means it did not exist a year ago, which is not a fault. Fading means the latest window is well below its own history.',
  },
];

const CAVEATS = [
  {
    term: 'Variations',
    short: 'How many size or colour options sit on the listing the figures came from.',
    body: 'On a listing with many variations the sold count covers all of them and the price is an average across whichever sold. A vet bed listing with two hundred variations spans a wide price range, so the money shown is a blend and not a per-size figure. Above ten variations the row says so.',
  },
  {
    term: 'Bulky',
    short: 'The product is unlikely to post as a small parcel.',
    body: 'Postage is still costed as a small parcel, so headroom on a bulky product is optimistic until the supplier gives dimensions and weight.',
  },
];

const SCORE = [
  {
    term: 'The score',
    short: 'A single number from the components below, weighted.',
    body: 'It is a sort order, not a verdict. An eighty made of strong sales and thin margin is a different proposition from an eighty made of the reverse, which is what the bar underneath is for.',
  },
  {
    term: 'The bar',
    short: 'One segment per component. Width is how much it counts, fill is how it scored.',
    body: 'A candidate measured on five things shows five segments. Where a component has no data it is left out rather than counted as zero, so the bar shows what the score was actually made of. Open a row to see the figures behind it.',
  },
];

const SECTIONS = [
  { title: 'The money', items: MONEY },
  { title: 'The demand', items: DEMAND },
  { title: 'What weakens a figure', items: CAVEATS },
  { title: 'The score and the bar', items: SCORE },
];

export function MetricsPage() {
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className="micro">Metrics</p>
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
                <dt className={styles.name}>{item.term}</dt>
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
          <li>Anything below ten sales in the latest month drops out.</li>
          <li>Anything with less than four pounds of headroom drops out.</li>
          <li>Anything that has fallen away against its own history drops out.</li>
          <li>Brand and compliance screens remove what we cannot list.</li>
          <li>What survives is scored, sorted and put in front of you.</li>
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
