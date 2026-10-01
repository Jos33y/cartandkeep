// Keepr's check of a shop draft before it can go on sale: which returns rules apply, and whether it is a chemical
// whose label warning has to sit next to the price (GB CLP). Pure here, so the tests hold the rules; the call and
// the write are in functions/shop-rules.

type Json = Record<string, any>;

export const RULES_VERSION = 1;

export const RULES_SYSTEM = `You check a product for a small UK online shop before it goes on sale. Two questions, answered from the facts and photographs given, never from guesses.

RETURNS. Which UK cancellation rules apply to these goods.
standard  The default. Almost everything. The customer can send it back for any reason.
sealed    Goods not suitable for return once unsealed, for health or hygiene reasons: cosmetics, toiletries, underwear, incontinence and continence products, anything applied to the body, anything that goes in the mouth.
none      Consumables and perishables: food, drink, supplements. Anything made to order or personalised.
Choose standard unless the goods clearly fall in an exception. Wrongly refusing a return denies a customer a right they have in law, which is the worse error, so when the goods are ambiguous the answer is standard. Judge the goods, not the packaging. Cleaning chemicals are ordinary goods, so they are standard.

CHEMICAL. Is it a chemical product that may carry a GB CLP hazard label: cleaners, bleach, descalers, drain unblockers, disinfectants, pest and weed killers, glues and sealants, paints, varnishes, oils and solvents, fuels, lamp oil, aerosols, battery acid, pool and garden chemicals, dishwasher and laundry products. Tools, appliances, furniture, clothing, food and ordinary cosmetics are not. Say true when it is such a product, even if the facts give no label, because she must check the bottle.

LABEL. Only what is printed in the facts or clearly legible on a photograph of the label: the signal word (Warning or Danger), the hazard statements with their codes as printed (H315 Causes skin irritation, EUH208 Contains ...), the precautionary statements with their codes (P102 Keep out of reach of children), the hazard pictograms by GHS code (GHS02 flame, GHS05 corrosion, GHS07 exclamation mark, GHS09 environment, and so on), and an HSE number for a biocide. Never write a statement, a code or a symbol that is not given: an empty list is the right answer when the label cannot be read. Say where you read it in one short phrase.

Give each reason in one short plain sentence about the goods, in British English.`;

export const RULES_TOOL = {
  name: 'rules',
  description: 'The returns class, whether it is a chemical, and any label elements read from the facts or photographs.',
  input_schema: {
    type: 'object',
    properties: {
      returns_class: { type: 'string', enum: ['standard', 'sealed', 'none'] },
      returns_reason: { type: 'string' },
      chemical: { type: 'boolean' },
      chemical_reason: { type: 'string' },
      biocide: { type: 'boolean' },
      label: {
        type: 'object',
        properties: {
          signal: { type: 'string', enum: ['Warning', 'Danger', 'none'] },
          h: { type: 'array', items: { type: 'string' } },
          p: { type: 'array', items: { type: 'string' } },
          pictograms: { type: 'array', items: { type: 'string' } },
          hse_number: { type: 'string' },
          read_from: { type: 'string' },
        },
      },
    },
    required: ['returns_class', 'returns_reason', 'chemical', 'chemical_reason', 'biocide', 'label'],
  },
};

const clip = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const dashless = (s: string) => s.replace(/[‒-―]/g, ',').replace(/\s+,/g, ',');

// Statements as printed, with their codes: a line without a code is a sentence, not a label element.
const H = /^(EUH\s?\d{3}[A-Z]?|H\d{3}[A-Za-z]{0,2}(\s?\+\s?H\d{3}[A-Za-z]{0,2})*)\b/;
const P = /^P\d{3}(\s?\+\s?P\d{3})*\b/;
const GHS = /^GHS0[1-9]$/;

function statements(list: unknown, re: RegExp, max: number) {
  const out: string[] = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const s = dashless(clip(raw, 200));
    if (re.test(s) && !out.some((x) => x.toLowerCase() === s.toLowerCase())) out.push(s);
  }
  return out.slice(0, max);
}

// The model's answer as the draft keeps it, and as the release guard reads it.
export function tidyRules(input: Json, at = new Date().toISOString()) {
  const returns = ['standard', 'sealed', 'none'].includes(input?.returns_class) ? input.returns_class : 'standard';
  const label = input?.label ?? {};
  const signal = label.signal === 'Warning' || label.signal === 'Danger' ? label.signal : null;
  const h = statements(label.h, H, 12);
  const p = statements(label.p, P, 16);
  const pictograms = [...new Set((Array.isArray(label.pictograms) ? label.pictograms : []).map((x: unknown) => clip(x, 8).toUpperCase()).filter((x: string) => GHS.test(x)))];
  const hse = clip(label.hse_number, 40).replace(/[^A-Za-z0-9 /-]/g, '') || null;
  const chemical = input?.chemical === true;
  const biocide = input?.biocide === true;
  const read = signal || h.length || p.length || pictograms.length || hse;
  return {
    returns,
    rules: {
      version: RULES_VERSION,
      at,
      returns,
      returns_reason: dashless(clip(input?.returns_reason, 240)),
      chemical,
      biocide,
      chemical_reason: dashless(clip(input?.chemical_reason, 240)),
    },
    // Only what was read off the label; null when nothing was, so she copies it from the bottle.
    hazard_draft: chemical && read ? { signal, h, p, pictograms, biocide_reg_no: hse, read_from: dashless(clip(label.read_from, 120)) || null } : null,
  };
}

/*
 * What goes into derived_fields. A standard return is confirmed as it lands; sealed only and no return wait for
 * her. A chemical is flagged for the label, with what Keepr read. A label she has already checked is left alone.
 */
export function derivedPatch(t: ReturnType<typeof tidyRules>, current: Json = {}) {
  const out: Json = { rules: t.rules, returns_class: t.returns === 'standard' ? null : t.returns };
  if (current.returns_by === 'her') delete out.returns_class;
  if (t.rules.chemical && !current.hazard_checked) {
    out.hazard_suspect = true;
    out.hazard_draft = t.hazard_draft;
  }
  return out;
}

// The facts the check reads: the draft's own fields, then the shop page and eBay facts on the card it came from.
export function rulesFacts(p: Json, listing: Json | null = null, item: Json | null = null) {
  const specs = Object.entries(p.specifications ?? {}).filter(([k]) => !k.startsWith('_')).slice(0, 30).map(([k, v]) => `${k}: ${v}`).join('; ');
  const held = Object.entries(item?.aspects ?? {}).map(([k, v]) => `${k}: ${v}`).join('; ');
  return [
    ['Title', p.title], ['Brand', p.brand ?? listing?.brand ?? item?.brand], ['Category', p.category_path ?? listing?.shop_category ?? item?.category],
    ['Description', p.description], ['In the box', p.in_the_box], ['Details', specs || null],
    ['What the supplier wrote', p.source_description],
    ['Shop page title', listing?.title], ['Shop page description', listing?.description ? String(listing.description).slice(0, 2500) : null],
    ['Shop page features', Array.isArray(listing?.features) ? listing.features.join('; ') : null],
    ['Item details eBay holds', held || null],
  ].filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n');
}
