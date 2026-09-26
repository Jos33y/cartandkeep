# Session summary: portal shell, visit tracking, status and deliverables

**25 September 2026** | The Brick Dev Studios | Internal

The portal got a pinned rail and a desktop topbar, and it now records who visits and which screens they open. The status page was rebuilt around the signed scope and a drawn cupboard, and the Deliverables page became a one-line-per-item checklist. The delivery states in the data were corrected to match what actually works today.

## Delivered in this chat

| Area | What changed |
|---|---|
| Portal rail | Pinned to the viewport with its own scroll. Scrollbar hidden, soft fades at the edges only while there is more to scroll, 12px gutters both sides, the current screen scrolled into view. Active item ink icon and sage bar; Messages count in ink. Parked phone drawer removed from the tab order |
| Portal topbar | Desktop and phone. Crumb (section / page), a Ctrl K palette that goes to any screen, an account menu holding email, role, "Your last visit" and Sign out (moved out of the rail). For studio accounts only, a client visits line: green up to 3 days, amber to 13, red at 14, opening a 14 day strip with visit times and the screens opened |
| Visit tracking | Migration 0098: `portal_visits`, one row per person, tenant and London day. First and last time, visit count (a new visit after 30 minutes away), screens in the order first opened with open counts. No clicks, typing or time on screen. Studio visits recorded and excluded through `portal_member_visits`. She sees her own last visit |
| Interest | Its own heart icon; it shared the eye with Traffic |
| Status page | Dark hero "32 of 42 delivered." beside a drawn cupboard: one shelf per part of the scope (Month two early on its own top shelf, then Month one, SEO, Analytics), one box per item, filled when it works today. Then Waiting on you (legal review, her own legal name) with Done by you chips, Delivered grouped by what it does for her business with a "When it arrived" dot chart, Not yet with one reason each, and the link to the scope. "Access portal" replaces "Sign in" |
| Deliverables page | The checklist. "The signed scope." One line per item with a tick and date, or an empty circle and a reason. No hero, no chart, no long descriptions. Prints on A4 |
| Shared header | One component for both public pages: logo, a link to the other page, Access portal |
| Delivery data | Items marked delivered because they work today: financial dashboard, multi-category structure, legal pages, sales, revenue, both blog items, cart abandonment, the seven on-site SEO items, first batch listed, custom store live. Her decisions and product descriptions removed from her list (day to day work). Her Settings work credited as done by her. A plain reason on every Not yet item. The stale "waits on the shop being public" tags removed |

## Decisions made

- **Delivered means functional:** it works and can be used today. Dates show where known and are not required.
- **Two states on the public pages:** Delivered, or Not yet with one reason.
- **The status page tells the story, the Deliverables page is the checklist.** They do not repeat each other.
- **A measured zero is data.** Only an unknown is never written as zero. Estimates are labelled as estimates.
- **Her £0 postcode surcharges are her decision,** made in Settings herself.
- **cartandkeep.com points at the live store.**
- **Parked:** a "Getting started" setup guide with progress and a replayable guided tour.

## Found and fixed

| Where | Problem | Fix |
|---|---|---|
| Portal rail | Grid item with no height of its own, so it grew with the page and the nav never scrolled | Sticky at `100dvh` |
| Portal rail | Windows scrollbar took width from the links, leaving a wider gap on the right | Hidden, with edge fades as the scroll signal |
| Portal rail | Active state and Messages count in terracotta | Ink and sage |
| Status page | Two completion stories: 92 of 100 on the status page, 15 of 42 on Deliverables | Both pages count the same 42 from one function |
| Status page | Completed work collapsed by default, "0 Coming up", a condition where a date belongs | Removed |
| Status page | Headline "15 of 42 … and 15 more" invited adding the two | Two separate things: the 42, and month two on its own shelf |
| Status page | Dot chart overflowed its baseline after a late size change | Height taken from the busiest day |
| Status page | Chip index scrolled the phone page sideways | `minmax(0, 1fr)` and `min-width: 0` |
| Delivery data | Items that worked were still "in build" | Marked delivered by the functional rule |
| Deliverables page | Paragraph claiming the domain was not pointed, and counts that had gone stale | Removed; the lines say it |
| Collector | `Compress-Archive` wrote backslash paths | Zips written entry by entry |

## Not verified

- Safari and Windows Chrome on the portal shell and both public pages.
- The `status.` to `portal.` links on the live hosts.
- Printing the Deliverables page from a real printer dialog.
- 0098 on the live Supabase project. It was replayed on Postgres 16 against 0001's tenancy with a stubbed `auth.uid()`.

## Open, not done

- Home page product cards, then product pages, then help pages (the next chat, see `06-handoff-store-2026-09-25.md`).
- The overview's three disagreeing "sold" figures (needs the `store_channel_profit` SQL on Postgres).
- The eBay Traffic page: Open rate does not match opened divided by shown, "Unrealised" needs an estimate label, terracotta on figures, clipped titles, the mono status pill.
- Her own legal name in Settings, and her review of the legal pages (hers).
- The ten Not yet items in the scope.

## Files for the tree

**Migration, run in the Supabase SQL editor:**

- `supabase/migrations/0098_portal_visits.sql`

**New files:**

- `src/hooks/usePortalVisits.js`
- `src/hooks/useStatusLastVisit.js`
- `src/components/layout/portal/PortalTopbar.jsx`
- `src/components/layout/portal/CommandPalette.jsx`
- `src/components/layout/status/StatusHeader.jsx`
- `src/components/status/ScopeCupboard.jsx`
- `src/components/status/DeliveryTrack.jsx`
- `src/styles/layout/portal/portal-topbar.module.css`
- `src/styles/layout/portal/command-palette.module.css`
- `src/styles/layout/status/status-header.module.css`
- `src/styles/ui/status/scope-cupboard.module.css`
- `src/styles/ui/status/delivery-track.module.css`
- `tools/collectors/collect-ck-status-overview-2026-09-25.ps1`
- `tools/collectors/collect-ck-portal-shell-2026-09-25.ps1`

**Changed files:**

- `src/components/layout/portal/PortalShell.jsx`
- `src/styles/layout/portal/portal-shell.module.css`
- `src/hooks/useAccount.js` (adds `isStudio`)
- `src/components/ui/icons/index.jsx` (adds `IconHeart`)
- `src/utils/constants.js` (Interest uses the heart)
- `src/pages/status/StatusPage.jsx`
- `src/styles/pages/status/status-page.module.css`
- `src/pages/status/DeliverablesPage.jsx`
- `src/styles/pages/status/deliverables-page.module.css`
- `src/data/statusItems.js` (group lines as `purpose`, corrected states)
- `src/data/deliverables.js` (`screen`, `why`, `committedItems()`, corrected states, store tags removed)
- `src/styles/base/tokens.css` (adds `--c-warning-on-dark`)

**New folder:** `src/styles/ui/status/`. Every other path above sits in a folder that already existed.

## How the work was verified

A local harness merged the repo layers and rendered the real components with real CSS modules, a stubbed Supabase and Playwright, at 1320px, 1024px and 390px. Migration 0098 was replayed twice on Postgres 16 with realistic users: client, studio and a member of another tenant, plus anonymous. Every screen was then checked live from Joseph's screenshots. Neither harness survives between chats.
