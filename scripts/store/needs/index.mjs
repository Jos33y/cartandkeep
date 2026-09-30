/*
 * Need words by Google top category. Each file exports RULES ([need, regex] in order, first match wins) and
 * NOT_NEED (titles that are browsed whatever words they carry). A category without its own file uses Home &
 * Garden's, the list the others were drawn from. Add a category by adding a file and a line below.
 */
import * as homeGarden from './home-garden.mjs';
import * as healthBeauty from './health-beauty.mjs';
import * as hardware from './hardware.mjs';

const BY_CATEGORY = new Map([
  ['home and garden', homeGarden],
  ['health and beauty', healthBeauty],
  ['hardware', hardware],
]);

const key = (c) => String(c ?? '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();

export function needOf(title, category = 'Home & Garden') {
  const list = BY_CATEGORY.get(key(category)) ?? homeGarden;
  if (list.NOT_NEED.test(title)) return '';
  for (const [need, rx] of list.RULES) if (rx.test(title)) return need;
  return '';
}
