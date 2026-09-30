import { Icon } from '@components/ui/icons';
import styles from '@styles/ui/portal/channel-marks.module.css';

const MARK = {
  store: { icon: 'IconShop', label: 'Shop', tip: 'For your own shop' },
  ebay: { icon: 'IconTag', label: 'eBay', tip: 'For eBay' },
};

// Where a card is for, on every card, so a glance says shop, eBay or both.
// Compact is the row's version: a small uppercase word, no icon, so the product name keeps the room.
export function ChannelMarks({ channels = [], compact = false }) {
  if (!channels.length) return null;
  const name = `For ${channels.map((c) => MARK[c]?.label ?? c).join(' and ')}`;
  // On a row, one mark split in two when a card is for both, so the pair takes the room of one.
  if (compact) {
    return (
      <span className={styles.pair} aria-label={name} title={channels.map((c) => MARK[c]?.tip).join(', ')}>
        {channels.map((c) => <span key={c} className={styles.half} data-channel={c}>{MARK[c]?.label ?? c}</span>)}
      </span>
    );
  }
  return (
    <span className={styles.marks} aria-label={name}>
      {channels.map((c) => (
        <span key={c} className={styles.mark} data-channel={c} title={MARK[c]?.tip}>
          <Icon name={MARK[c]?.icon ?? 'IconTag'} className={styles.icon} />
          {MARK[c]?.label ?? c}
        </span>
      ))}
    </span>
  );
}
