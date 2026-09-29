import { Link } from 'react-router';
import { ArrowRightIcon } from '@components/ui/store/icons';
import { useBrowse, useGroups } from '@hooks/useStoreCatalogue';
import { findGroup, imageAt, visibleGroups } from '@utils/categories';
import { formatGbp } from '@utils/formatGbp';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/ui/store/post-leads.module.css';

const SHOWN = 4;
const sectionPath = (slug) => STORE_ROUTES.CATEGORY.replace(':slug', slug);
const productPath = (slug) => STORE_ROUTES.PRODUCT.replace(':slug', slug);

// The default end of a post: the whole shop, with her sections as the ways in.
function Shop({ groups, total }) {
  const shown = visibleGroups(groups).slice(0, 6);
  return (
    <section className={styles.shop} aria-labelledby="leads-head">
      <p className={styles.micro}>From the shop</p>
      <h2 id="leads-head" className={`${styles.head} wide`}>Everything in one basket</h2>
      {total > 0 && <p className={styles.note}>{total} things across {shown.length} sections, and one delivery charge.</p>}
      {shown.length > 1 && (
        <ul className={styles.chips}>
          {shown.map((g) => <li key={g.slug}><Link to={sectionPath(g.slug)}>{g.name}<b>{g.count}</b></Link></li>)}
        </ul>
      )}
      <Link className={styles.cta} to={STORE_ROUTES.SHOP}>See everything in the shop <ArrowRightIcon size={16} /></Link>
    </section>
  );
}

// One section: its name, how many things and from what price, and three of its photographs.
function Section({ group }) {
  return (
    <section className={styles.section} aria-labelledby="leads-head">
      <div className={styles.sectionText}>
        <p className={styles.micro}>From the shop</p>
        <h2 id="leads-head" className={`${styles.head} wide`}>{group.name}</h2>
        <p className={styles.note}>{group.count} {group.count === 1 ? 'thing' : 'things'}, from {formatGbp(group.priceMin)}</p>
        <Link className={styles.cta} to={sectionPath(group.slug)}>See all of {group.name} <ArrowRightIcon size={16} /></Link>
      </div>
      {group.images?.length > 0 && (
        <div className={styles.pinned} aria-hidden="true">
          {group.images.slice(0, 3).map((src, i) => (
            <span key={src} className={styles.photo} style={{ '--i': i }}><img src={imageAt(src, 300)} alt="" loading="lazy" /></span>
          ))}
        </div>
      )}
    </section>
  );
}

// Live, in-stock products as price tags on string: what the post was about, at today's price.
function Tags({ items, group }) {
  return (
    <section className={styles.tags} aria-labelledby="leads-head">
      <p className={styles.micro}>From the shop</p>
      <h2 id="leads-head" className={`${styles.head} wide`}>{group ? `From ${group.name}` : 'In the shop now'}</h2>
      <ul className={styles.tagList}>
        {items.map((p, i) => (
          <li key={p.id} style={{ '--i': i }}>
            <Link className={styles.tag} to={productPath(p.slug)}>
              <span className={styles.hole} aria-hidden="true" />
              <span className={styles.tagImg}>{p.image_url && <img src={imageAt(p.image_url, 300)} alt="" loading="lazy" />}</span>
              <span className={styles.tagTitle}>{p.title}</span>
              <span className={styles.tagPrice} data-price>
                {p.variantCount > 1 && p.priceFrom !== p.priceTo ? `from ${formatGbp(p.priceFrom)}` : formatGbp(p.price)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link className={styles.more} to={group ? sectionPath(group.slug) : STORE_ROUTES.SHOP}>
        {group ? `See all of ${group.name}` : 'See everything in the shop'} <ArrowRightIcon size={16} />
      </Link>
    </section>
  );
}

/*
 * Where a post sends its reader, as its front matter says.
 * Anything that cannot be shown truthfully, such as a section that has gone or
 * no live products, falls back to the whole shop rather than an empty block.
 */
export function PostLeads({ leads }) {
  const { status, groups, total } = useGroups();
  const group = leads.section && status === 'ready' ? findGroup(groups, leads.section) : null;
  const wantsProducts = leads.kind === 'products';
  const settled = status !== 'loading';
  const browse = useBrowse(
    { keys: group?.keys ?? null, inStock: true, sort: 'featured' },
    { limit: SHOWN, enabled: wantsProducts && settled },
  );

  if (!settled) return <div className={styles.holder} aria-hidden="true" />;
  if (wantsProducts && browse.items.length > 0) return <Tags items={browse.items.slice(0, SHOWN)} group={group} />;
  if (wantsProducts && browse.status === 'loading') return <div className={styles.holder} aria-hidden="true" />;
  if (leads.kind === 'section' && group) return <Section group={group} />;
  return <Shop groups={groups} total={total} />;
}
