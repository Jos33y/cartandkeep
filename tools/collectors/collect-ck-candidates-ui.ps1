$ErrorActionPreference = 'Stop'

$root = (Get-Location).Path
for ($i = 0; $i -lt 4 -and -not (Test-Path (Join-Path $root 'package.json')); $i++) {
  $root = Split-Path $root -Parent
}
if (-not (Test-Path (Join-Path $root 'package.json'))) { throw "package.json not found within four levels of $(Get-Location)" }

$named = @(
  'package.json',

  # The Candidates page and what draws each card
  'src/pages/portal/CandidatesPage.jsx',
  'src/hooks/useCandidates.js',
  'src/lib/assess.js',
  'src/components/ui/portal/CandidateRow.jsx',
  'src/components/ui/portal/VerdictBar.jsx',
  'src/components/ui/portal/MarketBand.jsx',
  'src/components/ui/portal/MarketLine.jsx',
  'src/components/ui/portal/PriceScale.jsx',
  'src/components/ui/portal/SellerGauge.jsx',
  'src/components/ui/portal/SourceList.jsx',
  'src/components/ui/portal/Breakdown.jsx',
  'src/components/ui/portal/primitives.jsx',
  'src/utils/formatGbp.js',

  # Styles, only so the card keeps its tokens when edited
  'src/styles/pages/portal/candidates-page.module.css',
  'src/styles/ui/portal/candidate-row.module.css',
  'src/styles/ui/portal/verdict-bar.module.css',
  'src/styles/ui/portal/breakdown.module.css',
  'src/styles/ui/portal/primitives.module.css'
)

$globs = @()

$secret = '(^|[\\/])\.env|token|secret|\.pem$|\.key$'
$stamp = Get-Date -Format 'yyyyMMdd-HHmm'
$stage = Join-Path $env:TEMP "ck-collect-$stamp"
New-Item -ItemType Directory -Path $stage -Force | Out-Null

$collected = New-Object System.Collections.Generic.List[string]
$missing = New-Object System.Collections.Generic.List[string]
$withheld = New-Object System.Collections.Generic.List[string]

function Add-File([string]$rel) {
  if ($rel -match $secret) { $withheld.Add($rel); return }
  $src = Join-Path $root $rel
  if (-not (Test-Path $src -PathType Leaf)) { $missing.Add($rel); return }
  $dst = Join-Path $stage $rel
  New-Item -ItemType Directory -Path (Split-Path $dst -Parent) -Force | Out-Null
  Copy-Item $src $dst
  $kb = [math]::Round((Get-Item $src).Length / 1KB, 1)
  $collected.Add("$rel  ($kb KB)")
}

foreach ($rel in $named) { Add-File $rel }

foreach ($g in $globs) {
  $hits = Get-ChildItem -Path (Join-Path $root $g) -File -ErrorAction SilentlyContinue
  if (-not $hits) { $missing.Add("$g  (no match)"); continue }
  foreach ($h in $hits) { Add-File ($h.FullName.Substring($root.Length + 1) -replace '\\', '/') }
}

$listing = @('(not collected)')

$manifest = @(
  "Cart & Keep collector, $stamp",
  "Root: $root",
  '',
  "COLLECTED ($($collected.Count))"
) + $collected + @('', "MISSING ($($missing.Count))") + $missing +
  @('', "WITHHELD ($($withheld.Count))") + $withheld +
  @('', '.gate') + $listing

$manifest | Set-Content -Path (Join-Path $stage 'MANIFEST.txt') -Encoding UTF8

$zip = Join-Path ([Environment]::GetFolderPath('UserProfile')) "Downloads\ck-candidates-ui-$stamp.zip"
if (Test-Path $zip) { Remove-Item $zip }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip
Remove-Item $stage -Recurse -Force

Write-Host "Collected $($collected.Count), missing $($missing.Count), withheld $($withheld.Count)"
if ($missing.Count) { $missing | ForEach-Object { Write-Host "  missing: $_" -ForegroundColor Yellow } }
Write-Host "Zip: $zip"
