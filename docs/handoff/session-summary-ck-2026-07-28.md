# Session Summary, Cart & Keep

**28 July 2026, WAT.** Continues 26 July.

Started: schema and pipeline built, nothing deployed, every portal page blank.
Ended: three hosts live, portal usable, pipeline correctly wired and blocked on
one config row.

---

## Shipped

**Login page, rebuilt three times.** Ended on a full height cream slab against a
charcoal field, hard edge, no card. Product mark inline rather than as an image,
because the asset draws its letter as SVG text in DM Sans, which is not loaded
and cannot load inside an `img`. Two segment step indicator using the verdict bar
device. Deterministic star field on the dark side.

**Fonts.** `@fontsource-variable/geist` and `@fontsource/ibm-plex-mono` were in
`package.json` and never imported. Every screen had been rendering system
fallbacks, and `font-weight: 560` was snapping to 600. Three import lines in
`main.jsx` fixed the whole product.

**Status page, rebuilt twice.** First as a flat checklist, then restructured
around growth: verdict headline, next dated milestone, in progress, coming up,
completed as a month grouped log shut by default. Fifteen milestones, six done.
Sign in link derived from the hostname rather than hardcoded, so tenant two
works without a change.

**Portal shell.** Sunk rail with the active item raised back to the page
surface, eight icon set drawn because `PORTAL_NAV_SECTIONS` had referenced icons
by name since it was written and `components/ui/icons/` was empty. Account
footer showing email and role, so it is obvious whose session you are in.
Escape closes the mobile drawer and returns focus.

**Overview page.** New route at `/`, Candidates moved to `/candidates`. Before
the first batch it shows a three step flow strip; after it, figures, a decision
split bar and rejection reasons. Built for the empty case first, because that is
the state it is in.

**Notes.** Migration 0009, author only, no platform admin bypass. Rows expand
into an editor in place. Told him plainly that this is privacy from the portal,
not from the database owner, since the pipeline runs on the secret key.

**Settings.** Name editable through auth metadata, no migration. Email and role
read only. Gates and category boundaries shown in her language and not editable
yet, on the argument that changing the margin floor before seeing a batch
changes what arrives with no feel for the consequence.

**Five empty states.** Each previews the table its screen becomes, with real
column headers and values marked absent by a rule. Finance shows the seven line
margin model, so the empty screen already says that ads, packaging and returns
are counted.

**Demo mode.** `?demo=1`, per tab, banner always on, never the default. Ten
fixture candidates whose margins are computed rather than typed, so the ledger
reconciles to the penny.

**Deployed.** portal and status both live behind Cloudflare.

---

## The big correction

**The pipeline was computing the right numbers and writing the wrong ones.**

`run.js` imported `computeMargin` from `scoring.js`, which is platform fee and
payment fee only. The complete model in `margin.js`, with promoted listings,
postage by band, packaging, returns provision, `net_pct`, `band` and
`cost_source`, was written, tested and never called. Every margin in the database
was overstated by exactly the lines the methodology names as the ones most often
missed.

`evaluateGates` and `rankScore` were also never called. `passesFilter` was doing
the work of both, so the gates document described behaviour the code did not
have, and the ranking score existed only as a return value nobody read.

The interface then read fields that did not exist. `VerdictBar` reads
`candidate.breakdown`; there was no column and no select. The signature component
of the design system had never rendered once.

Same shape as the 26 July correction: the right thinking was written down, and
the wiring did not follow it.

---

## Issues and fixes

### Correctness

| Issue | Cause | Fix |
|---|---|---|
| Margins overstated | `run.js` used the thin `computeMargin` | import from `margin.js` |
| eBay double charged | payment fee inverted between the two files | managed payments include processing, store only |
| Gates never ran | `passesFilter` instead of `evaluateGates` | full gate set, failures and skips counted |
| Score never persisted | `rankScore` not called | migration 0007, written and sorted on |
| Verdict bar empty | no `breakdown` column | 0007 |
| Ledger showed source agreement as score | `confidence` at display size | `score`, confidence as tie break |
| Sources line always empty | signals emit `sourceId`, row read `source_id` | accept both |
| Studio accounts locked out | gate checked `memberships` only | check `is_platform_admin` too |
| Code entered, no redirect | `PortalProtected` not mounted on `/login`, so nothing listened | navigate from the page |
| Settings blank | `tenant.js` never selected `research` | added |
| Only CJ enabled | `tenant_sources` had one row | 0008 |

### Structure

**Circular imports.** `portalRouter` imported pages, five files imported
`portalPath` back from it. Moved `portalPath` and `PORTAL_NAV_SECTIONS` to
`constants`, which imports nothing. Dead outer catch-all removed. Lazy loading
past Overview and Candidates.

**Duplicate chrome.** `StatusShell` and `StatusPage` both rendered a header.

**Undefined tokens.** `--t-sm` and `--w-bold` are used in six files and defined
nowhere, so those declarations have never done anything.

**Invented a function name.** Wrote `member_of_tenant` in the notes policy. The
function is `has_tenant`. Would have been caught by reading 0001 first.

### Accessibility

Every new pairing measured before use. Sage on brand wash came in at 2.91, under
the 3:1 line for a graphic, so empty state icons moved to `--c-positive` at 4.52.
Cream on sage failed at 3.05, so all text on the sage plate is full ink.

---

## Decisions

| Decision | Reason |
|---|---|
| Demo behind `?demo=1`, never default | an honestly empty page beats a demo mistaken for real, with this client especially |
| Empty states preview the real table | a blank panel is the laziest thing on a page |
| Overview at `/`, Candidates at `/candidates` | a dashboard is the thing you check, the queue is the thing you work |
| Completed log shut by default | it only grows, and the nav was scaffolding for a problem that does not exist yet |
| Notes author only, no admin bypass | otherwise private is not true |
| Gates read only in Settings | changing the floor before seeing a batch has no felt consequence |
| Missing `scoring.costs` is fatal | every optional line resolving to zero is the flattering failure this pipeline exists to prevent |
| Portal link on the status page, nothing else | the store is not built, and linking a door onto nothing undoes the page's whole job |
| Category discovery before product research | picking a niche before the data is the same error as picking a supplier before the demand |

---

## Client

Status and portal links sent. Call happened on the afternoon of the 28th.
Nothing new beyond confirming she has a supplier in China. First review session
moved to Thursday 30 July, 7pm, and the status page carries that date, so it is
now a public commitment.

Raised once and dropped: a 1am WhatsApp timestamp reads badly to a lawyer client.
Message written, sent in the morning.

---

## What I would do differently

**Read the schema before writing a policy.** `member_of_tenant` was invented.
0001 was one file away.

**Check what the code calls, not what the repo contains.** Two libraries were
complete, tested and unreferenced. Nothing in a test run would have shown it,
because the tests test the libraries.

**Design towards a standard, not away from prohibitions.** Every empty state and
first pass this session came out correct and lifeless, and he was right each
time. Following a list of things not to do produces absence, not restraint. The
reference screens asked for at the end of the session are the fix.

**Confirm a call before implementing it.** Demo mode was reasoned about
correctly and then built in the same breath, without waiting. He asked for that
to change.
