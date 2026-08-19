import { Link } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import { ArrowRightIcon, ChevronRightIcon } from '@components/ui/store/icons';
import { POSTS, formatDate } from '@data/blog';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/pages/store/blog-page.module.css';

/*
 * The blog index.
 *
 * One post today, so this has to look deliberate at one and still work at
 * twenty. The first post is a lead card and the rest are a list underneath,
 * which means a single post reads as a featured piece rather than as a grid
 * with a hole in it.
 */
export function BlogPage() {
  const [lead, ...rest] = POSTS;

  return (
    <section className={styles.page}>
      <Head
        title="Writing"
        description="Buying guides and notes from a small UK general store. What things cost, what lasts, and what is worth keeping in the cupboard."
        path="/blog"
      />

      <nav className={styles.crumbs} aria-label="Breadcrumb">
        <Link to={STORE_ROUTES.HOME}>Shop</Link>
        <ChevronRightIcon size={13} />
        <span aria-current="page">Writing</span>
      </nav>

      <header className={styles.head}>
        <h1 className={`${styles.title} wide`}>Writing</h1>
        <p className={styles.blurb}>
          Buying guides and notes from a small UK general store. What things
          cost, what lasts, and what is worth keeping in the cupboard.
        </p>
      </header>

      {POSTS.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyLead}>Nothing written yet.</p>
          <p className={styles.emptyBody}>The first piece is being worked on.</p>
        </div>
      ) : (
        <>
          <article className={styles.lead}>
            <Link className={styles.leadLink} to={`/blog/${lead.slug}`}>
              <p className={styles.meta}>
                {formatDate(lead.date)} &middot; {lead.readingMinutes} minute read
              </p>
              <h2 className={`${styles.leadTitle} wide`}>{lead.title}</h2>
              <p className={styles.leadBlurb}>{lead.description}</p>
              <span className={styles.more}>Read it <ArrowRightIcon size={16} /></span>
            </Link>
          </article>

          {rest.length > 0 && (
            <ul className={styles.list}>
              {rest.map((post) => (
                <li key={post.slug}>
                  <Link className={styles.row} to={`/blog/${post.slug}`}>
                    <span className={styles.rowMain}>
                      <span className={styles.rowTitle}>{post.title}</span>
                      <span className={styles.rowBlurb}>{post.description}</span>
                    </span>
                    <span className={styles.rowMeta}>
                      {formatDate(post.date)} &middot; {post.readingMinutes} min
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
