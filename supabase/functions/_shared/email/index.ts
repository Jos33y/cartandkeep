// Every email the platform sends, and the parts they share.
// Sending lives in send.ts, imported on its own, so rendering never needs the environment.
export { type Brand, type Mail, toText } from './kit.ts';
export { type Shop, type Topic, identityComplete, shopFrom, topicName, units } from './context.ts';
export { confirmation } from './templates/confirmation.ts';
export { dispatch } from './templates/dispatch.ts';
export { recipient } from './templates/recipient.ts';
export { review } from './templates/review.ts';
export { asked } from './templates/asked.ts';
export { reply } from './templates/reply.ts';
export { sale } from './templates/sale.ts';
export { toShop } from './templates/toShop.ts';
export { stock } from './templates/stock.ts';
export { wants } from './templates/wants.ts';
export { pull } from './templates/pull.ts';
export { type PriceAlert, price } from './templates/price.ts';
