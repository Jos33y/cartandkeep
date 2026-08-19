import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import { ArrowRightIcon, ChevronRightIcon } from '@components/ui/store/icons';
import { POSTS, formatDate, postBySlug, relatedPosts } from '@data/blog';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/pages/store/blog-post-page.module.css';

const SITE = 'https://cartandkeep.com';

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
export function BlogPostPage() {
  const { slug } = useParams();
  const post = postBySlug(slug);
  const [html, setHtml] = useState(null);

  useEffect(() => {
    if (!post) return undefined;
    let live = true;
    setHtml(null);

    import('marked')
      .then(({ marked }) => {
        if (!live) return;
        setHtml(marked.parse(post.body, { async: false, gfm: true, breaks: false }));
      })
      .catch((err) => {
        console.error('[blog] could not render markdown', err);
        // Plain text beats a blank page. The words are the point and the
        // formatting is not.
        if (live) setHtml(null);
      });

    return () => { live = false; };
  }, [post?.slug]);

  if (!post) {
    return (
      <section className={styles.page}>
        <h1 className={`${styles.title} wide`}>That piece is not here</h1>
        <p className={styles.lede}>It may have been renamed.</p>
        <Link className={styles.back} to="/blog">Everything we have written</Link>
      </section>
    );
  }

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

      <article className={styles.article}>
        <p className={styles.meta}>
          {formatDate(post.date)} &middot; {post.readingMinutes} minute read
        </p>
        <h1 className={`${styles.title} wide`}>{post.title}</h1>
        {post.description && <p className={styles.lede}>{post.description}</p>}

        {html === null ? (
          // Not a spinner. The markdown chunk arrives in a fraction of a
          // second and a spinner for that is a flash of anxiety for nothing.
          <div className={styles.body}>{post.body}</div>
        ) : (
          <div className={styles.body} dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </article>

      <aside className={styles.after}>
        <Link className={styles.cta} to={STORE_ROUTES.HOME}>
          Everything in the shop <ArrowRightIcon size={16} />
        </Link>

        {related.length > 0 && (
          <div className={styles.related}>
            <h2 className={styles.relatedHead}>More writing</h2>
            <ul>
              {related.map((p) => (
                <li key={p.slug}><Link to={`/blog/${p.slug}`}>{p.title}</Link></li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </section>
  );
}
