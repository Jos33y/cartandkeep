$ErrorActionPreference = 'Stop'

$root = (Get-Location).Path
for ($i = 0; $i -lt 4 -and -not (Test-Path (Join-Path $root 'package.json')); $i++) {
  $root = Split-Path $root -Parent
}
if (-not (Test-Path (Join-Path $root 'package.json'))) { throw "package.json not found within four levels of $(Get-Location)" }

$named = @(
  'package.json',
  'scripts/README.md',

  # 1. pack sizes
  'research/shelf/shelf-hb.csv',
  'research/shelf/shelf-hb-costed.csv',
  'research/gates/gate-hb-1.csv',
  'research/gates/gate-hb-2.csv',
  'research/gates/gate-hb-evri5-1.csv',
  'research/gates/gate-dentastix.csv',
  'research/one-offs/q-dentastix.txt',
  'scripts/lib/snapshot.js',
  'scripts/lib/row.js',
  'scripts/lib/listing.js',

  # 2. gating the pool
  'research/queries/queries-evri5-pool.txt',
  'scripts/gate.js',
  'scripts/scan.js',
  'scripts/limits.js',
  'scripts/lib/ebay.js',
  'scripts/lib/verdict.js',
  'scripts/lib/refusals.js',
  'scripts/lib/cost.js',
  'scripts/lib/market.js',
  'tools/run-research.ps1',
  'tools/scan-all.ps1',

  # 3. The Range and QD Stores
  'scripts/shelf-hb.js',
  'scripts/shelf-queries.js',
  'scripts/lib/shops.js',
  'scripts/lib/sources.js',
  'research/probes/hb-api-candidates.txt',
  'research/probes/hb-net-probe.json',
  'tools/collectors/collect-ck-shelf.ps1'
)

$globs = @('scripts/probes/*.js')

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

# Snapshots since the HB runs only; older ones are Terapeak and mining era.
$gateDir = Join-Path $root '.gate'
if (Test-Path $gateDir) {
  $snaps = Get-ChildItem -Path $gateDir -Filter '*.json' -File -Force |
    Where-Object { $_.LastWriteTime -ge [datetime]'2026-09-21' }
  if (-not $snaps) { $missing.Add('.gate/*.json  (none since 21 Sep)') }
  foreach ($s in $snaps) { Add-File (".gate/" + $s.Name) }
  $all = Get-ChildItem -Path $gateDir -File -Force
  $listing = $all | Sort-Object LastWriteTime | ForEach-Object { '{0}  {1:yyyy-MM-dd HH:mm}  {2} KB' -f $_.Name, $_.LastWriteTime, [math]::Round($_.Length / 1KB, 1) }
} else {
  $missing.Add('.gate/  (folder not found)')
  $listing = @('(no .gate folder)')
}

$manifest = @(
  "Cart & Keep collector, $stamp",
  "Root: $root",
  '',
  "COLLECTED ($($collected.Count))"
) + $collected + @('', "MISSING ($($missing.Count))") + $missing +
  @('', "WITHHELD ($($withheld.Count))") + $withheld +
  @('', 'ALL FILES IN .gate') + $listing

$manifest | Set-Content -Path (Join-Path $stage 'MANIFEST.txt') -Encoding UTF8

$zip = Join-Path ([Environment]::GetFolderPath('UserProfile')) "Downloads\ck-collect-$stamp.zip"
if (Test-Path $zip) { Remove-Item $zip }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip
Remove-Item $stage -Recurse -Force

Write-Host "Collected $($collected.Count), missing $($missing.Count), withheld $($withheld.Count)"
if ($missing.Count) { $missing | ForEach-Object { Write-Host "  missing: $_" -ForegroundColor Yellow } }
Write-Host "Zip: $zip"
