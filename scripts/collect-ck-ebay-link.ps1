$ErrorActionPreference = 'Stop'

$dir = (Get-Location).Path
for ($i = 0; $i -lt 4 -and -not (Test-Path (Join-Path $dir 'package.json')); $i++) {
  $dir = Split-Path $dir -Parent
}
if (-not (Test-Path (Join-Path $dir 'package.json'))) { throw 'Run this from inside the Cart & Keep repo.' }
Set-Location $dir

# The eBay link on cards: the Candidates and Approved cards, the Market tab, the "Same item and pack?" panel, and
# where entry, external_ref, recommended_channels and margin.cost_from are written (the gate, import-store, the
# card move). So the link and the side by side names are built on what the cards actually hold.
$srcPattern = 'Same item and pack|recommended_channels|cost_from|external_ref|item_id|same_product_|entry\?\.|\.entry\b|ebay\.co\.uk|ebayLink|ebay-link|Market(Tab|Chart|Panel)|[>''"]Market[<''"]'
$scriptPattern = 'addEbay|matchOf|same_product_|cost_from|external_ref'
$functionPattern = 'same_product_|item_id|\.entry\b|entry:|external_ref|matchOf|cost_from'
$migrationPattern = 'external_ref|recommended_channels|cost_from|same_product|pack_match|\bentry\b'

$stamp = Get-Date -Format 'yyyy-MM-dd-HHmm'
$name = "ck-ebay-link-$stamp"
$stage = Join-Path ([IO.Path]::GetTempPath()) $name
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory $stage | Out-Null

$secret = 'sk-ant-[A-Za-z0-9_-]{10,}|sk_(live|test)_|rk_(live|test)_|whsec_|service_role\s*[:=]\s*[''"]ey|-----BEGIN [A-Z ]*PRIVATE KEY-----|v\^1\.1#i\^1#'
$found = @(); $missing = @(); $withheld = @()

function Rel($p) { (Resolve-Path -Relative $p) -replace '^\.[\\/]', '' }

$files = @()

$code = @(
  'src/pages/portal/CandidatesPage.jsx',
  'src/pages/portal/ApprovedPage.jsx',
  'package.json',
  'vite.config.js',
  'vitest.config.js'
)
foreach ($c in $code) { if (Test-Path $c) { $files += $c } else { $missing += $c } }

# Portal files that show or read the card's eBay evidence, the market, or the pack check.
if (Test-Path 'src') {
  $files += Get-ChildItem 'src' -Recurse -File -Include *.js,*.jsx |
    Where-Object { Select-String -Path $_.FullName -Pattern $srcPattern -Quiet } |
    ForEach-Object { Rel $_.FullName }
}
# The gate and import-store: where entry and the pack match are written.
if (Test-Path 'scripts') {
  $files += Get-ChildItem 'scripts' -Recurse -File -Include *.js,*.mjs,*.ts |
    Where-Object { $_.FullName -notmatch '[\\/]node_modules[\\/]' } |
    Where-Object { Select-String -Path $_.FullName -Pattern $scriptPattern -Quiet } |
    ForEach-Object { Rel $_.FullName }
}
# Edge functions that write or move a card's eBay evidence (the card move included).
if (Test-Path 'supabase/functions') {
  $files += Get-ChildItem 'supabase/functions' -Recurse -File -Include *.ts |
    Where-Object { $_.FullName -notmatch '[\\/]node_modules[\\/]' } |
    Where-Object { Select-String -Path $_.FullName -Pattern $functionPattern -Quiet } |
    ForEach-Object { Rel $_.FullName }
}
# The columns: their types decide how the read-only counts are written.
if (Test-Path 'supabase/migrations') {
  $files += Get-ChildItem 'supabase/migrations' -Filter *.sql -File |
    Where-Object { Select-String -Path $_.FullName -Pattern $migrationPattern -Quiet } |
    ForEach-Object { Rel $_.FullName }
} else { $missing += 'supabase/migrations' }

$files = @($files | ForEach-Object { $_ -replace '\\', '/' } | Sort-Object -Unique)

# The stylesheets and tests that belong to the portal files collected, plus the shared tokens.
$extra = @()
foreach ($f in ($files | Where-Object { $_ -match '^src/.*\.jsx?$' })) {
  $parent = Split-Path $f -Parent
  foreach ($mt in (Select-String -Path $f -Pattern '[''"]([^''"]+\.css)[''"]' -AllMatches)) {
    foreach ($g in $mt.Matches) {
      $ref = $g.Groups[1].Value
      if ($ref -like '@/*') { $abs = Join-Path $dir ('src/' + $ref.Substring(2)) }
      elseif ($ref -like '.*') { $abs = Join-Path $dir (Join-Path $parent $ref) }
      else { continue }
      $abs = [IO.Path]::GetFullPath($abs)
      if (Test-Path $abs) { $extra += $abs.Substring($dir.Length + 1) } else { $missing += "$ref (from $f)" }
    }
  }
  $base = $f -replace '\.jsx?$', ''
  foreach ($t in @("$base.test.js", "$base.test.jsx")) { if (Test-Path $t) { $extra += $t } }
}
if (Test-Path 'src/styles') {
  $extra += Get-ChildItem 'src/styles' -File -Filter *.css | ForEach-Object { Rel $_.FullName }
}
$files = @(($files + $extra) | ForEach-Object { $_ -replace '\\', '/' } | Sort-Object -Unique)

foreach ($f in $files) {
  if (Select-String -Path $f -Pattern $secret -Quiet) { $withheld += $f; continue }
  $dest = Join-Path $stage $f
  New-Item -ItemType Directory (Split-Path $dest -Parent) -Force | Out-Null
  Copy-Item $f $dest
  $found += $f
}

$m = @()
$m += "Cart & Keep, eBay link collector, $stamp"
$m += ''
$m += "Collected ($($found.Count))"; $m += $found | ForEach-Object { "  $_" }
$m += ''
$m += "Missing ($($missing.Count))"; $m += $missing | ForEach-Object { "  $_" }
$m += ''
$m += "Withheld, secret pattern ($($withheld.Count))"; $m += $withheld | ForEach-Object { "  $_" }
$m += ''
$m += 'Functions in the repo'
Get-ChildItem 'supabase/functions' -Directory -ErrorAction SilentlyContinue | ForEach-Object { $m += "  $($_.Name)" }
$m += ''
$m += 'Portal libs in the repo'
Get-ChildItem 'src/lib' -File -ErrorAction SilentlyContinue | ForEach-Object { $m += "  $($_.Name)" }
$m += ''
$m | Set-Content (Join-Path $stage 'MANIFEST.txt') -Encoding UTF8

$zip = Join-Path $dir "$name.zip"
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -Force
Remove-Item $stage -Recurse -Force
Write-Host "Done: $zip"
Write-Host "Collected $($found.Count), missing $($missing.Count), withheld $($withheld.Count)"
