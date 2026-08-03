import { EmptyState } from '@components/ui/portal/EmptyState';

const COLUMNS = [
  { key: 'ref', label: 'Order' },
  { key: 'items', label: 'Items' },
  { key: 'status', label: 'Status' },
  { key: 'net', label: 'Net', align: 'right' },
];

const ROWS = [{}, {}, {}];

export function OrdersPage() {
  return (
    <EmptyState
      eyebrow="Orders"
      title="No orders yet"
      icon="IconBox"
      body="Orders from your own store, with what was bought, where it is up to and what was left after fulfilment."
      columns={COLUMNS}
      rows={ROWS}
      note="eBay orders stay in eBay. This screen covers the store we are building for you, so it fills once that store is live and selling."
    />
  );
}
