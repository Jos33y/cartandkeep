param(
  [string]$Phrases = "scripts/queries-demand-az3.txt",
  [int]$Budget = 4500,
  [int]$Slice = 500,
  [int]$Start = 0,
  [string]$Band = "evri5",
  [string]$Tag = ""
)
$ErrorActionPreference = "Stop"

if (-not (Test-Path "package.json")) { throw "Run this from the repo root." }
if (-not (Test-Path $Phrases)) { throw "$Phrases not found. Mine the phrases first." }
if (-not $Tag) { $Tag = Get-Date -Format "MM-dd" }

$spent = 0
$at = $Start
$n = 0
$gated = 0

Write-Host ""
Write-Host "Budget $Budget calls, slices of $Slice, starting at $at"
Write-Host ""

while ($spent + $Slice -le $Budget) {
  $n++
  $scanCsv = "scan-$Tag-$n.csv"
  $queries = "scripts/queries-gated-$Tag-$n.txt"

  Write-Host "--- slice $n, phrases $at to $($at + $Slice)"
  node scripts/scan.js --file=$Phrases --csv=$scanCsv --out=$queries --start=$at --max=$Slice --band=$Band
  if ($LASTEXITCODE -ne 0) { throw "scan failed on slice $n" }
  $spent += $Slice
  $at += $Slice

  # The header line carries the count, so the gate's cost is known before it runs.
  $kept = (Get-Content $queries | Where-Object { $_ -and -not $_.StartsWith("#") }).Count
  $cost = $kept * 21
  if (-not $kept) { Write-Host "  nothing survived, next slice"; continue }

  if ($spent + $cost -gt $Budget) {
    Write-Host "  $kept phrases would cost $cost calls, over what is left. Gate them tomorrow:"
    Write-Host "    node scripts/gate.js --file=$queries --csv=gate-$Tag-$n.csv --band=$Band --show"
    break
  }

  Write-Host "--- gating $kept phrases, about $cost calls"
  node scripts/gate.js --file=$queries --csv="gate-$Tag-$n.csv" --band=$Band --show
  if ($LASTEXITCODE -ne 0) { throw "gate failed on slice $n" }
  $spent += $cost
  $gated += $kept
}

Write-Host ""
Write-Host "$spent calls spent, $gated phrases gated, next slice starts at $at"
Write-Host "Passes are in gate-$Tag-*.csv. Import the ones worth her seeing:"
Write-Host "  node scripts/import-gate.js --csv=gate-$Tag-1.csv --date=<monday> --term=<term> --label=<label> --dry"
Write-Host ""
