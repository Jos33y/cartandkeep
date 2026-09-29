$ErrorActionPreference = 'Stop'

$dir = (Get-Location).Path
for ($i = 0; $i -lt 4 -and -not (Test-Path (Join-Path $dir 'package.json')); $i++) {
  $dir = Split-Path $dir -Parent
}
if (-not (Test-Path (Join-Path $dir 'package.json'))) { throw 'Run this from inside the Cart & Keep repo.' }
Set-Location $dir

$files = @(
  'src/pages/portal/CoveragePage.jsx',
  'src/styles/pages/portal/coverage-page.module.css',
  'src/components/ui/portal/CoverageFlow.jsx',
  'src/styles/ui/portal/coverage-flow.module.css',
  'src/hooks/useQueryCoverage.js',
  'supabase/migrations/0001_platform.sql',
  'supabase/migrations/0017_research_coverage.sql',
  'supabase/migrations/0029_batch_retirement.sql',
  'supabase/migrations/0032_batch_category.sql',
  'supabase/migrations/0083_research_queries.sql',
  'supabase/migrations/0085_research_query_reasons.sql',
  'supabase/migrations/0086_research_query_goods.sql',
  'supabase/migrations/0094_batches_per_term.sql',
  'scripts/lib/persist.js'
)

$stamp = Get-Date -Format 'yyyy-MM-dd-HHmm'
$name = "ck-coverage-$stamp"
$stage = Join-Path $env:TEMP $name
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory $stage | Out-Null

$secret = 'sk_(live|test)_|rk_(live|test)_|whsec_|service_role\s*[:=]\s*[''"]ey'
$found = @(); $missing = @(); $withheld = @()

foreach ($f in $files) {
  if (-not (Test-Path $f -PathType Leaf)) { $missing += $f; continue }
  if (Select-String -Path $f -Pattern $secret -Quiet) { $withheld += $f; continue }
  $dest = Join-Path $stage $f
  New-Item -ItemType Directory (Split-Path $dest -Parent) -Force | Out-Null
  Copy-Item $f $dest
  $found += $f
}

$m = @()
$m += "Cart & Keep, coverage collector, $stamp"
$m += ''
$m += "Collected ($($found.Count))"; $m += $found | ForEach-Object { "  $_" }
$m += ''
$m += "Missing ($($missing.Count))"; $m += $missing | ForEach-Object { "  $_" }
$m += ''
$m += "Withheld, secret pattern ($($withheld.Count))"; $m += $withheld | ForEach-Object { "  $_" }
$m += ''
$m += 'Files that mention research_queries'
Get-ChildItem scripts, supabase/migrations -Recurse -Include *.js, *.mjs, *.sql -File |
  Where-Object { $_.FullName -notmatch '\\archive\\|\\node_modules\\' } |
  Select-String -Pattern 'research_queries' -List | ForEach-Object { $m += "  $(Resolve-Path -Relative $_.Path)" }
$m += ''
$m | Set-Content (Join-Path $stage 'MANIFEST.txt') -Encoding UTF8

$zip = Join-Path $dir "$name.zip"
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -Force
Remove-Item $stage -Recurse -Force
Write-Host "Done: $zip"
Write-Host "Collected $($found.Count), missing $($missing.Count), withheld $($withheld.Count)"
