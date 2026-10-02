// The shop check (keeper-task-01-shop-drafts.md): returns, chemical and label, the shop title, and Keeper's own
// unsaved draft read against the facts. One call on the words; photos only for a chemical's label or an unclear
// product. Pure here, so the tests hold the rules; the calls and the write are in functions/keeper-run.

import { RULES_SYSTEM, RULES_TOOL, derivedPatch, rulesFacts, tidyRules } from './shop-rules.ts';

type Json = Record<string, any>;

export const CHECK_VERSION = 1;

const clip = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
// Every dash the house style forbids, from the figure dash to the horizontal bar, and the minus sign.
const DASHES = /[‒-―−]/g;
export const dashless = (s: string) => s.replace(DASHES, ',').replace(/\s+,/g, ',').replace(/,{2,}/g, ',');

export const CHECK_SYSTEM = `${RULES_SYSTEM}

Judge returns from the words first. Ask for the photographs (needs_photos) only when the product is a chemical whose label must be read, or when the words leave it unclear what the product is.

TITLE. The product is going on a small UK shop's own website, where Google, Google Shopping and AI answer engines read the title to decide what it is. Many titles were copied from eBay and are written for eBay's search. Write the shop title:
1. What it is first, in the words a person would search for: "Blind Valance Clips", not "10Pcs Blind Valance Clips 2.5" Window Blinds Hidden Clip Retainer Holder".
2. Then what tells it apart: the brand when it is a real brand people search for, the size, the count or pack, the material or colour, the model number.
3. Plain and readable: about 50 to 70 characters, normal capitals, no hashtags, no counts in front ("10Pcs"), no "UK seller", "new", "free postage", "fast dispatch", no repeated words, no dashes, no emoji.
4. True: every number in the title is in the facts. Never invent a size, count or model.
A name that is a seller's shop name rather than a maker's brand (random letters, "Store", a name nobody searches) is not a brand: leave it out and say brand_is_seller.
If the facts do not say clearly what the product is, give the best title you can and set title_clear to false.

FACTS. You are also given Keeper's own unsaved draft (a description and title choices written earlier). Read them against the facts. For every number, size, count or pack in the draft that disagrees with the facts, give the field, what the draft says and what the facts say. When the description has such an error, give corrected_description: the same description with only those errors put right, nothing else changed. Never correct something the facts do not settle.

Her past changes, when given, show how the shop owner decides. Follow them where they apply.

Write every reason in one short plain sentence about the goods, in British English, never about the shop owner.`;

export const CHECK_TOOL = {
  name: 'check',
  description: 'The returns class, whether it is a chemical, whether photographs are needed, the shop title, and any errors in the unsaved draft.',
  input_schema: {
    type: 'object',
    properties: {
      returns_class: { type: 'string', enum: ['standard', 'sealed', 'none'] },
      returns_reason: { type: 'string' },
      chemical: { type: 'boolean' },
      chemical_reason: { type: 'string' },
      biocide: { type: 'boolean' },
      needs_photos: { type: 'boolean' },
      title: { type: 'string' },
      title_reason: { type: 'string' },
      title_clear: { type: 'boolean' },
      brand_is_seller: { type: 'boolean' },
      facts_errors: {
        type: 'array',
        items: {
          type: 'object',
          properties: { field: { type: 'string', enum: ['title', 'description'] }, says: { type: 'string' }, facts: { type: 'string' } },
          required: ['field', 'says', 'facts'],
        },
      },
      corrected_description: { type: 'string' },
    },
    required: ['returns_class', 'returns_reason', 'chemical', 'chemical_reason', 'biocide', 'needs_photos', 'title', 'title_reason', 'title_clear', 'brand_is_seller', 'facts_errors', 'corrected_description'],
  },
};

// The label read, when it is wanted: the same tool and system the product sheet's check has always used.
export const LABEL_SYSTEM = RULES_SYSTEM;
export const LABEL_TOOL = RULES_TOOL;

// Keeper's own unsaved draft (the writing pass, version 2), or null once she has applied it.
export const ownDraft = (p: Json): Json | null => {
  const d = p?.derived_fields?.draft;
  return d && d.version === 2 && !d.applied_at ? d : null;
};

// A title is Keeper's to change only on a copy from eBay, and only when nobody has saved one. A title written on the
// Approved page or typed into a product is hers.
export const mayRetitle = (p: Json) => p?.source_kind === 'ebay_listing' && !p?.derived_fields?.title_by;

/*
 * The facts the check reads: the draft's own fields, its eBay description, Keeper's unsaved draft, and the last
 * changes she made to Keeper's work.
 */
export function checkFacts(p: Json, overrides: Json[] = [], listing: Json | null = null, item: Json | null = null) {
  const own = ownDraft(p);
  const parts = [rulesFacts(p, listing, item)];
  if (p?.gtin) parts.push(`Barcode: ${p.gtin}`);
  if (own) {
    const titles = Object.values(own.titles ?? {}).filter(Boolean).map((t) => clip(t, 120));
    parts.push(`\nKeeper's unsaved draft:\nDescription: ${clip(own.description, 2000) || '(none)'}\nTitle choices: ${titles.join(' | ') || '(none)'}`);
  }
  const past = overrides.slice(0, 20).map((o) => `${o.field}: Keeper said ${JSON.stringify(o.keeper_value)}, she chose ${JSON.stringify(o.her_value)}`);
  if (past.length) parts.push(`\nHer past changes:\n${past.join('\n')}`);
  return parts.join('\n');
}

// Words that only ever mean a seller's patter or eBay's search, never the product.
const PATTER = /\b(uk seller|uk stock|fast (dispatch|delivery|shipping)|free (p ?& ?p|postage|delivery|shipping)|brand new|new in box|bnib|hot sale|best seller|top quality|high quality|l@@k|wow|bargain|cheap)\b/i;
const LEADING_COUNT = /^\s*\d+\s*(pcs|pc|pieces|x|pack|pk)\b/i;
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const STOP = new Set(['with', 'and', 'for', 'the', 'pack', 'inch', 'from', 'that', 'this', 'your']);
const numbersIn = (s: string) => (String(s).match(/\d+(?:\.\d+)?/g) ?? []).map((n) => n.replace(/^0+(?=\d)/, ''));

/*
 * What is wrong with a shop title, in her words. Empty means it can be saved. The facts text is everything the
 * check read, so a number in the title has to appear in it somewhere.
 */
export function titleProblems(title: string, facts: string) {
  const t = String(title ?? '').trim();
  const out: string[] = [];
  if (t.length < 12) out.push('too short to say what it is');
  if (t.length > 90) out.push(`too long at ${t.length} characters`);
  if (t.includes('#')) out.push('has a hashtag');
  if (LEADING_COUNT.test(t)) out.push('starts with a count');
  if (PATTER.test(t)) out.push('has seller wording');
  if (EMOJI.test(t)) out.push('has an emoji');
  if (DASHES.test(t) || /\s-\s/.test(t)) out.push('has a dash');
  DASHES.lastIndex = 0;
  const shouty = t.split(/\s+/).filter((w) => /^[A-Z]{4,}$/.test(w));
  if (shouty.length >= 2) out.push('written in capitals');
  const words = t.toLowerCase().split(/[^a-z0-9.]+/).filter((w) => w.length >= 4 && !STOP.has(w) && !/^\d/.test(w));
  const seen = new Set<string>();
  for (const w of words) {
    const stem = w.replace(/s$/, '');
    if (seen.has(stem)) { out.push(`repeats "${w}"`); break; }
    seen.add(stem);
  }
  const known = new Set(numbersIn(facts));
  const missing = numbersIn(t).filter((n) => !known.has(n));
  if (missing.length) out.push(`${missing.join(', ')} is not in the facts`);
  return out;
}

// The address from the title, the way the eBay import makes it, without the listing number.
export function slugFor(title: string) {
  return title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70).replace(/-+$/, '') || 'product';
}

/*
 * The same product twice among the drafts: the same barcode, or the same numbers and nearly the same words once
 * counts and seller wording are taken out. Returns each product's partners. Never decides which to keep.
 */
const KEY_DROP = /\b(pcs|pc|pack|set|of|the|and|with|for|uk|new|x)\b/g;
const keyWords = (t: string) => new Set(String(t).toLowerCase().replace(KEY_DROP, ' ').split(/[^a-z0-9]+/).filter((w) => w.length >= 3));
export function duplicates(products: Json[]) {
  const pairs = new Map<string, string[]>();
  const add = (a: string, b: string) => {
    pairs.set(a, [...new Set([...(pairs.get(a) ?? []), b])]);
    pairs.set(b, [...new Set([...(pairs.get(b) ?? []), a])]);
  };
  const rows = products.map((p) => ({
    id: String(p.id), gtin: String(p.gtin ?? '').replace(/\D/g, ''),
    nums: numbersIn(p.title).sort().join(' '), words: keyWords(p.title),
  }));
  for (let i = 0; i < rows.length; i += 1) {
    for (let k = i + 1; k < rows.length; k += 1) {
      const a = rows[i]; const b = rows[k];
      if (a.gtin.length >= 8 && a.gtin === b.gtin) { add(a.id, b.id); continue; }
      if (a.nums !== b.nums || a.words.size < 2 || b.words.size < 2) continue;
      const shared = [...a.words].filter((w) => b.words.has(w)).length;
      const union = new Set([...a.words, ...b.words]).size;
      if (shared / union >= 0.8) add(a.id, b.id);
    }
  }
  return pairs;
}

// Whether the portal holds this draft back for a label today (useCatalogue's needsLabel), before Keeper's verdict.
export const flaggedForLabel = (p: Json) => Boolean(p?.derived_fields?.hazard_suspect
  || ((p?.derived_fields?.draft?.care ?? []).includes('biocide') && !p?.derived_fields?.hazard_checked));

export type Tray = 'ready' | 'label' | 'not_chemical' | 'choose' | 'unread';

/*
 * Everything the check found, settled into what is written and what she sees. `words` is the first answer,
 * `label` the photo read when there was one. Nothing here talks to Claude or the database.
 */
export function settle(p: Json, words: Json, label: Json | null, facts: string, partners: string[] = [], at = new Date().toISOString()) {
  // The photo read can only add: a chemical the words missed, a biocide, the label itself.
  const rules = tidyRules({
    ...words,
    chemical: words?.chemical === true || label?.chemical === true,
    biocide: words?.biocide === true || label?.biocide === true,
    label: label?.label ?? {},
  }, at);
  const patch = derivedPatch(rules, p?.derived_fields ?? {});

  // The title: only on an eBay copy nobody has titled, and only when it passes every rule.
  const current = String(p?.title ?? '').trim();
  const proposed = dashless(clip(words?.title, 120));
  const retitle = mayRetitle(p) && Boolean(proposed) && proposed !== current;
  const problems = retitle ? titleProblems(proposed, `${facts}\n${current}`) : [];
  if (retitle && words?.title_clear === false) problems.push('the facts do not say clearly what it is');
  const title = retitle && problems.length === 0 ? proposed : null;
  const titleNeedsHer = retitle && !title;

  // Keeper's own unsaved description, put right where the facts say it is wrong.
  const own = ownDraft(p);
  const errors = (Array.isArray(words?.facts_errors) ? words.facts_errors : [])
    .map((e: Json) => ({ field: e?.field === 'title' ? 'title' : 'description', says: dashless(clip(e?.says, 160)), facts: dashless(clip(e?.facts, 160)) }))
    .filter((e: Json) => e.says && e.facts);
  const corrected = dashless(String(words?.corrected_description ?? '').trim());
  const fixDescription = Boolean(own?.description && corrected && errors.some((e: Json) => e.field === 'description') && corrected !== own.description);
  if (fixDescription) patch.draft = { ...own, description: corrected, corrected_at: at, corrections: errors };

  const check: Json = {
    version: CHECK_VERSION,
    at,
    title_reason: dashless(clip(words?.title_reason, 240)) || null,
    title_problems: titleNeedsHer ? problems : [],
    suggested_title: titleNeedsHer ? proposed : null,
    brand_is_seller: words?.brand_is_seller === true && Boolean(p?.brand),
    duplicate_of: partners,
    corrections: fixDescription ? errors : [],
  };
  patch.check = check;

  // The tray, first that applies: something for her to choose, then a label to copy, then a word flag that is not a
  // chemical, then ready. A label she has already saved or ticked is not asked for again.
  const labelDone = Boolean(p?.hazard) || Boolean(p?.derived_fields?.hazard_checked);
  const returnsNeedHer = rules.returns !== 'standard' && p?.derived_fields?.returns_by !== 'her';
  const tray: Tray = partners.length > 0 || returnsNeedHer || titleNeedsHer ? 'choose'
    : rules.rules.chemical && !labelDone ? 'label'
      : !rules.rules.chemical && flaggedForLabel(p) ? 'not_chemical'
        : 'ready';

  return { tray, patch, returns: rules.returns, title, slug: title ? slugFor(title) : null, line: lineFor(tray, rules, check, title, p) };
}

// Keeper's one line, in her words, for the log and the tray card.
export function lineFor(tray: Tray, rules: Json, check: Json, title: string | null, p: Json) {
  const r = rules.rules;
  const bits: string[] = [];
  if (check.duplicate_of?.length) bits.push('Looks like the same product as another draft, so choose which to keep.');
  if (rules.returns === 'sealed') bits.push(`Sealed only: ${r.returns_reason}`);
  else if (rules.returns === 'none') bits.push(`No return: ${r.returns_reason}`);
  if (tray === 'label') bits.push(rules.hazard_draft ? `A chemical, label read from ${rules.hazard_draft.read_from || 'the facts'}: check it against the bottle.` : `A chemical: ${r.chemical_reason} Copy the label from the bottle.`);
  if (tray === 'not_chemical') bits.push(`Not a chemical: ${r.chemical_reason}`);
  if (tray === 'ready') bits.push(`Standard returns: ${r.returns_reason}`);
  if (title) bits.push(`New title: ${title}.`);
  if (check.title_problems?.length) bits.push(`Title needs you: ${check.title_problems.join(', ')}.`);
  if (check.corrections?.length) bits.push(`Corrected the drafted description: ${check.corrections.map((c: Json) => `${c.says} is ${c.facts}`).join('; ')}.`);
  if (check.brand_is_seller) bits.push(`"${p?.brand}" looks like a seller's name, not a brand.`);
  return dashless(bits.join(' ').replace(/\.\./g, '.')).slice(0, 600);
}

// What a call cost, in pence. The prices are per million tokens in US dollars, set on the function (KEEPER_PRICE_*),
// and the pound rate likewise; the token counts are kept on the job too, so a wrong price can be put right later.
export function costPence(usage: Json | undefined, prices: { input: number; output: number; cacheWrite: number; cacheRead: number; gbpPerUsd: number }) {
  if (!usage) return 0;
  const usd = (Number(usage.input_tokens ?? 0) * prices.input
    + Number(usage.output_tokens ?? 0) * prices.output
    + Number(usage.cache_creation_input_tokens ?? 0) * prices.cacheWrite
    + Number(usage.cache_read_input_tokens ?? 0) * prices.cacheRead) / 1_000_000;
  return Math.round(usd * prices.gbpPerUsd * 100 * 10000) / 10000;
}

export const tokensOf = (usage: Json | undefined) => ({
  input: Number(usage?.input_tokens ?? 0),
  output: Number(usage?.output_tokens ?? 0),
  cache_write: Number(usage?.cache_creation_input_tokens ?? 0),
  cache_read: Number(usage?.cache_read_input_tokens ?? 0),
});
