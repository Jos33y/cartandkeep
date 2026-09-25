import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import { ArrowRightIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, LinkIcon } from '@components/ui/store/icons';
import { LEGAL_COLUMN, LEGAL_LINKS, anchorFor, legalPage } from '@data/legal';
import { PolicyShape } from '@components/ui/store/PolicyShape';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/pages/store/legal-page.module.css';

// Review notes are for the trader, never for a customer. Production shows only what a customer may rely on.
const SHOW_NOTES = import.meta.env.DEV;
const TABS = LEGAL_COLUMN;

function ReviewNote({ tag, children }) {
  if (!SHOW_NOTES || !children) return null;
  return (
    <p className={styles.confirm}>
      <span className={styles.confirmTag}>{tag}</span>
      {children}
    </p>
  );
}

function Tabs({ current }) {
  const ref = useRef(null);

  // On a phone the current tab may start off screen; bring it into the strip without moving the page.
  useEffect(() => {
    const strip = ref.current;
    const on = strip?.querySelector('[aria-current="page"]');
    if (strip && on) strip.scrollLeft = on.offsetLeft - (strip.clientWidth - on.clientWidth) / 2;
  }, [current]);

  return (
    <nav className={styles.tabs} aria-label="Policies">
      <ul ref={ref} className={styles.tabList}>
        {TABS.map((s) => (
          <li key={s}>
            <Link to={`/legal/${s}`} className={styles.tab} aria-current={s === current ? 'page' : undefined}>
              {LEGAL_LINKS[s]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function FactText({ item }) {
  if (!item.href) return item.v;
  if (item.href.startsWith('/')) return <Link className={styles.factLink} to={item.href}>{item.v}</Link>;
  return <a className={styles.factLink} href={item.href}>{item.v}</a>;
}

function Facts({ facts }) {
  return (
    <section className={styles.panel} aria-label="Key facts">
      <div className={styles.panelTop} data-shape={facts.shape ? '' : undefined}>
        <div>
          <p className={styles.eyebrow}>{facts.eyebrow}</p>
          <p className={`${styles.figure} wide`} data-kind={facts.kind}>{facts.figure}</p>
          <p className={styles.caption}>{facts.caption}</p>
        </div>
        <PolicyShape shape={facts.shape} />
      </div>
      <ul className={styles.facts}>
        {facts.items.map((item) => (
          <li key={item.v} className={styles.fact}>
            <span className={styles.factMark} data-link={item.href ? '' : undefined} aria-hidden="true">
              {item.href ? <ArrowRightIcon size={14} /> : <CheckIcon size={14} />}
            </span>
            <span><FactText item={item} /></span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Which heading is being read, and how far through the document, for the contents rail.
function useReading(articleRef, ids) {
  const [state, setState] = useState({ active: ids[0] ?? null, read: 0 });

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const article = articleRef.current;
      if (!article) return;
      const line = window.innerHeight * 0.3;
      const box = article.getBoundingClientRect();
      const read = Math.min(1, Math.max(0, (line - box.top) / Math.max(1, box.height - line)));
      let active = ids[0] ?? null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) active = id;
      }
      setState((s) => (s.active === active && Math.abs(s.read - read) < 0.005 ? s : { active, read }));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [articleRef, ids]);

  return state;
}

function ContentsList({ heads, active, onPick }) {
  return (
    <ol className={styles.contentsList}>
      {heads.map((h) => (
        <li key={h.id}>
          <a href={`#${h.id}`} className={styles.contentsLink} aria-current={h.id === active ? 'location' : undefined} onClick={onPick}>
            {h.number && <span className={styles.contentsNumber}>{h.number}</span>}
            <span>{h.text}</span>
          </a>
        </li>
      ))}
    </ol>
  );
}

function Rail({ heads, active, read }) {
  return (
    <nav className={styles.rail} aria-label="On this page">
      <p className={styles.railHead}>On this page</p>
      <div className={styles.track} style={{ '--read': read }}>
        <ContentsList heads={heads} active={active} />
      </div>
    </nav>
  );
}

function MobileContents({ heads, unit }) {
  const ref = useRef(null);
  return (
    <details ref={ref} className={styles.mobileContents}>
      <summary className={styles.mobileSummary}>
        <span>Contents</span>
        <span className={styles.mobileCount}>{heads.length} {unit}</span>
        <ChevronDownIcon size={20} />
      </summary>
      <ContentsList heads={heads} onPick={() => { if (ref.current) ref.current.open = false; }} />
    </details>
  );
}

function Heading({ head, onCopied }) {
  async function copy() {
    const url = `${window.location.origin}${window.location.pathname}#${head.id}`;
    window.history.replaceState(null, '', `#${head.id}`);
    try {
      await navigator.clipboard.writeText(url);
      onCopied('Link copied');
    } catch {
      onCopied('Could not copy. The link is in the address bar.');
    }
  }

  return (
    <h2 id={head.id} className={styles.h2}>
      {head.number && <span className={styles.clause}>{head.number}</span>}
      <span className={styles.h2Text}>{head.text}</span>
      <button type="button" className={styles.anchor} onClick={copy} aria-label={`Copy a link to ${head.text}`}>
        <LinkIcon size={16} />
      </button>
    </h2>
  );
}

function CancellationForm({ block, onCopied }) {
  const text = [
    `To: ${block.to.join(', ')}`,
    '',
    ...block.lines.map((l) => (l.endsWith(':') ? `${l} ` : l)),
    '',
    block.foot,
  ].join('\n');

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      onCopied('Form copied. Paste it into an email to us.');
    } catch {
      onCopied('Could not copy. Select the form and copy it instead.');
    }
  }

  return (
    <figure className={styles.form}>
      <dl className={styles.formBody}>
        <div className={styles.formRow}>
          <dt>To</dt>
          <dd>{block.to.map((line) => <span key={line} className={styles.formTo}>{line}</span>)}</dd>
        </div>
        {block.lines.map((line) => (
          <div key={line} className={styles.formRow}>
            <dt>{line}</dt>
            <dd className={styles.formBlank} aria-hidden="true" />
          </div>
        ))}
      </dl>
      <figcaption className={styles.formFoot}>
        <span>{block.foot}</span>
        <button type="button" className={styles.button} onClick={copy}>Copy the form</button>
      </figcaption>
    </figure>
  );
}

function Block({ block, head, onCopied }) {
  const note = <ReviewNote tag="For review">{block.review}</ReviewNote>;

  if (block.t === 'confirm') {
    return (
      <>
        <ReviewNote tag={block.owner === 'studio' ? 'Studio to check' : 'Trader to decide'}>{block.v}</ReviewNote>
        {block.show && <Block block={block.show} onCopied={onCopied} />}
      </>
    );
  }
  if (block.t === 'h') return <Heading head={head} onCopied={onCopied} />;
  if (block.t === 'p') return <><p className={styles.p}>{block.v}</p>{note}</>;
  if (block.t === 'note') return <p className={styles.note}>{block.v}</p>;
  if (block.t === 'list') {
    return (
      <>
        <ul className={styles.list}>{block.v.map((line) => <li key={line}>{line}</li>)}</ul>
        {note}
      </>
    );
  }
  if (block.t === 'form') return <CancellationForm block={block} onCopied={onCopied} />;
  return null;
}

function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(0);
  const show = useCallback((text) => {
    clearTimeout(timer.current);
    setToast({ text, key: Date.now() });
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [toast, show];
}

export function LegalPage() {
  const { slug } = useParams();
  const { hash } = useLocation();
  const page = legalPage(slug);
  const articleRef = useRef(null);
  const [toast, showToast] = useToast();

  // Keyed on the heading text: the page object is rebuilt every render, the headings rarely change.
  const outline = page ? page.blocks.map((b) => (b.t === 'h' ? b.v : '')).join('|') : '';
  const numbered = Boolean(page?.numbered);
  const heads = useMemo(() => {
    let n = 0;
    return outline.split('|').flatMap((text, index) => {
      if (!text) return [];
      n += 1;
      return [{ index, id: anchorFor(text), text, number: numbered ? String(n) : null }];
    });
  }, [outline, numbered]);

  const ids = useMemo(() => heads.map((h) => h.id), [heads]);
  const { active, read } = useReading(articleRef, ids);

  // A link to a clause arrives before the page has rendered it; scroll once it exists.
  useEffect(() => {
    if (!hash) return;
    document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
  }, [hash, slug]);

  if (slug === 'faq') return <Navigate to={`${STORE_ROUTES.FAQ}${hash}`} replace />;

  if (!page) {
    return (
      <section className={styles.page}>
        <div className={styles.frame}>
          <h1 className={`${styles.title} wide`}>That page does not exist</h1>
          <p className={styles.p}>It may have been renamed.</p>
          <Link className={styles.back} to={STORE_ROUTES.HOME}>Back to the shop</Link>
        </div>
      </section>
    );
  }

  const updated = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London',
  }).format(new Date(`${page.reviewed}T12:00:00Z`));

  const headAt = new Map(heads.map((h) => [h.index, h]));
  const withContents = heads.length > 1;

  return (
    <section className={styles.page}>
      <Head title={page.title} description={page.description} path={`/legal/${slug}`} />

      <div className={styles.frame}>
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <Link to={STORE_ROUTES.HOME}>Shop</Link>
          <ChevronRightIcon size={16} />
          <span aria-current="page">{page.title}</span>
        </nav>

        <Tabs current={slug} />

        <header className={styles.header}>
          <h1 className={`${styles.title} wide`}>{page.title}</h1>
          <p className={styles.updated}>Last updated <time dateTime={page.reviewed}>{updated}</time></p>
        </header>

        {page.facts && <Facts facts={page.facts} />}

        <div className={styles.doc} data-contents={withContents || undefined}>
          {withContents && <Rail heads={heads} active={active} read={read} />}
          <article ref={articleRef} className={styles.article}>
            {withContents && <MobileContents heads={heads} unit="sections" />}
            {page.blocks.map((block, i) => (
              <Block key={i} block={block} head={headAt.get(i)} onCopied={showToast} />
            ))}
          </article>
        </div>
      </div>

      <p className={styles.toast} role="status" aria-live="polite">
        {toast && <span key={toast.key} className={styles.toastText}>{toast.text}</span>}
      </p>
    </section>
  );
}
