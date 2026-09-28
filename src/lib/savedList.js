/*
 * A saved list as a link.
 *
 * There is no account, so Saved lives on one device. A link is how it gets to
 * another one, or to another person as a wish list. It carries product ids and,
 * if the owner chooses, a first name. Nothing else: no email, no address, no
 * basket, and no way back to the device it came from.
 *
 * Each id is a UUID packed from 36 characters to 22 (its 16 bytes in URL-safe
 * base64), so a list of forty still fits comfortably in a message.
 */

export const LIST_MAX = 50;
export const NAME_MAX = 30;

const HEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function packId(uuid) {
  if (!HEX.test(uuid)) return null;
  const hex = uuid.replace(/-/g, '');
  let bin = '';
  for (let i = 0; i < 32; i += 2) bin += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unpackId(code) {
  if (!/^[A-Za-z0-9_-]{22}$/.test(code)) return null;
  try {
    const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/') + '==');
    if (bin.length !== 16) return null;
    const hex = [...bin].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  } catch {
    return null;
  }
}

// A name as someone might type it, kept to letters, spaces, hyphens and apostrophes, so a link cannot carry anything else.
export function cleanName(raw) {
  return String(raw ?? '')
    .replace(/<[^>]*>?/g, '')
    .replace(/[^\p{L}\p{M}' -]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX);
}

// The path and query for a list, for the address bar or for sharing with the origin in front.
export function listPath(ids, name = '') {
  const codes = (ids ?? []).map(packId).filter(Boolean).slice(0, LIST_MAX);
  const params = new URLSearchParams({ i: codes.join('.') });
  const who = cleanName(name);
  if (who) params.set('n', who);
  return `/list?${params.toString()}`;
}

// What a link says, with anything malformed left out rather than trusted.
export function readList(search) {
  const params = new URLSearchParams(search);
  const seen = new Set();
  const ids = String(params.get('i') ?? '')
    .split('.')
    .map(unpackId)
    .filter((id) => id && !seen.has(id) && seen.add(id))
    .slice(0, LIST_MAX);
  return { ids, name: cleanName(params.get('n')) };
}
