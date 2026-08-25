import { useState } from 'react';
import { Link } from 'react-router';
import { MessageIcon } from '@components/ui/store/icons';
import { askAboutBasket, askAboutProduct } from '@lib/threads';
import styles from '@styles/ui/store/ask-panel.module.css';

/*
 * Asking before buying.
 *
 * On every product, not on some. A control that appears on certain pages
 * teaches nobody where to look, and any rule for picking which products get it
 * filters out exactly the questions worth catching, which are the ones nobody
 * predicted. The absence is a signal too: a product with no way to ask reads
 * as one the shop would rather you did not ask about.
 *
 * The quietest thing in the column, and last. Somebody who has decided scrolls
 * past without registering it; somebody who is stuck is looking for it. It is
 * outlined rather than terracotta because Add to basket is the one action on
 * this page that moves a buyer forward, and a second accent beside it is how
 * an accent stops meaning anything.
 *
 * Nothing here claims a speed. The measured median lives in the portal until
 * there is enough behind it to be a fact rather than a promise.
 */
export function AskPanel({ product, basket }) {
  // One form, two subjects. A second component would carry the same honeypot,
  // the same caps and the same three fields with two words different, and it
  // is the copy that differs here rather than the behaviour.
  const isBasket = Array.isArray(basket);
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  // Hidden from people and filled in by a bot. The same guard the request form
  // uses, and not a captcha, which taxes everybody who would have used it.
  const [website, setWebsite] = useState('');

  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);
  const [asked, setAsked] = useState(null);

  async function submit() {
    setBusy(true);
    setFailed(null);
    try {
      const { id, token } = isBasket
        ? await askAboutBasket({ lines: basket, body, email, name, website })
        : await askAboutProduct({ productId: product.id, body, email, name, website });
      setAsked({ id, token });
    } catch (e) {
      setFailed(e.message);
    } finally {
      setBusy(false);
    }
  }

  /*
   * Confirmed in place rather than navigated away.
   *
   * They are standing on a product they are considering. Sending them to a
   * conversation page the moment they ask takes them off it, and the link is
   * in their email as well, so there is no reason to move them.
   */
  if (asked) {
    return (
      <div className={styles.panel}>
        <p className={styles.doneTitle}>Asked</p>
        <p className={styles.doneBody}>
          A person reads every one of these and answers it themselves. We have
          emailed you a link to the conversation, and the answer arrives the
          same way.
        </p>
        <Link className={styles.doneLink} to={`/thread/${asked.id}?token=${asked.token}`}>
          See your question
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <p className={styles.title}>
        {isBasket ? 'Want to ask about these together?' : 'Not sure it is the right one?'}
      </p>
      <p className={styles.body}>
        {isBasket
          ? 'Send the lot as one question. We see exactly what you are looking at, so nothing has to be described twice.'
          : 'Ask before you buy. A person reads every one of these and answers it themselves.'}
      </p>

      {!open ? (
        <button type="button" className={styles.opener} onClick={() => setOpen(true)}>
          <MessageIcon size={17} />
          {isBasket ? 'Ask about this basket' : 'Ask about this product'}
        </button>
      ) : (
        <div className={styles.form}>
          <label className={styles.field}>
            <span className={styles.label}>Your question</span>
            <textarea
              className={styles.textarea}
              rows={3}
              value={body}
              maxLength={2000}
              onChange={(e) => setBody(e.target.value)}
              placeholder={isBasket
                ? 'Can these two go out together, and is the shade in stock?'
                : 'Is this the wide one? I need it to clear a 45cm shade.'}
              autoFocus
            />
          </label>

          {/* Under the question, not above it. Somebody types what they came to
              ask first, and gives an address afterwards because they now want
              an answer. Asking for it first turns this into a form. */}
          <div className={styles.pair}>
            <label className={styles.field}>
              <span className={styles.label}>Your email</span>
              <input
                className={styles.input}
                type="email"
                value={email}
                maxLength={160}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Your name</span>
              <input
                className={styles.input}
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                placeholder="Optional"
              />
            </label>
          </div>

          <input
            className={styles.trap}
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
          />

          {failed && <p className={styles.error} role="alert">{failed}</p>}

          <button
            type="button"
            className={styles.send}
            disabled={busy || !body.trim() || !email.trim() || (isBasket && basket.length === 0)}
            onClick={submit}
          >
            {busy ? 'Sending' : 'Ask'}
          </button>

          <p className={styles.small}>
            Your email is only used to answer you. No account, and it does not
            go on any list.
          </p>
        </div>
      )}
    </div>
  );
}
