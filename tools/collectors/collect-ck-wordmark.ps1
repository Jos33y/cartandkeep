# Cart & Keep, the wordmark and the order row.
#
# For the receipt. It carries the shop's own lockup rather than a rounded
# square with a C in it, and I have not seen the real one: the portal shell
# declares a local placeholder and the accessibility notes describe a sage
# ampersand that lives somewhere else.
#
# Globbed rather than named, because a guessed path comes back as a missing
# file rather than as my typo.
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

$out  = "ck-wordmark"
$root = Join-Path $env:TEMP $out
if (Test-Path $root) { Remove-Item $root -Recurse -Force }
New-Item -ItemType Directory -Path $root | Out-Null

# The portal row the packing slip is printed from. Named, because this one I
# have seen.
$files = @(
  "src\components\ui\portal\OrderRow.jsx",
  "src\styles\ui\portal\order-row.module.css"
)

$globs = @(
  # The lockup, wherever it lives.
  "src\components\**\*Wordmark*",
  "src\components\**\*Logo*",
  "src\components\**\*Brand*",
  # The storefront header, which draws it if nothing above does.
  "src\components\layout\store\*",
  "src\styles\layout\store\store-header*"
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
  foreach ($h in @(Get-ChildItem $g -Recurse -File -ErrorAction SilentlyContinue)) {
    $rel = (Resolve-Path $h.FullName -Relative) -replace '^\.\\', ''
    if ($globbed -contains $rel) { continue }
    Copy-Named $rel
    $globbed += $rel
  }
}

$manifest = @()
$manifest += "Cart & Keep, the wordmark and the order row"
$manifest += (Get-Date -Format "yyyy-MM-dd HH:mm")
$manifest += ""
$manifest += "For the receipt page and the packing slip printed from the portal."
$manifest += ""

if ($globbed.Count) {
  $manifest += "Matched by glob:"
  $globbed | ForEach-Object { $manifest += "  $_" }
  $manifest += ""
} else {
  $manifest += "NOTHING matched the wordmark globs. Say so, and say where the"
  $manifest += "header draws the lockup, and I will work from that instead."
  $manifest += ""
}

if ($missing.Count) {
  $manifest += "MISSING:"
  $missing | ForEach-Object { $manifest += "  $_" }
}

$manifest | Out-File (Join-Path $root "MANIFEST.txt") -Encoding utf8

$zip = Join-Path (Get-Location) "$out.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive (Join-Path $root "*") $zip -Force
Remove-Item $root -Recurse -Force

"Wrote $zip"
if ($missing.Count) { "Missing $($missing.Count):"; $missing | ForEach-Object { "  $_" } }
