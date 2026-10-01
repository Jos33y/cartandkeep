$ErrorActionPreference = 'Stop'

$dir = (Get-Location).Path
for ($i = 0; $i -lt 4 -and -not (Test-Path (Join-Path $dir 'package.json')); $i++) {
  $dir = Split-Path $dir -Parent
}
if (-not (Test-Path (Join-Path $dir 'package.json'))) { throw 'Run this from inside the Cart & Keep repo.' }
Set-Location $dir

# The SQL behind What is live: the live_listings view, live_listing_counts, and every migration the view reads from
# (sales, refunds, traffic, shop products and events). So Sold, refunds and the tab and chip counts are read from
# the real definitions before the counts are changed.
$pattern = 'live_listings|live_listing_counts|channel_sales|refund|ebay_traffic|ebay_listings|store_products|store_events|store_channel_profit'

$stamp = Get-Date -Format 'yyyy-MM-dd-HHmm'
$name = "ck-live-sql-$stamp"
$stage = Join-Path ([IO.Path]::GetTempPath()) $name
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory $stage | Out-Null

$secret = 'sk-ant-[A-Za-z0-9_-]{10,}|sk_(live|test)_|rk_(live|test)_|whsec_|service_role\s*[:=]\s*[''"]ey|-----BEGIN [A-Z ]*PRIVATE KEY-----|v\^1\.1#i\^1#'
$found = @(); $missing = @(); $withheld = @()

$files = @()
if (Test-Path 'supabase/migrations') {
  $files += Get-ChildItem 'supabase/migrations' -Filter *.sql -File |
    Where-Object { Select-String -Path $_.FullName -Pattern $pattern -Quiet } |
    ForEach-Object { ((Resolve-Path -Relative $_.FullName) -replace '^\.[\\/]', '') -replace '\\', '/' }
} else { $missing += 'supabase/migrations' }
foreach ($c in @('supabase/migrations/0120_live_listings.sql', 'supabase/migrations/0121_live_listings_insight.sql', 'supabase/migrations/0122_listing_averages.sql')) {
  if (-not (Test-Path $c)) { $missing += $c }
}
$files = @($files | Sort-Object -Unique)

foreach ($f in $files) {
  if (Select-String -Path $f -Pattern $secret -Quiet) { $withheld += $f; continue }
  $dest = Join-Path $stage $f
  New-Item -ItemType Directory (Split-Path $dest -Parent) -Force | Out-Null
  Copy-Item $f $dest
  $found += $f
}

$m = @()
$m += "Cart & Keep, live listings SQL collector, $stamp"
$m += ''
$m += "Collected ($($found.Count))"; $m += $found | ForEach-Object { "  $_" }
$m += ''
$m += "Missing ($($missing.Count))"; $m += $missing | ForEach-Object { "  $_" }
$m += ''
$m += "Withheld, secret pattern ($($withheld.Count))"; $m += $withheld | ForEach-Object { "  $_" }
$m += ''
$m | Set-Content (Join-Path $stage 'MANIFEST.txt') -Encoding UTF8

$zip = Join-Path $dir "$name.zip"
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -Force
Remove-Item $stage -Recurse -Force
Write-Host "Done: $zip"
Write-Host "Collected $($found.Count), missing $($missing.Count), withheld $($withheld.Count)"
