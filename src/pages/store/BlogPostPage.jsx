import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import { ChevronRightIcon } from '@components/ui/store/icons';
import { NoteCover } from '@components/ui/store/NoteCover';
import { PostLeads } from '@components/ui/store/PostLeads';
import { gbp, legalTerms } from '@data/legal';
import { replyPromise, siteUrl, storeConfig } from '@lib/storeConfig';
import { fillNumbers, formatDate, headingId, postBySlug, relatedPosts } from '@data/blog';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/pages/store/blog-post-page.module.css';


/*
 * One post.
 *
 * `marked` is imported inside an effect rather than at the top of the file, so
 * it lands in its own chunk and a shopper who never opens the blog never
 * downloads a markdown parser. It is about 11KB gzipped, which is nothing on
 * this route and is not nothing on every route.
 *
 * The posts are our own files rather than user input, so there is no
 * sanitising step. That stops being true the moment anybody else can write
 * one, and this comment is here so that change is not made quietly.
 */
const storeName = () => storeConfig().shopName || 'the shop';

export function BlogPostPage() {
  const { slug } = useParams();
  const post = postBySlug(slug);
  const [html, setHtml] = useState(null);

  const body = useMemo(() => {
    if (!post) return '';
    const T = legalTerms();
    return fillNumbers(post.body, {
      free_over: gbp(T.freeDeliveryOver), postage: gbp(T.postage), return_days: String(T.returnDays), reply: replyPromise(),
    });
  }, [post?.slug]);

  useEffect(() => {
    if (!post) return undefined;
    let live = true;
    setHtml(null);

    import('marked')
      .then(({ marked }) => {
        if (!live) return;
        // Each second level heading gets the address the margin index links to.
        const out = marked.parse(body, { async: false, gfm: true, breaks: false })
          .replace(/<h2>([\s\S]*?)<\/h2>/g, (_, inner) => `<h2 id="${headingId(inner.replace(/<[^>]+>/g, ''))}">${inner}</h2>`);
        setHtml(out);
      })
      .catch((err) => {
        console.error('[blog] could not render markdown', err);
        // Plain text beats a blank page. The words are the point and the
        // formatting is not.
        if (live) setHtml(null);
      });

    return () => { live = false; };
  }, [post?.slug]);

  // Which heading the reader is in, for the margin index.
  const bodyRef = useRef(null);
  const [current, setCurrent] = useState(null);
  useEffect(() => {
    const root = bodyRef.current;
    if (!root || !html) return undefined;
    const heads = [...root.querySelectorAll('h2[id]')];
    let frame = 0;
    const measure = () => {
      frame = 0;
      // Just under the sticky header: the heading the reader is actually reading, not the one coming up.
      const line = 160;
      const passed = window.scrollY < 40 ? [] : heads.filter((h) => h.getBoundingClientRect().top < line);
      setCurrent(passed.length ? passed[passed.length - 1].id : null);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(frame); };
  }, [html]);

  // Arriving from "Inside" on the list: the heading only exists once the markdown has rendered, so jump then.
  useEffect(() => {
    if (!html || !window.location.hash) return;
    document.getElementById(decodeURIComponent(window.location.hash.slice(1)))?.scrollIntoView();
  }, [html]);

  if (!post) {
    return (
      <section className={styles.page}>
        <h1 className={`${styles.title} wide`}>That piece is not here</h1>
        <p className={styles.lede}>It may have been renamed.</p>
        <Link className={styles.back} to="/blog">Everything we have written</Link>
      </section>
    );
  }

  const SITE = siteUrl();
  const related = relatedPosts(post);
  const path = `/blog/${post.slug}`;

  return (
    <section className={styles.page}>
      <Head
        title={post.title}
        description={post.description}
        path={path}
        image={post.image ? `${SITE}${post.image}` : undefined}
        schema={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Article',
              headline: post.title,
              description: post.description,
              datePublished: post.date,
              dateModified: post.date,
              author: { '@type': 'Organization', name: post.author, '@id': `${SITE}/#organization` },
              publisher: { '@id': `${SITE}/#organization` },
              mainEntityOfPage: `${SITE}${path}`,
              ...(post.image ? { image: `${SITE}${post.image}` } : {}),
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Shop', item: `${SITE}/` },
                { '@type': 'ListItem', position: 2, name: 'Writing', item: `${SITE}/blog` },
                { '@type': 'ListItem', position: 3, name: post.title, item: `${SITE}${path}` },
              ],
            },
          ],
        }}
      />

      <nav className={styles.crumbs} aria-label="Breadcrumb">
        <Link to={STORE_ROUTES.HOME}>Shop</Link>
        <ChevronRightIcon size={13} />
        <Link to="/blog">Writing</Link>
        <ChevronRightIcon size={13} />
        <span aria-current="page">{post.title}</span>
      </nav>

      <div className={styles.layout}>
        <header className={styles.masthead}>
          <div className={styles.mastText}>
            <p className={styles.issue}>
              <span className={styles.issueNo}>No. {post.no}</span>
              <span className={styles.issueMeta}>Notes from {storeName()} &middot; {formatDate(post.date)} &middot; {post.readingMinutes} minute read</span>
            </p>
            <h1 className={`${styles.title} wide`}>{post.title}</h1>
            {post.description && <p className={styles.lede}>{post.description}</p>}
          </div>
          <div className={styles.mastCover} aria-hidden="true"><NoteCover post={post} /></div>
        </header>

        {post.contents.length > 1 && (
          <nav className={styles.index} aria-label="In this note">
            <p className={styles.indexHead}>In this note</p>
            <ol>
              {post.contents.map((c, i) => (
                <li key={c.id} data-on={current === c.id || undefined}>
                  <a href={`#${c.id}`}><span className={styles.indexNo}>{i + 1}</span>{c.text}</a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <article className={styles.article}>
          {html === null ? (
            // Not a spinner. The markdown chunk arrives in a fraction of a second.
            <div className={`${styles.body} ${styles.raw}`}>{body}</div>
          ) : (
            <div ref={bodyRef} className={styles.body} dangerouslySetInnerHTML={{ __html: html }} />
          )}
        </article>
      </div>

      <div className={styles.after}>
        <PostLeads leads={post.leads} />

        {related.length > 0 && (
          <nav className={styles.related} aria-label="More writing">
            <h2 className={styles.relatedHead}>More writing</h2>
            <ul>
              {related.map((p) => (
                <li key={p.slug}><Link to={`/blog/${p.slug}`}>{p.title}</Link></li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </section>
  );
}
