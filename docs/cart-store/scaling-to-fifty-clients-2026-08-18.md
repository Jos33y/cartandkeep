# Scaling this to fifty clients

18 August 2026. Written after the Cart & Keep shop reached feature complete on
the customer side, because that is the moment to ask what the second client
costs before there is a second client.

The short version: **the database is multi-tenant and the front end is not.**
Every table carries `tenant_id` and the row level security is real. Almost
everything a client would want different lives in a source file.

---

## 1. What client two actually costs today

Measured, not estimated.

```
free delivery threshold    5 components + 1 edge function
postage rate               4 components + 1 edge function
cartandkeep.com            12 files
support@cartandkeep.com    8 files
the logo                   path data inside Logo.jsx
the departments            hardcoded in the header, footer and 404
CK- order prefix           inside the checkout function
legal and about copy       src/data/legal.js, src/data/about.js
blog posts                 src/content/blog/*.md, one folder for everybody
manifest, icons, og card   public/, one set
index.html                 one title, one description, one theme colour
```

That is not a configuration change. It is a fork, and fifty forks is fifty
codebases that drift.

**The tenants row already solves half of this and is barely used.** It carries
`palette`, `fees`, `scoring` and `research` as jsonb, and `applyPalette` in
`tenant.js` already writes the palette onto `--c-*` at runtime. The pattern is
right and it stops at four colours.

---

## 2. The security finding

`store_events` allows anon insert with `with check (true)`.

Anon can therefore write an event with **any** `tenant_id`, and the tenant id
is not secret: the browser fetches it on every page load and it is visible in
the network tab. So at fifty clients, anyone can pollute any other client's
analytics, and a competitor could do it deliberately.

Severity is low today because there is one client and nothing depends on the
numbers. It stops being low the moment those numbers inform what she buys.

**Three ways to fix it, in ascending cost:**

- Constrain the payload. Caps on `meta` size and on rows per session per
  minute. Reduces the damage, does not remove it.
- Route events through an edge function that resolves the tenant from the
  request `Origin` header rather than trusting the body. One round trip per
  batch, which is every two seconds. This is the right answer.
- Drop anon insert entirely and log server side. Loses client-side events,
  which is most of them.

I would do the second, and I have not done it in this pass because it changes a
deployed function and the batching interacts with it.

---

## 3. What actually has to move, in order

### Tier one, before client two exists

**A `store` config on the tenants row.** One jsonb, read once by `loadTenant`,
exposing everything currently hardcoded:

```json
{
  "domain": "cartandkeep.com",
  "email": "support@cartandkeep.com",
  "reference_prefix": "CK",
  "delivery": { "free_over": 40, "postage": 3.95, "cutoff_hour": 14,
                "transit_min": 2, "transit_max": 3 },
  "voice": { "tagline": "A small UK shop with a very large cupboard",
             "hero_title": "Everything for the house.",
             "hero_em": "Nothing you have to hunt for." },
  "socials": { "instagram": "cartandkeep", "tiktok": "cartandkeep" }
}
```

The edge functions read the same row, so a threshold cannot disagree between
the basket and the payment. Today it can: `FREE_OVER` is written out in both
places and nothing checks they match.

**Legal, about and blog content into tables.** `store_pages` with
`(tenant_id, slug, title, blocks jsonb)` and `store_posts` with the markdown in
a column. The current files are one client's contract terms sitting in a shared
repository, which is also a confidentiality problem the moment a second client
can see the codebase.

**Per-host head and manifest.** `index.html` already injects the manifest by
hostname, so the mechanism exists. It needs to inject a *different* manifest,
title and theme colour per host, which means a small manifest endpoint rather
than a static file.

**Logo as data, not as a component.** An SVG string or a URL on the tenant row.
`Logo.jsx` becomes a renderer.

### Tier two, before client ten

**The catalogue query does not scale.** `useStoreProducts` fetches every product
on every page, and `ProductPage` finds one with `rows.find()`. At 78 products
that is one request instead of two and it is genuinely the right call. At 2,000
it is a several megabyte download on a phone to show one lamp. The comment
saying so is already in the file. It becomes: a paged list query, a single row
query for a product, and a separate related call.

**No pagination anywhere.** `/shop` renders the entire catalogue in one grid.

**Bot traffic in the analytics.** Nothing filters crawlers, so `views` on the
funnel view will be inflated from the day the sitemap is submitted, and the
add rate will look worse than it is for exactly the reason that makes it wrong.

**No rate limit on the checkout function.** Anyone can create unlimited pending
orders. Harmless now, a mess in a table that somebody eventually has to read.

### Tier three, when it is a platform rather than a client list

Per-tenant fonts, per-tenant component variants, a theme system beyond the
palette, and an onboarding path that creates a tenant, a domain, a manifest and
a set of legal pages without a developer.

---

## 4. What is already right and should not be touched

Worth naming, because the temptation when refactoring is to redo the parts that
work.

- **Every table is tenant scoped with real RLS.** Orders and order items have no
  policies at all and are reachable only through service-role functions.
- **Prices are never trusted from the browser.** The checkout function reads
  every figure from the database.
- **The research pipeline is already multi-tenant** in the same shape.
- **Analytics stores nothing on the device**, so there is no consent banner to
  configure per client and no cookie policy that differs.
- **The design system is tokens.** Changing a palette is genuinely a data
  change, which is the thing most agencies get wrong.

---

## 5. The honest estimate

Tier one is roughly two to three days of work and it is worth doing **before**
the second client, not after. Every day it waits, another hardcoded value goes
in, and today's count is eleven files for one delivery threshold.

Tier two is a week and it can wait until there is a client with a real
catalogue behind them.

The thing that would make it expensive is doing it after five clients are live,
because then it is a migration of five sets of content and five deployments
rather than a refactor of one.
