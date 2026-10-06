// The Claude model every function writes and looks with. One place, so a change of model is one line.
// Sonnet 5.5 (1 October 2026): same price as Sonnet 5. The calls are shaped for it in claude.ts.
export const MODEL = 'claude-sonnet-5-5';

// What a million tokens cost, in US dollars: Sonnet's price (4 October 2026; it matched her bill: 6.15M in and 0.25M
// out came to about $22). Writing to the cache costs a quarter more than input; reading it, a tenth. Change here when
// the model or the price changes.
export const PRICE = { input: 3, output: 15, cache_write: 3.75, cache_read: 0.3 };

/*
 * A smaller model for the steps that fill forms and look at photos (6 October: the photo check and eBay's item details
 * were half the bill). Off unless CLAUDE_LIGHT_MODEL is set in the function secrets, so it is tried on a few cards
 * and judged against the bigger model's work before it stays. Haiku 4.5 at its listed price.
 */
export const LIGHT_MODEL: string | null = (typeof Deno !== 'undefined' && Deno.env.get('CLAUDE_LIGHT_MODEL')) || null;
const HAIKU = { input: 1, output: 5, cache_write: 1.25, cache_read: 0.1 };
export const priceOf = (model: unknown) => (/haiku/i.test(String(model ?? '')) ? HAIKU : PRICE);
