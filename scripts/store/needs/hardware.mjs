// Need words for Hardware: Home & Garden's plumbing, safety and parts, plus electrical parts. A starting list:
// tune it once the first Hardware picks are read.
import { RULES as HOME, NOT_NEED } from './home-garden.mjs';

export const RULES = [
  ...HOME.filter(([need]) => ['safety', 'plumbing', 'clean-fix', 'part'].includes(need)),
  ['electrical', /\b(fuses?|mcbs?|rcds?|rcbos?|circuit breakers?|consumer units?|junction box(?:es)?|fused spurs?|isolator switch(?:es)?|door bells?|doorbell chimes?)\b/i],
];
export { NOT_NEED };
