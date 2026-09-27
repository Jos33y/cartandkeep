/*
 * UK phone numbers, as people type them.
 *
 * Accepts 07700 900077, 7700900077, +44 7700 900077 and 0044 7700 900077 alike,
 * shows them the way a UK number is read aloud, and sends one form to the
 * server. Only UK numbers, because only UK addresses are delivered to.
 */

// The digits of the national number, without the leading 0 or +44.
export function nationalDigits(input) {
  let d = String(input ?? '').replace(/[^\d+]/g, '');
  if (d.startsWith('+44')) d = d.slice(3);
  else if (d.startsWith('0044')) d = d.slice(4);
  d = d.replace(/\D/g, '');
  if (d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 10);
}

// 07700 900077 for mobiles, 020 7946 0000 for London, 0113 496 0000 for the rest.
export function formatPhone(input) {
  const d = nationalDigits(input);
  if (!d) return '';
  const n = `0${d}`;
  if (n.startsWith('02')) return [n.slice(0, 3), n.slice(3, 7), n.slice(7)].filter(Boolean).join(' ');
  if (n.startsWith('07') || n.startsWith('08') || n.startsWith('03')) return [n.slice(0, 5), n.slice(5)].filter(Boolean).join(' ');
  return [n.slice(0, 4), n.slice(4, 7), n.slice(7)].filter(Boolean).join(' ');
}

// A complete UK number: ten digits after the 0, starting 1, 2, 3 or 7.
export function isUkPhone(input) {
  const d = nationalDigits(input);
  return d.length === 10 && /^[1237]/.test(d);
}

// The one form the order stores.
export function toE164(input) {
  return isUkPhone(input) ? `+44${nationalDigits(input)}` : null;
}
