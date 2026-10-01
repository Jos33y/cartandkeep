$ErrorActionPreference = 'Stop'

$dir = (Get-Location).Path
for ($i = 0; $i -lt 4 -and -not (Test-Path (Join-Path $dir 'package.json')); $i++) {
  $dir = Split-Path $dir -Parent
}
if (-not (Test-Path (Join-Path $dir 'package.json'))) { throw 'Run this from inside the Cart & Keep repo.' }
Set-Location $dir

# The portal as it builds: all of src, the root configs and the lockfile. So the eBay link change is built, tested
# and looked at in the browser on the real code, at every size, before it is delivered. No .env, no public folder.
$stamp = Get-Date -Format 'yyyy-MM-dd-HHmm'
$name = "ck-build-$stamp"
$stage = Join-Path ([IO.Path]::GetTempPath()) $name
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory $stage | Out-Null

$secret = 'sk-ant-[A-Za-z0-9_-]{10,}|sk_(live|test)_|rk_(live|test)_|whsec_|service_role\s*[:=]\s*[''"]ey|-----BEGIN [A-Z ]*PRIVATE KEY-----|v\^1\.1#i\^1#'
$text = '\.(js|jsx|mjs|cjs|ts|tsx|json|css|html|md|txt|svg|yml|yaml)$'
$maxBytes = 5MB
$found = @(); $missing = @(); $withheld = @(); $tooBig = @()

function Rel($p) { ((Resolve-Path -Relative $p) -replace '^\.[\\/]', '') -replace '\\', '/' }

$files = @()
foreach ($c in @('package.json', 'package-lock.json', 'index.html')) {
  if (Test-Path $c) { $files += $c } else { $missing += $c }
}
# Root configs: vite, eslint, postcss, jsconfig and the like. Never .env or .npmrc.
$files += Get-ChildItem -File -Force |
  Where-Object { $_.Name -match '(\.config\.(js|mjs|cjs|ts)|^jsconfig\.json|^tsconfig.*\.json|^\.eslintrc.*|^\.prettierrc.*|^\.browserslistrc)$' } |
  ForEach-Object { Rel $_.FullName }
if (Test-Path 'src') {
  $files += Get-ChildItem 'src' -Recurse -File -Force | ForEach-Object { Rel $_.FullName }
} else { $missing += 'src' }
$files = @($files | Sort-Object -Unique)

foreach ($f in $files) {
  $leaf = Split-Path $f -Leaf
  if ($leaf -match '^\.env' -or $leaf -eq '.npmrc') { $withheld += "$f (never collected)"; continue }
  if ((Get-Item $f).Length -gt $maxBytes) { $tooBig += $f; continue }
  if ($f -match $text -and (Select-String -Path $f -Pattern $secret -Quiet)) { $withheld += $f; continue }
  $dest = Join-Path $stage $f
  New-Item -ItemType Directory (Split-Path $dest -Parent) -Force | Out-Null
  Copy-Item $f $dest
  $found += $f
}

$m = @()
$m += "Cart & Keep, build collector, $stamp"
$m += ''
$m += "Node $(try { (node -v) } catch { 'not found' }), npm $(try { (npm -v) } catch { 'not found' })"
$m += ''
$m += "Collected ($($found.Count))"; $m += $found | ForEach-Object { "  $_" }
$m += ''
$m += "Missing ($($missing.Count))"; $m += $missing | ForEach-Object { "  $_" }
$m += ''
$m += "Over 5MB, left out ($($tooBig.Count))"; $m += $tooBig | ForEach-Object { "  $_" }
$m += ''
$m += "Withheld, secret pattern or env ($($withheld.Count))"; $m += $withheld | ForEach-Object { "  $_" }
$m += ''
$m | Set-Content (Join-Path $stage 'MANIFEST.txt') -Encoding UTF8

$zip = Join-Path $dir "$name.zip"
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -Force
Remove-Item $stage -Recurse -Force
Write-Host "Done: $zip"
Write-Host "Collected $($found.Count), missing $($missing.Count), over 5MB $($tooBig.Count), withheld $($withheld.Count)"
