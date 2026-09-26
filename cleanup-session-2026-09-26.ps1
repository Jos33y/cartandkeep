$ErrorActionPreference = 'Stop'

if (-not (Test-Path 'package.json')) { Write-Host "  [ABORT] No package.json. Run from the repo root." -ForegroundColor Red; exit 1 }
$pkg = Get-Content 'package.json' -Raw | ConvertFrom-Json
if ($pkg.name -ne 'cartandkeep') { Write-Host "  [ABORT] Wrong package." -ForegroundColor Red; exit 1 }

$status = & git status --porcelain 2>$null
if ($LASTEXITCODE -eq 0 -and $status) {
    Write-Host "  [ABORT] Uncommitted changes. Commit first, then run this again." -ForegroundColor Red
    exit 1
}

# Code files are only deleted if nothing in src still imports them.
# Matched on the import path, case sensitive: 'Cupboard' alone also matches scope-cupboard.module.css.
$code = @(
    @{ Path = 'src\components\ui\store\Cupboard.jsx';        Import = 'ui/store/Cupboard(\.jsx)?[''"]' },
    @{ Path = 'src\styles\ui\store\cupboard.module.css';     Import = 'ui/store/cupboard\.module\.css[''"]' },
    @{ Path = 'src\components\ui\store\TrustStrip.jsx';      Import = 'ui/store/TrustStrip(\.jsx)?[''"]' },
    @{ Path = 'src\styles\ui\store\trust-strip.module.css';  Import = 'ui/store/trust-strip\.module\.css[''"]' }
)

$loose = @(
    'src\ck_src_tree.txt',
    'ck_src_tree.txt',
    'ck_supabase_tree',
    'ck-home-cards-2026-09-26.zip',
    'ck-home-shelf-2026-09-26.zip'
)

$existing = @()

foreach ($c in $code) {
    if (-not (Test-Path $c.Path)) { Write-Host "    [ABSENT]  $($c.Path)" -ForegroundColor DarkGray; continue }
    $self = (Resolve-Path $c.Path).Path
    $uses = Get-ChildItem 'src' -Recurse -File -Include *.jsx, *.js, *.css |
        Where-Object { $_.FullName -ne $self -and $_.Name -ne 'Cupboard.jsx' -and $_.Name -ne 'TrustStrip.jsx' } |
        Select-String -Pattern $c.Import -CaseSensitive -List
    if ($uses) {
        Write-Host "    [KEPT]    $($c.Path), still imported by:" -ForegroundColor Red
        $uses | ForEach-Object { Write-Host "                $($_.Path):$($_.LineNumber)" -ForegroundColor Red }
    } else {
        Write-Host "    [PRESENT] $($c.Path)" -ForegroundColor Yellow; $existing += $c.Path
    }
}

foreach ($t in $loose) {
    if (Test-Path $t) { Write-Host "    [PRESENT] $t" -ForegroundColor Yellow; $existing += $t }
    else { Write-Host "    [ABSENT]  $t" -ForegroundColor DarkGray }
}

# Leftovers from applying zips by hand.
Get-ChildItem 'src' -Recurse -File -Include *.backup, *.mistake, *.orig -ErrorAction SilentlyContinue | ForEach-Object {
    $rel = Resolve-Path -Relative $_.FullName
    Write-Host "    [PRESENT] $rel" -ForegroundColor Yellow; $existing += $rel
}

if ($existing.Count -eq 0) { Write-Host "  Nothing to clean." -ForegroundColor Green; exit 0 }

$confirm = Read-Host "  Delete $($existing.Count) file(s)? (y/n)"
if ($confirm -ne 'y' -and $confirm -ne 'Y') { Write-Host "  [CANCELLED]" -ForegroundColor Yellow; exit 0 }

foreach ($t in $existing) {
    try { Remove-Item $t -Force; Write-Host "  [DELETED] $t" -ForegroundColor Green }
    catch { Write-Host "  [FAIL] $t : $($_.Exception.Message)" -ForegroundColor Red }
}

Write-Host ""
Write-Host "  Clean. Commit the deletions: git add -A; git commit -m ""chore: remove unused cupboard, trust strip and session files""" -ForegroundColor Green
