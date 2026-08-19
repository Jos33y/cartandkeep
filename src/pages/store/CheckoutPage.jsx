import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import { ArrowRightIcon, LockIcon, ReturnIcon, ShieldIcon } from '@components/ui/store/icons';
import { useBasket } from '@context/BasketContext';
import { sessionId, trackBeginCheckout } from '@lib/analytics';
import { ZONE_LABELS, checkPostcode, normalisePostcode } from '@lib/postcode';
import { deliveryFor } from '@lib/storeConfig';
import { startCheckout } from '@lib/checkout';
import { imageAt } from '@utils/categories';
import { formatGbp } from '@utils/formatGbp';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/pages/store/checkout-page.module.css';

/*
 * One page, three blocks, no steps.
 *
 * A step indicator on a three field form is a progress bar for a journey
 * nobody was worried about. Contact, delivery, pay, and the pay button leaves
 * for Stripe.
 *
 * Nothing here handles a card. Stripe Checkout does that on its own domain,
 * which is why the privacy page can say card details never reach us and mean
 * it.
 */
const FIELDS = {
  name: 'Full name',
  email: 'Email',
  phone: 'Phone, optional',
  line1: 'Address',
  line2: 'Address line 2, optional',
  city: 'Town or city',
  postcode: 'Postcode',
};

export function CheckoutPage() {
  const { lines, subtotal, count } = useBasket();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '', email: '', phone: '', line1: '', line2: '', city: '', postcode: '', note: '',
  });
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);
  const [zone, setZone] = useState('mainland');
  const [checking, setChecking] = useState(false);
  const [postcodeNote, setPostcodeNote] = useState(null);

  // Recomputed from the zone, so the figure in the summary is the figure the
  // checkout function will charge. They read the same tenant row.
  const quote = deliveryFor(subtotal, zone);
  const delivery = quote.cost;
  const total = quote.total;

  const set = (key) => (event) => {
    setForm((f) => ({ ...f, [key]: event.target.value }));
    // Cleared as soon as they start fixing it, rather than on the next
    // submit. An error that stays while you correct it reads as broken.
    if (errors[key]) setErrors((e) => ({ ...e, [key]: null }));
  };

  /*
   * Checked when they leave the field, not as they type.
   *
   * A lookup on every keystroke is six wasted requests and a message that
   * flickers "not a valid postcode" while somebody is halfway through typing a
   * valid one.
   */
  async function onPostcodeBlur() {
    const raw = form.postcode.trim();
    if (!raw) return;

    setChecking(true);
    setPostcodeNote(null);

    const result = await checkPostcode(raw);
    setChecking(false);

    setForm((f) => ({ ...f, postcode: result.postcode }));
    setZone(result.zone);

    if (!result.ok) {
      setErrors((e) => ({
        ...e,
        postcode: result.reason === 'unknown'
          ? 'We cannot find that postcode. Check it and try again.'
          : 'That does not look like a UK postcode.',
      }));
      return;
    }

    setErrors((e) => ({ ...e, postcode: null }));

    const zoneQuote = deliveryFor(subtotal, result.zone);
    if (zoneQuote.blocked) {
      setPostcodeNote({
        tone: 'blocked',
        text: `We cannot deliver to the ${ZONE_LABELS[result.zone]} yet. They sit outside the UK customs area and we are not set up to export. Write to us and we will tell you when that changes.`,
      });
    } else if (zoneQuote.surcharge > 0) {
      setPostcodeNote({
        tone: 'surcharge',
        text: `${ZONE_LABELS[result.zone]}. Delivery there costs us more, so there is a surcharge on this order${zoneQuote.extraDays ? `, and it takes about ${zoneQuote.extraDays} day${zoneQuote.extraDays === 1 ? '' : 's'} longer` : ''}.`,
      });
    } else if (result.zone !== 'mainland') {
      setPostcodeNote({
        tone: 'note',
        text: `${ZONE_LABELS[result.zone]}${zoneQuote.extraDays ? `. Allow about ${zoneQuote.extraDays} day${zoneQuote.extraDays === 1 ? '' : 's'} longer than the mainland` : ''}.`,
      });
    }
  }

  function validate() {
    const next = {};
    if (!form.name.trim()) next.name = 'We need a name for the parcel';
    if (!form.email.trim()) next.email = 'We need an email to send the confirmation to';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'That address does not look right';
    if (!form.line1.trim()) next.line1 = 'We need somewhere to send it';
    if (!form.city.trim()) next.city = 'We need a town or city';
    if (!form.postcode.trim()) next.postcode = 'We need a postcode';
    else if (deliveryFor(subtotal, zone).blocked) {
      next.postcode = `We cannot deliver to the ${ZONE_LABELS[zone]} yet`;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event) {
    event.preventDefault();
    setFailure(null);
    if (!validate()) {
      // Focus goes to the first thing wrong. Scrolling somebody to the top of
      // a form and letting them find it is how a checkout gets abandoned.
      const first = document.querySelector(`[data-field][aria-invalid="true"]`);
      first?.focus();
      return;
    }

    setBusy(true);
    trackBeginCheckout(subtotal, count);

    try {
      const { url } = await startCheckout({
        // Carried on the order rather than stored on the device, which is what
        // lets a purchase be attributed to the visit that produced it without
        // a cookie and without a consent banner.
        sessionId: sessionId(),
        items: lines.map((l) => ({ id: l.id, qty: l.qty })),
        contact: {
          zone,
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          note: form.note.trim() || null,
          address: {
            line1: form.line1.trim(),
            line2: form.line2.trim() || null,
            city: form.city.trim(),
            postcode: normalisePostcode(form.postcode),
            country: 'GB',
          },
        },
        returnTo: window.location.origin,
      });
      // A full navigation, not the router. Stripe is another origin.
      window.location.assign(url);
    } catch (err) {
      setFailure(err.message);
      setBusy(false);
    }
  }

  if (lines.length === 0) {
    return (
      <section className={styles.page}>
        <Head title="Checkout" description="Checkout." path="/checkout" noindex />
        <div className={styles.empty}>
          <h1 className={`${styles.emptyTitle} wide`}>There is nothing to pay for</h1>
          <p className={styles.emptyBody}>Your basket is empty.</p>
          <Link className={styles.emptyCta} to={STORE_ROUTES.HOME}>Find something first</Link>
        </div>
      </section>
    );
  }

  const field = (key, type = 'text', autoComplete = undefined) => (
    <label className={styles.field} key={key}>
      <span className={styles.label}>{FIELDS[key]}</span>
      <input
        data-field
        type={type}
        value={form[key]}
        onChange={set(key)}
        autoComplete={autoComplete}
        aria-invalid={Boolean(errors[key])}
        aria-describedby={errors[key] ? `err-${key}` : undefined}
        enterKeyHint="next"
      />
      {errors[key] && <span className={styles.error} id={`err-${key}`}>{errors[key]}</span>}
    </label>
  );

  return (
    <section className={styles.page}>
      <Head title="Checkout" description="Checkout." path="/checkout" noindex />

      <header className={styles.head}>
        <h1 className={`${styles.title} wide`}>Checkout</h1>
        <Link className={styles.backToCart} to={STORE_ROUTES.CART}>Back to basket</Link>
      </header>

      <div className={styles.body}>
        <form className={styles.form} onSubmit={submit} noValidate>
          <fieldset className={styles.block} disabled={busy}>
            <legend className={styles.legend}>Who we are sending it to</legend>
            {field('name', 'text', 'name')}
            {field('email', 'email', 'email')}
            {field('phone', 'tel', 'tel')}
          </fieldset>

          <fieldset className={styles.block} disabled={busy}>
            <legend className={styles.legend}>Where</legend>
            {field('line1', 'text', 'address-line1')}
            {field('line2', 'text', 'address-line2')}
            <div className={styles.pair}>
              {field('city', 'text', 'address-level2')}

              <label className={styles.field}>
                <span className={styles.label}>
                  {FIELDS.postcode}
                  {checking && <span className={styles.checking}> checking</span>}
                </span>
                <input
                  data-field
                  type="text"
                  value={form.postcode}
                  onChange={set('postcode')}
                  onBlur={onPostcodeBlur}
                  autoComplete="postal-code"
                  spellCheck="false"
                  aria-invalid={Boolean(errors.postcode)}
                  aria-describedby={errors.postcode ? 'err-postcode' : undefined}
                  className={styles.postcode}
                />
                {errors.postcode && <span className={styles.error} id="err-postcode">{errors.postcode}</span>}
              </label>
            </div>

            {postcodeNote && (
              <p className={styles.zoneNote} data-tone={postcodeNote.tone}>{postcodeNote.text}</p>
            )}
            <p className={styles.hint}>UK addresses only for now.</p>
          </fieldset>

          <fieldset className={styles.block} disabled={busy}>
            <legend className={styles.legend}>Anything we should know</legend>
            <label className={styles.field}>
              <span className={styles.label}>Delivery notes, optional</span>
              <textarea rows={3} value={form.note} onChange={set('note')} />
            </label>
          </fieldset>

          {failure && (
            <p className={styles.failure} role="alert">
              {failure}
            </p>
          )}

          <button type="submit" className={styles.pay} disabled={busy}>
            {busy ? 'Taking you to Stripe' : <>Pay {formatGbp(total)} <ArrowRightIcon size={17} /></>}
          </button>

          <p className={styles.stripeNote}>
            <ShieldIcon size={16} />
            Payment is taken by Stripe on their own page. Your card details never
            reach this shop.
          </p>
        </form>

        <aside className={styles.summary}>
          <h2 className={styles.summaryHead}>{count} {count === 1 ? 'item' : 'items'}</h2>

          <ul className={styles.lines}>
            {lines.map((line) => (
              <li key={line.id}>
                <span className={styles.thumb}>
                  {line.image_url
                    ? <img src={imageAt(line.image_url, 300)} alt="" loading="lazy" />
                    : <span className={styles.noImage} />}
                  <span className={styles.qty} data-price>{line.qty}</span>
                </span>
                <span className={styles.lineTitle}>{line.title}</span>
                <span className={styles.lineTotal} data-price>{formatGbp(line.price * line.qty)}</span>
              </li>
            ))}
          </ul>

          <dl className={styles.figures}>
            <div><dt>Subtotal</dt><dd data-price>{formatGbp(subtotal)}</dd></div>
            <div>
              <dt>Delivery{quote.surcharge > 0 && <span className={styles.zoneTag}>{ZONE_LABELS[zone]}</span>}</dt>
              <dd data-price>{delivery === 0 ? 'Free' : formatGbp(delivery)}</dd>
            </div>
            <div className={styles.grand}><dt>To pay</dt><dd data-price>{formatGbp(total)}</dd></div>
          </dl>

          <ul className={styles.reassure}>
            <li><LockIcon size={16} /><span>No account needed</span></li>
            <li><ReturnIcon size={16} /><span>30 days to change your mind</span></li>
          </ul>
        </aside>
      </div>
    </section>
  );
}
