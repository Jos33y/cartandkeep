import { supabase } from './supabase.js';
import { applyEbayAccount, ebayAccount } from './ebayAccount.js';

// The reads and the switch behind lib/ebayAccount.js, kept apart so that file has no database in it.

// Never throws: with nothing read, every card prices as it always has.
export async function loadEbayAccount(tenantId) {
  if (!tenantId) return ebayAccount();
  try {
    const [acc, ads] = await Promise.all([
      supabase.from('ebay_account').select('*').eq('tenant_id', tenantId).maybeSingle(),
      supabase.from('ebay_ads').select('listing_id, rate, campaign_name').eq('tenant_id', tenantId).range(0, 9999),
    ]);
    if (acc.error) throw acc.error;
    return applyEbayAccount(acc.data, ads.error ? null : ads.data ?? []);
  } catch (e) {
    console.warn('[ebay] account not read; pricing as before', e);
    return ebayAccount();
  }
}

// Her switch: 'private', 'business', or null to follow eBay.
export async function chooseEbayAccount(tenantId, type) {
  const { data, error } = await supabase.rpc('set_ebay_seller', { p_tenant: tenantId, p_type: type });
  if (error) throw new Error(error.message ?? 'That did not save.');
  return applyEbayAccount(data, null);
}

// Reads eBay again: account type, campaigns and their rates, and 90 days of charges.
export async function readEbayAccount(tenantId) {
  const { data, error } = await supabase.functions.invoke('ebay-account', { body: { tenant_id: tenantId } });
  if (error || data?.error) {
    let message = data?.error ?? error?.message ?? 'eBay did not answer.';
    try { message = (await error?.context?.json())?.error ?? message; } catch { /* the plain message stands */ }
    await loadEbayAccount(tenantId);
    throw new Error(message);
  }
  return loadEbayAccount(tenantId);
}

// Read again in the background when the last read is a day old. Once a session.
let refreshed = false;
export function refreshEbayAccountIfOld(tenantId, hours = 24) {
  if (refreshed || !tenantId) return;
  refreshed = true;
  const { readAt } = ebayAccount();
  const age = readAt ? Date.now() - Date.parse(readAt) : Infinity;
  if (age < hours * 3_600_000) return;
  readEbayAccount(tenantId).catch((e) => console.warn('[ebay] background read failed', e));
}

