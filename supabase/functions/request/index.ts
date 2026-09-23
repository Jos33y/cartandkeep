/*
 * Asking the shop to stock something.
 *
 * The table grants nothing to anon, so this is the only way in. It writes the
 * request and tells her one landed, because a request nobody reads for a week
 * is a person who asked and got nothing, and this is the one form on the shop
 * where a fast answer is worth more than the answer itself.
 *
 * Not a support route. Somebody with a problem replies to their order email,
 * which reaches her the same day. The page says so.
 *
 * There is no ../_shared import. The dashboard editor deploys one folder, which
 * is what broke cors.ts. The CORS block below is duplicated on purpose.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED = (Deno.env.get('STORE_ORIGINS')
  ?? 'https://cartandkeep.com,https://www.cartandkeep.com,http://localhost:5180,http://127.0.0.1:5180')
  .split(',')
  .map((o) => o.trim());

function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED.includes(origin) ? origin : ALLOWED[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

const TENANT = Deno.env.get('FEED_TENANT_SLUG') ?? 'cart-and-keep';
const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
const FROM = Deno.env.get('MAIL_FROM') ?? 'Cart & Keep <notify@relay.cartandkeep.com>';

const clean = (v: unknown, max: number) => {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : null;
};

/*
 * What they say they pay now, read loosely.
 *
 * People type "about £30", "30ish" and "£29.99" into a box that asks for a
 * price. Pulling the first number out of it is worth more than refusing the
 * request, because the number is a hint about a ceiling rather than a figure
 * anything is calculated from.
 */
function priceish(v: unknown) {
  const s = String(v ?? '').replace(/[, ]/g, '');
  const m = s.match(/\d+(\.\d{1,2})?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) && n >= 0 && n < 100000 ? Math.round(n * 100) / 100 : null;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);

  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400, origin); }

  const wanted = clean(body.wanted, 300);
  if (!wanted) return json({ error: 'Tell us what you are after.' }, 400, origin);

  /*
   * A honeypot, not a captcha.
   *
   * A field hidden from people and visible to a form filling bot. A captcha on
   * a form nobody has to fill in is a tax on the visitors who would have used
   * it, and this catches the only kind of automated submission a shop this
   * size will see.
   */
  if (clean(body.website, 40)) return json({ ok: true }, 200, origin);

  const { data: tenant } = await db.from('tenants').select('id, store').eq('slug', TENANT).maybeSingle();
  if (!tenant) return json({ error: 'Something went wrong.' }, 500, origin);

  const row = {
    tenant_id: tenant.id,
    wanted,
    paying: priceish(body.paying),
    seen_at: clean(body.seenAt, 300),
    email: clean(body.email, 160),
    name: clean(body.name, 80),
    source: clean(body.source, 120),
  };

  const { error } = await db.from('store_requests').insert(row);
  if (error) {
    console.error('[request]', error.message);
    return json({ error: 'That did not send. Try again.' }, 500, origin);
  }

  /*
   * Told straight away, and failing to tell her does not fail the request.
   *
   * The row is written and safe by this point. If Resend is down, she finds it
   * on the Requests screen instead, which is a worse outcome for her and no
   * outcome at all for the person who asked, and there is no version of this
   * where losing the request is better than losing the email.
   */
  const to = tenant.store?.email ?? tenant.store?.trader?.email;
  if (RESEND_KEY && to) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM,
          to,
          // The ask in the subject line, because this is worth reading on a
          // phone without opening it.
          subject: `Someone wants: ${wanted.slice(0, 60)}`,
          html: `
            <p style="font-size:16px;margin:0 0 12px;">${escapeHtml(wanted)}</p>
            ${row.paying ? `<p style="margin:0 0 6px;">They pay about £${row.paying.toFixed(2)} now.</p>` : ''}
            ${row.seen_at ? `<p style="margin:0 0 6px;">They buy it at ${escapeHtml(row.seen_at)}.</p>` : ''}
            ${row.email ? `<p style="margin:0 0 6px;">Reply to them: ${escapeHtml(row.email)}</p>` : '<p style="margin:0 0 6px;color:#6B6459;">They left no email, so they can only be answered by the thing appearing.</p>'}
            ${row.source ? `<p style="margin:12px 0 0;color:#6B6459;font-size:13px;">Asked from ${escapeHtml(row.source)}</p>` : ''}`,
        }),
      });
    } catch (e) {
      console.error('[request] alert', e instanceof Error ? e.message : String(e));
    }
  }

  return json({ ok: true }, 200, origin);
});

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
