import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import { ArrowRightIcon, LockIcon, ReturnIcon, ShieldIcon } from '@components/ui/store/icons';
import { useBasket } from '@context/BasketContext';
import { sessionId, trackBeginCheckout } from '@lib/analytics';
import { ZONE_LABELS, checkPostcode, normalisePostcode } from '@lib/postcode';
import { deliveryFor, returnsTerms } from '@lib/storeConfig';
import { useQuote } from '@hooks/useQuote';
import { startCheckout } from '@lib/checkout';
import { readOffer } from '@lib/threads';
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

// The details survive going back to the basket.
//
// Everything here is state, so leaving the page unmounts it and somebody who
// went back to add one more thing retypes an address. Local storage only, the
// same as the basket: no account, no server, their own device, and cleared as
// soon as the order is placed.
//
// The note is not kept. It is about one order, and a message meant for last
// week's parcel reappearing on this one is worse than retyping it.
//
// Never cleared. A declined card returns them here and the address has to still
// be there, and the shop has no accounts, so this is the only thing that makes a
// second order quicker than a first.
const FORM_KEY = 'ck.checkout.v1';

const EMPTY = {
  name: '', email: '', phone: '', line1: '', line2: '', city: '', postcode: '', note: '',
};

function readForm() {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = window.localStorage.getItem(FORM_KEY);
    const saved = raw ? JSON.parse(raw) : null;
    // Only the keys this form has. Anything else in there is an older shape or
    // a hand edit, and merging it blind puts unknown fields into the payload.
    return saved && typeof saved === 'object'
      ? { ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, String(saved[k] ?? '')])), note: '' }
      : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function CheckoutPage() {
  const { lines: basketLines, subtotal: basketSubtotal, count: basketCount, markPaying } = useBasket();

  /*
   * Two ways to arrive here.
   *
   * The basket, or a price she agreed in a conversation. An agreed price is an
   * offer id and the token of the conversation it was given in, both in the
   * address, because the link came out of an email and has to survive being
   * forwarded to the device somebody actually pays on.
   *
   * The basket is left alone in that case. Somebody who took a price on three
   * things should not come back later to find their basket rearranged by it.
   */
  const [params] = useSearchParams();
  const offerId = params.get('offer');
  const offerToken = params.get('token') ?? '';

  const [offer, setOffer] = useState(offerId ? undefined : null);

  useEffect(() => {
    if (!offerId) return;
    readOffer(offerId, offerToken)
      .then((data) => setOffer(data.offer))
      .catch((e) => setOffer({ error: e.message }));
  }, [offerId, offerToken]);

  const onOffer = Boolean(offer && !offer.error);

  /*
   * What is being bought, and what it comes to.
   *
   * On an offer both come off the agreement rather than off the basket. The
   * figure below is still only what the page shows: the checkout function
   * reads the same record again and prices from it, so nothing here can name a
   * total.
   */
  const asked = onOffer
    ? offer.lines.map((l) => ({
      id: l.product_id,
      variantId: l.variant_id,
      title: l.variant_label ? `${l.title}, ${l.variant_label}` : l.title,
      image_url: l.image_url,
      qty: l.qty,
      price: l.price,
    }))
    : basketLines;

  const [form, setForm] = useState(readForm);
  const [quotedPostcode, setQuotedPostcode] = useState(null);

  // Figures from the checkout function, the same code that charges the card.
  const { quote, error: quoteError, changed } = useQuote(offer === undefined || offer?.error ? [] : asked, {
    postcode: quotedPostcode,
    offerId: onOffer ? offer.id : null,
    token: onOffer ? offerToken : null,
  });

  // The basket's own lines, which the quote has already corrected to today's prices.
  const lines = asked;
  const count = onOffer ? lines.reduce((n, l) => n + l.qty, 0) : basketCount;
  const gone = quote?.unavailable ?? [];

  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);
  const [zone, setZone] = useState('mainland');
  const [checking, setChecking] = useState(false);
  const [postcodeNote, setPostcodeNote] = useState(null);

  useEffect(() => {
    try {
      const { note, ...keep } = form;
      window.localStorage.setItem(FORM_KEY, JSON.stringify(keep));
    } catch {
      // Private mode or a full quota. Failing to remember an address must never
      // stop somebody entering one.
    }
  }, [form]);

  // The basket's own arithmetic only stands in if the quote could not be fetched; the server still prices the order.
  const fallback = deliveryFor(onOffer ? Number(offer.price) : basketSubtotal, zone);
  const subtotal = quote ? quote.subtotal : (onOffer ? Number(offer.price) : basketSubtotal);
  const delivery = quote ? quote.delivery : fallback.cost;
  const total = quote ? quote.total : fallback.total;
  const surcharge = quote ? quote.surcharge : fallback.surcharge;
  const ready = Boolean(quote) || Boolean(quoteError);
  const days = Number(returnsTerms().days);

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
    setQuotedPostcode(result.ok ? result.postcode : null);

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

  // A postcode remembered from last time is checked once on arrival, so its zone and delivery are right before anyone types.
  useEffect(() => {
    if (form.postcode.trim()) onPostcodeBlur();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const { url, reference } = await startCheckout({
        // Carried on the order rather than stored on the device, which is what
        // lets a purchase be attributed to the visit that produced it without
        // a cookie and without a consent banner.
        sessionId: sessionId(),
        /*
         * The variant travels with the line.
         *
         * This sent the product id alone, which merged two sizes of one thing
         * into a single line of the summed quantity, charged the product price
         * rather than the variant's, and left order_items.variant_id null so
         * the stock came off the product instead of the size. The checkout
         * function has handled variants correctly since 0058 and was never
         * being told about them.
         */
        items: lines.map((l) => ({ id: l.id, variantId: l.variantId ?? null, qty: l.qty })),
        // Read back out of the offer record on the other side. Sent so the
        // function knows which agreement to price against, never as a figure.
        offerId: onOffer ? offer.id : null,
        token: onOffer ? offerToken : null,
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
      // Remembered so only this order empties the basket; an agreed price leaves it alone.
      if (!onOffer) markPaying(reference);
      // A full navigation, not the router. Stripe is another origin.
      window.location.assign(url);
    } catch (err) {
      setFailure(err.message);
      setBusy(false);
    }
  }

  // Fetching the agreement. Nothing is rendered against a basket that is about
  // to be replaced by it.
  if (offer === undefined) {
    return (
      <section className={styles.page}>
        <Head title="Checkout" description="Checkout." path="/checkout" noindex />
        <p className={styles.emptyBody} role="status">Reading the price you were given</p>
      </section>
    );
  }

  if (offer?.error) {
    return (
      <section className={styles.page}>
        <Head title="Checkout" description="Checkout." path="/checkout" noindex />
        <div className={styles.empty}>
          <h1 className={`${styles.emptyTitle} wide`}>That price has gone</h1>
          <p className={styles.emptyBody}>{offer.error}</p>
          <Link className={styles.emptyCta} to={STORE_ROUTES.HOME}>Back to the shop</Link>
        </div>
      </section>
    );
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
        {!onOffer && <Link className={styles.backToCart} to={STORE_ROUTES.CART}>Back to basket</Link>}
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

          {gone.length > 0 && (
            <p className={styles.failure} role="alert">
              {gone.length === 1 && gone[0].name ? `${gone[0].name} is` : 'Some things in your basket are'} no longer
              on sale. <Link to={STORE_ROUTES.CART}>Remove {gone.length === 1 ? 'it' : 'them'} in your basket</Link> to carry on.
            </p>
          )}

          {changed.length > 0 && (
            <p className={styles.zoneNote} data-tone="surcharge">
              {changed.length === 1 ? `The price of ${changed[0]} has changed` : 'Some prices have changed'} since
              you added it. The total shown is what you will pay.
            </p>
          )}

          {failure && (
            <p className={styles.failure} role="alert">
              {failure}
            </p>
          )}

          <button type="submit" className={styles.pay} disabled={busy || !ready || gone.length > 0}>
            {busy ? 'Taking you to Stripe'
              : !ready ? 'Checking prices'
                : <>Pay {formatGbp(total)} <ArrowRightIcon size={17} /></>}
          </button>

          <p className={styles.stripeNote}>
            <ShieldIcon size={16} />
            Payment is taken by Stripe on their own page. Your card details never
            reach this shop.
          </p>
        </form>

        <aside className={styles.summary}>
          <h2 className={styles.summaryHead}>{count} {count === 1 ? 'item' : 'items'}</h2>

          {/* Said once, plainly, and with no second figure beside it. The
              lines below are what she agreed a price for, and the total is
              that price. Nothing here compares it to anything. */}
          {onOffer && (
            <p className={styles.agreed}>
              This is the price you were given in your conversation with the shop.
            </p>
          )}

          <ul className={styles.lines}>
            {/* Keyed on the line rather than the product, or two sizes of one
                thing collide. */}
            {lines.map((line) => (
              <li key={line.variantId ? `${line.id}:${line.variantId}` : line.id}>
                <span className={styles.thumb}>
                  {line.image_url
                    ? <img src={imageAt(line.image_url, 300)} alt="" loading="lazy" />
                    : <span className={styles.noImage} />}
                  <span className={styles.qty} data-price>{line.qty}</span>
                </span>
                <span className={styles.lineTitle}>{line.variantLabel ? `${line.title}, ${line.variantLabel}` : line.title}</span>
                <span className={styles.lineTotal} data-price>{formatGbp(line.price * line.qty)}</span>
              </li>
            ))}
          </ul>

          <dl className={styles.figures}>
            <div>
              <dt>{onOffer ? 'Agreed price' : 'Subtotal'}</dt>
              <dd data-price>{formatGbp(subtotal)}</dd>
            </div>
            <div>
              <dt>Delivery{surcharge > 0 && <span className={styles.zoneTag}>{ZONE_LABELS[zone]}</span>}</dt>
              <dd data-price>{delivery === 0 ? 'Free' : formatGbp(delivery)}</dd>
            </div>
            <div className={styles.grand}><dt>To pay</dt><dd data-price>{formatGbp(total)}</dd></div>
          </dl>

          <ul className={styles.reassure}>
            <li><LockIcon size={16} /><span>No account needed</span></li>
            {days > 0 && <li><ReturnIcon size={16} /><span>{days} {days === 1 ? 'day' : 'days'} to change your mind</span></li>}
          </ul>
        </aside>
      </div>
    </section>
  );
}
