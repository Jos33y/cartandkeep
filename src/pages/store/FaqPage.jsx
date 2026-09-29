import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import {
  ArrowRightIcon, ChevronRightIcon, CloseIcon, MailIcon, PlusIcon, SearchIcon, VanIcon,
} from '@components/ui/store/icons';
import { TOPICS, faq } from '@data/help';
import { legalTrader } from '@data/legal';
import { STORE_ROUTES } from '@utils/constants';
import { replyPromise } from '@lib/storeConfig';
import styles from '@styles/pages/store/faq-page.module.css';

const words = (s) => s.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Every word of the query is marked separately, so "card safe" lights both.
function Highlight({ text, terms }) {
  if (!terms.length) return text;
  const pattern = new RegExp(`(${terms.map(escape).join('|')})`, 'gi');
  return text.split(pattern).map((part, i) => (i % 2 ? <mark key={i} className={styles.mark}>{part}</mark> : part));
}

// An index card: the question on the top line, its short answer already written beside it, the rest on the ruled lines below.
function Question({ item, open, onToggle, terms }) {
  return (
    <li id={item.id} className={styles.item} data-open={open || undefined}>
      <h3 className={styles.q}>
        <button type="button" className={styles.qButton} aria-expanded={open} aria-controls={`${item.id}-answer`} onClick={onToggle}>
          <span className={styles.qText}><Highlight text={item.q} terms={terms} /></span>
          {item.chip && <span className={styles.short}>{item.chip}</span>}
          <span className={styles.qIcon} aria-hidden="true"><PlusIcon size={16} /></span>
        </button>
      </h3>
      <div id={`${item.id}-answer`} className={styles.answer} hidden={!open}>
        {item.a.map((line) => <p key={line} className={styles.a}><Highlight text={line} terms={terms} /></p>)}
        {item.link && (
          <Link className={styles.more} to={item.link.to}>
            {item.link.label}
            <ArrowRightIcon size={16} />
          </Link>
        )}
      </div>
    </li>
  );
}

function Desk() {
  const { email } = legalTrader();
  return (
    <aside className={styles.desk} aria-label="Still stuck">
      <p className={styles.deskEyebrow}>Still stuck</p>
      <p className={`${styles.deskTitle} wide`}>Ask a person</p>
      <p className={styles.deskLine}>A reply {replyPromise()}.</p>
      <ul className={styles.deskLinks}>
        <li>
          <Link to={STORE_ROUTES.ORDER_LOOKUP} className={styles.deskLink}>
            <VanIcon size={20} /><span>Track an order</span><ChevronRightIcon size={16} />
          </Link>
        </li>
        <li>
          <Link to={STORE_ROUTES.REQUEST} className={styles.deskLink}>
            <SearchIcon size={20} /><span>Request a product</span><ChevronRightIcon size={16} />
          </Link>
        </li>
      </ul>
      <Link to={STORE_ROUTES.CONTACT} className={styles.deskAction}>
        <MailIcon size={20} />Write to us
      </Link>
      <a className={styles.deskEmail} href={`mailto:${email}`}>{email}</a>
    </aside>
  );
}

export function FaqPage() {
  const items = useMemo(faq, []);
  const { hash } = useLocation();
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('all');
  const [openIds, setOpenIds] = useState(() => new Set());
  // While searching every match starts open, so what a reader closes is tracked separately.
  const [closedIds, setClosedIds] = useState(() => new Set());
  const inputRef = useRef(null);

  const terms = useMemo(() => words(query), [query]);
  const counts = useMemo(() => items.reduce((c, i) => ({ ...c, [i.topic]: (c[i.topic] ?? 0) + 1 }), { all: items.length }), [items]);

  const shown = useMemo(() => items.filter((item) => {
    if (topic !== 'all' && item.topic !== topic) return false;
    if (!terms.length) return true;
    const hay = `${item.q} ${item.a.join(' ')} ${item.chip ?? ''}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  }), [items, topic, terms]);

  // A link to one question opens it and brings it into view.
  useEffect(() => {
    const id = decodeURIComponent(hash.slice(1));
    if (!id || !items.some((i) => i.id === id)) return;
    setOpenIds((s) => new Set(s).add(id));
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }));
  }, [hash, items]);

  const searching = terms.length > 0;
  const isOpen = (id) => (searching ? !closedIds.has(id) : openIds.has(id));
  const flip = (set, id) => { const next = new Set(set); if (next.has(id)) next.delete(id); else next.add(id); return next; };
  const toggle = (id) => (searching ? setClosedIds((s) => flip(s, id)) : setOpenIds((s) => flip(s, id)));
  const reset = () => { setQuery(''); setTopic('all'); inputRef.current?.focus(); };

  const groups = TOPICS
    .map((t) => ({ ...t, items: shown.filter((i) => i.topic === t.key) }))
    .filter((g) => g.items.length);

  const filtered = searching || topic !== 'all';

  return (
    <section className={styles.page}>
      <Head
        title="Frequently asked"
        description="Quick answers about delivery, returns, ordering and the shop."
        path={STORE_ROUTES.FAQ}
        schema={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: items.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a.join(' ') } })),
        }}
      />

      <div className={styles.frame}>
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <Link to={STORE_ROUTES.HOME}>Shop</Link>
          <ChevronRightIcon size={16} />
          <span aria-current="page">Frequently asked</span>
        </nav>

        <header className={styles.header}>
          <h1 className={`${styles.title} wide`}>Frequently asked</h1>
          <p className={styles.lede}>The short answer is on every card. Open one for the rest.</p>
        </header>

        <div className={styles.body}>
          <div className={styles.answers}>
            <div className={styles.finder}>
              <div className={styles.search} role="search">
                <SearchIcon size={20} />
                <label htmlFor="faq-search" className="visually-hidden">Search the questions</label>
                <input
                  id="faq-search"
                  ref={inputRef}
                  className={styles.input}
                  type="search"
                  autoComplete="off"
                  enterKeyHint="search"
                  placeholder="Type your question"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setClosedIds(new Set()); }}
                />
                {query && (
                  <button type="button" className={styles.clear} aria-label="Clear the search" onClick={() => { setQuery(''); inputRef.current?.focus(); }}>
                    <CloseIcon size={16} />
                  </button>
                )}
              </div>

              <div className={styles.topics} role="group" aria-label="Topics">
                {[{ key: 'all', short: 'All' }, ...TOPICS].map((t) => (
                  <button key={t.key} type="button" className={styles.topic} aria-pressed={topic === t.key} onClick={() => setTopic(t.key)}>
                    {t.short}
                    <span className={styles.topicCount}>{counts[t.key] ?? 0}</span>
                  </button>
                ))}
              </div>

              <p className={styles.count} aria-live="polite">
                {filtered && groups.length > 0 ? `${shown.length} ${shown.length === 1 ? 'answer' : 'answers'}` : ''}
              </p>
            </div>

            {groups.map((g) => (
              <section key={g.key} className={styles.group} aria-labelledby={`topic-${g.key}`}>
                <h2 id={`topic-${g.key}`} className={styles.groupHead}>
                  <span className={styles.tab}>{g.label}<span className={styles.groupCount}>{g.items.length}</span></span>
                </h2>
                <ul className={styles.items}>
                  {g.items.map((item) => (
                    <Question key={item.id} item={item} terms={terms} open={isOpen(item.id)} onToggle={() => toggle(item.id)} />
                  ))}
                </ul>
              </section>
            ))}

            {groups.length === 0 && (
              <div className={styles.empty}>
                <p className={styles.emptyTitle}>Nothing here matches that.</p>
                <p className={styles.a}>Ask us instead, and a person will reply {replyPromise()}.</p>
                <button type="button" className={styles.emptyReset} onClick={reset}>Show every question</button>
              </div>
            )}
          </div>

          <Desk />
        </div>
      </div>
    </section>
  );
}
