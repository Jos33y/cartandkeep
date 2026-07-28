import { useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';
import { loadTenant } from '@lib/tenant';
import { useAccount } from '@hooks/useAccount';
import styles from '@styles/pages/portal/settings-page.module.css';

const pct = (n) => `${Math.round(n * 100)}%`;

export function SettingsPage() {
  const account = useAccount();
  const [tenant, setTenant] = useState(null);
  const [name, setName] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { loadTenant().then(setTenant); }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setName(data.user?.user_metadata?.full_name ?? ''));
  }, []);

  async function saveName() {
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } });
    setBusy(false);
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
        <h1 className={styles.title}>Your account</h1>
      </header>

      <section className={styles.block}>
        <h2 className={styles.blockLabel}>You</h2>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="full-name">Name</label>
          <input
            id="full-name"
            className={styles.input}
            value={name}
            placeholder="How you want to be addressed"
            onChange={(e) => { setName(e.target.value); setSaved(''); }}
          />
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.primary} disabled={busy} onClick={saveName}>
            {busy ? 'Saving' : 'Save name'}
          </button>
          <span className={styles.saved} role="status">{saved}</span>
        </div>

        <dl className={styles.rows}>
          <Row label="Email" value={account.email ?? ''} note="Changing this changes how you sign in, so ask us first." />
          <Row label="Access" value={account.role ?? ''} />
        </dl>
      </section>

      <section className={styles.block}>
        <h2 className={styles.blockLabel}>Store</h2>
        <dl className={styles.rows}>
          <Row label="Name" value={tenant?.name ?? ''} />
          <Row label="Marketplace" value={tenant?.marketplace ?? ''} />
          <Row label="Currency" value={tenant?.currency ?? ''} />
        </dl>
      </section>

      <section className={styles.block}>
        <h2 className={styles.blockLabel}>What we look for</h2>
        <p className={styles.note}>
          These are the thresholds a product has to clear before it reaches your
          queue. Fixed for now. Once you have worked through a few weeks we will
          open them up, because by then you will know what you want to move.
        </p>
        <dl className={styles.rows}>
          <Row label="Net per unit" value={`at least ${money(gates.margin_abs_min ?? 4)}`} mono />
          <Row label="Net margin" value={`at least ${pct(gates.margin_pct_min ?? 0.25)}`} mono />
          <Row label="Sell-through" value={`at least ${pct(gates.str_min ?? 0.3)}`} mono />
          <Row label="Demand direction" value={`at least ${(gates.trend_min ?? 0.8).toFixed(2)}`} mono />
          <Row label="Active listings" value={`at most ${gates.listings_max ?? 500}`} mono />
          <Row label="Top three sellers" value={`under ${pct(gates.concentration_max ?? 0.7)}`} mono />
        </dl>
      </section>

      <section className={styles.block}>
        <h2 className={styles.blockLabel}>Categories</h2>
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
      </section>
    </div>
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
