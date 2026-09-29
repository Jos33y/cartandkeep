import { Icon } from '@components/ui/icons';
import styles from '@styles/ui/portal/channel-marks.module.css';

const MARK = {
  store: { icon: 'IconShop', label: 'Shop', tip: 'For your own shop' },
  ebay: { icon: 'IconTag', label: 'eBay', tip: 'For eBay' },
};

// Where a card is for, on every card, so a glance says shop, eBay or both.
export function ChannelMarks({ channels = [] }) {
  if (!channels.length) return null;
  return (
    <span className={styles.marks} aria-label={`For ${channels.map((c) => MARK[c]?.label ?? c).join(' and ')}`}>
      {channels.map((c) => (
        <span key={c} className={styles.mark} data-channel={c} title={MARK[c]?.tip}>
          <Icon name={MARK[c]?.icon ?? 'IconTag'} className={styles.icon} />
          {MARK[c]?.label ?? c}
        </span>
      ))}
    </span>
  );
}
