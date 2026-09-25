# How we work

The Brick Dev Studios, working with Claude. Living document: change it when something works better.

## The bar

World class, not correct. "Not boring" is the floor. Every page needs one idea you would recognise with the logo covered: a shape, a dark hero panel, a live preview, a track that fills. Bland (hairlines, one type size, numbers as prose) and generated (gradients and glow everywhere) are both failures. Technique is allowed wherever it does a job.

What raised the work this session, keep doing it:

- One dark hero panel per page carrying the figure that matters, in large type, with its context beside it.
- Shapes that explain, not decorate: the funnel, the readiness ring, the order track, the reply ring.
- Live previews of what the customer will see, drawn from the fields as they are typed.
- Real examples on empty screens, using her own products and marked Example, never grey skeleton bars.
- Motion as feedback for an action: a ring closing, a toast when something ships.
- Colour carries meaning and nothing else: terracotta for action, green for done, amber for ageing, red for broken.

## One page at a time

1. **Check the data first.** Ask for the SQL behind the page. Replay it on a real Postgres with realistic rows and every write the page makes. Numbers that contradict each other are bugs, not design problems.
2. **Audit.** Senior frontend audit of the screenshot, numbered and specific, including what happens at 300 products or 10,000 visits.
3. **Build in the real components.** No standalone mock-ups. Tokens and shared primitives only.
4. **Render before sending.** Desktop, phone, empty, busy and at scale. Look at every screenshot.
5. **Deliver.** Only the changed files, exact paths, migrations listed in run order, what to deploy where, and what was not verified.
6. **Joseph screenshots, Claude audits again,** until it is right. Then the next page.

## Getting files

Never guess a path. Ask for a tree, then send a collector: a PowerShell script in `tools/collectors/`, named `collect-ck-<area>-<date>.ps1`, run from the repo root, which zips exactly the named files and withholds secrets. If a file is missing, ask for it rather than mocking around the gap.

## Copy

- British English. No em or en dashes anywhere, code comments included. None of the banned words in the `brick-dev` skill.
- Plain professional labels: "Added to basket", not "Put something in the basket". Casual and cute read as childish.
- Never show zero as if it were data. "Not rated yet", "None yet", a dashed outline. A zero where the truth is "we could not see" is the most expensive error there is.
- No counts written into copy or status files that the portal also shows; they go stale.
- Nothing promised that is not true today: no report dates before the report exists, no "done" before it is done.
- Explanations go in tooltips, not paragraphs on the page.
- Comments: one line, the why not the what (`comment-rules.md`).

## Engineering rules

- Multi-tenant from the first line. Nothing client-specific in code; it lives in `tenants.store` or a table with a tenant id.
- Every view is `security_invoker`; every policy checks `has_tenant(tenant_id)`. Check this on every migration.
- Every write checks its result. A send that is not recorded gets sent again.
- Scripts never touch her decisions, notes, sources or figures she has already set.
- Migrations are numbered, idempotent where they can be, tested before delivery, and delivered with the order to run them.

## Talking to each other

- Joseph decides. Claude proposes one direction with reasons, asks at most one question, and builds on yes.
- Push back when something is wrong, including Joseph's instruction or Claude's own earlier claim. Correct mistakes out loud and early.
- Say plainly what was not verified.
- Short replies for small things, full reasoning for design and debugging.
