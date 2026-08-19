import { useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';
import { loadTenant } from '@lib/tenant';
import { useAccount } from '@hooks/useAccount';
import { StoreSettings } from '@components/ui/portal/StoreSettings';
import styles from '@styles/pages/portal/settings-page.module.css';

const pct = (n) => `${Math.round(n * 100)}%`;

export function SettingsPage() {
  const account = useAccount();
  const [tenant, setTenant] = useState(null);
  const [name, setName] = useState('');
  // What came back from the server, so the save can tell whether anything
  // changed. Without it this button is terracotta permanently, and terracotta
  // that is always on marks nothing.
  const [savedName, setSavedName] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { loadTenant().then(setTenant); }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const current = data.user?.user_metadata?.full_name ?? '';
      setName(current);
      setSavedName(current);
    });
  }, []);

  async function saveName() {
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } });
    setBusy(false);
    if (!error) setSavedName(name.trim());
    setSaved(error ? 'Could not save that. Try again.' : 'Saved');
  }

  const gates = tenant?.scoring?.gates ?? {};
  const research = tenant?.research ?? {};
  const categories = research.categories ?? [];
  const excluded = research.exclude?.terms ?? [];

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>Settings</p>
        <h1 className={styles.title}>Settings</h1>
      </header>

      <Block title="You" note="How you appear to us, and how you sign in.">
        <div className={styles.fields}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="full-name">Name</label>
            <span className={styles.control}>
              <input
                id="full-name"
                className={styles.input}
                value={name}
                placeholder="How you want to be addressed"
                onChange={(e) => { setName(e.target.value); setSaved(''); }}
              />
            </span>
          </div>
        </div>

        <div className={styles.save}>
          <button
            type="button"
            className={`${styles.button} ${!busy && name.trim() !== savedName ? styles.buttonReady : ''}`}
            disabled={busy || name.trim() === savedName}
            onClick={saveName}
          >
            {busy ? 'Saving' : 'Save name'}
          </button>
          <span className={styles.saved} role="status">{saved}</span>
        </div>

        <dl className={styles.rows}>
          <Row label="Email" value={account.email ?? ''} note="Changing this changes how you sign in, so ask us first." />
          <Row label="Access" value={account.role ?? ''} />
        </dl>
      </Block>

      {/*
        * One Settings page with sections rather than a second page under Your
        * shop. Two pages both called settings is a question she answers every
        * time she goes looking for something.
        *
        * Order matters: what she can change comes before what she cannot. The
        * three sections below this are studio work she should not be able to
        * break by accident, and putting them first would make the page read as
        * mostly closed.
        */}
      <StoreSettings tenantId={tenant?.id} />

      <Block title="Set by the studio" note="Ours to change rather than yours, so a settings screen cannot break how the pipeline scores anything.">
        <dl className={styles.rows}>
          <Row label="Name" value={tenant?.name ?? ''} />
          <Row label="Marketplace" value={tenant?.marketplace ?? ''} />
          <Row label="Currency" value={tenant?.currency ?? ''} />
          <Row
            label="Order references"
            value={tenant?.store?.reference_prefix
              ? `${tenant.store.reference_prefix}-XXXX-XXXX`
              : 'CK-XXXX-XXXX'}
            mono
            note="Not changeable. Two prefixes in one order book look like two businesses."
          />
        </dl>
      </Block>

      <Block
        title="What we look for"
        note="The thresholds a product clears before it reaches your queue. Fixed for now. Once you have worked through a few weeks we will open them up, because by then you will know what you want to move."
      >
        <dl className={styles.rows}>
          <Row label="Net per unit" value={`at least ${money(gates.margin_abs_min ?? 4)}`} mono />
          <Row label="Net margin" value={`at least ${pct(gates.margin_pct_min ?? 0.25)}`} mono />
          <Row label="Sell-through" value={`at least ${pct(gates.str_min ?? 0.3)}`} mono />
          <Row label="Demand direction" value={`at least ${(gates.trend_min ?? 0.8).toFixed(2)}`} mono />
          <Row label="Active listings" value={`at most ${gates.listings_max ?? 500}`} mono />
          <Row label="Top three sellers" value={`under ${pct(gates.concentration_max ?? 0.7)}`} mono />
        </dl>
      </Block>

      <Block title="Categories" note="What the pipeline sweeps for you.">
        {categories.length > 0 ? (
          <ul className={styles.tags}>
            {categories.map((c) => <li key={c} className={styles.tag}>{c}</li>)}
          </ul>
        ) : (
          <p className={styles.note}>No categories set yet.</p>
        )}
        {excluded.length > 0 && (
          <p className={styles.note}>
            {excluded.length} terms are held back for regulatory reasons, mainly
            cosmetics, pet food and health products.
          </p>
        )}
      </Block>
    </div>
  );
}

/*
 * The same two column section the shop half uses.
 *
 * Defined here rather than imported from StoreSettings, because that component
 * is the writable half and this page should not depend on it to render its own
 * read only rows. Twelve lines duplicated is cheaper than that dependency.
 */
function Block({ title, note, children }) {
  return (
    <section className={styles.block}>
      <div className={styles.aside}>
        <h2 className={styles.blockLabel}>{title}</h2>
        {note ? <p className={styles.blockNote}>{note}</p> : null}
      </div>
      <div className={styles.body}>{children}</div>
    </section>
  );
}

function money(n) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
}

function Row({ label, value, note, mono = false }) {
  return (
    <div className={styles.row}>
      <dt className={styles.rowLabel}>{label}</dt>
      <dd className={styles.rowValue}>
        <span className={mono ? styles.mono : undefined}>{value || '--'}</span>
        {note ? <span className={styles.rowNote}>{note}</span> : null}
      </dd>
    </div>
  );
}
