// Reads every row a query matches, in pages ordered by id so none is skipped or read twice. One request stops at the
// API's row ceiling (1,000 by default) without an error, so a count past that would come out short, silently. A
// ceiling on pages, so a server that ignored the range could never loop for ever.
export const PAGE = 500;

export async function readPages(build) {
  const data = [];
  for (let from = 0; from < PAGE * 60; from += PAGE) {
    const page = await build().order('id').range(from, from + PAGE - 1);
    if (page.error) return { data, error: page.error };
    data.push(...page.data);
    if (page.data.length < PAGE) break;
  }
  return { data, error: null };
}
