$ErrorActionPreference = 'Stop'

$root = (Get-Location).Path
for ($i = 0; $i -lt 4 -and -not (Test-Path (Join-Path $root 'package.json')); $i++) {
  $root = Split-Path $root -Parent
}
if (-not (Test-Path (Join-Path $root 'package.json'))) { throw "package.json not found within four levels of $(Get-Location)" }

$named = @(
  'src/pages/portal/InterestPage.jsx',
  'src/styles/pages/portal/interest-page.module.css',
  'src/hooks/useInterest.js',
  'src/pages/portal/BeingFoundPage.jsx',
  'src/styles/pages/portal/being-found-page.module.css',
  'src/hooks/useFindability.js',
  'supabase/migrations/0039_store_events.sql',
  'supabase/migrations/0045_funnel_purchases.sql',
  'supabase/migrations/0050_interest.sql',
  'supabase/migrations/0051_seo_reports.sql',
  'supabase/migrations/0053_traffic_sources.sql'
)

$secret = '(^|[\\/])\.env|\.cj-token|secret|\.pem$|\.key$'
$stamp = Get-Date -Format 'yyyyMMdd-HHmm'
$stage = Join-Path $env:TEMP "ck-collect-$stamp"
New-Item -ItemType Directory -Path $stage -Force | Out-Null

$collected = New-Object System.Collections.Generic.List[string]
$missing = New-Object System.Collections.Generic.List[string]
$withheld = New-Object System.Collections.Generic.List[string]

function Add-File([string]$rel) {
  if ($rel -match $secret) { $withheld.Add($rel); return }
  if ($collected | Where-Object { $_.StartsWith("$rel  ") }) { return }
  $src = Join-Path $root $rel
  if (-not (Test-Path $src -PathType Leaf)) { $missing.Add($rel); return }
  $dst = Join-Path $stage $rel
  New-Item -ItemType Directory -Path (Split-Path $dst -Parent) -Force | Out-Null
  Copy-Item $src $dst
  $kb = [math]::Round((Get-Item $src).Length / 1KB, 1)
  $collected.Add("$rel  ($kb KB)")
}

foreach ($rel in $named) { Add-File $rel }

$manifest = @(
  "Cart & Keep collector, orders, $stamp",
  "Root: $root",
  '',
  "COLLECTED ($($collected.Count))"
) + $collected + @('', "MISSING ($($missing.Count))") + $missing +
  @('', "WITHHELD ($($withheld.Count))") + $withheld

$manifest | Set-Content -Path (Join-Path $stage 'MANIFEST.txt') -Encoding UTF8

$zip = Join-Path ([Environment]::GetFolderPath('UserProfile')) "Downloads\ck-collect-interest-$stamp.zip"
if (Test-Path $zip) { Remove-Item $zip }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip
Remove-Item $stage -Recurse -Force

Write-Host "Collected $($collected.Count), missing $($missing.Count), withheld $($withheld.Count)"
if ($missing.Count) { $missing | ForEach-Object { Write-Host "  missing: $_" -ForegroundColor Yellow } }
Write-Host "Zip: $zip"
