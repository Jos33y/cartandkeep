import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useCustomers, searchCustomers } from '@hooks/useCustomers';
import { loadTenant } from '@lib/tenant';
import { formatGbp } from '@utils/formatGbp';
import { portalPath, PORTAL_ROUTES } from '@utils/constants';
import styles from '@styles/pages/portal/customers-page.module.css';

/*
 * Who has bought something.
 *
 * There is no customer table. Every order carries the name, the email and the
 * address, so a customer is what you get when you group orders by email, and a
 * second copy of an address is one that goes stale the first time somebody
 * moves house.
 *
 * The screen is opened for two reasons and it is built for the second. The
 * scope wants returning against new, which is the pair of figures at the top.
 * What she will actually use it for is somebody writing in to say an order
 * never arrived, so the search takes a name, a postcode or a reference, and the
 * row says whether anything of theirs is still waiting to be packed.
 */

const FILTERS = [
  { key: 'all', label: 'Everyone' },
  { key: 'returning', label: 'Returning' },
  { key: 'new', label: 'Bought once' },
];

/*
 * A bad timestamp shows nothing rather than taking the screen down.
 *
 * `Intl.DateTimeFormat.format` throws a RangeError on an invalid date, and one
 * unparseable `paid_at` in a thousand orders would blank the whole list rather
 * than one line of one row. Nothing is the honest answer for a date that cannot
 * be read.
 */
const when = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', day: 'numeric', month: 'short', year: 'numeric',
  }).format(d);
};

const lines = (order) => (order.order_items ?? [])
  .map((i) => `${i.qty > 1 ? `${i.qty} ` : ''}${i.variant_label ? `${i.title}, ${i.variant_label}` : i.title}`)
  .join(' · ');

function Customer({ person }) {
  const [open, setOpen] = useState(false);
  const a = person.address ?? {};

  return (
    <li className={styles.person} data-open={open || undefined}>
      <button
        type="button"
        className={styles.row}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.who}>
          <span className={styles.name}>{person.name || 'No name given'}</span>
          <span className={styles.email}>{person.email}</span>
        </span>

        {/* On the row, not behind the expand. This is the reason to open the
            screen when somebody writes in, so it should not need a tap. */}
        {person.toSend > 0 && (
          <span className={styles.waiting}>
            {person.toSend} to send
          </span>
        )}

        <span className={styles.count}>
          <span data-num>{person.orders}</span> {person.orders === 1 ? 'order' : 'orders'}
        </span>
        <span className={`figure ${styles.spent}`} data-num>{formatGbp(person.spent)}</span>
      </button>

      {open && (
        <div className={styles.detail}>
          <dl className={styles.facts}>
            <div><dt>Last bought</dt><dd>{when(person.last_order)}</dd></div>
            <div><dt>First bought</dt><dd>{when(person.first_order)}</dd></div>
            <div><dt>Average order</dt><dd data-num>{formatGbp(person.average)}</dd></div>
          </dl>

          {/* The most recent address they gave, not the first. Somebody who
              moved is best represented by what they last told the shop, and the
              older ones stay on their own orders where an invoice needs them. */}
          {(a.line1 || a.postcode) && (
            <address className={styles.address}>
              {[a.line1, a.line2, a.city, a.postcode].filter(Boolean).join(', ')}
            </address>
          )}

          <ul className={styles.history}>
            {person.history.map((o) => (
              <li key={o.id} className={styles.order}>
                <Link className={styles.ref} to={portalPath(PORTAL_ROUTES.ORDERS)} data-num>
                  {o.reference}
                </Link>
                <span className={styles.orderWhen}>{when(o.paid_at)}</span>
                <span className={styles.orderWhat}>{lines(o)}</span>
                <span className={`figure ${styles.orderTotal}`} data-num>{formatGbp(o.total)}</span>
                {!o.dispatched_at && <span className={styles.notSent}>not sent</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

export function CustomersPage() {
  const [tenant, setTenant] = useState(undefined);
  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const { status, rows, error, counts } = useCustomers(tenant?.id);

  const [filter, setFilter] = useState('all');
  const [term, setTerm] = useState('');

  const visible = useMemo(() => {
    const byFilter = filter === 'all'
      ? rows
      : rows.filter((r) => (filter === 'returning' ? r.returning : !r.returning));
    return searchCustomers(byFilter, term);
  }, [rows, filter, term]);

  if (status === 'error') {
    return (
      <div className={styles.page}>
        <h1 className={styles.emptyTitle}>The customers did not load</h1>
        <p className={styles.emptyBody}>{error?.message ?? 'Reload the page.'}</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <p className={styles.eyebrow}>Customers</p>
          <h1 className={styles.title}>
            {counts.all === 0
              ? 'Nobody yet'
              : `${counts.all} ${counts.all === 1 ? 'person has' : 'people have'} bought something`}
          </h1>
        </div>

        {/* Returning against new, which is what the scope commits to reporting.
            Both shown as counts rather than a percentage, because one returning
            customer out of three is 33% and reads as a trend it is not. */}
        {counts.all > 0 && (
          <dl className={styles.split}>
            <div>
              <dt className={styles.eyebrow}>Returning</dt>
              <dd className={`figure ${styles.splitNum}`} data-num>{counts.returning}</dd>
            </div>
            <div>
              <dt className={styles.eyebrow}>Bought once</dt>
              <dd className={`figure ${styles.splitNum}`} data-num>{counts.new}</dd>
            </div>
          </dl>
        )}
      </header>

      {counts.all > 0 && (
        <div className={styles.controls}>
          <div className={styles.filters}>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={styles.filter}
                data-on={filter === f.key || undefined}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <label className={styles.search}>
            <span className="sr-only">Find somebody</span>
            <input
              className={styles.searchInput}
              type="search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Name, postcode or order reference"
            />
          </label>
        </div>
      )}

      {visible.length === 0 ? (
        <p className={styles.empty}>
          {counts.all === 0
            ? 'This fills in on its own. Everyone who pays for something appears here, with what they bought and what they spent, and you never have to add anybody.'
            : term
              ? `Nothing matches ${term}.`
              : 'Nobody in this list.'}
        </p>
      ) : (
        <ul className={styles.list}>
          {visible.map((p) => <Customer key={p.email} person={p} />)}
        </ul>
      )}
    </div>
  );
}
