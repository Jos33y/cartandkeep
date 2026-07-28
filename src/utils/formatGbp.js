const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

export function formatGbp(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
  return gbp.format(Number(value));
}

export function formatPercent(value, digits = 1) {
  if (value === null || value === undefined) return '--';
  return `${(Number(value) * 100).toFixed(digits)}%`;
}
