// A refusal for want of credit, from Anthropic or Apify, told from an ordinary failure (Joseey, 4 October: a run went
// on through 68 cards after Claude's credit ran out, filing each as needing her). Nothing about the card is wrong when
// this is said, so the work stops and waits for a top-up rather than going on and failing card after card.
// A busy moment (rate limited, overloaded) is not this: it clears by itself and is tried again as usual.

export const CREDIT = /credit balance is too low|insufficient (credit|funds|balance)|purchase credits|plans? (&|and) billing|billing (issue|problem|details)|payment required|usage hard limit|monthly usage limit|exceeded your (current |monthly )?(quota|usage|plan)|platform usage limit|not enough (credit|usage)/i;

export const isCredit = (v: unknown) => CREDIT.test(v instanceof Error ? v.message : String(v ?? ''));

// Whose credit: Apify reads Amazon (supplier-read); everything else Keeper calls asks Claude.
export const creditOf = (fn: string) => (fn === 'supplier-read' ? 'Apify' : 'Claude');

export class OutOfCredit extends Error {
  service: string;
  constructor(service: string, said: string) {
    super(said);
    this.service = service;
  }
}
