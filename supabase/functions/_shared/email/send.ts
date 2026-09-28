/*
 * One way out to Resend, for every function that sends mail.
 *
 * The text part goes with every message. A message with no text part scores
 * worse with spam filters, and some people read mail as text.
 */
import type { Mail } from './kit.ts';

export const FROM = Deno.env.get('MAIL_FROM') ?? 'Cart & Keep <notify@relay.cartandkeep.com>';

export async function send(to: string, m: Pick<Mail, 'subject' | 'html' | 'text'>, replyTo: string, from = FROM) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY') ?? ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject: m.subject, html: m.html, text: m.text, reply_to: replyTo }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload?.message ?? `Resend ${res.status}`);
  return String(payload?.id ?? '');
}
