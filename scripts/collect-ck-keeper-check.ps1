$ErrorActionPreference = 'Stop'

$dir = (Get-Location).Path
for ($i = 0; $i -lt 4 -and -not (Test-Path (Join-Path $dir 'package.json')); $i++) {
  $dir = Split-Path $dir -Parent
}
if (-not (Test-Path (Join-Path $dir 'package.json'))) { throw 'Run this from inside the Cart & Keep repo.' }
Set-Location $dir

# Keeper task 01: the pieces the build plan names and the earlier zips did not hold. Claude's shared caller (for the
# cost of each check), the cron helpers and updated_at trigger, Keeper's dock and hook, the portal's routes, the Google
# feed (a new title must flow to it), and the shop's product page (for the product markup check).
$pattern = 'touch_updated_at|functions_base|scheduler_headers|keeper_jobs'

$stamp = Get-Date -Format 'yyyy-MM-dd-HHmm'
$name = "ck-keeper-check-$stamp"
$stage = Join-Path ([IO.Path]::GetTempPath()) $name
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory $stage | Out-Null

$secret = 'sk-ant-[A-Za-z0-9_-]{10,}|sk_(live|test)_|rk_(live|test)_|whsec_|service_role\s*[:=]\s*[''"]ey|-----BEGIN [A-Z ]*PRIVATE KEY-----|v\^1\.1#i\^1#'
$found = @(); $missing = @(); $withheld = @()

function Rel($p) { ((Resolve-Path -Relative $p) -replace '^\.[\\/]', '') -replace '\\', '/' }

$files = @()
if (Test-Path 'supabase/migrations') {
  $files += Get-ChildItem 'supabase/migrations' -Filter *.sql -File |
    Where-Object { Select-String -Path $_.FullName -Pattern $pattern -Quiet } |
    ForEach-Object { Rel $_.FullName }
} else { $missing += 'supabase/migrations' }
$fixed = @(
  'supabase/functions/_shared/claude.ts',
  'supabase/functions/_shared/product.ts',
  'supabase/functions/google-feed/index.ts',
  'supabase/functions/draft/index.ts',
  'src/components/ui/portal/KeeperDock.jsx',
  'src/hooks/useKeeper.js'
)
foreach ($c in $fixed) { if (Test-Path $c) { $files += $c } else { $missing += $c } }
# The portal's routes, and the shop's product page with whatever it puts in the page head.
if (Test-Path 'src') {
  $files += Get-ChildItem 'src' -Recurse -File -Include *.js,*.jsx |
    Where-Object { Select-String -Path $_.FullName -Pattern 'createBrowserRouter|<Route\b|path:\s*[''"]/|application/ld\+json|ProductPage' -Quiet } |
    ForEach-Object { Rel $_.FullName }
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
$m += "Cart & Keep, Keeper check collector, $stamp"
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
