import styles from '@styles/layout/store/announcement-bar.module.css';

/*
 * This bar and the trust strip were saying the same three things, one above
 * the other, which read as filler twice rather than as reassurance once.
 *
 * Each fact now appears in exactly one place. The delivery threshold stays
 * here, because it is the only line on the page that changes what someone puts
 * in a basket and it belongs above the fold. Returns, guest checkout and
 * payment moved down to the strip, which is where somebody looks when they are
 * deciding rather than arriving.
 *
 * The line beside it is the shop saying what it is. A general store's whole
 * pitch is that the cupboard is deep, so it says that rather than a slogan
 * about quality that any of ten thousand dropshippers could also print.
 */
export function AnnouncementBar() {
  return (
    <div className={styles.bar}>
      <p className={styles.inner}>
        <span className={styles.voice}>A small UK shop with a very large cupboard</span>
        <span className={styles.rule} aria-hidden="true" />
        <span className={styles.offer}>
          Free delivery over <span data-price>&pound;40</span>
        </span>
      </p>
    </div>
  );
}
