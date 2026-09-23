param(
  [string]$Pattern = "scripts/queries-hb-*.txt",
  [int]$Budget = 4500,
  [switch]$Force
)
$ErrorActionPreference = "Stop"

if (-not (Test-Path "package.json")) { throw "Run this from the repo root." }

# The band is in the file name because the scan and the gate cost everything at
# it, and a slice run at the wrong band prices a sandpit as a parcel.
$slices = Get-ChildItem $Pattern |
  Where-Object { $_.Name -match '-(letter100|letter250|letter500|evri5|evri10|evri15|parcel|rmMedium)-(\d+)\.txt$' } |
  ForEach-Object {
    [pscustomobject]@{
      File  = "scripts/$($_.Name)"
      Band  = $Matches[1]
      N     = [int]$Matches[2]
      Lines = (Get-Content $_.FullName | Where-Object { $_ -and -not $_.StartsWith("#") }).Count
      Csv   = "scan-$($Matches[1])-$($Matches[2]).csv"
      Out   = "scripts/queries-gated-$($Matches[1])-$($Matches[2]).txt"
    }
  } | Sort-Object Band, N

if (-not $slices) { throw "No slices matched $Pattern. Draft them with shelf-queries.js first." }

# A slice that died partway through is not a slice that ran. The bulky band
# got 47 real rows and 244 errors when the call limit hit, and a rule that
# only skipped an entirely failed file counted that as done.
function Scanned ($csv) {
  if (-not (Test-Path $csv)) { return $false }
  $rows = Import-Csv $csv
  if (-not $rows) { return $false }
  $errors = @($rows | Where-Object { $_.outcome -eq 'error' }).Count
  return ($errors -le ($rows.Count * 0.25))
}

$todo = if ($Force) { $slices } else { $slices | Where-Object { -not (Scanned $_.Csv) } }
$done = $slices.Count - $todo.Count

Write-Host ""
Write-Host "$($slices.Count) slices, $done already scanned, $($todo.Count) to go"
Write-Host "Budget $Budget calls"
Write-Host ""

$spent = 0
$kept = 0

foreach ($s in $todo) {
  if ($spent + $s.Lines -gt $Budget) {
    Write-Host ""
    Write-Host "$($s.File) needs $($s.Lines) calls and $($Budget - $spent) are left. Stopping here."
    Write-Host "Run this again tomorrow and it carries on from this slice."
    break
  }

  Write-Host "--- $($s.File), $($s.Lines) phrases at $($s.Band)"
  node scripts/scan.js --file=$($s.File) --csv=$($s.Csv) --out=$($s.Out) --band=$($s.Band)
  if ($LASTEXITCODE -eq 2) {
    Write-Host ""
    Write-Host "eBay stopped answering. Run this again after the limit resets and it carries on."
    break
  }
  if ($LASTEXITCODE -ne 0) { throw "scan failed on $($s.File)" }

  $spent += $s.Lines
  $kept += (Get-Content $s.Out | Where-Object { $_ -and -not $_.StartsWith("#") }).Count
}

# One file per band, so the gate runs once per band rather than once per slice.
Write-Host ""
foreach ($band in ($slices.Band | Sort-Object -Unique)) {
  $parts = Get-ChildItem "scripts/queries-gated-$band-*.txt" -ErrorAction SilentlyContinue
  if (-not $parts) { continue }

  $lines = $parts | ForEach-Object { Get-Content $_.FullName } | Where-Object { $_ -and -not $_.StartsWith("#") }
  $unique = $lines | Select-Object -Unique
  $file = "scripts/queries-gated-$band-all.txt"
  $unique | Set-Content $file -Encoding utf8

  Write-Host "$file  $($unique.Count) phrases, about $($unique.Count * 21) calls to gate"
  Write-Host "  node scripts/gate.js --file=$file --csv=gate-$band.csv --band=$band --show"
}

Write-Host ""
Write-Host "$spent calls spent this run, $kept phrases kept."
Write-Host ""
