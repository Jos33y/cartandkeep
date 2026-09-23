# Cart & Keep, messaging context collector.
#
# Scoped to item 3 rather than to the whole codebase. Sixteen source files and
# the documents, which is enough to read all of them properly.
#
# The reason it is tight: every mistake on this project has come from a file
# that was already in context and skimmed, not from one that was missing. An
# import split across two lines, a helper taking four positional arguments, a
# rule on an element that was not a flex container. More context does not fix
# that, it produces it, because a window with thirty components in it is a
# window nobody reads carefully.
#
# Ask for more. The whole of yesterday was built that way and the storefront
# work landed correctly without ever having most of the storefront in context.
#
# Run from the repository root.

$out = "ck-messaging-context"
$root = Join-Path $PWD $out
Remove-Item $root -Recurse -Force -ErrorAction SilentlyContinue

# --- what messaging actually touches ----------------------------------------
#
# A thread belongs to a product, an order or a basket, is reached by the token
# already in the confirmation email, and is answered in the portal. So: the
# three places a thread can start, the token path that already works, the
# portal shell it will hang off, and the sender it will use.

$files = @(
  # The documents. Read before anything else, in this order.
  "docs\cart-store\decisions-2026-08-20.md",
  "docs\cart-store\messaging-plan-2026-08-20.md",
  "docs\cart-store\build-plan-2026-08-20.md",
  "docs\handoff\handoff-ck-2026-08-23.md",
  "docs\handoff\session-summary-ck-2026-08-23.md",
  "docs\handoff\feedback-ck-2026-08-23.md",

  # Where a thread starts, buyer side.
  "src\pages\store\ProductPage.jsx",
  "src\pages\store\OrderConfirmationPage.jsx",
  "src\pages\store\OrderLookupPage.jsx",
  "src\pages\store\CartPage.jsx",

  # The token path that already works, and is the pattern to copy rather than
  # invent. `review` checks a reference and a token in constant time and
  # refuses in every way worth refusing.
  "supabase\functions\review\index.ts",
  "src\pages\store\ReviewPage.jsx",

  # The sender. Five kinds already, one of which is not about an order, which
  # is the shape a messaging kind will need.
  "supabase\functions\notify\index.ts",

  # The portal side. The shell decides where a Messages entry goes and what an
  # unanswered count hangs off; Orders is where a thread about an order is
  # answered.
  "src\components\layout\portal\PortalShell.jsx",
  "src\pages\portal\OrdersPage.jsx",
  "src\components\ui\portal\OrderRow.jsx",

  # The most recently built portal screen, as the shape to follow: a hook, a
  # page, a route, a nav item, its own icon, a stylesheet.
  "src\pages\portal\ReviewsPage.jsx",
  "src\hooks\useReviews.js",
  "src\styles\pages\portal\reviews-page.module.css",

  # Routing and shared plumbing.
  "src\utils\constants.js",
  "src\app\portalRouter.jsx",
  "src\app\storeRouter.jsx",
  "src\components\ui\icons\index.jsx",
  "src\lib\supabase.js",
  "src\lib\tenant.js",

  # The design tokens. Three files invented tokens this week that do not exist,
  # and this is what stops it happening again.
  "src\styles\base\tokens.css",
  "src\styles\base\store-tokens.css",

  # The two fixtures still in her database. The handoff says to clear them on
  # launch morning, and the next session should be able to read what they do
  # rather than take that on trust.
  "supabase\queries\lifecycle-test-order.sql",
  "supabase\queries\sample-review.sql"
)

$missing = @()
foreach ($f in $files) {
  if (Test-Path $f) {
    $dest = Join-Path $root (Split-Path $f -Parent)
    New-Item $dest -ItemType Directory -Force | Out-Null
    Copy-Item $f $dest
  } else {
    $missing += $f
  }
}

# --- the last four migrations ------------------------------------------------
#
# The eleven from this week, 0056 to 0066. Not all sixty six: the earlier ones
# are the research pipeline and the original store schema, both described in
# the handoff, and neither is what a messaging table sits beside.

$migDest = Join-Path $root "supabase\migrations"
New-Item $migDest -ItemType Directory -Force | Out-Null
Get-ChildItem "supabase\migrations" -Filter "00*.sql" |
  Where-Object { $_.Name -match '^00(5[6-9]|6[0-6])_' } |
  ForEach-Object { Copy-Item $_.FullName $migDest }

# --- the manifest ------------------------------------------------------------

$manifest = @()
$manifest += "Cart & Keep, messaging context"
$manifest += (Get-Date -Format "yyyy-MM-dd HH:mm")
$manifest += ""
$manifest += "Scoped to build plan item 3. Ask for any file not in here rather"
$manifest += "than inferring it: that is how the last three days were built."
$manifest += ""
$manifest += "Read the documents first, in the order they are listed in the"
$manifest += "handoff. decisions-2026-08-20.md wins any disagreement."
$manifest += ""
$manifest += "Collected $($files.Count - $missing.Count) of $($files.Count) named files."
$manifest += ""

if ($missing.Count) {
  $manifest += "MISSING, tell Claude before it starts:"
  $missing | ForEach-Object { $manifest += "  $_" }
  $manifest += ""
}

$manifest += "Migrations included, 0056 to 0066, this week's work:"
Get-ChildItem $migDest -Filter "*.sql" | ForEach-Object { $manifest += "  $($_.Name)" }
$manifest += ""
$manifest += "NOT in here, and deliberately:"
$manifest += "  the research pipeline, which messaging does not touch"
$manifest += "  the status app"
$manifest += "  most of src\components\ui\store"
$manifest += "  the blog and legal pages"
$manifest += "  checkout, stripe-webhook, draft, subscribe, request"
$manifest += ""
$manifest += "For anything a targeted question would answer faster than a file,"
$manifest += "run a sweep instead. That is what found the eBay policy ids and"
$manifest += "the newsletter contradiction:"
$manifest += ""
$manifest += "  Get-ChildItem -Path src -Recurse -Include *.jsx,*.js |"
$manifest += "    Select-String -Pattern 'whatever you are looking for'"

$manifest | Out-File (Join-Path $root "MANIFEST.txt") -Encoding utf8

Compress-Archive (Join-Path $root "*") "$out.zip" -Force
Remove-Item $root -Recurse -Force

"Wrote $out.zip"
if ($missing.Count) { "Missing $($missing.Count):"; $missing | ForEach-Object { "  $_" } }
