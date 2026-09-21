import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';
import { Icon } from '@components/ui/icons';
import styles from '@styles/ui/portal/ebay-connection.module.css';

/*
 * Connect, and see whether the connection is still good.
 *
 * Nothing here ever touches the token. The browser asks the edge function to
 * build a consent URL, sends her to eBay, and later asks whether a token
 * exists. The token itself is written and read by the service role only, which
 * is why tenant_credentials has row level security on and no policy: a token a
 * browser can read is a token that can be taken from a browser.
 */

const when = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

export function EbayConnection({ tenantId }) {
  const [state, setState] = useState({ status: 'loading' });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);
  const [checking, setChecking] = useState(false);
  const [pre, setPre] = useState(null);
  const [choice, setChoice] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const check = useCallback(async () => {
    if (!tenantId) return;
    const { data, error } = await supabase.functions.invoke('ebay-oauth', {
      body: { action: 'status', tenant_id: tenantId },
    });
    if (error) return setState({ status: 'error', message: error.message });
    setState({ status: 'ready', ...data });
    if (data?.settings) setChoice((c) => ({ ...data.settings, ...c }));
  }, [tenantId]);

  useEffect(() => { check(); }, [check]);

  // A token proves she consented. It does not prove eBay will accept a listing,
  // which needs three business policies and an inventory location.
  async function preflight() {
    setChecking(true);
    setFailed(null);
    const { data, error } = await supabase.functions.invoke('ebay-oauth', {
      body: { action: 'preflight', tenant_id: tenantId },
    });
    setChecking(false);
    if (error || data?.error) return setFailed(data?.error ?? error.message);
    setPre(data);
    // One of each is the common case, so preselect it rather than making her
    // choose from a list of one.
    setChoice({
      fulfillment: data.settings?.fulfillment ?? (data.postage?.length === 1 ? data.postage[0].id : ''),
      payment: data.settings?.payment ?? (data.payment?.length === 1 ? data.payment[0].id : ''),
      return: data.settings?.return ?? (data.returns?.length === 1 ? data.returns[0].id : ''),
      location: data.settings?.location ?? (data.locations?.length === 1 ? data.locations[0].key : ''),
    });
    check();
  }

  async function saveSettings() {
    setSaving(true);
    setFailed(null);
    const { data, error } = await supabase.functions.invoke('ebay-oauth', {
      body: { action: 'save_settings', tenant_id: tenantId, settings: choice },
    });
    setSaving(false);
    if (error || data?.error) return setFailed(data?.error ?? error.message);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const ready = choice.fulfillment && choice.payment && choice.return && choice.location;

  async function connect() {
    setBusy(true);
    setFailed(null);
    const { data, error } = await supabase.functions.invoke('ebay-oauth', {
      body: { action: 'start', tenant_id: tenantId },
    });
    if (error || !data?.url) {
      setBusy(false);
      return setFailed(error?.message ?? 'Could not start the connection.');
    }
    // A full navigation rather than a popup. eBay's consent screen asks her to
    // sign in, and a popup that gets blocked looks like a broken button.
    window.location.href = data.url;
  }

  if (!tenantId || state.status === 'loading') {
    return <p className={styles.quiet} role="status">Checking</p>;
  }

  if (state.status === 'error') {
    return <p className={styles.failed} role="alert">{state.message}</p>;
  }

  const lapses = when(state.expires_at);

  return (
    <div className={styles.wrap}>
      <p className={styles.line}>
        <span className={state.connected ? styles.dotOn : styles.dotOff} aria-hidden="true" />
        {state.connected
          ? `${state.account ? `Connected as ${state.account}` : 'Connected'} since ${when(state.connected_at)}`
          : state.lapsed
            ? 'The connection has lapsed and needs granting again'
            : 'Not connected yet'}
      </p>

      {state.connected && lapses && (
        <p className={styles.quiet}>
          Good until {lapses}. eBay expires it then and it has to be granted again.
        </p>
      )}

      {/* Saved choices, shown without having to run the check. Only the ids are
          stored, so names appear once the check has read them from eBay. */}
      {state.connected && !pre && (
        <p className={state.settings ? styles.savedOk : styles.savedNone}>
          {state.settings
            ? 'Listing policies are saved. Run the check to see or change them.'
            : 'No listing policies saved yet. Run the check and choose them before listing.'}
        </p>
      )}

      {!state.connected && (
        <p className={styles.quiet}>
          You will be sent to eBay to sign in and approve. Nothing is listed
          automatically, and your eBay password is never shared with us.
        </p>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.button} disabled={busy} onClick={connect}>
          {busy ? 'Opening eBay' : state.connected ? 'Reconnect' : 'Connect eBay'}
        </button>
        {state.connected && (
          <button type="button" className={styles.ghost} disabled={checking} onClick={preflight}>
            {checking ? 'Checking with eBay' : 'Check it works'}
          </button>
        )}
      </div>

      {pre && (
        <div className={styles.report}>
          <p className={pre.can_list ? styles.good : styles.warn}>
            {pre.can_list
              ? 'Everything a listing needs is in place.'
              : `Connected, but not able to list yet. Missing ${pre.missing.join(', ')}.`}
          </p>

          {/* What the consent actually covers. A permission granted before a
              feature existed is not in it, and the call that needs it comes
              back 403, which reads like a broken endpoint and is not one. */}
          {pre.missing_scopes?.length > 0 && (
            <p className={styles.warn}>
              This connection was granted before {pre.missing_scopes.join(', ')} were
              asked for, so those are not covered by it. Reconnect to include them.
            </p>
          )}

          {/* An offer names all four and eBay refuses to publish without them.
              Sixteen postage policies and two Shenzhen locations on one account
              mean nothing can choose automatically: a guess here publishes a
              listing that tells buyers it dispatches from China. */}
          <div className={styles.picks}>
            {/* Free postage, because every price on the board absorbs it.
                Three days handling or more, because she buys after it sells. */}
            <Pick label="Postage" value={choice.fulfillment}
              onChange={(v) => setChoice((c) => ({ ...c, fulfillment: v }))}
              options={(pre.postage ?? []).map((p) => ({
                value: p.id,
                label: [
                  p.name,
                  p.free ? 'free' : 'buyer pays',
                  p.handling != null ? `${p.handling}d handling` : null,
                  p.international ? 'international' : null,
                ].filter(Boolean).join(' · '),
                warn: !p.free || (p.handling != null && p.handling < 3),
              }))} />
            <Pick label="Payment" value={choice.payment}
              onChange={(v) => setChoice((c) => ({ ...c, payment: v }))}
              options={(pre.payment ?? []).map((p) => ({ value: p.id, label: p.name }))} />
            <Pick label="Returns" value={choice.return}
              onChange={(v) => setChoice((c) => ({ ...c, return: v }))}
              options={(pre.returns ?? []).map((p) => ({
                value: p.id,
                label: [p.name, p.accepted && p.days ? `${p.days} days` : null].filter(Boolean).join(' · '),
              }))} />
            <Pick label="Dispatch from" value={choice.location}
              onChange={(v) => setChoice((c) => ({ ...c, location: v }))}
              options={(pre.locations ?? []).map((l) => ({
                value: l.key,
                label: [l.name ?? l.key, l.where].filter(Boolean).join(' · '),
                warn: l.country && l.country !== 'GB',
              }))} />
          </div>

          <div className={styles.saveRow}>
            <button type="button" className={styles.button} disabled={!ready || saving}
              onClick={saveSettings}>
              {saving ? 'Saving' : saved ? 'Saved' : 'Save for listings'}
            </button>
            {!ready && (
              <span className={styles.quiet}>Choose all four before anything can be listed.</span>
            )}
          </div>

          {pre.errors?.length > 0 && (
            <p className={styles.failed}>
              eBay refused some of it: {pre.errors.join(', ')}. A 403 means the scope
              was not granted and reconnecting fixes it.
            </p>
          )}
        </div>
      )}

      {failed && <p className={styles.failed} role="alert">{failed}</p>}
    </div>
  );
}

function Pick({ label, value, onChange, options }) {
  return (
    <label className={styles.pick}>
      <span className={styles.pickLabel}>{label}</span>
      {options.length ? (
        <select className={styles.select} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose one</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.warn ? `⚠ ${o.label}` : o.label}</option>
          ))}
        </select>
      ) : (
        <span className={styles.pickNone}>
          <Icon name="IconInfo" className={styles.pickIcon} />
          None set up in Seller Hub
        </span>
      )}
    </label>
  );
}
