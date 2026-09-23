# Collects the storefront context into cartandkeep-store-context.zip.
# Run from repo root.
#
# One of three, and they do not mix:
#
#   collect-ck-context.ps1        research, candidates, the pipeline
#   collect-ck-admin-context.ps1  products, orders, money, settings
#   collect-ck-store-context.ps1  this one. The shop a customer sees
#
# Running more than one into a chat spends the context window on files nobody
# in that session is going to touch, and the storefront alone is around ninety.
#
# No markdown. The handoff, feedback and session summary are attached to the
# chat directly, because they are read first and should not be buried inside a
# zip with sixty components.

$ErrorActionPreference = 'Stop'

$repoRoot = (Get-Location).Path
$pkgPath = Join-Path $repoRoot 'package.json'

if (-not (Test-Path $pkgPath)) { Write-Host "No package.json in $repoRoot. Run this from the repo root." -ForegroundColor Red; exit 1 }

$pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
if ($pkg.name -ne 'cartandkeep') { Write-Host "package.json name is '$($pkg.name)', expected 'cartandkeep'. Aborting." -ForegroundColor Red; exit 1 }

# How the shop is wired.
#
# One build serves portal., status. and the shop, so App.jsx and host.js decide
# which one renders. A session that reads storeRouter without them will not
# understand why the shop has no login and cannot be given one.
$tier1 = @(
  'index.html',
  'vite.config.js',
  'src/main.jsx',
  'src/app/App.jsx',
  'src/app/StoreApp.jsx',
  'src/app/storeRouter.jsx',
  'src/lib/host.js',
  'src/pwa/registerStore.js',
  'src/utils/constants.js'
)

# Data and configuration.
#
# storeConfig is the one that matters: the delivery threshold is still written
# out in five components and this is what they are meant to be swapped to.
$tier2 = @(
  'src/lib/supabase.js',
  'src/lib/tenant.js',
  'src/lib/storeConfig.js',
  'src/lib/checkout.js',
  'src/lib/analytics.js',
  'src/lib/postcode.js',
  'src/lib/csv.js',
  'src/hooks/useTenant.js',
  'src/hooks/useStoreProducts.js',
  'src/hooks/useSaved.js',
  'src/hooks/useRecentlyViewed.js',
  'src/hooks/useOnline.js',
  'src/hooks/useAnalytics.js',
  'src/context/BasketContext.jsx',
  'src/utils/categories.js',
  'src/utils/search.js',
  'src/utils/delivery.js',
  'src/utils/formatGbp.js',
  'src/data/legal.js',
  'src/data/about.js',
  'src/data/blog.js',
  'src/data/statusItems.js',
  'src/data/deliverables.js'
)

# Orders and payments.
#
# The status values on an order come from the webhook rather than from anything
# in the front end, and prices are read from the database inside the checkout
# function rather than accepted from the browser. A change made without reading
# these will get one of those two wrong.
# Globbed per folder rather than named, because a new function is a new folder
# and a hardcoded list misses it. Which is how feed came to sit in the repo
# with no index.ts in it at all.
$tier3Globs = @(
  'supabase/functions/checkout/*.ts',
  'supabase/functions/stripe-webhook/*.ts',
  'supabase/functions/order/*.ts',
  'supabase/functions/notify/*.ts',
  'supabase/functions/feed/*.ts'
)

# The pages. Globbed, because the store folder is still growing and a hardcoded
# list shipped a bundle missing three pages on 14 August.
$tier4Globs = @(
  'src/pages/store/*.jsx',
  'src/pages/not-found/*.jsx',
  'src/components/layout/store/*.jsx',
  'src/components/layout/shared/*.jsx',
  'src/components/ui/store/*.jsx'
)

# Styles. Also globbed. The tokens files are listed separately because they are
# read far more often than any single module.
$tier5 = @(
  'src/styles/base/tokens.css',
  'src/styles/base/store-tokens.css',
  'src/styles/base/global.css'
)

$tier5Globs = @(
  'src/content/blog/*.md',
  'src/styles/pages/store/*.css',
  'src/styles/pages/not-found/*.css',
  'src/styles/layout/store/*.css',
  'src/styles/ui/store/*.css'
)

# Scripts that put things into the shop.
$tier6 = @(
  'scripts/seed-store.js',
  'scripts/enrich-store.js',
  'scripts/band-listings.py',
  'scripts/build-sitemap.js',
  'scripts/backup.js'
)

# Public files that are content rather than assets. Icons and splash images are
# deliberately excluded: they are binary, they are large, and nothing about
# them is a decision anybody needs to revisit.
$tier7 = @(
  'public/robots.txt',
  'public/llms.txt',
  'public/manifest.webmanifest'
)

$tier7Globs = @(
  'src/content/blog/*.md'
)

# Schema. Store tables start at 0034, so fourteen covers everything the shop
# touches without dragging in the whole portal history.
$tier8Glob = 'supabase/migrations/*.sql'
$tier8Take = 14

$staging = Join-Path $repoRoot '_ck-store-staging'
$srcDir = Join-Path $staging '_src'
$zipPath = Join-Path $repoRoot 'cartandkeep-store-context.zip'

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

Write-Host "`nTier 1 (how the shop is wired)" -ForegroundColor Cyan
Copy-Tier $tier1 'T1'

Write-Host "`nTier 2 (data and configuration)" -ForegroundColor Cyan
Copy-Tier $tier2 'T2'

Write-Host "`nTier 3 (orders and payments)" -ForegroundColor Cyan
foreach ($g in $tier3Globs) { Copy-Glob $g 'T3' }

Write-Host "`nTier 4 (pages and components)" -ForegroundColor Cyan
foreach ($g in $tier4Globs) { Copy-Glob $g 'T4' }

Write-Host "`nTier 5 (styles)" -ForegroundColor Cyan
Copy-Tier $tier5 'T5'
foreach ($g in $tier5Globs) { Copy-Glob $g 'T5' }

Write-Host "`nTier 6 (scripts)" -ForegroundColor Cyan
Copy-Tier $tier6 'T6'

Write-Host "`nTier 7 (content and public)" -ForegroundColor Cyan
Copy-Tier $tier7 'T7'
foreach ($g in $tier7Globs) { Copy-Glob $g 'T7' }

Write-Host "`nTier 8 (schema, latest $tier8Take)" -ForegroundColor Cyan
$migrations = Get-ChildItem -Path (Join-Path $repoRoot ($tier8Glob -replace '/', '\')) -ErrorAction SilentlyContinue |
  Sort-Object Name -Descending | Select-Object -First $tier8Take
if (-not $migrations) {
  Write-Host "  missing supabase/migrations/*.sql" -ForegroundColor Yellow
  $missing += "T8  supabase/migrations/*.sql"
} else {
  foreach ($m in $migrations) { Copy-One "supabase/migrations/$($m.Name)" 'T8' }
}

# Env var names only. Values are never written.
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

# What is live and what is not.
#
# Every question about the shop being empty has the same answer, so the bundle
# carries the counts rather than making somebody ask.
$state = @()
$state += "Storefront state, generated $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
$state += ""
$state += "Run these against the database if the numbers matter:"
$state += "  select status, is_sample, count(*) from store_products group by 1, 2;"
$state += "  select count(*) from orders;"
$state += "  select event, count(*) from store_events group by 1;"
$state += ""
$state += "As of 18 August: all 78 products are draft and is_sample, so the shop"
$state += "is empty to anyone not signed in. That is the answer to almost every"
$state += "question that starts with why is nothing showing."
Set-Content -Path (Join-Path $srcDir 'STATE.txt') -Value $state -Encoding UTF8

$versions = @()
$versions += "node    $(try { (node --version) } catch { 'not found' })"
$versions += "npm     $(try { (npm --version) } catch { 'not found' })"
Set-Content -Path (Join-Path $srcDir 'runtime-versions.txt') -Value $versions -Encoding UTF8

$manifest = @()
$manifest += "Cart and Keep storefront context bundle"
$manifest += "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$manifest += "Repo: $repoRoot"
$manifest += ""
$manifest += "No markdown in here. The handoff, feedback and session summary are"
$manifest += "attached to the chat directly, because they are read first."
$manifest += ""
$manifest += "The portal and the research pipeline are not in here either. Use"
$manifest += "collect-ck-context.ps1 for those, and do not run both into one chat."
$manifest += ""
$manifest += "Read STATE.txt before asking why the shop looks empty."
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
