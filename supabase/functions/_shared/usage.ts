// What Claude was really used for, counted from its own replies (4 October: Keeper's meter estimated 4 to 7p a card
// while the bill said about 12p). Every reply reports its tokens (claude.ts post notes them here); a request or a
// card collects its own, and a function hands its total back in the x-claude-usage header for Keeper to add up.

import { PRICE, priceOf } from './model.ts';

type Json = Record<string, any>;
// usd: what the calls cost at each one's own model's price, so a mix of models is counted right.
export type Usage = { input: number; output: number; cache_write: number; cache_read: number; usd?: number };
export const noUsage = (): Usage => ({ input: 0, output: 0, cache_write: 0, cache_read: 0, usd: 0 });

// Each request or card keeps its own tally, even when several run side by side. Without async_hooks (an older
// runtime) nothing is counted and the estimates stand.
// deno-lint-ignore no-explicit-any
let Store: any = null;
try { Store = new (await import('node:async_hooks')).AsyncLocalStorage(); } catch { Store = null; }
export const metering = () => Boolean(Store);

export function note(u: Json | null | undefined, model: unknown = null) {
  const t: Usage | undefined = Store?.getStore();
  if (!t || !u) return;
  const p = priceOf(model);
  t.usd = (t.usd ?? 0) + ((Number(u.input_tokens) || 0) * p.input + (Number(u.output_tokens) || 0) * p.output
    + (Number(u.cache_creation_input_tokens) || 0) * p.cache_write + (Number(u.cache_read_input_tokens) || 0) * p.cache_read) / 1e6;
  t.input += Number(u.input_tokens) || 0;
  t.output += Number(u.output_tokens) || 0;
  t.cache_write += Number(u.cache_creation_input_tokens) || 0;
  t.cache_read += Number(u.cache_read_input_tokens) || 0;
}

export async function tallied<T>(fn: () => Promise<T>): Promise<[T, Usage]> {
  const t = noUsage();
  if (!Store) return [await fn(), t];
  const out = await Store.run(t, fn);
  return [out, t];
}

export const addUsage = (a: Usage, b: Partial<Usage> | null | undefined): Usage => ({
  input: a.input + (Number(b?.input) || 0), output: a.output + (Number(b?.output) || 0),
  cache_write: a.cache_write + (Number(b?.cache_write) || 0), cache_read: a.cache_read + (Number(b?.cache_read) || 0),
  usd: (Number(a.usd) || 0) + (Number(b?.usd) || 0),
});

export const used = (u: Partial<Usage> | null | undefined) => Boolean(u && ((u.input ?? 0) + (u.output ?? 0) + (u.cache_write ?? 0) + (u.cache_read ?? 0)) > 0);

// Pence, at the price per million tokens in model.ts and the pound against the dollar.
export function pence(u: Partial<Usage> | null | undefined, gbpPerUsd = 0.75) {
  if (!u) return 0;
  // Counted at each call's own model when it was (note); worked out at the main model's price for an older tally.
  const usd = Number(u.usd) > 0 ? Number(u.usd) : ((u.input ?? 0) * PRICE.input + (u.output ?? 0) * PRICE.output
    + (u.cache_write ?? 0) * PRICE.cache_write + (u.cache_read ?? 0) * PRICE.cache_read) / 1e6;
  return Math.round(usd * gbpPerUsd * 100 * 1000) / 1000;
}

// A function's handler, its Claude use counted and handed back in a header (read by keeper-run's callFunction).
export function metered(handler: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    const [res, t] = await tallied(() => handler(req));
    if (!used(t)) return res;
    const headers = new Headers(res.headers);
    headers.set('x-claude-usage', JSON.stringify(t));
    headers.set('access-control-expose-headers', 'x-claude-usage');
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  };
}
