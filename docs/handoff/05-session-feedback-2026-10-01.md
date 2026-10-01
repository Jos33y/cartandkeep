# Cart & Keep, session feedback

**Written 2026-10-01** | The Brick Dev Studios | Internal

How the session from 29 September to 1 October went. The work itself is in `01-session-2026-10-01.md`.

---

## The headline

A lot was built, and most of it held: the Amazon reader worked on its first live run, Listings came down from 7 seconds to 90ms, and every count agreed with her data. But the one thing that mattered most at the end, getting a single card live on eBay, took over 12 hours and still has not landed. Rules piled on rules, and eBay errors were found one at a time by Joseph pressing Publish. That is the lesson of this session.

---

## What worked

- **Collector first, then build.** The listings and insights collectors gave her real counts before any SQL was written, so the view matched her data on the first deploy.
- **Measuring rather than claiming.** The view was timed on 6,000 generated listings in local Postgres. The Amazon parser was tested against her real Axesso run, and the daily check was read back from `supplier_checks`.
- **Asking what the page is for.** Once Joseph said Listings means live and nothing else, the page got simpler and better: three tabs of truth, not a mix of drafts and listings.
- **Meaning over labels.** "Shop 1, shop 2" became "12 views", "no views yet", "3 baskets, no sale". The flat "Open product" button became the draft's actual gaps, each linking to its step.

---

## Where Joseph had to push

| Joseph said | What was wrong | The lesson |
|---|---|---|
| "its called listings and whats live... draft is in product no need for it be there" | Shop drafts shown on Listings | Name the page's job before designing it. |
| "shop 1 shop 2 shop 8 doesn't carry meaning" and "the open product button shows you getting lazy" | Labels and a generic button where meaning was possible | Every mark has to say something to her at a glance. |
| "review the visuals properly... close to hallucination.. don't be" | Visual review that missed things | Look at every screenshot at every size before saying it is right. |
| "wait the page interest I sent to you is to let you know" | Context taken as a request to audit | When a screenshot comes without a question, ask what it is for, or use it as context only. |
| "the url we pulled back then came with images whats now the issues?" | Amazon facts and photos read but not used on the card | Data that is fetched must flow into what she sees. Trace it end to end. |
| "the parcel 0.5kg can't even be filled in" | `Number()` ran on every keystroke | Type into every input, including decimals and units, before delivering. |
| "we are not to make this overly complicated or strict... we need to act human" | A photo gate stricter than any real seller | Ask how a human seller does it, and match that. |
| "can you stop with all this rules left and right... I have been trying to list 1 product over 12 hours now" | Rules blocking the one outcome that mattered | A rule that stops a listing must earn its place. Default to letting it list. |
| "let it list successfully thats what matters" | A price warning treated as a blocker | Warnings inform. Only eBay's own refusals block. |
| "I did not say you should build it... relax" | Building on a passing remark | Build only on "build", "yes" or "go". |
| "there is docs there is everything but we facing error upon error" | eBay refusals met one by one in production | Read eBay's documentation for each field before sending it, and handle known refusals in code. |

The pattern: protective rules and partial wiring, added faster than they were checked against the real goal, which is her product live on eBay. Each rule made sense alone. Together they stopped the listing.

---

## How Joseph works, for the next chat

- He tests on the live portal with her real cards, and sends screenshots and pasted errors. Every screen is read closely.
- **"Don't code" means answer only.** Build only on "build", "yes" or "go". A remark like "infact we should be able to pull from ebay photos" is an idea, not an order.
- He wants it to act like a person selling on eBay, not a compliance system. Dropshippers share photos, so we should be practical.
- Short confirmations ("its done", "all deployed") close the item. Move on.
- He is under time pressure on listing. When something blocks a listing, fixing that comes before any new feature.
- Push back once, with evidence, then do it his way.

---

## For the next chat

1. **The goal is her products live.** Before adding any check, ask whether it could stop a listing, and whether eBay itself would stop it. If not, it is a note, not a blocker.
2. **Before any eBay call changes,** read the API page for every field sent, and list the known refusals for the UK site.
3. **Trace data end to end.** If something is fetched (Amazon facts, photos, weight), confirm it reaches the card, the draft and eBay.
4. **Use every control before delivering:** type real values, click, use the keys, check all 13 sizes.
5. **Answer what was asked.** When the message is a question, answer it. When it is context, use it as context.
6. **Mark what is confirmed and what is inferred** in every diagnosis, as was done for the publish error.
