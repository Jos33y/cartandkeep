// The shop check (keeper-task-01-shop-drafts.md): returns, chemical and label, the shop title, and Keeper's own
// unsaved draft read against the facts. One call on the words; photos only for a chemical's label or an unclear
// product. Pure here, so the tests hold the rules; the calls and the write are in functions/keeper-run.

import { RULES_SYSTEM, RULES_TOOL, rulesFacts, tidyRules } from './shop-rules.ts';

type Json = Record<string, any>;

export const CHECK_VERSION = 2;

const clip = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
// Every dash the house style forbids, from the figure dash to the horizontal bar, and the minus sign.
const DASHES = /[\u2012-\u2015\u2212]/g;
export const dashless = (s: string) => s.replace(DASHES, ',').replace(/\s+,/g, ',').replace(/,{2,}/g, ',');

export const CHECK_SYSTEM = `${RULES_SYSTEM}

You decide like an experienced UK seller, not a compliance officer. Nothing here stops a product going on sale unless eBay or the law would stop it.

Judge returns from the words first and decide them yourself. Set returns_sure to false only when the goods could honestly go either way. Ask for the photographs (needs_photos) only when the product is a chemical whose label should be read, or when the words leave it unclear what the product is.

TITLE. The product is going on a small UK shop's own website, where Google, Google Shopping and AI answer engines read the title to decide what it is. Many titles were copied from eBay and are written for eBay's search. Write the shop title:
1. What it is first, in the words a person would search for: "Blind Valance Clips", not "10Pcs Blind Valance Clips 2.5" Window Blinds Hidden Clip Retainer Holder".
2. Then what tells it apart: the brand when it is a real brand people search for, the size, the count or pack, the material or colour, the model number.
3. Plain and readable: about 50 to 70 characters, normal capitals, no hashtags, no counts in front ("10Pcs"), no "UK seller", "new", "free postage", "fast dispatch", no repeated words, no dashes, no emoji.
4. True: every number in the title is in the facts. Never invent a size, count or model.
A name that is a seller's shop name rather than a maker's brand (random letters, "Store", a name nobody searches) is not a brand: leave it out and say brand_is_seller.
If the facts do not say clearly what the product is, give the best title you can and set title_clear to false.

ALREADY ON THE SHOP. You may be given products already on the shop that look similar, each with a letter. If one is the same product (the same thing, perhaps with another title or from another supplier), give its letter in same_as. A different size, colour, count or pack is a different product. Otherwise same_as is empty.

QUESTIONS LEFT EARLIER. You may be given questions left on the product by an earlier pass, each with an id and its options. Answer every one in answers, as the seller would, from the facts. Pick an option only when the facts settle it. When the question is about a detail the sources disagree on, or that the facts do not settle, answer "Leave out": a detail left off never puts wrong information on the shop. A note with a single option only needs that option.

BIOCIDES. For a biocide (an insect, rodent or weed killer, a repellent, a disinfectant), say in biocide_kind what a shopper would call it in the plural: insecticides, rodenticides, weed killers, repellents, disinfectants, or biocides when none fits.

FACTS. You are also given Keeper's own unsaved draft (a description and title choices written earlier). Read them against the facts. For every number, size, count or pack in the draft that disagrees with the facts, give the field, what the draft says and what the facts say. When the description has such an error, give corrected_description: the same description with only those errors put right, nothing else changed. Never correct something the facts do not settle.

Her past changes, when given, show how the shop owner decides. Follow them where they apply.

Write every reason as you would say it to the shop owner across the counter: one short plain sentence about the goods, in British English, with no law names, codes, agency names or field names, never about the shop owner.`;

export const CHECK_TOOL = {
  name: 'check',
  description: 'The returns class, whether it is a chemical, the shop title, any match already on the shop, answers to questions left earlier, and any errors in the unsaved draft.',
  input_schema: {
    type: 'object',
    properties: {
      returns_class: { type: 'string', enum: ['standard', 'sealed', 'none'] },
      returns_sure: { type: 'boolean' },
      returns_reason: { type: 'string' },
      chemical: { type: 'boolean' },
      chemical_reason: { type: 'string' },
      biocide: { type: 'boolean' },
      biocide_kind: { type: 'string', enum: ['insecticides', 'rodenticides', 'weed killers', 'repellents', 'disinfectants', 'biocides', ''] },
      needs_photos: { type: 'boolean' },
      title: { type: 'string' },
      title_reason: { type: 'string' },
      title_clear: { type: 'boolean' },
      brand_is_seller: { type: 'boolean' },
      same_as: { type: 'string' },
      answers: {
        type: 'array',
        items: { type: 'object', properties: { id: { type: 'string' }, answer: { type: 'string' } }, required: ['id', 'answer'] },
      },
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
    required: ['returns_class', 'returns_sure', 'returns_reason', 'chemical', 'chemical_reason', 'biocide', 'biocide_kind', 'needs_photos', 'title', 'title_reason', 'title_clear', 'brand_is_seller', 'same_as', 'answers', 'facts_errors', 'corrected_description'],
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
 * Questions an earlier pass left on the product, as the portal reads them (useCatalogue's checksFor): a saved record
 * wins over a fresh draft, and a legacy list she only had to read becomes one-option notes.
 */
export function checksOf(p: Json): { decide: Json[]; done: string[] } | null {
  const stored = p?.derived_fields?.checks;
  const draft = p?.derived_fields?.draft;
  const legacy = (items: string[], readAt: unknown) => items.map((q, i) => ({
    id: `legacy-${i}`, question: q, options: ['Noted'], detail: null, answer: readAt ? 'Noted' : null,
  }));
  let decide: Json[] = [];
  let done: string[] = [];
  if (stored?.decide || stored?.done) {
    decide = stored.decide ?? [];
    done = stored.done ?? [];
  } else if (stored?.items?.length) {
    decide = legacy(stored.items, stored.read_at);
  } else if (draft?.version !== 2 && draft?.flags?.length) {
    decide = legacy(draft.flags, null);
  }
  if (draft?.version === 2 && !draft.applied_at) {
    const have = new Set(decide.map((d) => d.id));
    decide = [...decide, ...(draft.decide ?? []).filter((d: Json) => !have.has(d.id)).map((d: Json) => ({ ...d, answer: null }))];
    done = [...new Set([...done, ...(draft.done ?? [])])];
  }
  return decide.length || done.length ? { decide, done } : null;
}

/*
 * The facts the check reads: the draft's own fields, its eBay description, Keeper's unsaved draft, products already
 * on the shop that may be the same, the questions left on it earlier, and the last changes she made to Keeper's work.
 */
export function checkFacts(p: Json, overrides: Json[] = [], listing: Json | null = null, item: Json | null = null, similar: Json[] = []) {
  const own = ownDraft(p);
  const parts = [rulesFacts(p, listing, item)];
  if (p?.gtin) parts.push(`Barcode: ${p.gtin}`);
  if (own) {
    const titles = Object.values(own.titles ?? {}).filter(Boolean).map((t) => clip(t, 120));
    parts.push(`\nKeeper's unsaved draft:\nDescription: ${clip(own.description, 2000) || '(none)'}\nTitle choices: ${titles.join(' | ') || '(none)'}`);
  }
  if (similar.length) {
    parts.push(`\nAlready on the shop, possibly the same product:\n${similar.map((x) => `${x.ref}: ${clip(x.title, 140)}`).join('\n')}`);
  }
  const open = (checksOf(p)?.decide ?? []).filter((q) => !q.answer);
  if (open.length) {
    parts.push(`\nQuestions left earlier:\n${open.map((q) => `${q.id}: ${clip(q.question, 300)} Options: ${(q.options ?? []).map((o: string) => clip(o, 120)).join(' / ')}${q.detail ? ` (a detail: ${q.detail})` : ''}`).join('\n')}`);
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

/*
 * The address: the first six words that say what it is, about forty characters, no listing numbers. Short and
 * readable is what Google shows under the title; the words still carry the search terms.
 */
const SLUG_DROP = new Set(['a', 'an', 'and', 'the', 'of', 'with', 'for', 'in', 'on', 'to', 'by', 'from', 'uk', 'new', 'pcs', 'pc', 'x']);
const SLUG_WORDS = 6;
const SLUG_MAX = 50;
export function slugFor(title: string) {
  const words = String(title ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ')
    .split(/[\s,/|]+/).map((w) => w.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')).filter((w) => w && !SLUG_DROP.has(w) && !/^\d+(pcs|pc|pk|x)$/.test(w));
  const out: string[] = [];
  for (const w of words) {
    if (out.length >= SLUG_WORDS || [...out, w].join('-').length > SLUG_MAX) break;
    out.push(w);
  }
  return out.join('-') || 'product';
}

// An address worth making again on a draft: one with an eBay listing number on the end, or a long one.
export const slugNeedsWork = (slug: string) => /-\d{8,}$/.test(String(slug ?? '')) || String(slug ?? '').length > SLUG_MAX;

/*
 * The same product twice among the drafts: the same barcode, or the same numbers and nearly the same words once
 * counts and seller wording are taken out. Returns each product's partners. Never decides which to keep.
 */
const KEY_DROP = /\b(pcs|pc|pack|set|of|the|and|with|for|uk|new|x)\b/g;
const keyWords = (t: string) => new Set(String(t).toLowerCase().replace(KEY_DROP, ' ').split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !/^\d+$/.test(w)));
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

/*
 * A draft against what is already on the shop. Certain in code: the same barcode, or the same eBay listing or
 * supplier page. Possible: two or more key words shared, half of the shorter title's; up to three of those go to
 * Claude in the same call, lettered, and it says which one, if any, is the same thing.
 */
export function liveMatches(p: Json, live: Json[]) {
  const gtin = String(p?.gtin ?? '').replace(/\D/g, '');
  const ref = String(p?.source_ref ?? '');
  const certain = live.filter((l) => (gtin.length >= 8 && String(l.gtin ?? '').replace(/\D/g, '') === gtin) || (ref && l.source_ref === ref));
  const mine = keyWords(p?.title);
  const similar = live
    .filter((l) => !certain.includes(l))
    .map((l) => {
      const theirs = keyWords(l.title);
      const shared = [...mine].filter((w) => theirs.has(w)).length;
      return { l, shared, share: shared / Math.max(1, Math.min(mine.size, theirs.size)) };
    })
    .filter((x) => x.shared >= 2 && x.share >= 0.5)
    .sort((a, b) => b.share - a.share || b.shared - a.shared)
    .slice(0, 3)
    .map((x, i) => ({ ref: String.fromCharCode(65 + i), id: String(x.l.id), title: x.l.title }));
  return { certain: certain.map((l) => ({ id: String(l.id), title: l.title })), similar };
}

// The words the law does not allow in an advert for a biocide (HSE, advertising requirements for biocidal products).
const BIOCIDE_BANNED = /\b(non[ -]?toxic|harmless|natural|environmentally friendly|animal friendly|low[ -]risk)\b/gi;
const safetyLine = (kind: string) => `Use ${kind || 'biocides'} safely. Always read the label and product information before use.`;
const hasSafetyLine = (text: unknown) => /read the label and product information before use/i.test(String(text ?? ''));

// What keeps a product off the shop that only she can add, as the portal's release check reads it.
export function gapsOf(p: Json, decide: Json[]) {
  const out: string[] = [];
  if (!(Number(p?.price) > 0)) out.push('a price');
  if (!p?.image_url) out.push('a photograph');
  if (p?.availability === 'out_of_stock' || p?.availability === 'discontinued') out.push('to be marked available');
  if (typeof p?.stock === 'number' && p.stock <= 0) out.push('stock');
  const open = decide.filter((q) => !q.answer).length;
  if (open) out.push(open === 1 ? 'an answer to one question' : `answers to ${open} questions`);
  for (const q of decide) if (q.answer && Array.isArray(q.holds) && q.holds.includes(q.answer) && q.hold) out.push(String(q.hold).toLowerCase());
  return out;
}

// A detail value from an answer, without the earlier pass's note of where it came from.
const cleanOption = (o: string) => String(o).replace(/\s*\((from|per|in|as)\b[^)]*\)\s*$/i, '').trim();

export type Tray = 'ready' | 'label' | 'choose' | 'unread';

type SettleOpts = { partners?: string[]; live?: Json[]; certain?: Json[] };

/*
 * Everything the check found, settled into what is written and what she sees. `words` is the first answer, `label`
 * the photo read when there was one. Nothing here talks to Claude or the database.
 *
 * Keeper decides like a seller: it sets the returns, puts the label warnings on the page when it can read them, adds
 * the safety line a biocide's advert needs, answers the questions an earlier pass left, and leaves out a detail the
 * sources disagree on. Only what eBay or the law would stop, or what only she can add, comes to her.
 */
export function settle(p: Json, words: Json, label: Json | null, facts: string, opts: SettleOpts = {}, at = new Date().toISOString()) {
  const derived = p?.derived_fields ?? {};
  const rules = tidyRules({
    ...words,
    chemical: words?.chemical === true || label?.chemical === true,
    biocide: words?.biocide === true || label?.biocide === true,
    label: label?.label ?? {},
  }, at);
  const notes: string[] = [];

  // Returns: Keeper's call, unless she has made it, or the goods could honestly go either way.
  const hers = derived.returns_by === 'her';
  const unsure = !hers && rules.returns !== 'standard' && words?.returns_sure === false;
  const patch: Json = { rules: rules.rules, returns_class: unsure ? rules.returns : null };
  if (hers) delete patch.returns_class;
  else if (!unsure) patch.returns_by = 'keeper';
  const returns = hers || unsure ? null : rules.returns;

  // The label: never a gate. Read warnings go on the page; when none can be read, a note.
  patch.hazard_suspect = false;
  patch.hazard_checked = true;
  patch.hazard_draft = null;
  let hazard: Json | null = null;
  let biocideReg: string | null = null;
  if (rules.rules.chemical && rules.hazard_draft && !p?.hazard) {
    const { signal, h, p: pr, pictograms } = rules.hazard_draft;
    if (signal || h.length || pr.length || pictograms.length) hazard = { signal, h, p: pr, pictograms };
    if (rules.hazard_draft.biocide_reg_no && !p?.biocide_reg_no) biocideReg = rules.hazard_draft.biocide_reg_no;
    if (hazard) { patch.hazard_by = 'keeper'; patch.hazard_read_from = rules.hazard_draft.read_from; }
  }
  if (rules.rules.chemical && !hazard && !p?.hazard) notes.push('A chemical, but no warnings could be read from the photos or the words. Add them if you have them.');

  // The title: only on an eBay copy nobody has titled, and only when it passes every rule. A title that does not is
  // a suggestion, never a hold.
  const current = String(p?.title ?? '').trim();
  const proposed = dashless(clip(words?.title, 120));
  const retitle = mayRetitle(p) && Boolean(proposed) && proposed !== current;
  const problems = retitle ? titleProblems(proposed, `${facts}\n${current}`) : [];
  if (retitle && words?.title_clear === false) problems.push('the facts do not say clearly what it is');
  const title = retitle && problems.length === 0 ? proposed : null;
  const suggestion = retitle && !title ? proposed : null;

  // The address: from the new title, or made again from the current one when it carries a listing number.
  const slug = title ? slugFor(title) : slugNeedsWork(p?.slug) && slugFor(current) !== p?.slug ? slugFor(current) : null;

  // Keeper's own unsaved description, put right where the facts say it is wrong.
  const own = ownDraft(p);
  const errors = (Array.isArray(words?.facts_errors) ? words.facts_errors : [])
    .map((e: Json) => ({ field: e?.field === 'title' ? 'title' : 'description', says: dashless(clip(e?.says, 160)), facts: dashless(clip(e?.facts, 160)) }))
    .filter((e: Json) => e.says && e.facts);
  const corrected = dashless(String(words?.corrected_description ?? '').trim());
  let ownDescription: string | null = own?.description ?? null;
  const fixDescription = Boolean(ownDescription && corrected && errors.some((e: Json) => e.field === 'description') && corrected !== ownDescription);
  if (fixDescription) ownDescription = corrected;

  // A biocide's advert carries the safety line, at the end of the description: added, nothing of hers changed.
  let description: string | null = null;
  let safety = false;
  if (rules.rules.biocide) {
    const line = safetyLine(String(words?.biocide_kind ?? ''));
    const saved = String(p?.description ?? '').trim();
    if (saved && !hasSafetyLine(saved)) { description = `${saved}\n\n${line}`; safety = true; }
    else if (!saved && ownDescription && !hasSafetyLine(ownDescription)) { ownDescription = `${ownDescription}\n\n${line}`; safety = true; }
    const banned = [...new Set((`${current} ${saved || ownDescription || ''}`.match(BIOCIDE_BANNED) ?? []).map((w) => w.toLowerCase()))];
    if (banned.length) notes.push(`Says ${banned.map((w) => `"${w}"`).join(' and ')}, which an insect or weed killer's advert may not. Worth taking out.`);
  }
  if (own && ownDescription !== own.description) patch.draft = { ...own, description: ownDescription, corrected_at: at, ...(fixDescription ? { corrections: errors } : {}) };

  // Questions an earlier pass left: Keeper answers each as the seller would. A disputed detail is left out.
  const checks = checksOf(p);
  const given = new Map((Array.isArray(words?.answers) ? words.answers : []).map((a: Json) => [String(a?.id), String(a?.answer ?? '').trim()]));
  let specs: Json | null = null;
  let answered = 0; let leftOut = 0;
  const decide = (checks?.decide ?? []).map((q) => {
    if (q.answer) return q;
    const options: string[] = Array.isArray(q.options) ? q.options : [];
    const a = given.get(String(q.id)) ?? '';
    let answer: string | null = null;
    if (options.includes(a)) answer = a;
    else if (/^leave (it )?out$/i.test(a) && q.detail) answer = 'Left out';
    else if (options.length === 1) answer = options[0];
    if (!answer) return q;
    answered += 1;
    if (q.detail) {
      const next: Json = { ...(specs ?? p?.specifications ?? {}) };
      const key = Object.keys(next).find((k) => k.trim().toLowerCase() === String(q.detail).trim().toLowerCase());
      if (answer === 'Left out') { leftOut += 1; if (key) delete next[key]; } else next[key ?? q.detail] = cleanOption(answer);
      specs = next;
    }
    return { ...q, answer, answered_by: 'keeper' };
  });
  if (checks) patch.checks = { decide, done: checks.done };

  // The same product twice: another draft in this run, or something already on the shop.
  const partners = opts.partners ?? [];
  const sameAs = (opts.live ?? []).find((x) => x.ref && x.ref === String(words?.same_as ?? '').trim().toUpperCase());
  const liveTwin = [...(opts.certain ?? []), ...(sameAs ? [sameAs] : [])][0] ?? null;

  const gaps = gapsOf(p, decide);
  const check: Json = {
    version: CHECK_VERSION,
    at,
    title_reason: dashless(clip(words?.title_reason, 240)) || null,
    title_problems: suggestion ? problems : [],
    suggested_title: suggestion,
    brand_is_seller: words?.brand_is_seller === true && Boolean(p?.brand),
    duplicate_of: partners,
    same_as_live: liveTwin ? { id: liveTwin.id, title: liveTwin.title } : null,
    corrections: fixDescription ? errors : [],
    notes,
    gaps,
  };
  patch.check = check;

  const tray: Tray = partners.length > 0 || liveTwin || unsure || gaps.length > 0 ? 'choose'
    : hazard ? 'label'
      : 'ready';

  const did = { title, slug, hazard: Boolean(hazard), safety, answered, leftOut, unsure, returns: rules.returns, chemical: rules.rules.chemical };
  return {
    tray, patch, returns, title, slug, hazard, biocideReg, description, specs,
    line: lineFor(tray, did, check),
    why: dashless([rules.rules.returns_reason, rules.rules.chemical ? rules.rules.chemical_reason : null, title ? check.title_reason : null].filter(Boolean).join(' ')).slice(0, 600),
  };
}

// Keeper's one line, short enough to read at a glance: what it decided, then anything left for her.
export function lineFor(_tray: Tray, did: Json, check: Json) {
  const bits: string[] = [];
  if (check.same_as_live) bits.push(`Same as "${clip(check.same_as_live.title, 60)}" on your shop`);
  if (check.duplicate_of?.length) bits.push('Same as another draft');
  if (did.unsure) bits.push(did.returns === 'sealed' ? 'Returns only if unopened? Your call' : 'No returns? Your call');
  else bits.push(did.returns === 'sealed' ? 'Returns if unopened' : did.returns === 'none' ? 'No returns' : 'Standard returns');
  if (did.hazard) bits.push('label warnings added');
  if (did.safety) bits.push('safety line added');
  if (did.title) bits.push('new title');
  else if (check.suggested_title) bits.push('title suggestion left for you');
  if (did.slug) bits.push('shorter address');
  if (did.answered) bits.push(did.leftOut ? `${did.answered} old questions sorted, ${did.leftOut} disputed ${did.leftOut === 1 ? 'detail' : 'details'} left out` : `${did.answered} old ${did.answered === 1 ? 'question' : 'questions'} sorted`);
  if (check.corrections?.length) bits.push('own description corrected');
  if (check.gaps?.length) bits.push(`needs ${check.gaps.join(', ')}`);
  const line = bits.join(', ');
  return dashless(`${line.charAt(0).toUpperCase()}${line.slice(1)}.`).slice(0, 300);
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
