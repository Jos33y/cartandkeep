import { useEffect, useId, useState } from 'react';
import { useStoreSettings, traderGaps, ZONES } from '@hooks/useStoreSettings';
import { formatGbp } from '@utils/formatGbp';
import styles from '@styles/pages/portal/settings-page.module.css';

const hour = (h) => {
  const n = Number(h);
  if (!Number.isFinite(n) || h === '') return null;
  return n === 12 ? 'midday' : n < 12 ? `${n}am` : `${n - 12}pm`;
};

// What the bottom of every receipt carries, drawn from the fields as she types.
function ReceiptPreview({ t }) {
  const line = (value, missing) => (value?.trim()
    ? <span>{value}</span>
    : <span className={styles.previewMissing}>{missing}</span>);
  return (
    <figure className={styles.preview}>
      <figcaption className={styles.previewLabel}>At the foot of every receipt</figcaption>
      <div className={styles.paperSlip}>
        <b>{t.legal_name?.trim() || <span className={styles.previewMissing}>Legal name needed</span>}</b>
        {t.trading_as?.trim() && t.trading_as !== t.legal_name && <span>trading as {t.trading_as}</span>}
        {line(t.address, 'Address needed')}
        {t.company_number?.trim() && <span>Company number <span data-num>{t.company_number}</span></span>}
        {t.email?.trim() && <span>{t.email}</span>}
        {t.complaints_url?.trim() && <span>Complaints: {t.complaints_url}</span>}
        {!t.complaints_url?.trim() && t.email?.trim() && <span>Complaints: {t.email}</span>}
      </div>
    </figure>
  );
}

// What the returns page, the receipt and the confirmation email will say.
function ReturnsPreview({ r }) {
  const days = Number(r.days);
  const ok = Number.isInteger(days) && days >= 14;
  return (
    <figure className={styles.preview}>
      <figcaption className={styles.previewLabel}>On every receipt</figcaption>
      <div className={styles.paperSlip}>
        {ok
          ? <b>{days} days to change your mind.</b>
          : <span className={styles.previewMissing}>Return window needed</span>}
        {r.postage_paid_by === 'customer' && <span>Return postage is yours to pay unless it is faulty.</span>}
        {r.postage_paid_by === 'us' && <span>We pay the return postage.</span>}
        <span>Nothing here removes your statutory rights.</span>
      </div>
    </figure>
  );
}

// The promise the shop makes, and what a basket of any size would pay.
function DeliveryPreview({ d }) {
  const free = Number(d.free_over);
  const post = Number(d.postage);
  const [basket, setBasket] = useState(() => (Number.isFinite(free) && free > 0 ? Math.max(5, Math.round(free * 0.8)) : 30));
  const hasFree = Number.isFinite(free) && free > 0;
  const pays = hasFree && basket >= free ? 0 : (Number.isFinite(post) ? post : 0);
  const cut = hour(d.cutoff_hour);
  const max = Math.max(60, hasFree ? Math.ceil(free * 1.6) : 60);

  return (
    <figure className={styles.preview}>
      <figcaption className={styles.previewLabel}>What customers are told</figcaption>
      <div className={styles.promise}>
        <p className={styles.promiseMain}>
          {hasFree ? <>Free UK delivery from <b data-num>{formatGbp(free)}</b></> : <>UK delivery <b data-num>{formatGbp(post || 0)}</b></>}
        </p>
        <p className={styles.promiseSub}>
          {cut ? <>Order by {cut} and it goes out that day. </> : null}
          {d.transit_max ? <>Arrives in {d.transit_min && d.transit_min !== d.transit_max ? `${d.transit_min} to ` : ''}{d.transit_max} working days.</> : null}
        </p>
      </div>
      <div className={styles.sim}>
        <label className={styles.simLabel} htmlFor="basket-sim">
          A basket of <b data-num>{formatGbp(basket)}</b> pays <b data-num data-free={pays === 0 || undefined}>{pays === 0 ? 'nothing' : formatGbp(pays)}</b> for delivery
        </label>
        <input id="basket-sim" className={styles.slider} type="range" min="1" max={max} step="1" value={basket}
          onChange={(e) => setBasket(Number(e.target.value))}
          style={{ '--fill': `${(basket / max) * 100}%`, '--mark': hasFree ? `${(free / max) * 100}%` : '200%' }} />
        {hasFree && basket < free && <p className={styles.simNote}><span data-num>{formatGbp(free - basket)}</span> more and delivery is free</p>}
      </div>
    </figure>
  );
}

function VoicePreview({ v }) {
  return (
    <figure className={styles.preview}>
      <figcaption className={styles.previewLabel}>The top of the home page</figcaption>
      <div className={styles.heroPreview}>
        {v.hero_title?.trim()
          ? <p className={styles.heroTitle}>{v.hero_title}</p>
          : <p className={styles.heroEmpty}>The shop&apos;s standard headline shows here until you write one.</p>}
        {v.hero_em?.trim() && <p className={styles.heroEm}>{v.hero_em}</p>}
        <p className={styles.heroTag}>{v.tagline?.trim() || 'Your tagline'}</p>
        <p className={styles.heroSocials}>
          {v.instagram?.trim() && <span>@{v.instagram} on Instagram</span>}
          {v.tiktok?.trim() && <span>@{v.tiktok} on TikTok</span>}
        </p>
      </div>
    </figure>
  );
}

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
    status, values, saveTrader, saveDelivery, saveZones, saveReturns, saveVoice, saveAbout,
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
      <Returns initial={values.returns} onSave={saveReturns} />
      <Voice initial={{ ...values.voice, ...values.socials }} onSave={saveVoice} />
      <About initial={values.about} onSave={saveAbout} />
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
function Section({ id, title, note, state, stateTone, preview, children }) {
  return (
    <section id={id} className={styles.block} data-preview={preview ? '' : undefined}>
      <div className={styles.aside}>
        <h2 className={styles.blockLabel}>{title}</h2>
        {note ? <p className={styles.blockNote}>{note}</p> : null}
        {state ? (
          <p className={`${styles.state} ${styles[stateTone] ?? ''}`} role="status">{state}</p>
        ) : null}
      </div>
      <div className={styles.body}>{children}</div>
      {preview && <div className={styles.previewCol}>{preview}</div>}
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

  // For fields that are lists of rows, which a single input event cannot describe.
  const patch = (next) => {
    setDraft((d) => ({ ...d, ...next }));
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

  return { draft, set, patch, changed, busy, note, failed, commit };
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

// "Cart and Keep Ltd" and "Cart & Keep" are the same name to a customer.
const COMPANY_SUFFIX = /\b(ltd|limited|plc|llp)\.?\s*$/i;
const sameName = (a, b) => {
  const norm = (v) => String(v ?? '').trim().replace(COMPANY_SUFFIX, '').toLowerCase()
    .replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
  return norm(a) !== '' && norm(a) === norm(b);
};
const claimsCompany = (name) => COMPANY_SUFFIX.test(String(name ?? '').trim());

function Trader({ initial, onSave }) {
  const s = useSection(initial);
  const gaps = traderGaps(s.draft);
  const noNumber = !s.draft.company_number.trim();
  const nameIsShop = sameName(s.draft.legal_name, s.draft.trading_as) && noNumber;
  const companyWithoutNumber = claimsCompany(s.draft.legal_name) && noNumber;

  return (
    <Section
      title="Who is selling"
      note="Your identity as a trader. It appears on your legal pages and on every order confirmation."
      state={gaps.length ? `${gaps.length} missing` : (nameIsShop || companyWithoutNumber) ? 'Check your name' : null}
      stateTone="stateMissing"
      preview={<ReceiptPreview t={s.draft} />}
    >
      {/*
        * Said in the words of the consequence rather than the words of the
        * regulation. "Schedule 2 items b and c" tells her nothing she can act
        * on; "every confirmation goes out without it" does.
        */}
      {companyWithoutNumber && (
        <p className={styles.note} role="alert">
          Ltd is only for a company registered at Companies House, and using it otherwise is an
          offence. If you have a company, add its number. If you are a sole trader, put your own
          name here.
        </p>
      )}

      {nameIsShop && !companyWithoutNumber && (
        <p className={styles.note} role="alert">
          Your legal name matches your trading name. As a sole trader it has to be your own
          name, the one on your bank account, or every receipt and legal page names nobody.
        </p>
      )}

      {gaps.length > 0 && (
        <p className={styles.note}>
          Every order confirmation goes out without your {gaps.join(' and ')}, which the
          law requires it to carry. Fill these in and the next one is complete.
        </p>
      )}

      <div className={styles.fields}>
        <Field
          label="Your legal name"
          value={s.draft.legal_name}
          onChange={s.set('legal_name')}
          placeholder="Your full name"
          hint="As a sole trader, your own name. It has to appear beside the trading name."
        />

        <Field
          label="Trading name"
          value={s.draft.trading_as}
          onChange={s.set('trading_as')}
          placeholder="The name customers know the shop by"
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
          label="Return address"
          wide
          value={s.draft.return_address}
          onChange={s.set('return_address')}
          placeholder="Optional"
          hint="Leave empty and returns go to the address above."
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
          label="Where complaints go"
          value={s.draft.complaints_url}
          onChange={s.set('complaints_url')}
          placeholder="Optional"
          hint="A page on your site or an email address. Leave empty and complaints go to your support email."
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

const RETURN_DAYS = [
  ['14', '14 days, the legal minimum'], ['21', '21 days'], ['28', '28 days'], ['30', '30 days'],
  ['45', '45 days'], ['60', '60 days'], ['90', '90 days'],
];

function Returns({ initial, onSave }) {
  const s = useSection(initial);
  const days = Number(s.draft.days);

  return (
    <Section
      title="Returns"
      note="Printed on the returns page, every receipt and every order confirmation, from here."
      state={!s.draft.days || !s.draft.postage_paid_by ? 'Not set' : null}
      stateTone="stateMissing"
      preview={<ReturnsPreview r={s.draft} />}
    >
      <div className={styles.fields}>
        <Choice
          label="Time to change their mind"
          value={s.draft.days}
          onChange={s.set('days')}
          options={[['', 'Choose'], ...RETURN_DAYS]}
          hint={days > 14 ? `The law gives 14. The other ${days - 14} are your own promise.` : 'Customers always have at least 14 days by law.'}
        />
        <Choice
          label="Return postage on a change of mind"
          value={s.draft.postage_paid_by}
          onChange={s.set('postage_paid_by')}
          options={[['', 'Choose'], ['us', 'We pay'], ['customer', 'The customer pays']]}
          hint="You always pay when something is faulty or not as described."
        />
      </div>
      <Save section={s} onSave={onSave} label="Save returns" />
    </Section>
  );
}

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
const DAYS = [1, 2, 3, 4, 5, 6, 7, 10];

function Choice({ label, hint, options, ...rest }) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>{label}</label>
      <select id={id} className={styles.select} {...rest}>
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
    </div>
  );
}

function Delivery({ initial, onSave }) {
  const s = useSection(initial);

  return (
    <Section
      title="Delivery"
      note="Read by the basket, the checkout and the confirmation email from the same place, so they cannot disagree."
      preview={<DeliveryPreview d={s.draft} />}
    >
      <div className={styles.fields}>
        <Field
          label="Free delivery from"
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

        <Choice
          label="Order by"
          value={s.draft.cutoff_hour}
          onChange={s.set('cutoff_hour')}
          options={HOURS.map((h) => [String(h), hour(h)])}
          hint="Paid before this, it goes out the same day. Pick a time you can reach the post office."
        />
        <div className={styles.field}>
          <span className={styles.label}>Arrives in</span>
          <span className={styles.range}>
            <select className={styles.select} data-num aria-label="Quickest, in working days" value={s.draft.transit_min} onChange={s.set('transit_min')}>
              {DAYS.map((d) => <option key={d} value={String(d)}>{d}</option>)}
            </select>
            <span>to</span>
            <select className={styles.select} data-num aria-label="Longest, in working days" value={s.draft.transit_max} onChange={s.set('transit_max')}>
              {DAYS.map((d) => <option key={d} value={String(d)}>{d}</option>)}
            </select>
            <span>working days</span>
          </span>
          <p className={styles.hint}>The longer figure is the one quoted: a date beaten is better than one missed.</p>
          {Number(s.draft.transit_min) > Number(s.draft.transit_max) && <p className={styles.failed}>The quickest is later than the longest.</p>}
        </div>
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
      state={set === 0 ? 'No surcharges set' : `${set} ${set === 1 ? 'surcharge' : 'surcharges'} set`}
      stateTone={set === 0 ? 'stateNeutral' : 'stateSaved'}
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
      preview={<VoicePreview v={s.draft} />}
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

const MAX_PARTS = 5;
const MAX_REFUSALS = 6;

function TextArea({ label, hint, rows = 4, ...rest }) {
  const id = useId();
  return (
    <div className={`${styles.field} ${styles.wide}`}>
      <label className={styles.label} htmlFor={id}>{label}</label>
      <span className={`${styles.control} ${styles.areaControl}`}>
        <textarea id={id} className={`${styles.input} ${styles.area}`} rows={rows} {...rest} />
      </span>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
    </div>
  );
}

// What a stranger reads first on About, and what the rest of the page holds.
function AboutPreview({ a }) {
  const parts = a.sections.filter((p) => p.heading.trim() || p.text.trim()).length;
  const refusals = a.refusals.filter((r) => r.no.trim()).length;
  return (
    <figure className={styles.preview}>
      <figcaption className={styles.previewLabel}>The top of the About page</figcaption>
      <div className={styles.heroPreview}>
        {a.title.trim()
          ? <p className={styles.heroTitle}>{a.title}</p>
          : <p className={styles.heroEmpty}>Without a heading the page reads About and the shop name.</p>}
        {a.lede.trim() && <p className={styles.aboutLede}>{a.lede}</p>}
      </div>
      <ul className={styles.aboutCount}>
        <li>{parts === 1 ? '1 section' : `${parts} sections`}</li>
        <li>{refusals === 1 ? '1 thing you will not do' : `${refusals} things you will not do`}</li>
        <li data-missing={!a.her_words.trim() || undefined}>{a.her_words.trim() ? 'Who runs it, in your words' : 'Who runs it: not written, so not shown'}</li>
      </ul>
    </figure>
  );
}

/*
 * About, in her words.
 *
 * Every line on that page comes from here. A section left empty is left off
 * the page rather than filled with something she did not write, and Who runs
 * it stays hidden until she writes it.
 */
function About({ initial, onSave }) {
  const s = useSection(initial);
  const { draft } = s;
  const edit = (list, i, key) => (e) => {
    const next = draft[list].map((row, n) => (n === i ? { ...row, [key]: e.target.value } : row));
    s.patch({ [list]: next });
  };
  const add = (list, blank) => s.patch({ [list]: [...draft[list], blank] });
  const drop = (list, i) => s.patch({ [list]: draft[list].filter((_, n) => n !== i) });

  return (
    <Section
      id="about"
      title="About page"
      note="The page a stranger reads before trusting the shop. It never shows your address; the legal pages carry that."
      state={!draft.her_words.trim() ? 'Who runs it not written' : null}
      stateTone="stateNeutral"
      preview={<AboutPreview a={draft} />}
    >
      <div className={styles.fields}>
        <Field label="Heading" wide value={draft.title} onChange={s.set('title')} placeholder="A general store, not a niche." />
        <TextArea label="Opening line" rows={3} value={draft.lede} onChange={s.set('lede')} hint="One or two sentences under the heading. The largest text on the page after it." />
      </div>

      <div className={styles.group}>
        <p className={styles.groupLabel}>Sections</p>
        {draft.sections.map((p, i) => (
          <div key={i} className={styles.groupRow}>
            <Field label={`Section ${i + 1} heading`} wide value={p.heading} onChange={edit('sections', i, 'heading')} />
            <TextArea label={`Section ${i + 1} text`} rows={5} value={p.text} onChange={edit('sections', i, 'text')} hint="A blank line starts a new paragraph." />
            <button type="button" className={styles.quiet} onClick={() => drop('sections', i)}>Remove section {i + 1}</button>
          </div>
        ))}
        {draft.sections.length < MAX_PARTS && (
          <button type="button" className={styles.quiet} onClick={() => add('sections', { heading: '', text: '' })}>Add a section</button>
        )}
      </div>

      <div className={styles.group}>
        <p className={styles.groupLabel}>What you will not do</p>
        <p className={styles.hint}>Each one is crossed out on the page as it scrolls into view.</p>
        {draft.refusals.map((r, i) => (
          <div key={i} className={styles.groupRow}>
            <div className={styles.fields}>
              <Field label="You will not" value={r.no} onChange={edit('refusals', i, 'no')} placeholder="Make you create an account." />
              <TextArea label="Because" rows={2} value={r.why} onChange={edit('refusals', i, 'why')} />
            </div>
            <button type="button" className={styles.quiet} onClick={() => drop('refusals', i)}>Remove this one</button>
          </div>
        ))}
        {draft.refusals.length < MAX_REFUSALS && (
          <button type="button" className={styles.quiet} onClick={() => add('refusals', { no: '', why: '' })}>Add another</button>
        )}
      </div>

      <div className={styles.fields}>
        <TextArea label="Who runs it" rows={4} value={draft.her_words} onChange={s.set('her_words')} hint="Two or three sentences in your own words: who you are and why you started this. Stays off the page until written." />
        <Field label="Last section heading" wide value={draft.closing_heading} onChange={s.set('closing_heading')} placeholder="If something goes wrong" />
        <TextArea label="Last section text" rows={4} value={draft.closing_text} onChange={s.set('closing_text')} />
      </div>

      <Save section={s} onSave={onSave} label="Save About page" />
    </Section>
  );
}
