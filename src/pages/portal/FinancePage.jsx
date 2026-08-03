import { EmptyState } from '@components/ui/portal/EmptyState';

// The line items are the real margin model, so the empty screen already tells
// her which costs are counted. Most sellers only find out about half of these.
const COLUMNS = [
  { key: 'line', label: 'Line' },
  { key: 'value', label: 'Per unit', align: 'right' },
];

const ROWS = [
  { cells: ['Revenue'] },
  { cells: ['eBay final value fee'] },
  { cells: ['Promoted listings'] },
  { cells: ['Postage, by size band'] },
  { cells: ['Packaging'] },
  { cells: ['Returns provision'] },
  { cells: ['Cost of goods'] },
  { cells: ['Net'], rule: true },
];

export function FinancePage() {
  return (
    <EmptyState
      eyebrow="Finance"
      title="No figures yet"
      icon="IconChart"
      body="What is actually left after every cost, not just after the eBay fee."
      columns={COLUMNS}
      rows={ROWS}
      note="Measured seven, fourteen and thirty days after each listing goes up. The first figures land a week after the first listing, because anything sooner says very little."
    />
  );
}
