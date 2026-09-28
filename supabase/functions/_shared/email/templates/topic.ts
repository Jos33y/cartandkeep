// The picture of what a conversation is about: the product, the basket, or the order.
import { about, items, money } from '../kit.ts';
import { type Topic, lineOf, thumbOf } from '../context.ts';

export function topicBlock(t: Topic, { forShop = false } = {}) {
  if (t.product?.title) {
    const bits = [
      t.product.price != null ? money(t.product.price) : '',
      forShop && typeof t.product.stock === 'number' ? `${t.product.stock} in stock` : '',
    ].filter(Boolean).join(', ');
    return about(t.product.title, thumbOf(t.product.image_url), bits);
  }
  if (t.basket?.length) return items(t.basket.map(lineOf));
  if (t.order?.reference) return about(`Order ${t.order.reference}`, thumbOf(t.order.image_url), '');
  return '';
}
