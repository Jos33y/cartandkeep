// Reads every row a query matches, in pages ordered by id so none is skipped or read twice. One request stops at the
// API's row ceiling (1,000 by default) without an error, so a count past that would come out short, silently. A
// ceiling on pages, so a server that ignored the range could never loop for ever.
//
// Pages are asked for four at a time (7 October: Candidates read ten pages one after another, about 12 seconds before
// the list showed). The answer is the same rows in the same order; a wave past the end costs a few empty replies.
export const PAGE = 500;
const AT_ONCE = 4;
const MAX_PAGES = 60;

export async function readPages(build, { atOnce = AT_ONCE } = {}) {
  const data = [];
  for (let first = 0; first < MAX_PAGES; first += atOnce) {
    const wave = [];
    for (let i = first; i < Math.min(first + atOnce, MAX_PAGES); i += 1) {
      wave.push(build().order('id').range(i * PAGE, i * PAGE + PAGE - 1));
    }
    const pages = await Promise.all(wave);
    for (const page of pages) {
      if (page.error) return { data, error: page.error };
      data.push(...page.data);
      if (page.data.length < PAGE) return { data, error: null };
    }
  }
  return { data, error: null };
}
