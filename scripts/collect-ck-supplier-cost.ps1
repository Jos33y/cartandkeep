# Collects what decides a supplier's cost and the Amazon daily read, plus the writer (draft) function.
# Run from the repo root:  powershell -ExecutionPolicy Bypass -File scripts\collect-ck-supplier-cost.ps1
# Writes ck-collect-supplier-cost-<date>.zip in the repo root. Secrets are never collected: no .env files, no keys.

$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path
$stamp = Get-Date -Format 'yyyy-MM-dd'
$name = "ck-collect-supplier-cost-$stamp"
$out = Join-Path $env:TEMP $name
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Path $out | Out-Null

$files = @(
  'supabase/functions/_shared/amazon.ts',
  'supabase/functions/supplier-read/index.ts',
  'supabase/migrations/0118_supplier_checks.sql',
  'src/lib/supplierWatch.js',
  'src/components/ui/portal/SupplierWatch.jsx',
  'src/hooks/useSupplierWatch.js',
  'src/pages/portal/ApprovedPage.jsx',
  'src/hooks/useApproved.js',
  'src/components/ui/portal/SourceList.jsx',
  'src/components/ui/portal/CostTry.jsx',
  'src/lib/pricing.js'
)

# Every migration and shared function that writes or reads supplier_read or a source's unit cost.
$files += Get-ChildItem -Path 'supabase/migrations', 'supabase/functions/_shared' -File -Recurse -ErrorAction SilentlyContinue |
  Where-Object { $_.Extension -in '.sql', '.ts' } |
  Where-Object { Select-String -Path $_.FullName -Pattern 'supplier_read|supplier_checks|landed_unit_cost' -Quiet } |
  ForEach-Object { $_.FullName.Substring($root.Length + 1).Replace('\', '/') }

# The writer: the draft function and the shared files it imports.
$files += Get-ChildItem -Path 'supabase/functions/draft' -File -Recurse -ErrorAction SilentlyContinue |
  ForEach-Object { $_.FullName.Substring($root.Length + 1).Replace('\', '/') }
$files += Get-ChildItem -Path 'supabase/functions/_shared' -File -Recurse |
  Where-Object { Select-String -Path $_.FullName -Pattern 'decide|flags' -Quiet } |
  ForEach-Object { $_.FullName.Substring($root.Length + 1).Replace('\', '/') }

$files = $files | Where-Object { $_ -notmatch '(^|/)\.env' } | Sort-Object -Unique
$manifest = @("$name", "Collected $(Get-Date -Format 'yyyy-MM-dd HH:mm') from $root", '')
foreach ($f in $files) {
  if (Test-Path $f) {
    $dest = Join-Path $out $f
    New-Item -ItemType Directory -Path (Split-Path $dest) -Force | Out-Null
    Copy-Item $f $dest
    $manifest += "ok       $f  ($((Get-Item $f).Length) bytes)"
  } else {
    $manifest += "MISSING  $f"
  }
}
$manifest | Set-Content -Path (Join-Path $out 'MANIFEST.txt') -Encoding utf8
$zip = Join-Path $root "$name.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $out '*') -DestinationPath $zip
Remove-Item $out -Recurse -Force
Write-Host "`n  $zip`n  $(($manifest | Where-Object { $_ -like 'ok*' }).Count) files, $(($manifest | Where-Object { $_ -like 'MISSING*' }).Count) missing (see MANIFEST.txt)`n"
