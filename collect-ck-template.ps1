# Collector template: copy, rename to collect-ck-<job>-YYYY-MM-DD.ps1, then edit the three marked parts (Out, seeds and globs, usage pattern).
# Run from the repo root: powershell -ExecutionPolicy Bypass -File <this file>
param([string]$Out = 'ck-JOB-YYYY-MM-DD.zip')  # EDIT 1: the zip name, never one a delivery zip uses
$ErrorActionPreference = 'Stop'

$root = (Get-Location).Path
if (-not (Test-Path -LiteralPath (Join-Path $root 'package.json'))) { throw 'Run from the repo root: package.json not found here.' }

# Longest alias first; '@' only ever matches '@/'.
$aliases = [ordered]@{
  '@components' = 'src/components'; '@context' = 'src/context'; '@styles' = 'src/styles'
  '@hooks' = 'src/hooks'; '@utils' = 'src/utils'; '@pages' = 'src/pages'; '@data' = 'src/data'
  '@app' = 'src/app'; '@pwa' = 'src/pwa'; '@lib' = 'src/lib'; '@' = 'src'
}
$exts = @('.jsx', '.js', '.mjs', '.ts', '.tsx', '.css')
$indexes = @('index.jsx', 'index.js', 'index.ts')
$parsable = '\.(jsx?|mjs|tsx?|css)$'

function Get-Rel([string]$full) { $full.Substring($root.Length).TrimStart('\', '/').Replace('\', '/') }

# EDIT 2: the files the job starts from; every import they reach is followed automatically.
$seeds = @(
  'package.json', 'vite.config.js', 'supabase/config.toml',
  'src/app/storeRouter.jsx', 'src/lib/supabase.js', 'src/lib/storeConfig.js', 'src/lib/tenant.js',
  'src/hooks/useStoreProducts.js', 'src/hooks/useSections.js', 'src/hooks/useCategoryNamesStore.js', 'src/hooks/useRecentlyViewed.js'
)

# Whole folders, by pattern: every store page, every migration, every edge function and the store scripts.
$globs = @(
  @{ Dir = 'src/pages/store'; Filter = '*.jsx' },
  @{ Dir = 'supabase/migrations'; Filter = '*.sql' },
  @{ Dir = 'supabase/functions'; Filter = 'index.ts' },
  @{ Dir = 'scripts/store'; Filter = '*.*' }
)
foreach ($g in $globs) {
  $d = Join-Path $root $g.Dir
  if (-not (Test-Path -LiteralPath $d)) { continue }
  Get-ChildItem -LiteralPath $d -Recurse -File -Filter $g.Filter | ForEach-Object { $seeds += (Get-Rel $_.FullName) }
}


function Resolve-Spec([string]$spec, [string]$fromRel) {
  $spec = ($spec -split '\?')[0]
  $base = $null
  foreach ($k in $aliases.Keys) {
    if ($spec.StartsWith("$k/")) { $base = $aliases[$k] + $spec.Substring($k.Length); break }
  }
  if (-not $base) {
    if (-not $spec.StartsWith('.')) { return $null }
    $base = (Split-Path $fromRel -Parent) + '/' + $spec
  }
  $full = [IO.Path]::GetFullPath((Join-Path $root $base))
  $tries = @($full) + ($exts | ForEach-Object { "$full$_" }) + ($indexes | ForEach-Object { Join-Path $full $_ })
  foreach ($t in $tries) { if (Test-Path -LiteralPath $t -PathType Leaf) { return (Get-Rel $t) } }
  return "MISSING:$((Get-Rel $full))"
}

$importRx = [regex]'(?:from|import)\s*(?:url)?\(?\s*[''"]([^''"]+)[''"]'
$secretRx = '^\.env(\..+)?$|^\.dev\.vars$'

$seen = @{}; $order = New-Object System.Collections.ArrayList
$missing = New-Object System.Collections.ArrayList
$queue = New-Object System.Collections.Queue

foreach ($s in $seeds) {
  if (Test-Path -LiteralPath (Join-Path $root $s) -PathType Leaf) { $queue.Enqueue($s) }
  elseif ($s -ne 'supabase/config.toml') { [void]$missing.Add("$s  (seed)") }
}

while ($queue.Count -gt 0) {
  $rel = $queue.Dequeue()
  if ($seen.ContainsKey($rel)) { continue }
  $seen[$rel] = $true; [void]$order.Add($rel)
  if ($rel -notmatch $parsable -or -not $rel.StartsWith('src/')) { continue }
  $text = [IO.File]::ReadAllText((Join-Path $root $rel))
  foreach ($m in $importRx.Matches($text)) {
    $r = Resolve-Spec $m.Groups[1].Value $rel
    if (-not $r) { continue }
    if ($r.StartsWith('MISSING:')) { [void]$missing.Add("$($r.Substring(8))  (imported by $rel)"); continue }
    if (-not $seen.ContainsKey($r)) { $queue.Enqueue($r) }
  }
}

# Tables, views and RPCs the collected code reads, then the migrations that define them.
$names = @{}; $functions = @{}
foreach ($rel in $order) {
  if ($rel -notmatch '\.(jsx?|mjs|tsx?)$') { continue }
  $text = [IO.File]::ReadAllText((Join-Path $root $rel))
  foreach ($m in [regex]::Matches($text, '\.(?:from|rpc)\(\s*[''"]([a-z_0-9]+)[''"]')) { $names[$m.Groups[1].Value] = $true }
  foreach ($m in [regex]::Matches($text, 'functions\.invoke\(\s*[''"]([a-z0-9_-]+)[''"]')) { $functions[$m.Groups[1].Value] = $true }
}

$sqlReport = New-Object System.Collections.ArrayList
$migDir = Join-Path $root 'supabase/migrations'
if (Test-Path -LiteralPath $migDir) {
  $migs = Get-ChildItem -LiteralPath $migDir -Filter '*.sql' | Sort-Object Name
  foreach ($n in ($names.Keys | Sort-Object)) {
    $rx = "(?i)create\s+(or\s+replace\s+)?(materialized\s+)?(view|table|function)\s+(if\s+not\s+exists\s+)?(public\.)?`"?$n`"?\b"
    $hits = @($migs | Where-Object { Select-String -LiteralPath $_.FullName -Pattern $rx -Quiet })
    if ($hits.Count -eq 0) { [void]$sqlReport.Add("$n  -> no defining migration found (bucket name, or defined outside migrations)") }
    foreach ($h in $hits) {
      $r = Get-Rel $h.FullName
      [void]$sqlReport.Add("$n  -> $r")
      if (-not $seen.ContainsKey($r)) { $seen[$r] = $true; [void]$order.Add($r) }
    }
  }
}
foreach ($f in ($functions.Keys | Sort-Object)) {
  $r = "supabase/functions/$f/index.ts"
  if (Test-Path -LiteralPath (Join-Path $root $r)) {
    [void]$sqlReport.Add("edge function $f  -> $r")
    if (-not $seen.ContainsKey($r)) { $seen[$r] = $true; [void]$order.Add($r) }
  } else { [void]$missing.Add("$r  (invoked from collected code)") }
}

# EDIT 3: the words that mark every other user of the shared parts, so a change is checked against all of them.
$usage = @()
foreach ($dir in @('src', 'supabase/functions', 'scripts')) {
  $p = Join-Path $root $dir
  if (-not (Test-Path -LiteralPath $p)) { continue }
  Get-ChildItem -LiteralPath $p -Recurse -File -Include *.js, *.jsx, *.mjs, *.ts |
    Where-Object { $_.FullName -notmatch '[\\/](node_modules|archive)[\\/]' } |
    Select-String -CaseSensitive -Pattern "store_products|store_variants|store_category_names|useStoreProducts|useSections\(" |
    ForEach-Object {
      $r = Get-Rel $_.Path
      $usage += "$($r):$($_.LineNumber)  $($_.Line.Trim())"
      if (-not $seen.ContainsKey($r) -and ((Get-Item -LiteralPath $_.Path).Length -lt 300kb)) { $seen[$r] = $true; [void]$order.Add($r) }
    }
}

$withheld = New-Object System.Collections.ArrayList
$final = New-Object System.Collections.ArrayList
foreach ($rel in $order) {
  if ((Split-Path $rel -Leaf) -match $secretRx) { [void]$withheld.Add($rel) } else { [void]$final.Add($rel) }
}

$manifest = @()
$manifest += "$([System.IO.Path]::GetFileNameWithoutExtension($Out))  $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
$manifest += ''
$manifest += "COLLECTED ($($final.Count))"; $manifest += $final
$manifest += ''; $manifest += "MISSING ($($missing.Count))"; $manifest += $missing
$manifest += ''; $manifest += "WITHHELD ($($withheld.Count))"; $manifest += $withheld
$manifest += ''; $manifest += 'DATA SOURCES'; $manifest += $sqlReport
$manifest += ''; $manifest += 'OTHER USERS OF THE SHARED PARTS'; $manifest += $usage

Add-Type -AssemblyName System.IO.Compression
$zipPath = Join-Path $root $Out
if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath }
$fs = [IO.File]::Open($zipPath, [IO.FileMode]::CreateNew)
$zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($rel in $final) {
    $bytes = [IO.File]::ReadAllBytes((Join-Path $root $rel))
    $w = $zip.CreateEntry($rel.Replace('\', '/')).Open()
    try { $w.Write($bytes, 0, $bytes.Length) } finally { $w.Dispose() }
  }
  $mb = [Text.Encoding]::UTF8.GetBytes(($manifest -join "`r`n"))
  $w = $zip.CreateEntry('MANIFEST.txt').Open()
  try { $w.Write($mb, 0, $mb.Length) } finally { $w.Dispose() }
} finally { $zip.Dispose(); $fs.Dispose() }

Write-Host "Wrote $Out : $($final.Count) files, $($missing.Count) missing, $($withheld.Count) withheld."
