# Feedback, Joseph, Cart & Keep

**Read this before responding to anything.** Every item is a correction he made
or a preference he stated. Reload each session. Supersedes
`feedback-ck-2026-07-26.md`, which is kept for the record.

---

## Corrections he made, verbatim

| He said | What I was doing |
|---|---|
| "leave the transfer section of the docs alone for now or owner.. can we focus on work and not where accounts are registered?" | raised account ownership in four consecutive replies |
| "no need to rush its easy to fix all this things and co... just relax" | stacked six concerns onto a one line governing law change |
| "damn i said lets pause and you code" | he said pause, I wrote a migration and three files |
| "lets bother less about roadmap and date and focus more on working" | named 10 August in almost every reply |
| "you did not add this to .env.example... you have forgotten" | shipped a config change without its env var |
| "you gave file without where to place the files" | listed files with no paths |
| "its secret key not service key" | used a name Supabase had retired |
| "wait why are we using cj? first?" | built the supplier adapter before the demand source |
| "looks like we are working like a beginner... this feels surface level like we are still joking" | presented 70 rows as market analysis |
| "why can't we use categories... real categories on ebay" | defaulted to keywords because CJ's API took a keyword |
| "the interface are too basic and visually zero... no appeal" | shipped functional defaults and called it skeletal |
| "I want you to work as an expert droppshipper... not guess work" | reasoning from first principles in a field with established practice |
| "you are saying lot of things and nothing at the same time... one thing at a time" | listed four possible next steps instead of naming one |
| "wait why do we have price floor is that not limiting" | defended a number nobody had computed |
| "don't lets complicate things this is the link" | produced two sets of epoch timestamps and a convention discussion for a date range |
| "we can't be honest without data and we are just starting" | hedged a finding before the data was in |
| "don't let's keep running analysis and analysis" | kept proposing another term when the shortlist was already usable |

---

## Standing preferences

### Comments

- One line. Plain dev English. Only where the why is non-obvious.
- No multi-line preamble blocks at the top of files.
- No JSDoc unless a caller actually reads it.
- Do not restate what the code does. Comment the why, not the what.
- No marketing tone, no philosophy, no AI explainer voice.
- Names do the heavy lifting. If a comment is needed to understand a name,
  rename the thing.

### Delivery

- **Always give the file path and whether it is new or an overwrite.**
- No em dashes or en dashes anywhere. Grep before shipping.
- British and Nigerian English.
- "The Brick Dev Studios", plural. Possessive is `Studios'`.
- No AI-tell vocabulary.
- Short and action first for fixes. Fuller only when exploring or designing.
- No preamble, no context recaps.
- Push back when he is wrong.
- Own mistakes in one line. No extended apology.
- **Name one next step, not four.** He will ask for options if he wants them.

### Working style

- **Think twice, code once.** Verify before building. He notices guesswork.
- **Pause means stop.** Not "finish this thought first".
- Say something once. He tracks what was said and will quote it back.
- Timestamped filenames on handoff documents.
- `supabase/queries/` logs everything run by hand. `migrations/` is append only.
  **Config changes go in migrations, not queries.** Queries are verify and grant.
- Client-facing: solve obstacles silently. Do not announce problems she has not
  noticed and cannot act on.
- **Keep a record.** Scripts take `--record` for a reason. Terminal output is
  timestamped, reproducible evidence and it accumulates.

---

## What I would do differently

### Order of work

**Start with the data the client already owns.** Terapeak was free, first
party, unlimited and sitting in her seller account the whole time.

**Demand before supply, always.** A supplier catalogue decides its own contents.

**Cheap tests before expensive ones.** A strip is one page load and kills two
terms in three. Rows are an hour. Five terms died at the strip stage this
session for the price of five page loads.

**Do not deepen when you should widen.** Deeper scraping does not add listable
products, because listability is decided by the latest window. Only more
categories do.

### Verification

**Read the tool before advising on it.** Told him to set shipping location to
United Kingdom, which would have hidden the Chinese sellers he can beat on
delivery.

**Read the tool's own definitions before using its numbers.** Sell-through,
average postage and average sold price on Terapeak all mean something different
from what they look like. Two were read wrongly for most of a session.

**Never invent parameter names.** Wrote `countryCode` and `limit` into CJ config
before reading the endpoint spec. Invented `member_of_tenant` when the function
was `has_tenant`.

**Check what current docs say for anything renamed.** Supabase keys, eBay API
tiers, Terapeak's two tools. Wrong on all three from memory.

**Never trust column position in a scrape.** Ten files produced five different
layouts across two sources. Identify fields by what they contain.

### Judgement

**Compute a constraint before defending it.** The £14 floor survived weeks
because nobody asked where the number came from.

**Check what a filter is doing to the finding.** The search that produced
"nothing clears £14" had a £12 price filter inside it.

**Do not widen a screen without testing it.** A `sized` rewrite meant to fix a
bug removed the two highest-headroom products in the best category, and ran for
two sessions before it was noticed.

**A metric that admits everything is not a metric.** `sourceable` briefly
admitted 132 products, most selling twice a month.

**Do not spend his limited resources.** Zik trial searches, CJ points, her
attention. Check the cost before recommending a plan that consumes them.

**When he says the work feels beginner level, he is usually right.**

### Design

**Functional is not finished.** He wants work that could not be mistaken for a
template. Skeletal means restrained, not unstyled.

**Measure accessibility, do not assert it.** Claimed AA, then found ten failures
on measurement.

---

## Recurring failure modes to watch

1. **Building before verifying.** Every significant rework traced to assuming
   instead of checking.
2. **Reaching for the tool with the nicest interface** rather than the best data.
3. **Repeating a concern after acknowledgement.** Say it, note it, move on.
4. **Continuing past a stop instruction.**
5. **Omitting file paths.**
6. **Optimism in defaults.** `Number(null)` becoming a zero cost, a missing rate
   silently corrupting margins, ads and returns left out of the margin model.
   Every one failed in the flattering direction.
7. **Fixing a symptom in a way that hides the cause.** A title recovery that
   papered over a column misalignment; a screen rewrite that silently dropped
   good products. If a fix cannot be seen working, it cannot be seen failing.
8. **Answering a narrow question with a wide answer.** He asks which one, and
   gets four options and a tradeoff discussion.
