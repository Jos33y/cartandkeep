import { EmptyState } from '@components/ui/portal/EmptyState';

const COLUMNS = [
  { key: 'product', label: 'Product' },
  { key: 'channel', label: 'Channel' },
  { key: 'listed', label: 'Listed' },
  { key: 'price', label: 'Price', align: 'right' },
];

const ROWS = [{}, {}, {}, {}];

export function ListingsPage() {
  return (
    <EmptyState
      eyebrow="Listings"
      title="No listings yet"
      icon="IconTag"
      body="Everything you have approved that is live, and where it is live."
      columns={COLUMNS}
      rows={ROWS}
      note="Listings follow approvals, so this fills once the first approved products go up on eBay or the store."
    />
  );
}
