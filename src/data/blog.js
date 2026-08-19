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
    body,
  };
}

export const POSTS = Object.entries(files)
  .map(([path, raw]) => build(path, raw))
  .filter(Boolean)
  // Newest first, and future dates are kept rather than hidden: a post dated
  // ahead is a scheduling mistake and hiding it makes it invisible to whoever
  // made it.
  .sort((a, b) => b.date.localeCompare(a.date));

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
