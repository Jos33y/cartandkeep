import { imageAt } from '@utils/categories';
import { formatGbp } from '@utils/formatGbp';
import { SearchIcon } from '@components/ui/store/icons';
import styles from '@styles/ui/store/store-hero.module.css';

/*
 * The shop front's opening, on its own ground.
 *
 * The first version sat on the page colour like everything else, so the hero
 * and the departments and the shelves were one undifferentiated cream field
 * and nothing said where the top of the shop ended. It now has a warm band of
 * its own, full bleed, closed by a hairline.
 *
 * The right hand side was three white cards floating on cream, which read as a
 * placeholder because that is what it was. It is now one object: a window,
 * with the products edge to edge inside it and sage showing through as the
 * frame. Four products rather than three, because the whole pitch is range and
 * three of anything reads as a curation.
 */
export function StoreHero({ query, onQuery, suggestions, featured, count }) {
  const window4 = featured.slice(0, 4);

  return (
    <section className={styles.band}>
      <div className={styles.inner}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Eight departments, one basket</p>

          <h1 className={`${styles.title} wide`}>
            Everything for the house.
            <em className={styles.em}> Nothing you have to hunt for.</em>
          </h1>

          <p className={styles.sub}>
            Pans, pet beds, floor lamps, drain unblocker. If it belongs in a
            house, it is probably in here somewhere.
          </p>

          <div className={styles.searchRow}>
            <div className={styles.search}>
              <SearchIcon size={20} />
              <input
                className={styles.input}
                type="search"
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                placeholder="Search all products"
                aria-label="Search the shop"
                enterKeyHint="search"
              />
              {query && (
                <button type="button" className={styles.clear} onClick={() => onQuery('')}>
                  Clear
                </button>
              )}
            </div>
          </div>

          {suggestions.length > 0 && !query && (
            <div className={styles.terms}>
              <span className={styles.termsLabel}>Popular</span>
              {suggestions.map((term) => (
                <button key={term} type="button" className={styles.term} onClick={() => onQuery(term)}>
                  {term}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.window}>
          {window4.map((p, i) => (
            <figure key={p.id} className={`${styles.pane} ${styles[`pane${i + 1}`]}`}>
              <img
                src={imageAt(p.image_url, 500)}
                alt=""
                loading={i < 2 ? 'eager' : 'lazy'}
                decoding="async"
              />
              {/* The price is on it because a window with prices in it is a
                  shop, and a window without them is a mood board. */}
              <figcaption className={styles.chip} data-price>{formatGbp(p.price)}</figcaption>
            </figure>
          ))}
          <span className={styles.stock}>
            <span data-price>{count}</span> in stock today
          </span>
        </div>
      </div>
    </section>
  );
}
