# Handoff, Cart & Keep

**Session close:** 28 July 2026, WAT. Continues 26 July.
**Load with:** this file, `feedback-ck-2026-07-26.md`, plus `docs/research-methodology.md`,
`docs/design-system.md`, `docs/category-research.md` and `docs/ebay-access-notes.md`.

---

## Opening message for the new chat

> Continuing Cart & Keep. Portal is deployed and live at portal.cartandkeep.com,
> status page at status.cartandkeep.com. Overview, Notes, Settings and five empty
> states are built. Candidates ledger is next and has never rendered with data.
> Blocked on tenant scoring config. Read the feedback file first, then the design
> note at the end of this file.

---

## Deployed and working

Three hosts, one build, split on hostname. All live.

- Login, cream slab against charcoal, star field on the dark side
- Status page, verdict headline, in progress, coming up, completed log collapsed
- Portal shell, sunk rail, icon set, account footer showing email and role
- Overview, flow strip before the first batch, figures after it
- Notes, private per author, migration 0009
- Settings, name editable, gates and categories read only
- Five empty states previewing the table each screen becomes

Demo mode is `?demo=1`, per tab, banner always visible. Never the default. That
was a deliberate call: an empty page that is honestly empty beats a demo briefly
mistaken for real, with this client especially.

---

## Blocked, in order

**1. Tenant scoring config.** `tenants.scoring` has `weights`, `margin_floor`
and `min_signals`. It has no `gates` and no `costs`. The rewritten `run.js` exits
on missing `scoring.costs` by design, so the pipeline cannot run at all. This is
the only thing blocking everything downstream.

Needs: Royal Mail large letter and small parcel prices, packaging, 6 percent ads,
returns by category, plus the gate thresholds already agreed. Open question left
from last session: use the figures in the session notes and mark them for
checking, or get current Royal Mail pricing first.

**2. Terapeak access.** Still the demand layer. Paste parser, not an export
adapter, and not written because it needs one real paste to write against.

**3. Candidates has never rendered with data.** Demo fixtures exist and
reconcile. It is the screen Thursday is built around.

---

## Migrations run

| | |
|---|---|
| 0007 | score, breakdown, component_count, demand metrics on candidates |
| 0008 | terapeak, browse, zik, csv rows in tenant_sources. Browse disabled until the keyset is live |
| 0009 | notes, author only, no admin bypass |

---

## Corrections made this session

**`run.js` called the wrong margin function.** It imported `computeMargin` from
`scoring.js`, the two line version. The complete model in `margin.js` with ads,
postage by band, packaging and returns provision was written and never called.
Every margin in the database was overstated.

**The payment fee was inverted.** `scoring.js` charged it when the channel was
not the store; `margin.js` charges it when it is. eBay managed payments include
processing inside the 12.8 percent, so every eBay candidate was double charged.

**`evaluateGates` and `rankScore` were never called.** `passesFilter` was doing
the work of both. Now gates run, failures and skips are counted and printed, and
score plus breakdown persist.

**The verdict bar had never rendered.** It reads `candidate.breakdown`, which had
no column and was not selected. The signature component of the design system was
dead since it was written.

**The ledger showed the wrong number.** `confidence` at display size where the
score belongs. Confidence measures source agreement, not quality.

**Circular imports.** `portalPath` and `PORTAL_NAV_SECTIONS` moved from
`portalRouter` to `constants`, which imports nothing.

**`PortalProtected` checked memberships only**, locking out studio accounts. Now
checks both, and separates a failed tenant load from a real access problem.

**`tenant.js` never selected `research`.**

**Fonts were installed and never imported.** Every screen was rendering fallbacks.

---

## Direction change, recorded in docs/category-research.md

Category discovery now comes before product research. Compare Terapeak, Zik and
Browse to find categories that are evergreen or rising into August to December,
rather than staying inside the two agreed categories where almost nothing clears
the fourteen pound floor.

Regulatory exclusions do not move regardless of what the data shows. Her sign off
comes before any config change, because the category boundary was agreed with
her.

Needs a Categories section in the portal. Designed in that doc, not built.

---

## Client state

Status page and portal links sent, call happened 28 July afternoon. First review
session moved to **Thursday 30 July, 7pm**, and the status page shows that date,
so if it moves again the page has to move with it.

She has a supplier in China. Nothing else new from the call.

---

## Rotting

- CJ account freezes around late August without an order
- `pipeline/sources/index.js` is still supply-first. `collect()` needs splitting
  into `discover()` and `enrich(candidates)` before the demand-first reorder has
  anywhere to land
- `missing_adapter` is still silently non-fatal
- `Number(ts.weight)` is still unguarded against NaN
- `ScreenStub.jsx` and `screen-stub.module.css` are dead
- `--t-sm` and `--w-bold` are undefined and used in six files

---

## Design, read this before touching any interface

He has pushed back on visual quality repeatedly and the pushback has been
correct every time. The pattern in my work: designing against the design
system's prohibitions rather than towards a standard. No gradients, no shadows,
no decorative icons, take one thing off. Follow only those and the result is
correct and lifeless, which is what he keeps rejecting.

What he has said, in his words: the interfaces are too basic and visually zero,
this is 2001 design in 2026, icons are not a SaaS tell, do not kill what makes a
page worth looking at in the name of avoiding templates.

**Open action:** he was asked for two or three reference screens he considers
top level. Design against those. Until they arrive, the standard is undefined
and the same loop will repeat.

Things that did work: the charcoal and cream slab login, the mono display
numbers on the status page, the star field, the sunk rail with the active item
raised. Things that did not: centred cards, large empty panels, numbered lists,
four zeros in a row, anything where restraint became absence.
