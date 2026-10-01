$ErrorActionPreference = 'Stop'

$dir = (Get-Location).Path
for ($i = 0; $i -lt 4 -and -not (Test-Path (Join-Path $dir 'package.json')); $i++) {
  $dir = Split-Path $dir -Parent
}
if (-not (Test-Path (Join-Path $dir 'package.json'))) { throw 'Run this from inside the Cart & Keep repo.' }
Set-Location $dir

# What decides whether a shop product can go on sale: the migrations that touch its returns, hazard or live state,
# and the shop settings, so the defaults are built on what the database actually enforces.
$migrationPattern = 'returns_class|returns_note|hazard|store_products[^;]*status|release_guard|can_go_live|go_live|tenant_settings|store_settings|return_days|returns_window'

$stamp = Get-Date -Format 'yyyy-MM-dd-HHmm'
$name = "ck-shop-rules-$stamp"
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

# The screens and code that set returns and hazard today, whatever their exact names.
$code = @(
  'src/hooks/useCatalogue.js',
  'src/lib/readiness.js',
  'src/components/ui/portal/product/ProductSheet.jsx',
  'src/components/ui/portal/StoreSettings.jsx',
  'src/pages/portal/ProductsPage.jsx',
  'src/pages/portal/SettingsPage.jsx',
  'src/components/ui/store/ReturnWindow.jsx'
)
foreach ($c in $code) { if (Test-Path $c) { $files += $c } else { $missing += $c } }
$files = $files | Sort-Object -Unique

foreach ($f in $files) {
  if (Select-String -Path $f -Pattern $secret -Quiet) { $withheld += $f; continue }
  $dest = Join-Path $stage $f
  New-Item -ItemType Directory (Split-Path $dest -Parent) -Force | Out-Null
  Copy-Item $f $dest
  $found += $f
}

$m = @()
$m += "Cart & Keep, shop rules collector, $stamp"
$m += ''
$m += "Collected ($($found.Count))"; $m += $found | ForEach-Object { "  $_" }
$m += ''
$m += "Missing ($($missing.Count))"; $m += $missing | ForEach-Object { "  $_" }
$m += ''
$m += "Withheld, secret pattern ($($withheld.Count))"; $m += $withheld | ForEach-Object { "  $_" }
$m += ''
$m += 'Lines that decide going on sale'
Get-ChildItem 'supabase/migrations' -Filter *.sql -File -ErrorAction SilentlyContinue |
  Select-String -Pattern 'raise exception|check \(|returns_class|hazard' |
  Select-Object -First 80 |
  ForEach-Object { $m += "  $((Resolve-Path -Relative $_.Path) -replace '^\.[\\/]', ''):$($_.LineNumber)  $($_.Line.Trim())" }
$m += ''
$m | Set-Content (Join-Path $stage 'MANIFEST.txt') -Encoding UTF8

$zip = Join-Path $dir "$name.zip"
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -Force
Remove-Item $stage -Recurse -Force
Write-Host "Done: $zip"
Write-Host "Collected $($found.Count), missing $($missing.Count), withheld $($withheld.Count)"
