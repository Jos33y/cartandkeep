/*
 * Keeper's questions and notes, in the words she sees on screen. The prompt asks for screen words; this makes sure,
 * because the model has slipped before ("in_the_box field is null", "GB CLP" reached her on 2 October).
 *   Known field names become what the screen calls them.
 *   Anything still written like a field name (words joined by underscores) becomes plain words.
 *   "null" and "the x field" become plain English; trade shorthand becomes the everyday word.
 */
type Swap = [RegExp, string | ((m: string, ...g: string[]) => string)];

const FIELD_WORDS: Swap[] = [
  [/\b(the )?current_returns_class\b/gi, 'the returns policy'],
  [/\b(the )?returns_class\b/gi, 'the returns policy'],
  [/\b(the )?supplier_text\b/gi, 'what the supplier wrote'],
  [/\b(the )?source_description\b/gi, 'what the supplier wrote'],
  [/\b(the )?in_the_box\b/gi, 'what is in the box'],
  [/\b(the )?category_path\b/gi, 'the section'],
  [/\b(the )?image_url\b/gi, 'the photograph'],
  [/\b(the )?current_title\b/gi, 'the title'],
  [/\b(the )?price_gbp\b/gi, 'the price'],
  [/\b(the )?specifications\b/gi, 'the details'],
  [/\b(the )?safety_data_sheet_url\b/gi, 'the safety sheet'],
  [/\b(the )?biocide_reg_no\b/gi, 'the HSE number'],
  // Trade shorthand.
  [/\b(?:GB )?CLP\b/g, 'label warning'],
  [/\b(?:GTIN|EAN|UPC)s?\b/g, 'barcode'],
  [/\bMPN\b/g, 'part number'],
  // Anything else still written as a field name.
  [/\b[a-z]+(?:_[a-z0-9]+)+\b/g, (m) => m.replace(/_/g, ' ')],
  // "the brand field is null" reads "the brand is missing".
  [/\b(the [a-z ]{1,30}?) field\b(?=\s+(?:is|was|has|says|shows|reads|contains)\b)/gi, (_m, g) => g],
  [/\bis (?:null|undefined|empty string)\b/gi, 'is missing'],
  [/\b(?:null|undefined)\b/gi, 'missing'],
];

// Findings about the shop's own rules are not questions for her.
export const NOT_A_FINDING = [
  /\b(returns?|cancellation) (policy|class|rules?)\b/i,
  /\bper (rule|policy|guideline)/i,
];

export function screenWords(raw: unknown) {
  let text = String(raw ?? '').trim();
  // deno-lint-ignore no-explicit-any
  for (const [pattern, word] of FIELD_WORDS) text = text.replace(pattern, word as any);
  text = text.replace(/\s{2,}/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
