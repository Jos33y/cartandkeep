# How we work

The Brick Dev Studios, working with Claude. Living document: change it when something works better.

## The bar

Deliver as if the engagement were worth £100,000. The platform is built to be sold again, so every screen is also a portfolio piece. Most of what a client calls missing is often built and live; if it does not look finished, it does not feel delivered. Presentation is how a client knows the work exists.

World class, not correct. "Not boring" is the floor. Every page needs one idea you would recognise with the logo covered: a shape, a dark hero panel, a live preview, a track that fills, a drawn object. Bland (hairlines, one type size, numbers as prose) and generated (gradients and glow everywhere) are both failures. Technique is allowed wherever it does a job. Gamified only where it tells the truth: the basket ring filling towards free delivery is the model.

What raised the work, keep doing it:

- One dark hero panel per page carrying the figure that matters, in large type, with its context beside it.
- Shapes that explain, not decorate: the funnel, the readiness ring, the order track, the return window bar, the data tree.
- Objects drawn in the icon set's line, so a page looks designed whatever the catalogue's photographs look like.
- Live previews of what the customer will see, drawn from the fields as they are typed.
- Real examples on empty screens, marked Example, never grey skeleton bars.
- Motion as feedback for an action: a ring closing, a toast when something ships. Everything off under reduced motion.
- Colour carries meaning and nothing else: ink, cream and sage; terracotta only for the action that means buy, send or submit; green for done, amber for ageing, red for broken.

## One page at a time

1. **Check the data first.** Ask for the SQL behind the page. Replay it on a real Postgres with realistic rows and every write the page makes. Numbers that contradict each other are bugs, not design problems.
2. **Audit.** Senior visual audit of the screenshot, numbered and specific, including what happens at 300 products or 10,000 visits. Every point checked against the code. No guessing: if a cause cannot be confirmed from the files, say so and say how to check it.
3. **Propose one direction** with reasons, ask at most one or two questions, and build on yes.
4. **Words before code.** Copy is approved before it ships. Offer distinct angles, not variations of one sentence.
5. **Build in the real components.** No standalone mock-ups, no throwaway HTML. Tokens and shared primitives only.
6. **Render before sending,** on our side: desktop, phone, empty, busy and at scale. Never send image previews; Joseph previews live. Any change to a size or a spacing after the check means rendering again before it goes: a 1px dot change once pushed a chart through its own baseline.
7. **Deliver.** A zip of only the files changed in that round, exact paths, migrations listed in run order, what to deploy where, and what was not verified.
8. **Joseph screenshots, Claude audits again,** until it is right. Then the next page.

## Getting files

Never guess a path. Ask for a tree, then send a collector: a PowerShell script in `tools/collectors/`, named `collect-ck-<area>-<date>.ps1`, run from the repo root, which zips exactly the named files and withholds secrets by whole file name only (a bare "token" once withheld `tokens.css`). If a file is missing, ask for it rather than mocking around the gap.

- Write the zip entry by entry with `System.IO.Compression`. `Compress-Archive` on Windows PowerShell 5.1 stores backslashes in the paths.
- Imports go through the Vite aliases (`@app`, `@components`, `@context`, `@pages`, `@pwa`, `@styles`, `@hooks`, `@utils`, `@lib`, `@data`, `@` for `src`). A collector that follows imports must resolve those, not only relative paths.
- CSS modules live under `src/styles/`, mirroring `src/components` and `src/pages`, never beside the component.
- Find migrations by what they define (a function, a table, a view), not by guessing their number.

## Copy

- British English. No em or en dashes anywhere, code comments included. No contractions in client-facing copy. None of the banned words in the `brick-dev` skill.
- Plain professional labels: "Added to basket", not "Put something in the basket". Casual and cute read as childish; so does trying too hard.
- Specific beats generic: "If it is not on the shelf yet, tell us and we will find it" beats "useful things for the house".
- A measured zero is data and is shown as zero: 0 sold is a fact. Only an unknown is never written as zero; that gets "Not rated yet", "None yet" or a dashed outline. A zero where the truth is "we could not see" is the most expensive error there is.
- Estimates are labelled as estimates, and never set at the size of a measured figure.
- No counts written into copy or status files that the portal also shows; they go stale.
- Nothing promised that is not true today: no report dates before the report exists, no "done" before it is done, no prices that are not the real ones.
- Explanations go in tooltips, not paragraphs on the page.
- Comments: one line, the why not the what (`comment-rules.md`).

## Delivery status

- An item is delivered when it is functional: it works and can be used today. A date is shown where it is known and is not required.
- The public pages use two states only: Delivered, or Not yet with one plain reason. No "in build", no "built, waiting".
- Her day to day work in the portal (product decisions, product descriptions) is not a delivery item waiting on her.
- The status page tells the story; the Deliverables page is the checklist against the contract. They must not repeat each other.
- One number, one meaning: a figure and the list under it come from the same function.

## Engineering rules

- Multi-tenant from the first line. Nothing client-specific in code; it lives in `tenants.store` or a table with a tenant id, read through settings on every page.
- Every view is `security_invoker`; every policy checks `has_tenant(tenant_id)`. Check this on every migration.
- Every write checks its result. A send that is not recorded gets sent again.
- A failure is never silent: a fallback to defaults is logged.
- Scripts never touch her decisions, notes, sources or figures she has already set.
- Migrations are numbered, idempotent where they can be, tested before delivery, and delivered with the order to run them.
- The CSS reset's `ul[class] { padding: 0 }` outranks a plain class: padded lists use `ul.className`.
- Anything fixed inside the sticky header goes through a portal: its backdrop blur makes it the containing block. The portal topbar's popovers and the command palette do this.
- A grid item will not shrink below its content: use `minmax(0, 1fr)` columns or `min-width: 0`, or a row of chips scrolls the whole page sideways.
- Keyframes named in a CSS module are scoped to that module. A module cannot use the global `rise` from `tokens.css`; define its own.
- Every colour goes through a token, including tints: `color-mix(in srgb, var(--c-base) 60%, transparent)`, not a raw rgb. A new colour means a new token.

## Talking to each other

- Joseph decides. Claude proposes one direction with reasons, asks at most one or two questions, and builds on yes.
- Push back when something is wrong, including Joseph's instruction or Claude's own earlier claim. Correct mistakes out loud and early.
- Say plainly what was not verified.
- Short replies for small things, full reasoning for design and debugging.
- When a chat grows long enough to dull the work, say so and write a handoff and a session summary.
- When Joseph says to hold off on code, stop changing files until he says go, and say what is already in the last zip.
