# Comments

**The Brick Dev Studios** · living document

One line. Plain dev English. Only where the why is non-obvious.

- No multi-line preamble blocks at the top of files.
- No JSDoc unless a caller actually reads it.
- Do not restate what the code does. Comment the why, not the what.
- No marketing tone, no philosophy, no AI explainer voice.
- Names do the heavy lifting. If a comment is needed to understand a name, rename the thing.

Good:

```js
// Service-role webhook bypasses RLS on purpose.
```

Bad:

```js
/**
 * Apply the incoming webhook event to the meetings row.
 *
 * The webhook arrives from Cloudflare Calls and we trust its
 * payload because the signature has already been verified.
 * This is why we use service_role to bypass RLS for the update.
 */
```

## When a comment earns its place

- A value that looks wrong and is not. `// eBay wants the RuName here, not the URL.`
- A workaround for something outside the code. `// apiz host, not api. 404s otherwise.`
- A deliberate omission. `// No scope on refresh: sending one breaks existing consents.`
- A constraint nobody can infer from the file. `// 80 char limit, eBay truncates silently.`

## When it does not

- Restating the line below it.
- Explaining a well-named function.
- Recording the history of how the code got here. That belongs in the commit.
- Justifying a decision at length. If it needs a paragraph, it needs a doc.
