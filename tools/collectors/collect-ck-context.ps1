# Collects the research half of the portal into cartandkeep-portal-context.zip.
# Run from repo root.
#
# Scoped down on 20 August. This used to be the whole portal. The portal is now
# two surfaces that barely overlap, and sixty admin files went in on 20 August,
# so carrying both spends the context window on files nobody in that session
# will touch.
#
#   collect-ck-context.ps1        this one. Research, candidates, the pipeline
#   collect-ck-admin-context.ps1  products, orders, money, settings
#   collect-ck-store-context.ps1  the shop a customer sees
#
# Do not run more than one into a single chat.

$ErrorActionPreference = 'Stop'

$repoRoot = (Get-Location).Path
$pkgPath = Join-Path $repoRoot 'package.json'

if (-not (Test-Path $pkgPath)) { Write-Host "No package.json in $repoRoot. Run this from the repo root." -ForegroundColor Red; exit 1 }

$pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
if ($pkg.name -ne 'cartandkeep') { Write-Host "package.json name is '$($pkg.name)', expected 'cartandkeep'. Aborting." -ForegroundColor Red; exit 1 }

# What the handoff says to load first. These carry the decisions and the
# corrections, and without them a new session rediscovers a week of work.
#
# The handoff filenames are dated, so they are globbed and the newest three are
# taken. Hardcoding them meant the bundle silently shipped last week's
# decisions the day after a session closed.
$tier1Docs = @(
  'docs/design-system.md',
  'docs/cart-store/decisions-2026-08-20.md',
  'docs/cart-store/build-plan-2026-08-20.md',
  'docs/research/research-process.md',
  'docs/research/research-process-update-2026-08-10.md',
  'docs/research/terapeak.md',
  'docs/research/research-methodology.md',
  'docs/research/category-research.md',
  'docs/supplier-apis.md',
  'docs/supplier-leads-2026-08-13.md',
  'docs/data-sources.md',
  'docs/cj-api-notes.md'
)

# The screens being worked on.
#
# OverviewPage, useOverview and BatchScatter were absent from the bundle and
# had to be requested mid session on 14 August, twice. Every page that queries
# batches belongs here, because a change to how batches work touches all of
# them.
$tier2 = @(
  'src/app/portalRouter.jsx',
  'src/app/PortalApp.jsx',
  'src/components/layout/portal/PortalShell.jsx',
  'src/pages/portal/CandidatesPage.jsx',
  'src/pages/portal/ApprovedPage.jsx',
  'src/pages/portal/ListingsPage.jsx',
  'src/pages/portal/NotesPage.jsx',
  'src/pages/portal/ActivityPage.jsx',
  'src/pages/portal/OverviewPage.jsx',
  'src/pages/portal/MetricsPage.jsx',
  'src/pages/portal/CoveragePage.jsx',
  'src/components/ui/portal/CandidateRow.jsx',
  'src/components/ui/portal/BatchScatter.jsx',
  'src/components/ui/portal/MarketLine.jsx',
  'src/components/ui/portal/VerdictBar.jsx',
  'src/components/ui/portal/WindowSeries.jsx',
  'src/components/ui/portal/SourceList.jsx',
  'src/components/layout/portal/PortalProtected.jsx',
  'src/components/ui/portal/EmptyState.jsx',
  'src/components/ui/portal/ImageLightbox.jsx',
  'src/components/ui/icons/index.jsx',
  'src/hooks/useCandidates.js',
  'src/hooks/useOverview.js',
  'src/hooks/useBoundaries.js',
  'src/hooks/useApproved.js',
  'src/hooks/useCoverage.js',
  'src/hooks/useNotes.js',
  'src/hooks/useActivity.js',
  'src/hooks/useSuppliers.js',
  'src/hooks/useAccount.js',
  'src/lib/supabase.js',
  'src/data/statusItems.js',
  'src/styles/pages/portal/candidates-page.module.css',
  'src/styles/pages/portal/overview-page.module.css',
  'src/styles/ui/portal/candidate-row.module.css',
  'src/styles/ui/portal/market-line.module.css',
  'src/styles/ui/portal/verdict-bar.module.css',
  'src/styles/ui/portal/batch-scatter.module.css',
  'src/styles/layout/portal/portal-shell.module.css',
  'src/styles/ui/portal/empty-state.module.css',
  'src/styles/ui/portal/window-series.module.css',
  'src/styles/ui/portal/source-list.module.css',
  'src/styles/base/tokens.css',
  'src/styles/base/global.css'
)

# The research pipeline. Most of the work happens here now.
#
# analyse-terapeak.py is 18 lines of entry point since the split on 14 August.
# Listing it alone shipped a bundle with none of the logic in it, so the
# package is globbed instead and stays current as modules are added.
$tier3 = @(
  'scripts/analyse-terapeak.py',
  'scripts/mine-terms.py',
  'scripts/run-tests.py',
  'scripts/import-shortlist.js',
  'scripts/enrich-candidates.js',
  'scripts/import-coverage.js',
  'scripts/check-competition.js',
  'scripts/check-identity.py',
  'scripts/request-cj-sourcing.js',
  'scripts/add-source.js',
  'pipeline/lib/rank.js',
  'pipeline/lib/margin.js',
  'pipeline/lib/gates.js',
  'pipeline/lib/brand.js',
  'pipeline/lib/rates.js',
  'pipeline/lib/scoring.js',
  'pipeline/sources/ebayBrowse.js',
  'pipeline/sources/cjDropshipping.js',
  'pipeline/lib/db.js'
)

$tier3Globs = @(
  'scripts/terapeak/*.py',
  'scripts/terapeak/tests/*.py',
  'scripts/terapeak/tests/corpus/*.csv'
)

# What the data actually is.
$tier4 = @(
  'src/lib/tenant.js',
  'src/utils/constants.js',
  'src/utils/category.js',
  'src/utils/categories.js',
  'src/utils/formatGbp.js'
)

# Schema, newest first. Append only, so a glob keeps this current without
# anyone remembering to add the next number.
$tier5Glob = 'supabase/migrations/*.sql'
$tier5Take = 14

$staging = Join-Path $repoRoot '_ck-context-staging'
$srcDir = Join-Path $staging '_src'
$zipPath = Join-Path $repoRoot 'cartandkeep-portal-context.zip'

if (Test-Path $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
New-Item -ItemType Directory -Path $srcDir -Force | Out-Null

$found = @()
$missing = @()

function Copy-One { param($rel, $tierName)
  $src = Join-Path $repoRoot ($rel -replace '/', '\')
  if (Test-Path $src) {
    $dest = Join-Path $srcDir ($rel -replace '/', '\')
    $destDir = Split-Path $dest -Parent
    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
    Copy-Item -LiteralPath $src -Destination $dest -Force
    $script:found += "$tierName  $rel"
    Write-Host "  ok      $rel" -ForegroundColor Green
  } else {
    $script:missing += "$tierName  $rel"
    Write-Host "  missing $rel" -ForegroundColor Yellow
  }
}

function Copy-Tier { param($paths, $tierName)
  foreach ($rel in $paths) { Copy-One $rel $tierName }
}

# Copies whatever a glob matches, so a folder stays current without anyone
# maintaining a list. __pycache__ is excluded because a .pyc in the bundle is
# noise a reader has to skip past.
function Copy-Glob { param($glob, $tierName)
  $full = Join-Path $repoRoot ($glob -replace '/', '\')
  $hits = Get-ChildItem -Path $full -File -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '__pycache__' }
  if (-not $hits) {
    Write-Host "  missing $glob" -ForegroundColor Yellow
    $script:missing += "$tierName  $glob"
    return
  }
  $prefix = Split-Path $glob -Parent
  foreach ($h in $hits) { Copy-One "$prefix/$($h.Name)" $tierName }
}

Write-Host "`nTier 1 (docs, read these first)" -ForegroundColor Cyan

# Newest of each handoff kind. Dated filenames, so sorting by name descending
# gives the most recent session. One each: the older ones are still in the repo
# and a session that needs them can ask.
foreach ($kind in @('handoff', 'feedback', 'session-summary')) {
  # Both places. This only looked in docs/handoff/, and the 18 August documents
  # were written to docs/, so a bundle would have shipped with none of a
  # session's decisions in it and reported that only in the manifest.
  # Three places now. Documents have been written to docs/, docs/cart-store/
  # and docs/handoff/ on different days, and a bundle that looks in fewer than
  # all three has shipped without a session's decisions before.
  $hits = @()
  foreach ($dir in @('docs\cart-store', 'docs\handoff', 'docs')) {
    $hits += Get-ChildItem -Path (Join-Path $repoRoot "$dir\$kind-ck-*.md") -ErrorAction SilentlyContinue
  }
  $newest = $hits | Sort-Object Name -Descending | Select-Object -First 1
  if (-not $newest) {
    Write-Host "  MISSING $kind-ck-*.md" -ForegroundColor Red
    $missing += "T1  $kind-ck-*.md"
  } else {
    Copy-One (($newest.FullName.Substring($repoRoot.Length + 1)) -replace '\\', '/') 'T1'
  }
}
Copy-Tier $tier1Docs 'T1'

Write-Host "`nTier 2 (screens)" -ForegroundColor Cyan
Copy-Tier $tier2 'T2'

Write-Host "`nTier 3 (research pipeline and tests)" -ForegroundColor Cyan
Copy-Tier $tier3 'T3'
foreach ($g in $tier3Globs) { Copy-Glob $g 'T3' }

Write-Host "`nTier 4 (data shape)" -ForegroundColor Cyan
Copy-Tier $tier4 'T4'

Write-Host "`nTier 5 (schema, latest $tier5Take)" -ForegroundColor Cyan
$migrations = Get-ChildItem -Path (Join-Path $repoRoot ($tier5Glob -replace '/', '\')) -ErrorAction SilentlyContinue |
  Sort-Object Name -Descending | Select-Object -First $tier5Take
if (-not $migrations) {
  Write-Host "  missing supabase/migrations/*.sql" -ForegroundColor Yellow
  $missing += "T5  supabase/migrations/*.sql"
} else {
  foreach ($m in $migrations) { Copy-One "supabase/migrations/$($m.Name)" 'T5' }
}

# The current shortlist and the strip files. The strips are six numbers a
# window and they are the category read, so they cost almost nothing to carry
# and answer questions the rows cannot.
Write-Host "`nTier 6 (current output)" -ForegroundColor Cyan
Copy-One 'drops/merged/shortlist.csv' 'T6'
Copy-Glob 'drops/terapeak/*_strips.csv' 'T6'

# Every migration by name, even where the contents are not carried. Concluding
# a mechanism did not exist from a partial view of this folder cost an hour on
# 20 August and shipped four policies looser than they should have been.
$allMigrations = Get-ChildItem -Path (Join-Path $repoRoot 'supabase\migrations\*.sql') -ErrorAction SilentlyContinue |
  Sort-Object Name | ForEach-Object { $_.Name }
Set-Content -Path (Join-Path $srcDir 'migration-list.txt') -Value $allMigrations -Encoding UTF8
Write-Host "  ok      migration-list.txt ($($allMigrations.Count) names)" -ForegroundColor Green

# Env var names only. Values are split off and never written.
$envOut = @()
foreach ($ef in @('.env.example', '.env.local')) {
  $ep = Join-Path $repoRoot $ef
  if (Test-Path $ep) {
    $envOut += "[$ef]"
    $names = Get-Content $ep | Where-Object { $_ -match '^\s*[A-Za-z_][A-Za-z0-9_]*\s*=' } | ForEach-Object { ($_ -split '=', 2)[0].Trim() }
    $envOut += $names
    $envOut += ''
    Write-Host "  env     $ef ($($names.Count) names)" -ForegroundColor Green
  } else {
    Write-Host "  env     $ef not found" -ForegroundColor Yellow
  }
}
Set-Content -Path (Join-Path $srcDir 'env-var-names.txt') -Value $envOut -Encoding UTF8

# The runtime versions, because a script that parses here and crashes there has
# cost a session before.
$versions = @()
$versions += "node    $(try { (node --version) } catch { 'not found' })"
$versions += "python  $(try { (python --version 2>&1) } catch { 'not found' })"
$versions += "npm     $(try { (npm --version) } catch { 'not found' })"
Set-Content -Path (Join-Path $srcDir 'runtime-versions.txt') -Value $versions -Encoding UTF8
Write-Host "`n  $($versions -join ' | ')" -ForegroundColor Green

$manifest = @()
$manifest += "Cart and Keep context bundle"
$manifest += "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$manifest += "Repo: $repoRoot"
$manifest += ""
$manifest += "Read T1 first. It carries the decisions and the corrections."
$manifest += "The analysis lives in scripts/terapeak/, not in analyse-terapeak.py,"
$manifest += "which is an 18 line entry point since 14 August."
$manifest += ""
$manifest += "This is the research half only. The shop admin is in"
$manifest += "collect-ck-admin-context.ps1 and the storefront is in"
$manifest += "collect-ck-store-context.ps1. Do not run more than one into"
$manifest += "one chat."
$manifest += ""
$manifest += "Only the latest $tier5Take migrations are included in full, and"
$manifest += "every name is in migration-list.txt. Ask rather than concluding a"
$manifest += "mechanism does not exist. has_tenant is in 0001."
$manifest += ""
$manifest += "FOUND ($($found.Count)):"
$manifest += $found
$manifest += ""
$manifest += "MISSING ($($missing.Count)):"
if ($missing.Count -eq 0) { $manifest += "  none" } else { $manifest += $missing }
Set-Content -Path (Join-Path $srcDir 'MANIFEST.txt') -Value $manifest -Encoding UTF8

if (Test-Path $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
Compress-Archive -Path $srcDir -DestinationPath $zipPath -Force

# Clean staging only. Never touch repo root.
if ($staging -and $staging -ne $repoRoot -and (Test-Path $staging)) { Remove-Item -LiteralPath $staging -Recurse -Force }

$sizeKb = [math]::Round((Get-Item $zipPath).Length / 1KB, 1)
Write-Host "`nWrote $zipPath ($sizeKb KB). Found $($found.Count), missing $($missing.Count)." -ForegroundColor Cyan
if ($missing.Count -gt 0) { Write-Host "Missing paths are listed in _src/MANIFEST.txt inside the zip." -ForegroundColor Yellow }
