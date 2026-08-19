import { useEffect, useId, useState } from 'react';
import { useStoreSettings, traderGaps, ZONES } from '@hooks/useStoreSettings';
import styles from '@styles/pages/portal/settings-page.module.css';

/*
 * The shop half of Settings.
 *
 * Kept out of SettingsPage rather than written into it, because that page is
 * read-only sections and this is the part anybody types into. One file that
 * both reads a scoring gate and writes a legal name is a file where the next
 * change has to work out which half it is in.
 *
 * Saved a section at a time. Trader identity and delivery rates are different
 * decisions made at different moments, and one button covering both means
 * correcting a surcharge quietly resaves a name she was midway through
 * changing.
 */
export function StoreSettings({ tenantId }) {
  const {
    status, values, saveTrader, saveDelivery, saveZones, saveVoice,
  } = useStoreSettings(tenantId);

  if (status === 'loading') return null;

  if (status === 'error') {
    return (
      <Section title="Your shop" note="These did not load. Reload the page, and tell me if it keeps happening.">
        <span />
      </Section>
    );
  }

  return (
    <>
      <Trader initial={values.trader} onSave={saveTrader} />
      <Delivery initial={values.delivery} onSave={saveDelivery} />
      <Zones initial={values.delivery.zones} onSave={saveZones} />
      <Voice initial={{ ...values.voice, ...values.socials }} onSave={saveVoice} />
    </>
  );
}

/*
 * Two columns: what this is, then what you change.
 *
 * The left column holds still while the right scrolls, so by the time she is
 * four fields into delivery she can still see which section she is in. That is
 * the same idea as the shelf panel on the shop, and it is the reason this reads
 * as a considered screen rather than a stack of boxes.
 */
function Section({ title, note, state, stateTone, children }) {
  return (
    <section className={styles.block}>
      <div className={styles.aside}>
        <h2 className={styles.blockLabel}>{title}</h2>
        {note ? <p className={styles.blockNote}>{note}</p> : null}
        {state ? (
          <p className={`${styles.state} ${styles[stateTone] ?? ''}`} role="status">{state}</p>
        ) : null}
      </div>
      <div className={styles.body}>{children}</div>
    </section>
  );
}

function useSection(initial) {
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [failed, setFailed] = useState(null);

  // A reload after saving brings new values down, and a draft that ignores them
  // shows her the old ones.
  useEffect(() => { setDraft(initial); }, [initial]);

  const set = (key) => (e) => {
    setDraft((d) => ({ ...d, [key]: e.target.value }));
    setNote('');
  };

  const changed = JSON.stringify(draft) !== JSON.stringify(initial);

  async function commit(fn) {
    setBusy(true);
    setFailed(null);
    try {
      await fn(draft);
      setNote('Saved');
    } catch (e) {
      setFailed(e?.message ?? 'That did not save.');
    } finally {
      setBusy(false);
    }
  }

  return { draft, set, changed, busy, note, failed, commit };
}

/*
 * Label, then a wrapper holding the input and its unit.
 *
 * The first version nested the input inside the label, which turned every field
 * into a row with a shrunken box beside its own name. The unit sits inside the
 * field rather than in the label because reading "3.95" and reading "£3.95" are
 * different acts, and the second is the one she is doing.
 */
function Field({ label, hint, prefix, suffix, num, wide, ...rest }) {
  const id = useId();

  return (
    <div className={`${styles.field} ${wide ? styles.wide : ''}`}>
      <label className={styles.label} htmlFor={id}>{label}</label>
      <span className={styles.control}>
        {prefix ? <span className={styles.affix} aria-hidden="true">{prefix}</span> : null}
        <input id={id} className={styles.input} data-num={num || undefined} {...rest} />
        {suffix ? <span className={styles.affix} aria-hidden="true">{suffix}</span> : null}
      </span>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
    </div>
  );
}

function Save({ section, onSave, label = 'Save' }) {
  const ready = section.changed && !section.busy;

  return (
    <div className={styles.save}>
      <button
        type="button"
        className={`${styles.button} ${ready ? styles.buttonReady : ''}`}
        disabled={!ready}
        onClick={() => section.commit(onSave)}
      >
        {section.busy ? 'Saving' : label}
      </button>
      {section.failed
        ? <span className={styles.failed} role="alert">{section.failed}</span>
        : <span className={styles.saved} role="status">{section.note}</span>}
    </div>
  );
}

function Trader({ initial, onSave }) {
  const s = useSection(initial);
  const gaps = traderGaps(s.draft);

  return (
    <Section
      title="Who is selling"
      note="Your identity as a trader. It appears on your legal pages and on every order confirmation."
      state={gaps.length ? `${gaps.length} missing` : null}
      stateTone="stateMissing"
    >
      {/*
        * Said in the words of the consequence rather than the words of the
        * regulation. "Schedule 2 items b and c" tells her nothing she can act
        * on; "every confirmation goes out without it" does.
        */}
      {gaps.length > 0 && (
        <p className={styles.note}>
          Every order confirmation goes out without your {gaps.join(' and ')}, which the
          law requires it to carry. Fill these in and the next one is complete.
        </p>
      )}

      <div className={styles.fields}>
        <Field
          label="Trading name"
          value={s.draft.legal_name}
          onChange={s.set('legal_name')}
          placeholder="The name you trade under"
        />

        <Field
          label="Company number"
          value={s.draft.company_number}
          onChange={s.set('company_number')}
          num
          placeholder="Sole trader, leave empty"
        />

        <Field
          label="Address"
          wide
          value={s.draft.address}
          onChange={s.set('address')}
          placeholder="12 Example Road, London N1 1AA"
          hint="A geographic address, not a PO box."
        />

        <Field
          label="Support email"
          type="email"
          value={s.draft.email}
          onChange={s.set('email')}
          hint="Where replies to order emails go."
        />

        {/* Schedule 2 item k, and only if she has one. An invented complaints
            procedure is a term she would then be held to. */}
        <Field
          label="Complaints page"
          type="url"
          value={s.draft.complaints_url}
          onChange={s.set('complaints_url')}
          placeholder="Only if you have one"
        />
      </div>

      <p className={styles.hint}>
        You are not VAT registered, so no VAT number appears anywhere on the shop.
        Tell me when that changes, because it changes prices as well as paperwork.
      </p>

      <Save section={s} onSave={onSave} label="Save who is selling" />
    </Section>
  );
}

function Delivery({ initial, onSave }) {
  const s = useSection(initial);

  return (
    <Section
      title="Delivery"
      note="Read by the basket, the checkout and the confirmation email from the same place, so they cannot disagree."
    >
      <div className={styles.fields}>
        <Field
          label="Free delivery over"
          prefix="£"
          num
          inputMode="decimal"
          value={s.draft.free_over}
          onChange={s.set('free_over')}
        />

        <Field
          label="Postage"
          prefix="£"
          num
          inputMode="decimal"
          value={s.draft.postage}
          onChange={s.set('postage')}
        />

        <Field
          label="Cutoff"
          suffix=":00"
          num
          inputMode="numeric"
          value={s.draft.cutoff_hour}
          onChange={s.set('cutoff_hour')}
          hint="Orders paid before this go out the same day, so make it a time you can reach the post office."
        />

        <Field
          label="Quickest"
          suffix="days"
          num
          inputMode="numeric"
          value={s.draft.transit_min}
          onChange={s.set('transit_min')}
        />

        <Field
          label="Longest"
          suffix="days"
          num
          inputMode="numeric"
          value={s.draft.transit_max}
          onChange={s.set('transit_max')}
          hint="This is the one quoted to a customer, because a date that is beaten is better than one that is missed."
        />
      </div>

      <Save section={s} onSave={onSave} label="Save delivery" />
    </Section>
  );
}

function Zones({ initial, onSave }) {
  const [draft, setDraft] = useState(initial ?? {});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [failed, setFailed] = useState(null);

  useEffect(() => { setDraft(initial ?? {}); }, [initial]);

  const changed = JSON.stringify(draft) !== JSON.stringify(initial ?? {});
  const ready = changed && !busy;

  const setSurcharge = (key) => (e) => {
    const value = e.target.value;
    setNote('');
    setDraft((d) => ({ ...d, [key]: { ...(d[key] ?? {}), surcharge: value === '' ? 0 : Number(value) } }));
  };

  const priced = ZONES.filter((z) => !z.fixed && !z.blocked);
  const set = priced.filter((z) => Number(draft[z.key]?.surcharge ?? 0) > 0).length;

  async function commit() {
    setBusy(true);
    setFailed(null);
    try {
      // Sent whole. The screen renders every zone every time, so what it sends
      // is the complete picture rather than a patch.
      await onSave(draft);
      setNote('Saved');
    } catch (e) {
      setFailed(e?.message ?? 'That did not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title="Where it costs more"
      note="Most carriers charge extra for these postcodes and Royal Mail is the exception rather than the rule."
      state={set === 0 ? 'All zero' : `${set} set`}
      stateTone={set === 0 ? 'stateMissing' : 'stateSaved'}
    >
      <div className={styles.rates}>
        {priced.map((z) => (
          <div key={z.key} className={styles.rate}>
            <label className={styles.rateName} htmlFor={`zone-${z.key}`}>{z.label}</label>
            <span className={styles.control}>
              <span className={styles.affix} aria-hidden="true">£</span>
              <input
                id={`zone-${z.key}`}
                className={styles.input}
                data-num
                inputMode="decimal"
                placeholder="0.00"
                value={draft[z.key]?.surcharge ?? ''}
                onChange={setSurcharge(z.key)}
              />
            </span>
          </div>
        ))}

        {/* Not a rate. Guernsey and Jersey sit outside the UK customs and VAT
            territory, so an order there is an export with a customs declaration
            attached, which is a different business rather than a postage rate. */}
        <div className={styles.rateOff}>
          <span className={styles.rateName}>Channel Islands</span>
          <span className={styles.rateOffValue}>Turned off</span>
        </div>
      </div>

      <p className={styles.hint}>
        Every one is zero until you put your rate card in, so nothing changes for a
        customer until you do. The Channel Islands are off rather than surcharged,
        because an order there is an export with customs paperwork attached. Tell me
        if you want it opened up.
      </p>

      <div className={styles.save}>
        <button
          type="button"
          className={`${styles.button} ${ready ? styles.buttonReady : ''}`}
          disabled={!ready}
          onClick={commit}
        >
          {busy ? 'Saving' : 'Save surcharges'}
        </button>
        {failed
          ? <span className={styles.failed} role="alert">{failed}</span>
          : <span className={styles.saved} role="status">{note}</span>}
      </div>
    </Section>
  );
}

function Voice({ initial, onSave }) {
  const s = useSection(initial);

  return (
    <Section
      title="What the shop says"
      note="The lines a stranger reads first, and where to find you."
    >
      <div className={styles.fields}>
        <Field
          label="Headline"
          wide
          value={s.draft.hero_title}
          onChange={s.set('hero_title')}
          hint="Pans, pet beds, floor lamps beats quality household essentials, because you can picture it."
        />

        <Field
          label="Second line"
          wide
          value={s.draft.hero_em}
          onChange={s.set('hero_em')}
          hint="Sits under the headline in terracotta."
        />

        <Field
          label="Tagline"
          wide
          value={s.draft.tagline}
          onChange={s.set('tagline')}
          hint="Under the mark in the footer, and under your name in a search result."
        />

        <Field
          label="Instagram"
          prefix="@"
          value={s.draft.instagram}
          onChange={s.set('instagram')}
          placeholder="cartandkeep"
          hint="Empty removes the link."
        />

        <Field
          label="TikTok"
          prefix="@"
          value={s.draft.tiktok}
          onChange={s.set('tiktok')}
          placeholder="cartandkeep"
        />
      </div>

      <Save section={s} onSave={onSave} label="Save wording" />
    </Section>
  );
}
