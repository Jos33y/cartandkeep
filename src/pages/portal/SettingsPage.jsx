import { useEffect, useRef, useState } from 'react';
import { supabase } from '@lib/supabase';
import { loadTenant } from '@lib/tenant';
import { useAccount } from '@hooks/useAccount';
import { StoreSettings } from '@components/ui/portal/StoreSettings';
import { EbayConnection } from '@components/ui/portal/EbayConnection';
import { Icon } from '@components/ui/icons';
import styles from '@styles/pages/portal/settings-page.module.css';

const SECTIONS = [
  { id: 'you', label: 'You', icon: 'IconPeople' },
  { id: 'shop', label: 'Your shop', icon: 'IconShop' },
  { id: 'about', label: 'About page', icon: 'IconInfo' },
  { id: 'channels', label: 'Channels', icon: 'IconTag' },
  { id: 'rules', label: 'How we choose', icon: 'IconLayers' },
];

// From gate.js. These are what actually refuses a product, not the composite
// score the old pipeline used.
const RULES = [
  { label: 'You keep at least', value: '£2.00 a sale', note: 'After fees, postage, packaging and goods' },
  { label: 'Competing listings', value: 'at most 250', note: 'Above this, page one costs more than the ad rate allows' },
  { label: 'Market volume', value: 'at least 10 a month', note: 'Below this a listing is not worth the slot' },
  { label: 'A seller your size', value: 'under 1,000 feedback', note: 'Has to be converting for a product to count as proven' },
];

export function SettingsPage() {
  const account = useAccount();
  const [tenant, setTenant] = useState(null);
  const [name, setName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState('you');
  // The section just clicked, held until she scrolls herself: a short last section can never reach the top.
  const picked = useRef(null);

  useEffect(() => { loadTenant().then(setTenant); }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const current = data.user?.user_metadata?.full_name ?? '';
      setName(current);
      setSavedName(current);
    });
  }, []);

  /*
   * The nav follows the page, so it says where you are rather than where you
   * last clicked. Measured on every scroll rather than observed once: the shop
   * and About sections arrive after their settings load, and About sits inside
   * Your shop, so an observer set up at load missed it and handed the
   * highlight back to Your shop. The current section is the last one whose top
   * has passed a line a third of the way down; at the foot of the page it is
   * the last one.
   */
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const line = window.innerHeight / 3;
      const place = (id) => document.getElementById(id)?.getBoundingClientRect() ?? null;
      const held = picked.current && place(picked.current);
      if (held && held.top < window.innerHeight && held.bottom > 0) {
        setActive(picked.current);
        return;
      }
      picked.current = null;
      let on = SECTIONS[0].id;
      for (const s of SECTIONS) {
        const box = place(s.id);
        if (box && box.top <= line) on = s.id;
      }
      const doc = document.documentElement;
      if (window.scrollY > 0 && window.innerHeight + window.scrollY >= doc.scrollHeight - 2) on = SECTIONS.at(-1).id;
      setActive(on);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const release = () => { picked.current = null; };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener('wheel', release, { passive: true });
    window.addEventListener('touchstart', release, { passive: true });
    window.addEventListener('keydown', release);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('wheel', release);
      window.removeEventListener('touchstart', release);
      window.removeEventListener('keydown', release);
    };
  }, []);

  // On a phone the menu is a strip that scrolls sideways; keep the lit tab in it.
  const strip = useRef(null);
  useEffect(() => {
    const nav = strip.current;
    const on = nav?.querySelector('[aria-current="location"]');
    if (!nav || !on || nav.scrollWidth <= nav.clientWidth) return;
    const left = on.offsetLeft - nav.offsetLeft;
    if (left < nav.scrollLeft || left + on.offsetWidth > nav.scrollLeft + nav.clientWidth) {
      nav.scrollLeft = left - (nav.clientWidth - on.offsetWidth) / 2;
    }
  }, [active]);

  async function saveName() {
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } });
    setBusy(false);
    if (!error) setSavedName(name.trim());
    setSaved(error ? 'Could not save that. Try again.' : 'Saved');
  }

  const research = tenant?.research ?? {};
  const categories = research.categories ?? [];
  const excluded = research.exclude?.terms ?? [];
  const initial = (account.email ?? '?')[0].toUpperCase();

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>Account</p>
        <h1 className={styles.title}>Settings</h1>
      </header>

      <div className={styles.layout}>
        <nav ref={strip} className={styles.nav} aria-label="Settings sections">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`}
              className={`${styles.navItem} ${active === s.id ? styles.navOn : ''}`}
              aria-current={active === s.id ? 'location' : undefined}
              onClick={() => { picked.current = s.id; setActive(s.id); }}>
              <Icon name={s.icon} className={styles.navIcon} />
              {s.label}
            </a>
          ))}
        </nav>

        <div className={styles.sections}>
          <Section id="you" title="You" note="How you appear to us, and how you sign in.">
            <div className={styles.identity}>
              <span className={styles.avatar} aria-hidden="true">{initial}</span>
              <div className={styles.identityText}>
                <span className={styles.identityEmail}>{account.email}</span>
                <span className={styles.identityRole}>{account.role}</span>
              </div>
            </div>

            <div className={styles.fields}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="full-name">Name</label>
                <span className={styles.control}>
                  <input id="full-name" className={styles.input} value={name}
                    placeholder="How you want to be addressed"
                    onChange={(e) => { setName(e.target.value); setSaved(''); }} />
                </span>
              </div>
            </div>

            <div className={styles.save}>
              <button type="button"
                className={`${styles.button} ${!busy && name.trim() !== savedName ? styles.buttonReady : ''}`}
                disabled={busy || name.trim() === savedName}
                onClick={saveName}>
                {busy ? 'Saving' : 'Save name'}
              </button>
              <span className={styles.saved} role="status">{saved}</span>
              <span className={styles.saveHint}>Changing your email changes how you sign in, so ask us first.</span>
            </div>
          </Section>

          <div id="shop" className={styles.anchor}>
            <StoreSettings tenantId={tenant?.id} />
          </div>

          <Section id="channels" title="Channels" note="Where approved products can be published from here.">
            <div className={styles.channel}>
              <div className={styles.channelHead}>
                <span className={styles.channelMark}>eBay</span>
                <span className={styles.channelNote}>Listing, traffic and order data</span>
              </div>
              <EbayConnection tenantId={tenant?.id} />
            </div>

            <div className={`${styles.channel} ${styles.channelSoon}`}>
              <div className={styles.channelHead}>
                <span className={styles.channelMark}>TikTok Shop</span>
                <span className={styles.channelNote}>Not connected yet</span>
              </div>
            </div>
          </Section>

          <Section id="rules" title="How we choose"
            note="Set by the studio. What a product has to clear before it reaches your queue.">
            <dl className={styles.rules}>
              {RULES.map((r) => (
                <div key={r.label} className={styles.rule}>
                  <dt className={styles.ruleLabel}>{r.label}</dt>
                  <dd className={styles.ruleValue}>{r.value}</dd>
                  <dd className={styles.ruleNote}>{r.note}</dd>
                </div>
              ))}
            </dl>

            <div className={styles.meta}>
              <Meta label="Marketplace" value={tenant?.marketplace} />
              <Meta label="Currency" value={tenant?.currency} />
              <Meta label="Order references"
                value={`${tenant?.store?.reference_prefix ?? 'CK'}-XXXX-XXXX`} mono />
            </div>

            {categories.length > 0 && (
              <div className={styles.cats}>
                <span className={styles.catsLabel}>Categories swept</span>
                <ul className={styles.tags}>
                  {categories.map((c) => <li key={c} className={styles.tag}>{c}</li>)}
                </ul>
                {excluded.length > 0 && (
                  <span className={styles.catsNote}>
                    {excluded.length} terms held back for regulatory reasons.
                  </span>
                )}
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ id, title, note, children }) {
  return (
    <section id={id} className={styles.section}>
      <header className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {note && <p className={styles.sectionNote}>{note}</p>}
      </header>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

function Meta({ label, value, mono }) {
  return (
    <div className={styles.metaItem}>
      <span className={styles.metaLabel}>{label}</span>
      <span className={`${styles.metaValue} ${mono ? styles.mono : ''}`}>{value ?? '--'}</span>
    </div>
  );
}
