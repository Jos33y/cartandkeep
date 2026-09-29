import { useEffect, useState } from 'react';
import { BasketIcon, CheckIcon, ClockIcon, FilesIcon, HeartIcon, PersonIcon, StarIcon, VanIcon } from '@components/ui/store/icons';
import { setRecentlyViewed, useRecentlyViewed } from '@hooks/useRecentlyViewed';
import { DETAILS_EVENT, detailsOff, setRememberDetails } from '@lib/checkoutDraft';
import { MY_ORDERS_EVENT, myOrdersOff, setKeepMyOrders } from '@lib/myOrders';
import styles from '@styles/ui/store/policy-shape.module.css';

// Fourteen days by law, the rest as the shop's own promise, to scale.
function Window({ law, total }) {
  const extra = Math.max(0, total - law);
  const lawShare = `${(law / total) * 100}%`;
  return (
    <figure className={styles.shape} aria-label={`${law} days by law${extra ? `, and ${extra} more as our own promise` : ''}`}>
      <div className={styles.scale} aria-hidden="true">
        <span className={styles.tick} style={{ left: 0 }}>Arrives</span>
        {extra > 0 && <span className={styles.tick} style={{ left: lawShare }}>Day {law}</span>}
        <span className={`${styles.tick} ${styles.tickEnd}`}>Day {total}</span>
      </div>
      <div className={styles.bar} aria-hidden="true">
        <span className={styles.barLaw} style={{ width: lawShare }} />
        {extra > 0 && <span className={styles.barOurs} />}
      </div>
      <ul className={styles.legend}>
        <li><i className={styles.keyLaw} />{law} days by law</li>
        {extra > 0 && <li><i className={styles.keyOurs} />{extra} more, our promise</li>}
      </ul>
    </figure>
  );
}

function Track({ cutoff, transit }) {
  const stops = [
    ['By ' + cutoff, 'Order on a working day'],
    ['Same day', 'Packed and sent'],
    [`${transit} days`, 'Working days to you'],
  ];
  return (
    <figure className={styles.shape}>
      <ol className={styles.route}>
        {stops.map(([big, small], i) => (
          <li key={small} className={styles.stop} data-first={i === 0 || undefined}>
            <span className={styles.dot} aria-hidden="true" />
            <b className={styles.stopBig}>{big}</b>
            <span className={styles.stopSmall}>{small}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

// Whether something is switched off on this device, kept in step with the rest of the shop.
function useOff(read, event) {
  const [off, setOff] = useState(read);
  useEffect(() => {
    const sync = () => setOff(read());
    window.addEventListener(event, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(event, sync); window.removeEventListener('storage', sync); };
  }, [read, event]);
  return off;
}

function Switch({ off, label, onToggle }) {
  return (
    <button type="button" role="switch" aria-checked={!off} aria-label={label} className={styles.switch} onClick={onToggle}>
      <span className={styles.switchLabel}>{off ? 'Off' : 'On'}</span>
      <span className={styles.switchTrack} aria-hidden="true"><span className={styles.switchKnob} /></span>
    </button>
  );
}

function Storage() {
  const { off: viewedOff } = useRecentlyViewed();
  const noDetails = useOff(detailsOff, DETAILS_EVENT);
  const noOrders = useOff(myOrdersOff, MY_ORDERS_EVENT);
  const tiles = [
    { Icon: BasketIcon, name: 'Your basket', state: 'Needed' },
    { Icon: HeartIcon, name: 'Saved items', state: 'You asked' },
    { Icon: ClockIcon, name: 'Recently viewed', id: 'recently-viewed',
      toggle: { off: viewedOff, label: 'Keep recently viewed products on this device', flip: () => setRecentlyViewed(viewedOff) } },
    { Icon: PersonIcon, name: 'Your details', id: 'your-details',
      toggle: { off: noDetails, label: 'Remember your checkout details on this device', flip: () => setRememberDetails(noDetails) } },
    { Icon: VanIcon, name: 'Your orders', id: 'your-orders',
      toggle: { off: noOrders, label: 'Keep links to orders opened on this device', flip: () => setKeepMyOrders(noOrders) } },
    { Icon: FilesIcon, name: 'Shop files', state: 'Speed only' },
  ];
  return (
    <figure className={styles.shape}>
      <ul className={styles.tiles}>
        {tiles.map(({ Icon, name, state, id, toggle }) => (
          <li key={name} className={styles.tile} id={id}>
            <Icon size={20} />
            <span className={styles.tileName}>{name}</span>
            {toggle
              ? <Switch off={toggle.off} label={toggle.label} onToggle={toggle.flip} />
              : <span className={styles.tileState}>{state}</span>}
          </li>
        ))}
      </ul>
    </figure>
  );
}

function Flow({ held, to }) {
  return (
    <figure className={styles.shape}>
      <ol className={styles.flow}>
        <li className={styles.node}>You</li>
        <li className={`${styles.node} ${styles.nodeHeld}`}>{held}</li>
        <li>
          <ul className={styles.branches}>
            {to.map(([who, why]) => (
              <li key={who} className={styles.branch}><b>{who}</b> {why}</li>
            ))}
          </ul>
        </li>
      </ol>
    </figure>
  );
}

function Slip({ lines }) {
  const [first, ...rest] = lines;
  return (
    <figure className={styles.shape}>
      <figcaption className={styles.slipLabel}>At the foot of every receipt</figcaption>
      <div className={styles.slip}>
        <b>{first}</b>
        {rest.map((l) => <span key={l}>{l}</span>)}
      </div>
    </figure>
  );
}

function Stars() {
  return (
    <figure className={styles.shape} aria-label="Reviews of every rating are published">
      <ul className={styles.ratings}>
        {[5, 4, 3, 2, 1].map((n) => (
          <li key={n} className={styles.rating}>
            <span className={styles.stars} aria-hidden="true">
              {[1, 2, 3, 4, 5].map((s) => <StarIcon key={s} size={14} className={s > n ? styles.starOff : undefined} />)}
            </span>
            <span className={styles.leader} aria-hidden="true" />
            <span className={styles.published}><CheckIcon size={16} />Published</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

const SHAPES = { window: Window, track: Track, storage: Storage, flow: Flow, slip: Slip, stars: Stars };

export function PolicyShape({ shape }) {
  const Shape = SHAPES[shape?.type];
  return Shape ? <Shape {...shape} /> : null;
}
