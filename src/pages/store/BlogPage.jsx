import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import { ArrowRightIcon, ChevronRightIcon } from '@components/ui/store/icons';
import { NoteCover } from '@components/ui/store/NoteCover';
import { POSTS, formatDate } from '@data/blog';
import { useGroups } from '@hooks/useStoreCatalogue';
import { findGroup } from '@utils/categories';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/pages/store/blog-page.module.css';

/*
 * The notes, as a rack of drawn booklets.
 *
 * Built for thirty rather than one: the newest leads, large, with what is inside
 * it; the rest stand in a grid of covers, a dozen at a time, and a topic can be
 * picked from the tags the posts already carry.
 */

const PAGE = 12;
const topicSlug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const topicName = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// Where a post ends up, said on its card: a section by her name for it, otherwise the shop.
function useDestination() {
  const { status, groups } = useGroups();
  return (post) => {
    const group = post.leads.section && status === 'ready' ? findGroup(groups, post.leads.section) : null;
    if (group) return post.leads.kind === 'products' ? `Ends with things from ${group.name}` : `Ends in ${group.name}`;
    return post.leads.kind === 'products' ? 'Ends with things from the shop' : 'Ends in the shop';
  };
}

function Featured({ post, destination }) {
  return (
    <article className={styles.featured}>
      <Link className={styles.featuredCover} to={`/blog/${post.slug}`} tabIndex={-1} aria-hidden="true">
        <NoteCover post={post} />
      </Link>
      <div className={styles.featuredText}>
        <p className={styles.kicker}>Newest note</p>
        <h2 className={`${styles.featuredTitle} wide`}><Link to={`/blog/${post.slug}`}>{post.title}</Link></h2>
        <p className={styles.featuredBlurb}>{post.description}</p>
        {post.contents.length > 0 && (
          <ol className={styles.inside} aria-label="Inside">
            {post.contents.map((c, i) => (
              <li key={c.id}><Link to={`/blog/${post.slug}#${c.id}`}><span className={styles.insideNo}>{i + 1}</span>{c.text}</Link></li>
            ))}
          </ol>
        )}
        <p className={styles.featuredFoot}>
          <Link className={styles.read} to={`/blog/${post.slug}`}>Read No. {post.no} <ArrowRightIcon size={16} /></Link>
          <span className={styles.meta}>{post.readingMinutes} minute read</span>
          <span className={styles.ends}>{destination(post)}</span>
        </p>
      </div>
    </article>
  );
}

function Card({ post, index }) {
  return (
    <li className={styles.card} style={{ '--i': index % PAGE }}>
      <Link className={styles.cardLink} to={`/blog/${post.slug}`}>
        <span className={styles.cardCover}><NoteCover post={post} /></span>
        <span className={styles.cardMeta}>{formatDate(post.date)} &middot; {post.readingMinutes} min</span>
        <span className={styles.cardTitle}>{post.title}</span>
      </Link>
    </li>
  );
}

export function BlogPage() {
  const [params, setParams] = useSearchParams();
  const destination = useDestination();
  const [shown, setShown] = useState(PAGE);

  // Topics are the tags the posts already carry, most used first. Only worth offering once there is a choice.
  const topics = useMemo(() => {
    const counts = new Map();
    POSTS.forEach((p) => p.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t, n]) => ({ t, n, slug: topicSlug(t) }));
  }, []);
  const topic = topics.find((x) => x.slug === params.get('topic')) ?? null;
  const posts = topic ? POSTS.filter((p) => p.tags.includes(topic.t)) : POSTS;
  const [lead, ...rest] = posts;
  const pick = (slug) => { setShown(PAGE); setParams(slug ? { topic: slug } : {}, { replace: true }); };

  return (
    <section className={styles.page}>
      <Head
        title="Writing"
        description="Guides and notes on the everyday things a house runs on: what lasts, what is worth having in before you need it, and what to look for."
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
          Guides on the everyday things a house runs on: what lasts, what is worth
          having in before you need it, and what to look for.
          {POSTS.length > 1 && <> <b>{POSTS.length} so far.</b></>}
        </p>
      </header>

      {topics.length > 1 && POSTS.length > 3 && (
        <div className={styles.topics} role="group" aria-label="Topic">
          <button type="button" aria-pressed={!topic} onClick={() => pick(null)}>All <b>{POSTS.length}</b></button>
          {topics.map((x) => (
            <button key={x.slug} type="button" aria-pressed={topic?.slug === x.slug} onClick={() => pick(x.slug)}>
              {topicName(x.t)} <b>{x.n}</b>
            </button>
          ))}
        </div>
      )}

      {posts.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyLead}>Nothing written yet.</p>
          <p className={styles.emptyBody}>The first note is being worked on.</p>
        </div>
      ) : (
        <>
          <Featured post={lead} destination={destination} />

          {rest.length > 0 && (
            <>
              <h2 className={styles.rackHead}>{topic ? `More on ${topicName(topic.t).toLowerCase()}` : 'Earlier notes'}</h2>
              <ul className={styles.rack}>
                {rest.slice(0, shown).map((post, i) => <Card key={post.slug} post={post} index={i} />)}
              </ul>
              {rest.length > shown && (
                <button type="button" className={styles.moreBtn} onClick={() => setShown((n) => n + PAGE)}>
                  Show {Math.min(PAGE, rest.length - shown)} more of {rest.length - shown}
                </button>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
