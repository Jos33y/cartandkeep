/*
 * The filters every category passes before any shop is looked at, in one place, so a new category needs a
 * rules file at most, never a change to the scripts. Order matters: the first stop wins and is the reason
 * coverage shows.
 *
 *   own_label   a brand only its own shop sells                    own-label.mjs
 *   not_shelf   made to measure, furniture, plants, experiences    not-shelf.mjs
 *   restricted  medicines (prescription and shop-shelf), whitening, lenses, infant formula, vet diets,
 *               banned cosmetics, perfume dupes, alcohol, tobacco, weapons   restricted.mjs
 *   cant_post   Royal Mail will not carry it                       post.mjs
 *
 * postCheckOf(title) is not a stop: the product goes through with a note for her card (aerosol limits and so on).
 * Test a new category's exports with rules-check.mjs before running store-picks.
 */
import { OWN_LABEL as OWN } from './own-label.mjs';
import { NOT_SHELF as NOT, staleYear } from './not-shelf.mjs';
import { RESTRICTED as RES, NOT_RESTRICTED } from './restricted.mjs';
import { CANT_POST as POST, POST_CHECK, TOILETRY_AEROSOL } from './post.mjs';
import * as healthBeauty from './categories/health-beauty.mjs';
import * as hardware from './categories/hardware.mjs';
import * as toysGames from './categories/toys-games.mjs';

const BY_CATEGORY = new Map([
  ['health and beauty', healthBeauty],
  ['hardware', hardware],
  ['toys and games', toysGames],
]);

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const catKey = (c) => String(c ?? '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
const ownRx = (names) => new RegExp(`^(${names.map(esc).join('|')})$`, 'i');
const wordsRx = (words) => new RegExp(`\\b(${words.join('|')})\\b`, 'i');
// Not shelf: each [word, only, unless] as three regexes; the word stops when "only" (if any) is there and "unless" is not.
const shelfRules = (entries) => entries.map(([w, only, unless]) => ({
  word: new RegExp(`\\b(?:${w})\\b`, 'i'),
  only: only ? new RegExp(`\\b(?:${only})\\b`, 'i') : null,
  unless: unless ? new RegExp(`\\b(?:${unless})\\b`, 'i') : null,
}));
const notShelfHit = (rules, t) => {
  for (const r of rules) {
    const m = t.match(r.word);
    if (m && (!r.only || r.only.test(t)) && !(r.unless && r.unless.test(t))) return m[0];
  }
  return null;
};
const anyRx = (sources) => new RegExp(sources.map((s) => `(?:${s})`).join('|'), 'i');

// The shared lists as single regexes, for scripts that only need the old three (shelf-barcodes, shelf.mjs).
export const OWN_LABEL = ownRx(OWN);
const SHARED_SHELF = shelfRules(NOT);
export const NOT_SHELF = { test: (t) => notShelfHit(SHARED_SHELF, String(t ?? '')) != null };
export const RESTRICTED = anyRx(Object.values(RES));
export const CANT_POST = anyRx(Object.values(POST));

const notRestricted = Object.fromEntries(Object.entries(NOT_RESTRICTED).map(([k, v]) => [k, new RegExp(v, 'i')]));
const toiletry = new RegExp(TOILETRY_AEROSOL, 'i');
const restrictedParts = Object.entries(RES).map(([k, s]) => [k, new RegExp(s, 'i')]);
const postParts = Object.entries(POST).map(([k, s]) => [k, new RegExp(s, 'i')]);
const postChecks = POST_CHECK.map(([label, s]) => [label, new RegExp(s, 'i')]);

// Built once per category and kept.
const cache = new Map();
function forCategory(category) {
  const k = catKey(category);
  if (cache.has(k)) return cache.get(k);
  const extra = BY_CATEGORY.get(k) ?? {};
  const rules = {
    own: extra.OWN_LABEL?.length ? ownRx([...OWN, ...extra.OWN_LABEL]) : OWN_LABEL,
    notShelf: extra.NOT_SHELF?.length ? [...SHARED_SHELF, ...shelfRules(extra.NOT_SHELF.map((e) => (Array.isArray(e) ? e : [e])))] : SHARED_SHELF,
    // A category's extras are named (an object) or numbered (an array).
    restricted: [...restrictedParts, ...(Array.isArray(extra.RESTRICTED) ? extra.RESTRICTED.map((s, i) => [`${k} ${i + 1}`, s]) : Object.entries(extra.RESTRICTED ?? {})).map(([n, s]) => [n, new RegExp(s, 'i')])],
    branded: extra.BRANDED ? new RegExp(extra.BRANDED, 'i') : null,
    ownTitle: extra.OWN_TITLE ? new RegExp(extra.OWN_TITLE, 'i') : null,
    lines: extra.LINES ?? {},
    post: [...postParts, ...(extra.CANT_POST ?? []).map((s, i) => [`${k} ${i + 1}`, new RegExp(s, 'i')])],
  };
  cache.set(k, rules);
  return rules;
}

/*
 * Where a Google product stops, or null when it goes on to the shops. rule names the list that caught it
 * (alcohol, compressed_gas and so on) and hit the words, so a wrong stop can be traced to one line.
 */
export function stopOf({ title, brand = '', category = '' }) {
  const r = forCategory(category);
  const t = String(title ?? '');
  if (r.own.test(String(brand ?? '').trim()) && !(r.branded && r.branded.test(t))) return { stop: 'own_label', rule: 'own label', hit: String(brand).trim() };
  if (r.ownTitle) { const m = t.match(r.ownTitle); if (m) return { stop: 'own_label', rule: 'own label', hit: m[0] }; }
  const ns = notShelfHit(r.notShelf, t);
  if (ns) return { stop: 'not_shelf', rule: 'not shelf', hit: ns };
  if (staleYear(t)) return { stop: 'not_shelf', rule: 'dated', hit: t.match(/\b20\d\d\b/)[0] };
  for (const [rule, rx] of r.restricted) {
    const m = t.match(rx);
    if (m && !notRestricted[rule]?.test(t)) return { stop: 'restricted', rule, hit: m[0] };
  }
  for (const [rule, rx] of r.post) {
    const m = t.match(rx);
    if (!m) continue;
    if (rule === 'aerosol' && toiletry.test(t)) continue;
    return { stop: 'cant_post', rule, hit: m[0] };
  }
  return null;
}

// Royal Mail limits a product passes with, as one line for her card, or ''.
export function postCheckOf(title) {
  const t = String(title ?? '');
  return postChecks.filter(([, rx]) => rx.test(t)).map(([label]) => label).join('; ');
}

// A maker's ranges for a category (Epoch: Sylvanian Families), so store-picks searches the shops under the range too.
export function linesOf(category) {
  return forCategory(category).lines;
}
