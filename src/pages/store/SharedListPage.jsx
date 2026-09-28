import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import { SavedRow } from '@components/ui/store/SavedRow';
import { SharedPanel } from '@components/ui/store/SavedPanel';
import { SavedHero } from '@components/ui/store/SavedHero';
import { ArrowRightIcon } from '@components/ui/store/icons';
import { useSaved } from '@hooks/useSaved';
import { useCards } from '@hooks/useStoreCatalogue';
import { readList } from '@lib/savedList';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/pages/store/saved-page.module.css';

/*
 * A saved list opened from a link.
 *
 * It might be the owner on their laptop, or a friend with a birthday coming
 * up, and the page cannot tell which, so it offers both: keep the list, or
 * buy from it. The name is whatever the owner typed, shown as text and never
 * as anything more, and it is only ever a first name.
 *
 * Nothing on the page is written to this device until somebody asks for it.
 */
export function SharedListPage() {
  const { search } = useLocation();
  const { ids, name } = useMemo(() => readList(search), [search]);
  const { addMany, has } = useSaved();
  const { status, items } = useCards(ids);
  const ready = status === 'ready';
  const [kept, setKept] = useState(false);

  const gone = ready ? ids.length - items.length : 0;
  const allMine = items.length > 0 && items.every((p) => has(p.id));
  const title = name ? `${name}'s list` : 'A shared list';

  return (
    <section className={styles.page}>
      <Head title={title} description="A list of things from Cart & Keep." path="/list" noindex />

      <SavedHero items={items} shared name={name} ready={ready} />

      {status === 'loading' && ids.length > 0 && <p className={styles.note}>Opening the list.</p>}

      {(ids.length === 0 || (ready && items.length === 0)) && (
        <div className={styles.empty}>
          <p className={styles.emptyLead}>{ids.length === 0 ? 'This link has no list in it' : 'Nothing on this list is sold any more'}</p>
          <p className={styles.emptyBody}>
            {ids.length === 0
              ? 'It may have been cut short when it was copied. Ask for it again, or have a look around.'
              : 'Everything on it has come off sale since it was sent.'}
          </p>
          <Link className={styles.emptyCta} to={STORE_ROUTES.SHOP}>
            Have a look around <ArrowRightIcon size={16} />
          </Link>
        </div>
      )}

      {ready && items.length > 0 && (
        <>
          {gone > 0 && (
            <p className={styles.cleared}>
              {gone === 1 ? 'One thing on this list is' : `${gone} things on this list are`} no longer sold, so {gone === 1 ? 'it is' : 'they are'} not shown.
            </p>
          )}
          <div className={styles.body}>
            <ul className={styles.rows}>
              {items.map((product) => <SavedRow key={product.id} product={product} shared />)}
            </ul>
            <div className={styles.side}>
              <SharedPanel
                items={items}
                name={name}
                kept={kept || allMine}
                onKeep={() => { addMany(items); setKept(true); }}
              />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
