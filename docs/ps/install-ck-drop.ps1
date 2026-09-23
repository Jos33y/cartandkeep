param(
  [Parameter(Mandatory = $true)][string]$Source,
  [switch]$DryRun
)
$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
for ($i = 0; $i -lt 4 -and -not (Test-Path (Join-Path $root "package.json")); $i++) {
  $root = Split-Path $root -Parent
}
if (-not (Test-Path (Join-Path $root "package.json"))) { throw "package.json not found within four levels up." }

# A zip is unpacked to a temp folder and treated the same as a folder drop.
$drop = $Source
$temp = $null
if ($Source -match '\.zip$') {
  $temp = Join-Path $env:TEMP ("ck-drop-" + [guid]::NewGuid())
  Expand-Archive -Path $Source -DestinationPath $temp
  $drop = $temp
}
if (-not (Test-Path $drop)) { throw "$Source not found." }

# Only the folders the studio ships into. Anything else in the drop is ignored.
$allowed = @("src", "scripts", "supabase", "docs")
$files = Get-ChildItem $drop -Recurse -File | Where-Object {
  $rel = $_.FullName.Substring($drop.Length).TrimStart("\", "/")
  $top = ($rel -split "[\\/]")[0]
  $allowed -contains $top
}

if (-not $files) { throw "Nothing to install. Expected one of: $($allowed -join ', ')" }

$stamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$backup = Join-Path $root ".ck-backup\$stamp"
$new = @(); $over = @()

foreach ($f in $files) {
  $rel = $f.FullName.Substring($drop.Length).TrimStart("\", "/")
  $dst = Join-Path $root $rel
  if (Test-Path $dst) {
    $over += $rel
    if (-not $DryRun) {
      $keep = Join-Path $backup $rel
      New-Item -ItemType Directory (Split-Path $keep -Parent) -Force | Out-Null
      Copy-Item $dst $keep
    }
  } else {
    $new += $rel
  }
  if (-not $DryRun) {
    New-Item -ItemType Directory (Split-Path $dst -Parent) -Force | Out-Null
    Copy-Item $f.FullName $dst -Force
  }
}

if ($temp) { Remove-Item $temp -Recurse -Force }

Write-Host ""
Write-Host "$($over.Count) overwritten, $($new.Count) new$(if ($DryRun) { '  (dry run, nothing written)' })"
$over | ForEach-Object { Write-Host "  overwrite  $_" }
$new  | ForEach-Object { Write-Host "  new        $_" }
if (-not $DryRun -and $over.Count) { Write-Host "`nPrevious versions: .ck-backup\$stamp" }
Write-Host ""
Write-Host "Check it with: git status"
