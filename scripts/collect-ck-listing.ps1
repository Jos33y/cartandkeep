$ErrorActionPreference = 'Stop'

$dir = (Get-Location).Path
for ($i = 0; $i -lt 4 -and -not (Test-Path (Join-Path $dir 'package.json')); $i++) {
  $dir = Split-Path $dir -Parent
}
if (-not (Test-Path (Join-Path $dir 'package.json'))) { throw 'Run this from inside the Cart & Keep repo.' }
Set-Location $dir

# The functions that list, read and write for eBay, and the code they share. Whole folders, whatever is inside.
$functionDirs = @(
  'supabase/functions/ebay-list',
  'supabase/functions/ebay-item',
  'supabase/functions/ebay-compose',
  'supabase/functions/_shared'
)

# A migration comes along when it touches the shop products, the candidate's eBay, draft or listing columns,
# the listing photos bucket, returns and hazard fields, or the eBay tokens.
$migrationPattern = 'store_products|store_product_margin|listing-images|ebay_tokens|ebay_accounts|alter table[^;]*candidates[^;]*(ebay|draft|listing)|hazard'

$stamp = Get-Date -Format 'yyyy-MM-dd-HHmm'
$name = "ck-listing-$stamp"
$stage = Join-Path $env:TEMP $name
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory $stage | Out-Null

$secret = 'sk_(live|test)_|rk_(live|test)_|whsec_|service_role\s*[:=]\s*[''"]ey|-----BEGIN [A-Z ]*PRIVATE KEY-----|v\^1\.1#i\^1#'
$found = @(); $missing = @(); $withheld = @()

$files = @()
foreach ($d in $functionDirs) {
  if (-not (Test-Path $d -PathType Container)) { $missing += $d; continue }
  $files += Get-ChildItem $d -Recurse -File |
    Where-Object { $_.Name -notmatch '^\.env' -and $_.FullName -notmatch '\\node_modules\\' } |
    ForEach-Object { Resolve-Path -Relative $_.FullName }
}
if (Test-Path 'supabase/migrations') {
  $files += Get-ChildItem 'supabase/migrations' -Filter *.sql -File |
    Where-Object { Select-String -Path $_.FullName -Pattern $migrationPattern -Quiet } |
    ForEach-Object { Resolve-Path -Relative $_.FullName }
} else { $missing += 'supabase/migrations' }

foreach ($f in $files) {
  $f = $f -replace '^\.\\', ''
  if (Select-String -Path $f -Pattern $secret -Quiet) { $withheld += $f; continue }
  $dest = Join-Path $stage $f
  New-Item -ItemType Directory (Split-Path $dest -Parent) -Force | Out-Null
  Copy-Item $f $dest
  $found += $f
}

$m = @()
$m += "Cart & Keep, listing collector, $stamp"
$m += ''
$m += "Collected ($($found.Count))"; $m += $found | ForEach-Object { "  $_" }
$m += ''
$m += "Missing ($($missing.Count))"; $m += $missing | ForEach-Object { "  $_" }
$m += ''
$m += "Withheld, secret pattern ($($withheld.Count))"; $m += $withheld | ForEach-Object { "  $_" }
$m += ''
$m += 'Edge functions present'
if (Test-Path 'supabase/functions') {
  Get-ChildItem 'supabase/functions' -Directory | ForEach-Object { $m += "  $($_.Name)" }
}
$m += ''
$m += 'Files that call ebay-list'
Get-ChildItem src, scripts, supabase -Recurse -Include *.js, *.jsx, *.mjs, *.ts -File |
  Where-Object { $_.FullName -notmatch '\\archive\\|\\node_modules\\' } |
  Select-String -Pattern "ebay-list" -List | ForEach-Object { $m += "  $(Resolve-Path -Relative $_.Path)" }
$m += ''
$m | Set-Content (Join-Path $stage 'MANIFEST.txt') -Encoding UTF8

$zip = Join-Path $dir "$name.zip"
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -Force
Remove-Item $stage -Recurse -Force
Write-Host "Done: $zip"
Write-Host "Collected $($found.Count), missing $($missing.Count), withheld $($withheld.Count)"
