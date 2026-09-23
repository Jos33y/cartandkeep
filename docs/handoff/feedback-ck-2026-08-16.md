# Feedback, Joseph, Cart & Keep

**Read this before responding to anything.** Every item is a correction he made
or a preference he stated. Reload each session. Supersedes
`feedback-ck-2026-08-14.md`, which is kept for the record. Items from that file
that still bite are carried forward rather than dropped.

Sessions of 15 and 16 August 2026.

---

## Corrections he made this session, verbatim

| He said | What I was doing |
|---|---|
| "4800 products lol... you have forgotten elderly alone had over 2k rows per csv files and others" | reported the count of grouped products as the amount of work done, when grouping is the smallest number in the chain. Real figure is 17,786 rows |
| "you have forgotten the way our status page is and the routing?" | built a standalone HTML page when the status page is a React route inside the app, host split on `status.`, with its own router and CSS modules |
| "you did not apply the fix on your end how could you forget" | told him to change an import, then rewrote the same file twice without making the change |
| "was that not for my the brick dev studios and to receive payment from her" | merged Flutterwave, which is the studio's rail for her retainer, with Stripe, which is her storefront checkout. Two different things |
| "you do know it will be in a box?" | called a knocked down garment rail a metre of steel tube, with the flat pack photo on screen |
| "see shipping" | priced freight off the two piece quote at £16.73 a unit when the one piece quote on the same page was £10.44 |
| "haaa 12 pounds to 2.3 pounds and it still failed haaaa" | reported the route's answer as the product's answer. The £12.99 garment rail is dead at the price with free freight, and I made it a freight story |
| "its suppose to be 19 not 24" | proposed a date without checking it against the month one deadline he was working to |
| "the csv files I don't have 06 and 05 there ooo" | assumed row exports existed for windows he had only screenshotted |
| "lets use 19 not 24" | his call was better. Three sittings rather than one queue of 120, and inside the 22 August deadline rather than after it |
| "even if its 5 that survives its honest and solid" | stated as a rule and it now outranks volume on this project |
| "lets work advance way and senior level" | asking permission on every small tested reversible change |
| "hope its not sounding a.i generated?" | a four hundred word client message with not one contraction in it |

---

## The rule he set this session

**Five real ones she can source beats fifty she cannot.** Said explicitly and
confirmed as outranking everything else. It killed the plan to reach 200 by
lowering the importer floor, because lowering the floor is exactly how you get
fifty she cannot source.

---

## Standing preferences

Everything in the 13 and 14 August files still applies. The ones breached this
session are marked.

### Delivery

- **Always give the file path and whether it is new or an overwrite.**
- Present the file again rather than referring back to it.
- No em dashes or en dashes anywhere.
- British and Nigerian English. No archaic vocabulary.
- "The Brick Dev Studios", plural.
- Short and action first for fixes. Fuller only when exploring or designing.
- No preamble, no context recaps.
- **Push back when he is wrong.** He was right on every push back he made this
  session.
- Own mistakes in one line. No extended apology.
- **Name one next step, not four.**
- **Ship small tested reversible changes without asking.** Ask before anything
  touching the schema, the client, or money.

### Working style

- **Think twice, code once.**
- **Pause means stop.** Aidapt was paused on 15 August and has not been raised
  since.
- Say something once.
- **Read every file he uploads before answering.**
- **Read the page before asserting what is on it.** (breached four times, see
  below)
- Timestamped filenames on handoff documents.
- **When he asks a question, answer it before doing anything else.**

### Client communication

- **Never put an excuse in a client message.** He had not slept in 48 hours and
  wanted it in. It stays out. She had already thrown one explanation back.
- **Never claim something is done that she could check and find missing.** He
  wanted "all products are sourceable" in writing. It is not true and she is a
  lawyer.
- **Give the real number, not the round one.** 17,786 rows and 169,225 units of
  sales beat "close to 50,000 products", and she can verify them.
- **Contractions in WhatsApp.** No contractions is the biggest tell that a
  message was written elsewhere.
- **Split into sends.** One wall of perfect punctuation does not look typed.
- His opening to her is "Good evening ma, Happy Blessed Sunday". Use his voice
  where it is known rather than inventing a register.

---

## What I would do differently

### The big one, and it is the same one

**Report the product's answer, not the route's answer.** This was the headline
correction on 14 August and it happened again on 16 August on the garment rail.
I framed a product that cannot work at £12.99 with free freight as a freight
problem, because the freight quote was the number in front of me.

The test: before writing that a product failed, set the route's cost to zero and
check whether it still fails. If it does, it is a price problem and the route is
irrelevant.

### Asserting instead of reading, four times in one session

- Called a flat packed garment rail a metre of steel tube with the photo open.
- Took the two piece freight rate when a cheaper one piece rate was on the
  same screen.
- Said the listable table ranks on headroom. It ranks on `recent * headroom`,
  which is monthly worth, and is correct as written.
- Said "sources and notes are typed by hand and have no other copy". The two
  lost rows were CJ sourcing requests with no price in them.

### Multiplying a metric I had not read the definition of

Sold-rate times seller count, presented as proof that demand had not grown. The
report's own note says sold-rate is eBay's percentage of similar items that
sold and is not the same metric as sell-through in the gates. I did not know
its denominator and multiplied it anyway. Withdrawn, and the tail column gave
the right answer instead.

### Building the wrong artefact

An hour on a standalone HTML page for a status site that is a React route. The
architecture was in the context package I had already unpacked. Check what
exists before deciding what to build, and that check is not optional because
the request sounded simple.

### Naming a fix and not applying it

Told him to change `./statusItems` to `@data/statusItems`, then rewrote that
file twice without the change. A fix that is described and not made is worse
than one that is neither, because he stops checking.

---

## Recurring failure modes to watch

1. **Testing the route and reporting the product.** Two sessions running.
2. **Asserting a rate, a page, a price or a dimension instead of reading it.**
3. **Using a metric without reading its definition.**
4. **Building before checking what already exists.**
5. **Describing a change instead of making it.**
6. **Optimism in defaults.** A null must never become a zero.
7. **Printing a verdict the data cannot support.**
8. **Generalising from one row, one price, or one cell of a matrix.**
9. **Fixing a fault on one page and not the others that share it.**
10. **Placeholders in commands.** Three separate `<stamp>` style failures in
    one evening, all in the Windows shell where angle brackets are redirects.
    Print the real path or make it a flag.
