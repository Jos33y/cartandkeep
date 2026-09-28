# Store pages' head tags, both feed functions, the existing SEO reporting, and the store_products schema.
# Run from the repo root: powershell -ExecutionPolicy Bypass -File collect-ck-seo-pages-2026-09-28.ps1
param([string]$Out = 'ck-collect-seo-pages-2026-09-28.zip')
$ErrorActionPreference = 'Stop'

$root = (Get-Location).Path
if (-not (Test-Path -LiteralPath (Join-Path $root 'package.json'))) { throw 'Run from the repo root: package.json not found here.' }

$files = @(
  'src/pages/store/HomePage.jsx', 'src/pages/store/CategoryPage.jsx', 'src/pages/store/AboutPage.jsx',
  'src/pages/store/ContactPage.jsx', 'src/pages/store/BlogPage.jsx', 'src/pages/store/BlogPostPage.jsx',
  'src/pages/store/LegalPage.jsx', 'src/pages/store/FaqPage.jsx', 'src/pages/store/RequestPage.jsx',
  'src/pages/store/SearchPage.jsx', 'src/pages/not-found/NotFoundPage.jsx',
  'src/app/StoreApp.jsx', 'src/app/App.jsx', 'src/main.jsx', 'src/utils/constants.js',
  'src/hooks/useStoreCatalogue.js', 'src/lib/storeCatalogue.js',
  'supabase/functions/feed/index.ts', 'supabase/functions/google-feed/index.ts',
  'supabase/migrations/0034_store_products.sql', 'supabase/migrations/0035_store_category.sql',
  'supabase/migrations/0036_store_product_detail.sql', 'supabase/migrations/0047_stock.sql',
  'supabase/migrations/0051_seo_reports.sql', 'supabase/migrations/0052_product_cost.sql',
  'supabase/migrations/0065_archive_and_stock.sql', 'supabase/migrations/0080_store_products_tenant_scope.sql',
  'supabase/migrations/0101_catalogue_browse.sql',
  'src/hooks/useFindability.js', 'src/pages/portal/BeingFoundPage.jsx',
  'public/llms.txt', 'public/robots.txt', '.gitignore', 'README.md', 'supabase/README.md'
)

$final = New-Object System.Collections.ArrayList
$missing = New-Object System.Collections.ArrayList
foreach ($f in $files) {
  if (Test-Path -LiteralPath (Join-Path $root $f) -PathType Leaf) { [void]$final.Add($f) } else { [void]$missing.Add($f) }
}

$checks = @()
$checks += "pipeline/lib/db.js exists: $(Test-Path -LiteralPath (Join-Path $root 'pipeline/lib/db.js'))"
$ignored = & git check-ignore .browser 2>$null
$checks += ".browser ignored by git: $([bool]$ignored)"

$manifest = @()
$manifest += "$([System.IO.Path]::GetFileNameWithoutExtension($Out))  $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
$manifest += ''; $manifest += 'CHECKS'; $manifest += $checks
$manifest += ''; $manifest += "COLLECTED ($($final.Count))"; $manifest += $final
$manifest += ''; $manifest += "MISSING ($($missing.Count))"; $manifest += $missing

Add-Type -AssemblyName System.IO.Compression
$zipPath = Join-Path $root $Out
if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath }
$fs = [IO.File]::Open($zipPath, [IO.FileMode]::CreateNew)
$zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($rel in $final) {
    $bytes = [IO.File]::ReadAllBytes((Join-Path $root $rel))
    $w = $zip.CreateEntry($rel).Open()
    try { $w.Write($bytes, 0, $bytes.Length) } finally { $w.Dispose() }
  }
  $mb = [Text.Encoding]::UTF8.GetBytes(($manifest -join "`r`n"))
  $w = $zip.CreateEntry('MANIFEST.txt').Open()
  try { $w.Write($mb, 0, $mb.Length) } finally { $w.Dispose() }
} finally { $zip.Dispose(); $fs.Dispose() }

Write-Host "Wrote $Out : $($final.Count) files, $($missing.Count) missing."
$checks | ForEach-Object { Write-Host "  $_" }
