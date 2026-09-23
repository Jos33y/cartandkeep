param([string]$Out = "ck-shelf-context.zip")
$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
for ($i = 0; $i -lt 4 -and -not (Test-Path (Join-Path $root "package.json")); $i++) {
  $root = Split-Path $root -Parent
}
if (-not (Test-Path (Join-Path $root "package.json"))) { throw "package.json not found within four levels up." }

$paths = @(
  # The collectors
  "scripts/shelf-hb.js",
  "scripts/shelf.js",
  "scripts/shelf-queries.js",
  "scripts/shelf-product.js",
  "scripts/shelf-probe.js",
  "scripts/hb-find-api.js",
  "scripts/hb-probe.js",
  "scripts/cost-shelf.js",

  # What they produced, so the shape is read rather than guessed
  "scripts/shelf-hb.csv",
  "scripts/queries-hb-map.csv",
  "scripts/queries-hb-1.txt",
  "scripts/hb-api-candidates.txt"
)

$secret = '(\.env|token|secret|credential|\.pem|\.key)$'
$stage = Join-Path $env:TEMP ("ck-shelf-" + [guid]::NewGuid())
New-Item -ItemType Directory $stage | Out-Null
$missing = @(); $copied = 0

foreach ($p in $paths) {
  $src = Join-Path $root $p
  if ((Split-Path $p -Leaf) -match $secret) { $missing += "$p (withheld)"; continue }
  if (-not (Test-Path $src)) { $missing += $p; continue }
  $dst = Join-Path $stage $p
  New-Item -ItemType Directory (Split-Path $dst -Parent) -Force | Out-Null

  # The JSON drops run to megabytes, so only the head of each one travels.
  if ((Split-Path $p -Leaf) -match '\.(json)$') {
    Get-Content $src -TotalCount 200 | Set-Content $dst -Encoding UTF8
  } elseif ((Split-Path $p -Leaf) -match '\.(csv|txt)$') {
    Get-Content $src -TotalCount 60 | Set-Content $dst -Encoding UTF8
  } else {
    Copy-Item $src $dst
  }
  $copied++
}

# One head of each big drop, named so it is obvious they are samples.
foreach ($p in @("scripts/shelf-hb-full.json", "scripts/products-hb-1.json", "scripts/shelf-hb-costed.csv")) {
  $src = Join-Path $root $p
  if (-not (Test-Path $src)) { $missing += $p; continue }
  $dst = Join-Path $stage ($p -replace '\.(json|csv)$', '.sample$0')
  New-Item -ItemType Directory (Split-Path $dst -Parent) -Force | Out-Null
  Get-Content $src -TotalCount 120 | Set-Content $dst -Encoding UTF8
  $copied++
}

$manifest = @("Collected $copied", "", "Missing:") + ($missing | ForEach-Object { "  $_" })
$manifest | Set-Content (Join-Path $stage "MANIFEST.txt") -Encoding UTF8

$zip = Join-Path $root $Out
if (Test-Path $zip) { Remove-Item $zip }
Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zip
Remove-Item $stage -Recurse -Force

Write-Host "$copied collected, $($missing.Count) missing -> $zip"
if ($missing.Count) { $missing | ForEach-Object { Write-Host "  missing: $_" } }
