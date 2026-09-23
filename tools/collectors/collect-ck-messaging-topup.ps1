# Cart & Keep, messaging top up.
#
# A second narrow bundle rather than a rerun of the full collector. The first
# messaging bundle is already read, and re-sending twenty six files to add nine
# spends the context on things that were read three hours ago.
#
# Run from the repository root.

$ErrorActionPreference = 'Stop'

# The guard the other collectors carry. A collector run from the wrong folder
# reports every file missing, which reads as a repository problem rather than
# as a working directory problem.
if (-not (Test-Path .\package.json)) {
  throw "No package.json here. Run this from the cartandkeep repository root."
}

$pkg = Get-Content .\package.json -Raw | ConvertFrom-Json
if ($pkg.name -ne 'cartandkeep') {
  throw "package.json name is '$($pkg.name)'. Run this from the cartandkeep repository root."
}

$out  = "ck-messaging-topup"
$root = Join-Path $env:TEMP $out
if (Test-Path $root) { Remove-Item $root -Recurse -Force }
New-Item -ItemType Directory -Path $root | Out-Null

# Exact paths. A guessed path comes back as a missing file rather than as a
# typo, which is a round trip spent on my mistake.
$files = @(
  # The only fully open public write path already deployed. Its spam and
  # validation guard is what the messaging function should copy rather than
  # inventing a second one.
  "supabase\functions\request\index.ts",

  # The customer side of that same form. An open box with an email field
  # exists, and the ask panel should read as its sibling rather than as a new
  # component with its own opinions.
  "src\pages\store\RequestPage.jsx",
  "src\styles\pages\store\request-page.module.css",

  # The closest precedent for a tokened page nobody can reach from the shop.
  "src\styles\pages\store\review-page.module.css",

  # Where the ask control goes, and what already sits under the buy block.
  "src\styles\pages\store\product-page.module.css",
  "src\components\ui\store\ProductTerms.jsx",

  # fetchOrder, because the order thread mounts inside the confirmation page
  # rather than on a page of its own.
  "src\lib\checkout.js",

  # How the portal calls notify with a signed in user's JWT, which the reply
  # path needs to do the same way.
  "src\hooks\useOrders.js"
)

# The store icon set is imported as '@components/ui/store/icons', which is
# either a file or a folder with an index. Globbed so it arrives either way.
$globs = @(
  "src\components\ui\store\icons*"
)

$missing = @()

function Copy-Named($rel) {
  $dest = Join-Path $root $rel
  $dir  = Split-Path $dest -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  Copy-Item $rel $dest -Force
}

foreach ($f in $files) {
  if (Test-Path $f) { Copy-Named $f } else { $missing += $f }
}

$globbed = @()
foreach ($g in $globs) {
  $hits = @(Get-ChildItem $g -Recurse -File -ErrorAction SilentlyContinue)
  if ($hits.Count -eq 0) { $missing += "$g  (nothing matched)"; continue }
  foreach ($h in $hits) {
    $rel = Resolve-Path $h.FullName -Relative
    $rel = $rel -replace '^\.\\', ''
    Copy-Named $rel
    $globbed += $rel
  }
}

$manifest = @()
$manifest += "Cart & Keep, messaging top up"
$manifest += (Get-Date -Format "yyyy-MM-dd HH:mm")
$manifest += ""
$manifest += "A top up to ck-messaging-context.zip, not a replacement. Read that"
$manifest += "one first: decisions-2026-08-20.md still wins any disagreement."
$manifest += ""
$manifest += "Everything here answers one of two questions: what an open public"
$manifest += "write path already does about spam and validation, and what the"
$manifest += "customer facing surfaces next to the new ones already look like."
$manifest += ""
$manifest += "Collected $($files.Count - ($missing | Where-Object { $_ -notlike '*nothing matched*' }).Count) of $($files.Count) named files."
$manifest += ""

if ($globbed.Count) {
  $manifest += "Matched by glob:"
  $globbed | ForEach-Object { $manifest += "  $_" }
  $manifest += ""
}

if ($missing.Count) {
  $manifest += "MISSING, tell Claude before it starts:"
  $missing | ForEach-Object { $manifest += "  $_" }
  $manifest += ""
}

$manifest += "NOT in here, and deliberately:"
$manifest += "  anything already in ck-messaging-context.zip"
$manifest += "  checkout and stripe-webhook, which messaging does not touch"
$manifest += "  the research pipeline and the status app"

$manifest | Out-File (Join-Path $root "MANIFEST.txt") -Encoding utf8

$zip = Join-Path (Get-Location) "$out.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive (Join-Path $root "*") $zip -Force
Remove-Item $root -Recurse -Force

"Wrote $zip"
if ($missing.Count) { "Missing $($missing.Count):"; $missing | ForEach-Object { "  $_" } }
