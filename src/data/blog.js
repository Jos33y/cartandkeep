/*
 * The blog, from markdown files.
 *
 * Posts live in src/content/blog as .md with YAML front matter. Vite reads
 * them at build time through import.meta.glob, so there is no fetch, no CMS
 * and no runtime cost beyond the strings themselves, and a post is added by
 * dropping a file in a folder.
 *
 * Front matter is parsed here rather than with gray-matter. What we need is
 * key: value and one array, and a YAML parser to do that is a dependency for
 * fifteen lines. `marked` is a different question and is handled in the page,
 * because a hand written markdown parser gets nested lists wrong on the third
 * post.
 */

const files = import.meta.glob('/src/content/blog/*.md', { query: '?raw', import: 'default', eager: true });

const FRONT = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function parseFront(raw) {
  const match = raw.match(FRONT);
  if (!match) return { data: {}, body: raw };

  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const at = line.indexOf(':');
    if (at < 1) continue;
    const key = line.slice(0, at).trim();
    let value = line.slice(at + 1).trim();

    // One array shape, [a, b, c], which is all the front matter uses.
    if (value.startsWith('[') && value.endsWith(']')) {
      data[key] = value.slice(1, -1).split(',').map((v) => v.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
      continue;
    }
    value = value.replace(/^['"]|['"]$/g, '');
    data[key] = value;
  }

  return { data, body: raw.slice(match[0].length) };
}

// A heading's address inside its post, shared by the contents list and the rendered heading.
export const headingId = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// The post's own contents: its second level headings, in order.
function contentsOf(body) {
  return body.split(/\r?\n/)
    .filter((l) => /^##\s+/.test(l))
    .map((l) => l.replace(/^##\s+/, '').trim())
    .map((text) => ({ text, id: headingId(text) }));
}

/*
 * Where a post sends its reader when it ends, from the front matter.
 *
 *   (nothing)                  the whole shop
 *   leads: section             one of her sections, named by `section: <slug>`
 *   leads: products            live, in-stock products picked for it: from `section`
 *                              if given, otherwise from the whole shop
 *
 * Products are only ever the live ones, so a post never points at something that cannot be bought.
 */
function leadsOf(data) {
  const kind = ['section', 'products'].includes(data.leads) ? data.leads : 'shop';
  return {
    kind: kind === 'section' && !data.section ? 'shop' : kind,
    section: data.section || null,
  };
}

/*
 * A post with no title or no date is a draft somebody saved, not something to
 * publish. It is dropped rather than rendered with "undefined" in the heading,
 * and the console says which file so it can be fixed.
 */
function build(path, raw) {
  const { data, body } = parseFront(raw);
  const slug = data.slug || path.split('/').pop().replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '');

  if (!data.title || !data.date) {
    if (import.meta.env.DEV) console.warn(`[blog] ${path} has no title or no date, skipped`);
    return null;
  }

  return {
    slug,
    path,
    title: data.title,
    description: data.description ?? '',
    date: data.date,
    author: data.author ?? 'Cart & Keep',
    tags: data.tags ?? [],
    image: data.image ?? null,
    // Stated in the file when the writer knows better, otherwise measured at
    // 200 words a minute, which is the usual reading speed for prose.
    readingMinutes: Number(data.readingMinutes) || Math.max(1, Math.round(body.split(/\s+/).length / 200)),
    // The drawn cover: which objects, and optionally which colourway and layout. All optional.
    cover: Array.isArray(data.cover) ? data.cover : data.cover ? [data.cover] : [],
    colour: data.colour ?? null,
    layout: data.layout ?? null,
    leads: leadsOf(data),
    contents: contentsOf(body),
    body,
  };
}

// Numbered in date order, oldest first, as issues are, counting scheduled notes too: a number never changes once given.
const numbered = (posts) => {
  const order = [...posts].sort((a, b) => a.date.localeCompare(b.date) || a.slug.localeCompare(b.slug));
  order.forEach((p, i) => { p.no = String(i + 1).padStart(2, '0'); });
  return posts;
};

// Today in the UK, so a note dated tomorrow stays hidden until midnight London time, not the reader's.
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());

/*
 * One note per address. A file copied or renamed without removing the old one
 * would otherwise show twice and push every number up; the newest file wins and
 * development says which one to delete. Two notes on one day are allowed but flagged.
 */
function unique(posts) {
  const bySlug = new Map();
  for (const p of [...posts].sort((a, b) => a.path.localeCompare(b.path))) {
    const had = bySlug.get(p.slug);
    if (had && import.meta.env.DEV) console.warn(`[blog] ${had.path} and ${p.path} share the address ${p.slug}; showing ${p.path}. Delete the other.`);
    bySlug.set(p.slug, p);
  }
  const kept = [...bySlug.values()];
  if (import.meta.env.DEV) {
    const days = new Map();
    kept.forEach((p) => days.set(p.date, [...(days.get(p.date) ?? []), p.path]));
    days.forEach((paths, day) => { if (paths.length > 1) console.warn(`[blog] more than one note dated ${day}: ${paths.join(', ')}`); });
  }
  return kept;
}

const ALL = numbered(unique(Object.entries(files)
  .map(([path, raw]) => build(path, raw))
  .filter(Boolean)));

/*
 * A note dated ahead is scheduled: hidden until its day, then shown without a
 * deploy. In development every note shows, so a scheduled one can be checked.
 */
export const POSTS = ALL
  .filter((p) => import.meta.env.DEV || p.date <= TODAY)
  // Newest first; on the same day the higher number was published later.
  .sort((a, b) => b.date.localeCompare(a.date) || b.no.localeCompare(a.no));

export const postBySlug = (slug) => POSTS.find((p) => p.slug === slug) ?? null;

export const relatedPosts = (post, limit = 3) =>
  POSTS.filter((p) => p.slug !== post.slug)
    .sort((a, b) => {
      const shared = (x) => x.tags.filter((t) => post.tags.includes(t)).length;
      return shared(b) - shared(a) || b.date.localeCompare(a.date);
    })
    .slice(0, limit);

export const formatDate = (iso) =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London',
  }).format(new Date(`${iso}T12:00:00Z`));

/*
 * Her numbers, written into a post as {free_over}, {postage}, {return_days} or {reply},
 * filled from Settings when the post is shown, so a post can never quote a threshold
 * the checkout no longer charges. An unknown name is left as written, so a typo shows.
 */
export function fillNumbers(text, values) {
  return String(text).replace(/\{(\w+)\}/g, (whole, key) => (values[key] ?? whole));
}
