import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import { ArrowRightIcon, GiftIcon, PersonIcon, PlusIcon, ShieldIcon, WalletIcon } from '@components/ui/store/icons';
import { BasketPromises, basketArrival } from '@components/ui/store/BasketTotals';
import { ParcelLabel } from '@components/ui/store/checkout/ParcelLabel';
import { PhoneField } from '@components/ui/store/checkout/PhoneField';
import { useBasket } from '@context/BasketContext';
import { sessionId, trackBeginCheckout } from '@lib/analytics';
import { ZONE_LABELS, checkPostcode, normalisePostcode } from '@lib/postcode';
import { deliveryFor, freeOver } from '@lib/storeConfig';
import { isUkPhone, toE164 } from '@lib/phone';
import { initialForm, readSaved, rememberBuyer, saveDraft } from '@lib/checkoutDraft';
import { useQuote } from '@hooks/useQuote';
import { startCheckout, startExpress } from '@lib/checkout';
import { readOffer } from '@lib/threads';
import { formatGbp } from '@utils/formatGbp';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/pages/store/checkout-page.module.css';

/*
 * One page, no steps, and the parcel label beside it.
 *
 * Who it is for comes first, because everything else depends on it: a gift
 * needs a second name and a second address, and must never go to the buyer's
 * own door by accident. The label on the right is written as they type, so
 * the address being checked is the address that will be stuck on the box.
 *
 * Nothing here handles a card. Stripe does that on its own page, which is why
 * the privacy page can say card details never reach the shop and mean it.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MESSAGE_MAX = 300;

export function CheckoutPage() {
  const { lines: basketLines, subtotal: basketSubtotal, count: basketCount, markPaying } = useBasket();

  /*
   * Two ways to arrive here: the basket, or a price she agreed in a
   * conversation, carried as an offer id and the conversation's token so the
   * link survives being forwarded to the device somebody actually pays on.
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

  const asked = onOffer
    ? offer.lines.map((l) => ({
      id: l.product_id,
      variantId: l.variant_id,
      title: l.title,
      variantLabel: l.variant_label ?? null,
      image_url: l.image_url,
      qty: l.qty,
      price: l.price,
    }))
    : basketLines;

  const saved = useMemo(() => readSaved(), []);
  const [form, setForm] = useState(initialForm);
  const [quotedPostcode, setQuotedPostcode] = useState(null);

  // Figures from the checkout function, the same code that charges the card.
  const { quote, error: quoteError, was } = useQuote(offer === undefined || offer?.error ? [] : asked, {
    postcode: quotedPostcode,
    offerId: onOffer ? offer.id : null,
    token: onOffer ? offerToken : null,
  });

  const lines = asked;
  const count = onOffer ? lines.reduce((n, l) => n + l.qty, 0) : basketCount;
  const gone = quote?.unavailable ?? [];

  const [showLine2, setShowLine2] = useState(() => Boolean(initialForm().line2));
  const [showNote, setShowNote] = useState(() => Boolean(initialForm().note));
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);
  const [zone, setZone] = useState('mainland');
  const [checking, setChecking] = useState(false);
  const [postcodeNote, setPostcodeNote] = useState(null);
  const [townHint, setTownHint] = useState(null);

  useEffect(() => { saveDraft(form); }, [form]);

  const gift = form.forWhom === 'gift';
  const usingSaved = !gift && form.addressChoice === 'saved' && Boolean(saved?.address);
  const choosing = !gift && Boolean(saved?.address) && form.addressChoice === null;
  const address = usingSaved
    ? saved.address
    : { line1: form.line1.trim(), line2: form.line2.trim(), city: form.city.trim(), postcode: form.postcode.trim() };

  // The basket's own arithmetic only stands in if the quote could not be fetched; the server still prices the order.
  const fallback = deliveryFor(onOffer ? Number(offer.price) : basketSubtotal, zone);
  const figures = quote
    ? { subtotal: quote.subtotal, delivery: quote.delivery, total: quote.total, toFree: onOffer ? 0 : quote.toFree, freeOver: quote.freeOver, surcharge: quote.surcharge, zone }
    : { subtotal: fallback.total - fallback.cost, delivery: fallback.cost, total: fallback.total, toFree: onOffer ? 0 : fallback.toFree, freeOver: freeOver(), surcharge: fallback.surcharge, zone };
  const ready = Boolean(quote) || Boolean(quoteError);
  const arrival = quote && !gone.length ? basketArrival(quote.lines, zone) : null;
  const expressOn = !onOffer && !gift && quote?.express === true && !gone.length;

  const put = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    // Cleared as they start fixing it: an error that stays while you correct it reads as broken.
    if (errors[key]) setErrors((e) => ({ ...e, [key]: null }));
  };
  const set = (key) => (event) => put(key, event.target.value);
  const fail = (key) => (message) => setErrors((e) => ({ ...e, [key]: message }));

  /*
   * Checked when they leave the field, not as they type: a lookup per key is
   * six wasted requests and a message that flickers while a valid postcode is
   * still being typed.
   */
  async function checkAddressPostcode(raw, { quiet = false } = {}) {
    const value = String(raw ?? '').trim();
    if (!value) return;
    setChecking(true);
    setPostcodeNote(null);
    const result = await checkPostcode(value);
    setChecking(false);

    if (!quiet) setForm((f) => ({ ...f, postcode: result.postcode }));
    setZone(result.zone);
    setQuotedPostcode(result.ok ? result.postcode : null);
    setTownHint(result.ok ? result.town ?? null : null);

    if (!result.ok) {
      if (!quiet) {
        setErrors((e) => ({
          ...e,
          postcode: result.reason === 'unknown'
            ? 'We cannot find that postcode. Check it and try again.'
            : 'That does not look like a UK postcode.',
        }));
      }
      return;
    }
    setErrors((e) => ({ ...e, postcode: null }));

    const zoneQuote = deliveryFor(figures.subtotal, result.zone);
    if (zoneQuote.blocked) {
      setPostcodeNote({ tone: 'blocked', text: `We cannot deliver to the ${ZONE_LABELS[result.zone]} yet. They sit outside the UK customs area and we are not set up to export.` });
    } else if (zoneQuote.surcharge > 0) {
      setPostcodeNote({ tone: 'surcharge', text: `${ZONE_LABELS[result.zone]}. Delivery there costs us more, so there is a surcharge${zoneQuote.extraDays ? `, and it takes about ${zoneQuote.extraDays} day${zoneQuote.extraDays === 1 ? '' : 's'} longer` : ''}.` });
    } else if (result.zone !== 'mainland') {
      setPostcodeNote({ tone: 'note', text: `${ZONE_LABELS[result.zone]}${zoneQuote.extraDays ? `. Allow about ${zoneQuote.extraDays} day${zoneQuote.extraDays === 1 ? '' : 's'} longer than the mainland` : ''}.` });
    }
  }

  // The postcode that decides delivery is whichever address is in use, checked as soon as it is.
  useEffect(() => {
    if (usingSaved) checkAddressPostcode(saved.address.postcode, { quiet: true });
    else if (form.postcode.trim()) checkAddressPostcode(form.postcode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usingSaved]);

  function validate() {
    const next = {};
    if (!form.name.trim()) next.name = gift ? 'We need your name for the receipt' : 'We need a name for the parcel';
    if (!form.email.trim()) next.email = 'We need an email to send the receipt to';
    else if (!EMAIL.test(form.email.trim())) next.email = 'That address does not look right';
    if (form.phone.trim() && !isUkPhone(form.phone)) next.phone = 'That does not look like a UK number. Mobiles start 07.';

    if (gift) {
      if (!form.rName.trim()) next.rName = 'We need their name for the label';
      if (form.rPhone.trim() && !isUkPhone(form.rPhone)) next.rPhone = 'That does not look like a UK number. Mobiles start 07.';
      if (form.notify && !EMAIL.test(form.rEmail.trim())) next.rEmail = 'We need their email to tell them, or untick the box';
      if (form.message.length > MESSAGE_MAX) next.message = `Keep it under ${MESSAGE_MAX} characters`;
    }

    if (choosing) next.addressChoice = 'Choose where it is going';
    else if (!usingSaved) {
      if (!form.line1.trim()) next.line1 = 'We need a street and number';
      if (!form.city.trim()) next.city = 'We need a town or city';
      if (!form.postcode.trim()) next.postcode = 'We need a postcode';
    }
    if (!next.postcode && deliveryFor(figures.subtotal, zone).blocked) next.postcode = `We cannot deliver to the ${ZONE_LABELS[zone]} yet`;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  const items = () => lines.map((l) => ({ id: l.id, variantId: l.variantId ?? null, qty: l.qty }));

  async function submit(event) {
    event.preventDefault();
    setFailure(null);
    if (!validate()) {
      // Focus goes to the first thing wrong, rather than leaving them to find it.
      requestAnimationFrame(() => document.querySelector('[data-field][aria-invalid="true"]')?.focus());
      return;
    }

    setBusy(true);
    trackBeginCheckout(figures.subtotal, count);

    const delivery = {
      line1: address.line1,
      line2: address.line2 || null,
      city: address.city,
      postcode: normalisePostcode(address.postcode),
      country: 'GB',
    };

    try {
      const { url, reference } = await startCheckout({
        // Carried on the order so a purchase can be tied to the visit that produced it, without a cookie.
        sessionId: sessionId(),
        items: items(),
        offerId: onOffer ? offer.id : null,
        token: onOffer ? offerToken : null,
        contact: {
          zone,
          name: form.name.trim(),
          email: form.email.trim(),
          phone: toE164(form.phone),
          note: form.note.trim() || null,
          address: delivery,
          gift: gift ? {
            recipientName: form.rName.trim(),
            recipientPhone: toE164(form.rPhone),
            message: form.message.trim() || null,
            notify: form.notify,
            recipientEmail: form.notify ? form.rEmail.trim() : null,
          } : null,
        },
        returnTo: window.location.origin,
      });
      rememberBuyer(form, gift ? null : { line1: delivery.line1, line2: delivery.line2 ?? '', city: delivery.city, postcode: delivery.postcode });
      // Remembered so only this order empties the basket; an agreed price leaves it alone.
      if (!onOffer) markPaying(reference);
      window.location.assign(url);
    } catch (err) {
      setFailure(err.message);
      setBusy(false);
    }
  }

  async function express() {
    setFailure(null);
    setBusy(true);
    trackBeginCheckout(figures.subtotal, count);
    try {
      const { url, reference } = await startExpress({ sessionId: sessionId(), items: items(), returnTo: window.location.origin });
      markPaying(reference);
      window.location.assign(url);
    } catch (err) {
      setFailure(err.message);
      setBusy(false);
    }
  }

  // Fetching the agreement. Nothing is rendered against a basket that is about to be replaced by it.
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

  // The label names the field and nothing else; the hint or error is linked, so it is read after the name, not as part of it.
  const input = (key, label, { type = 'text', autoComplete, hint, className, ...rest } = {}) => (
    <div className={`${styles.field} ${className ?? ''}`}>
      <label className={styles.label} htmlFor={`f-${key}`}>{label}</label>
      <input
        id={`f-${key}`}
        data-field
        type={type}
        value={form[key]}
        onChange={set(key)}
        autoComplete={autoComplete}
        aria-invalid={Boolean(errors[key])}
        aria-describedby={errors[key] || hint ? `err-${key}` : undefined}
        enterKeyHint="next"
        {...rest}
      />
      {errors[key]
        ? <span className={styles.error} id={`err-${key}`}>{errors[key]}</span>
        : hint ? <span className={styles.hint} id={`err-${key}`}>{hint}</span> : null}
    </div>
  );

  const payButton = (
    <button type="submit" form="checkout-form" className={styles.pay} disabled={busy || !ready || gone.length > 0}>
      {busy ? 'Taking you to Stripe'
        : !ready ? 'Checking prices'
          : <>Pay {formatGbp(figures.total)} <ArrowRightIcon size={17} /></>}
    </button>
  );

  const payNote = (
    <p className={styles.stripeNote}>
      <ShieldIcon size={15} />
      <span>You pay on Stripe&apos;s own page and come straight back here.</span>
    </p>
  );

  const problems = (
    <>
      {gone.length > 0 && (
        <p className={styles.failure} role="alert">
          {gone.length === 1 && gone[0].name ? `${gone[0].name} is` : 'Some things in your basket are'} no longer
          on sale. <Link to={STORE_ROUTES.CART}>Remove {gone.length === 1 ? 'it' : 'them'} in your basket</Link> to carry on.
        </p>
      )}
      {failure && <p className={styles.failure} role="alert">{failure}</p>}
    </>
  );

  return (
    <section className={styles.page}>
      <Head title="Checkout" description="Checkout." path="/checkout" noindex />

      <div className={styles.body}>
        <ParcelLabel
          gift={gift}
          deliverTo={(gift ? form.rName : form.name).trim()}
          from={form.name.trim().split(/\s+/)[0]}
          address={address}
          lines={lines}
          was={was}
          gone={gone}
          figures={figures}
          arrival={arrival}
          agreed={onOffer}
          count={count}
          dock={(
            <div className={styles.payInLabel}>
              {problems}
              {payButton}
              {payNote}
            </div>
          )}
        >
          <BasketPromises paying />
        </ParcelLabel>

        <form id="checkout-form" className={styles.form} onSubmit={submit} noValidate>
          <h1 className={`${styles.title} wide`}>Checkout</h1>

          <fieldset className={styles.who} disabled={busy}>
            <legend className={styles.whoLegend}>Who is it for?</legend>
            <div className={styles.whoGrid}>
            {[
              { value: 'me', Icon: PersonIcon, title: 'For me', text: 'Sent to your address' },
              { value: 'gift', Icon: GiftIcon, title: 'For someone else', text: 'A gift, no prices inside' },
            ].map(({ value, Icon, title, text }) => (
              <label key={value} className={styles.choice} data-on={form.forWhom === value || undefined}>
                <input type="radio" name="forWhom" value={value} checked={form.forWhom === value} onChange={() => put('forWhom', value)} />
                <Icon size={22} />
                <span className={styles.choiceText}><b>{title}</b><span>{text}</span></span>
              </label>
            ))}
            </div>
          </fieldset>

          {expressOn && (
            <div className={styles.express}>
              <button type="button" className={styles.expressButton} onClick={express} disabled={busy || !ready}>
                <WalletIcon size={20} />Express checkout
              </button>
              <p className={styles.expressNote}>Apple Pay, Google Pay or card on Stripe&apos;s page. Your wallet fills in the address, and you can change it there.</p>
              <p className={styles.or}><span>or fill in your details</span></p>
            </div>
          )}

          <fieldset className={styles.block} disabled={busy}>
            <legend className={styles.legend}>{gift ? 'From you' : 'Your details'}</legend>
            <div className={styles.fields}>
              {input('name', 'Full name', { autoComplete: 'name' })}
              <div className={styles.pairEven}>
                {input('email', 'Email', { type: 'email', autoComplete: 'email', inputMode: 'email', hint: 'Your receipt and tracking go here.' })}
                <PhoneField
                  label="Phone, optional"
                  value={form.phone}
                  onChange={(v) => put('phone', v)}
                  error={errors.phone}
                  onError={fail('phone')}
                  hint={gift ? 'Only if we need you about the order.' : 'For the courier, on the day only.'}
                />
              </div>
            </div>
          </fieldset>

          {gift && (
            <fieldset className={`${styles.block} ${styles.giftBlock}`} disabled={busy}>
              <legend className={styles.legend}>Who it is going to</legend>
              <div className={styles.fields}>
                <div className={styles.pairEven}>
                  {input('rName', 'Their full name', { autoComplete: 'off', hint: 'Printed on the label.' })}
                  <PhoneField
                    label="Their phone, optional"
                    value={form.rPhone}
                    onChange={(v) => put('rPhone', v)}
                    error={errors.rPhone}
                    onError={fail('rPhone')}
                    autoComplete="off"
                    hint="For the courier, if they need to reach them."
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="f-message">A message for the slip, optional</label>
                  <textarea
                    id="f-message"
                    aria-describedby="hint-message"
                    data-field
                    rows={3}
                    maxLength={MESSAGE_MAX}
                    value={form.message}
                    onChange={set('message')}
                    placeholder="Happy birthday. Thought of you the moment I saw it."
                    aria-invalid={Boolean(errors.message)}
                  />
                  <span className={styles.counter} id="hint-message"><span>Printed on the packing slip. No prices anywhere in the box.</span><span data-num>{form.message.length} / {MESSAGE_MAX}</span></span>
                </div>

                <label className={styles.tick}>
                  <input type="checkbox" checked={form.notify} onChange={(e) => put('notify', e.target.checked)} />
                  <span className={styles.tickBox} aria-hidden="true" />
                  <span><b>Let them know it is on its way</b><span>One email when it leaves us. It will not say what is inside.</span></span>
                </label>
                {form.notify && input('rEmail', 'Their email', { type: 'email', autoComplete: 'off', inputMode: 'email', hint: 'Used for that one email and nothing else.' })}
              </div>
            </fieldset>
          )}

          <fieldset className={styles.block} disabled={busy}>
            <legend className={styles.legend}>{gift ? 'Their address' : 'Where it is going'}</legend>
            <div className={styles.fields}>
              {!gift && saved?.address && (
                <div className={styles.addressChoices} role="radiogroup" aria-label="Where it is going" aria-invalid={Boolean(errors.addressChoice)}>
                  <label className={styles.addressChoice} data-on={form.addressChoice === 'saved' || undefined}>
                    <input data-field type="radio" name="addressChoice" checked={form.addressChoice === 'saved'} onChange={() => put('addressChoice', 'saved')} aria-invalid={Boolean(errors.addressChoice)} />
                    <span>
                      <b>{saved.address.line1}</b>
                      <span>{[saved.address.line2, saved.address.city, saved.address.postcode].filter(Boolean).join(', ')}</span>
                      <small>Where you had it sent last time</small>
                    </span>
                  </label>
                  <label className={styles.addressChoice} data-on={form.addressChoice === 'new' || undefined}>
                    <input type="radio" name="addressChoice" checked={form.addressChoice === 'new'} onChange={() => put('addressChoice', 'new')} />
                    <span><b>A different address</b><small>Type it in below</small></span>
                  </label>
                  {errors.addressChoice && <span className={styles.error}>{errors.addressChoice}</span>}
                </div>
              )}

              {(gift || !saved?.address || form.addressChoice === 'new') && (
                <>
                  <div className={`${styles.field} ${styles.postcodeField}`}>
                    <label className={styles.label} htmlFor="f-postcode">
                      Postcode{checking && <span className={styles.checking} aria-live="polite"> checking</span>}
                    </label>
                    <input
                      id="f-postcode"
                      data-field
                      type="text"
                      value={form.postcode}
                      onChange={set('postcode')}
                      onBlur={() => checkAddressPostcode(form.postcode)}
                      autoComplete={gift ? 'section-gift shipping postal-code' : 'shipping postal-code'}
                      spellCheck="false"
                      autoCapitalize="characters"
                      aria-invalid={Boolean(errors.postcode)}
                      aria-describedby={errors.postcode ? 'err-postcode' : undefined}
                      className={styles.postcode}
                    />
                    {errors.postcode && <span className={styles.error} id="err-postcode">{errors.postcode}</span>}
                  </div>

                  {input('line1', 'Street and number', { autoComplete: gift ? 'section-gift shipping address-line1' : 'shipping address-line1' })}
                  {showLine2 || form.line2
                    ? input('line2', 'Flat, floor or building, optional', { autoComplete: gift ? 'section-gift shipping address-line2' : 'shipping address-line2' })
                    : (
                      <button type="button" className={styles.reveal} onClick={() => setShowLine2(true)}>
                        <PlusIcon size={14} />Add a flat, floor or building
                      </button>
                    )}
                  {input('city', 'Town or city', { autoComplete: gift ? 'section-gift shipping address-level2' : 'shipping address-level2' })}
                  {townHint && !form.city.trim() && (
                    <button type="button" className={styles.suggest} onClick={() => put('city', townHint)}>
                      Use {townHint}?
                    </button>
                  )}
                </>
              )}

              {postcodeNote && <p className={styles.zoneNote} data-tone={postcodeNote.tone}>{postcodeNote.text}</p>}

              {showNote || form.note ? (
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="f-note">A note for the courier, optional</label>
                  <textarea id="f-note" rows={2} value={form.note} onChange={set('note')} placeholder="Leave it with the neighbour at number 12" />
                </div>
              ) : (
                <button type="button" className={styles.reveal} onClick={() => setShowNote(true)}>
                  <PlusIcon size={14} />Add a note for the courier
                </button>
              )}
              <p className={styles.hint}>UK addresses only for now.</p>
            </div>
          </fieldset>

          <div className={styles.payInForm}>
            {problems}
            {payButton}
            {payNote}
          </div>
        </form>
      </div>
    </section>
  );
}
