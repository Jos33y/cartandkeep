# Cart & Keep, the checkout half.
#
# The last connecting piece of item 7. The checkout prices from the offer
# record rather than the basket, and the webhook is what spends it, because an
# abandoned checkout must not burn a price she gave somebody.
#
# Narrow on purpose. Everything else is already in the chat.
#
# Run from the repository root.

$ErrorActionPreference = 'Stop'

if (-not (Test-Path .\package.json)) {
  throw "No package.json here. Run this from the cartandkeep repository root."
}

$pkg = Get-Content .\package.json -Raw | ConvertFrom-Json
if ($pkg.name -ne 'cartandkeep') {
  throw "package.json name is '$($pkg.name)'. Run this from the cartandkeep repository root."
}

$out  = "ck-checkout"
$root = Join-Path $env:TEMP $out
if (Test-Path $root) { Remove-Item $root -Recurse -Force }
New-Item -ItemType Directory -Path $root | Out-Null

$files = @(
  # Builds the order. Has to take an offer id and a thread token, price from
  # the offer's own lines, refuse one that is expired, withdrawn or already
  # used, and set orders.from_thread_id.
  "supabase\functions\checkout\index.ts",

  # Where an offer is actually spent. The order becomes paid here, and this is
  # the only place that should write accepted, order_id and accepted_at.
  "supabase\functions\stripe-webhook\index.ts",

  # The page. It has to render the offer's lines rather than the basket, show
  # the quoted total, and not let either be edited on the way through.
  "src\pages\store\CheckoutPage.jsx",
  "src\styles\pages\store\checkout-page.module.css"
)

# Whatever the checkout page is built from. Globbed rather than named, because
# a guessed filename comes back as a missing file rather than as my typo.
$globs = @(
  "src\components\ui\store\Checkout*",
  "src\styles\ui\store\checkout*"
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
  foreach ($h in $hits) {
    $rel = (Resolve-Path $h.FullName -Relative) -replace '^\.\\', ''
    Copy-Named $rel
    $globbed += $rel
  }
}

$manifest = @()
$manifest += "Cart & Keep, the checkout half"
$manifest += (Get-Date -Format "yyyy-MM-dd HH:mm")
$manifest += ""
$manifest += "For the last piece of item 7. The offer is spent on payment, not"
$manifest += "on starting a checkout, so the webhook is in here as well."
$manifest += ""
$manifest += "0067 to 0071 have all run. lib/checkout.js is already in the chat."
$manifest += ""

if ($globbed.Count) {
  $manifest += "Matched by glob:"
  $globbed | ForEach-Object { $manifest += "  $_" }
  $manifest += ""
}

if ($missing.Count) {
  $manifest += "MISSING, say so before Claude starts:"
  $missing | ForEach-Object { $manifest += "  $_" }
}

$manifest | Out-File (Join-Path $root "MANIFEST.txt") -Encoding utf8

$zip = Join-Path (Get-Location) "$out.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive (Join-Path $root "*") $zip -Force
Remove-Item $root -Recurse -Force

"Wrote $zip"
if ($missing.Count) { "Missing $($missing.Count):"; $missing | ForEach-Object { "  $_" } }
