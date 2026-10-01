$ErrorActionPreference = 'Stop'

$dir = (Get-Location).Path
for ($i = 0; $i -lt 4 -and -not (Test-Path (Join-Path $dir 'package.json')); $i++) {
  $dir = Split-Path $dir -Parent
}
if (-not (Test-Path (Join-Path $dir 'package.json'))) { throw 'Run this from inside the Cart & Keep repo.' }
Set-Location $dir

# How eBay sales reach the portal: the traffic and sales pulls, the export import, the tables and views they write,
# and the pages that count them, so the sold figures are fixed from what the code actually does.
$migrationPattern = 'channel_sales|store_channel_profit|ebay_traffic|sale_costs|ebay_orders|sales_import'

$stamp = Get-Date -Format 'yyyy-MM-dd-HHmm'
$name = "ck-sales-$stamp"
$stage = Join-Path ([IO.Path]::GetTempPath()) $name
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory $stage | Out-Null

$secret = 'sk-ant-[A-Za-z0-9_-]{10,}|sk_(live|test)_|rk_(live|test)_|whsec_|service_role\s*[:=]\s*[''"]ey|-----BEGIN [A-Z ]*PRIVATE KEY-----|v\^1\.1#i\^1#'
$found = @(); $missing = @(); $withheld = @()

$files = @()
if (Test-Path 'supabase/migrations') {
  $files += Get-ChildItem 'supabase/migrations' -Filter *.sql -File |
    Where-Object { Select-String -Path $_.FullName -Pattern $migrationPattern -Quiet } |
    ForEach-Object { (Resolve-Path -Relative $_.FullName) -replace '^\.[\\/]', '' }
} else { $missing += 'supabase/migrations' }

# Every edge function that reads eBay orders, traffic or sales, whatever its name.
if (Test-Path 'supabase/functions') {
  $files += Get-ChildItem 'supabase/functions' -Recurse -File -Include *.ts |
    Where-Object { $_.FullName -notmatch '[\\/]node_modules[\\/]' } |
    Where-Object { Select-String -Path $_.FullName -Pattern 'channel_sales|ebay_traffic|sell/fulfillment|sell/analytics|getOrders|traffic_report' -Quiet } |
    ForEach-Object { (Resolve-Path -Relative $_.FullName) -replace '^\.[\\/]', '' }
}

$code = @(
  'src/hooks/useChannelSales.js',
  'src/hooks/useFinance.js',
  'src/hooks/useListings.js',
  'src/hooks/useOverview.js',
  'src/hooks/useShopDashboard.js',
  'src/pages/portal/FinancePage.jsx',
  'src/pages/portal/OverviewPage.jsx',
  'src/pages/portal/EbayTrafficPage.jsx'
)
foreach ($c in $code) { if (Test-Path $c) { $files += $c } else { $missing += $c } }
# Any portal file that imports eBay sales from an export.
$files += Get-ChildItem 'src' -Recurse -File -Include *.js,*.jsx |
  Where-Object { Select-String -Path $_.FullName -Pattern 'channel_sales|ebay-sales|sales export|Orders report' -Quiet } |
  ForEach-Object { (Resolve-Path -Relative $_.FullName) -replace '^\.[\\/]', '' }
$files = $files | ForEach-Object { $_ -replace '\\', '/' } | Sort-Object -Unique

foreach ($f in $files) {
  if (Select-String -Path $f -Pattern $secret -Quiet) { $withheld += $f; continue }
  $dest = Join-Path $stage $f
  New-Item -ItemType Directory (Split-Path $dest -Parent) -Force | Out-Null
  Copy-Item $f $dest
  $found += $f
}

$m = @()
$m += "Cart & Keep, sales collector, $stamp"
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
$m | Set-Content (Join-Path $stage 'MANIFEST.txt') -Encoding UTF8

$zip = Join-Path $dir "$name.zip"
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -Force
Remove-Item $stage -Recurse -Force
Write-Host "Done: $zip"
Write-Host "Collected $($found.Count), missing $($missing.Count), withheld $($withheld.Count)"
