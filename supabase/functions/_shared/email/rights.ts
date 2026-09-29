// deno-lint-ignore-file no-explicit-any
/*
 * The statutory part, in its own quieter section at the foot of the
 * confirmation.
 *
 * Schedule 2 items l, m, o and p, and the Schedule 3 form. A web page is not a
 * durable medium and this email is, so the wording lives here and nowhere
 * else. Every clause is conditional on the shop having the fact, and matches
 * src/data/legal.js.
 */
import { C, TEXT, esc, plain } from './kit.ts';
import { identityLine } from './context.ts';

export function rights(items: any[], trader: Record<string, any>, cfg: Record<string, any>) {
  const days = Number(cfg.returns?.days ?? 30);
  const extended = days > 14;
  const customerPays = cfg.returns?.postage_paid_by === 'customer';
  // 'none' is deliberately not an exception here: an opened consumable is a reduced refund, not a refusal.
  const sealed = items.filter((i) => i.returns_class === 'sealed');
  const sendTo = trader.return_address ?? trader.address;
  const how = trader.address ? `replying to this email or by writing to ${trader.address}` : 'replying to this email';

  const para = (t: string) => `<p style="margin:0 0 12px;font:400 14px/22px ${TEXT};color:${C.soft};">${t}</p>`;
  const parts = [
    para(`You have 14 days from the day your order arrives to cancel it, for any reason. That is your statutory right${extended ? `, and we extend it to ${days} days on the same terms` : ''}. Tell us by ${plain(how)}.`),
    para(`Send the goods back${sendTo ? ` to ${plain(sendTo)}` : ''} within 14 days of telling us. ${customerPays ? 'The cost of sending them back is yours, unless they are faulty or not as described.' : 'We pay the return postage.'} You can handle what you receive as you would in a shop; if it has been handled more than that, we may reduce the refund by the value lost.`),
    para('We refund the price you paid, and the delivery charge if the whole order comes back, within 14 days of the goods reaching us or of you showing us proof of postage, whichever is sooner.'),
  ];
  if (sealed.length) {
    parts.push(para(`${sealed.map((i) => esc(i.title)).join(', ')} can be returned within the same ${days} days only while the seal is unbroken. Once opened, the right to cancel does not apply to ${sealed.length > 1 ? 'them' : 'it'}, on health and hygiene grounds, unless faulty.`));
  }
  parts.push(para(`None of this affects your right to a refund, repair or replacement if something is faulty or not as described. That right is separate and does not run out when the ${Math.max(days, 14)} days do.`));

  const to = identityLine(trader);
  const form = [
    'I/We* hereby give notice that I/We* cancel my/our* contract of sale of the following goods:',
    'Order reference:', 'Ordered on* / received on*:', 'Name of consumer(s):', 'Address of consumer(s):',
    'Signature of consumer(s) (only if this form is sent on paper):', 'Date:',
  ];

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.cream};border-top:1px solid ${C.line};">
<tr><td class="px" style="padding:26px 36px 30px;">
  <p style="margin:0 0 12px;font:700 12px/16px ${TEXT};letter-spacing:0.12em;text-transform:uppercase;color:${C.faint};">Your rights</p>
  ${parts.join('')}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;"><tr><td style="padding:14px 16px;border:1.5px dashed ${C.lineMid};border-radius:10px;background:#fff;font:400 12px/20px ${TEXT};color:${C.soft};">
    <p style="margin:0 0 6px;font:600 13px/18px ${TEXT};color:${C.ink};">Cancellation form</p>
    <p style="margin:0 0 6px;">Complete and return this only if you want to cancel. You can also just reply to this email.</p>
    ${to ? `<p style="margin:0 0 6px;">To: ${plain(to)}</p>` : ''}
    ${form.map((l) => `<p style="margin:0;">${esc(l)}</p>`).join('')}
    <p style="margin:6px 0 0;font-size:11px;">* Delete as appropriate.</p>
  </td></tr></table>
</td></tr>
</table>`;
}
