# Collects the shop admin half of the portal into cartandkeep-admin-context.zip.
# Run from repo root.
#
# New on 20 August. The portal used to be one surface and is now two that barely
# overlap: the research pipeline that finds products, and the admin that runs
# the shop. Sixty files went in on 20 August and every one of them belongs here
# rather than in collect-ck-context.ps1.
#
# Splitting them because a bundle carrying both spends the context window on
# files nobody in that session is going to touch, which is the same reason the
# storefront was split off in the first place.
#
#   collect-ck-context.ps1        research, candidates, the pipeline
#   collect-ck-admin-context.ps1  this one. Products, orders, money, settings
#   collect-ck-store-context.ps1  the shop a customer sees
#
# Do not run more than one into a single chat.

$ErrorActionPreference = 'Stop'

$repoRoot = (Get-Location).Path
$pkgPath = Join-Path $repoRoot 'package.json'

if (-not (Test-Path $pkgPath)) { Write-Host "No package.json in $repoRoot. Run this from the repo root." -ForegroundColor Red; exit 1 }

$pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
if ($pkg.name -ne 'cartandkeep') { Write-Host "package.json name is '$($pkg.name)', expected 'cartandkeep'. Aborting." -ForegroundColor Red; exit 1 }

# The shell every portal screen sits inside.
#
# PortalProtected and the icon set were both requested mid session on 20 August
# because neither was in any bundle, and PortalProtected is where has_tenant and
# is_platform_admin are actually called, which is the thing I spent an hour
# concluding did not exist.
$tier1 = @(
  'src/app/PortalApp.jsx',
  'src/app/portalRouter.jsx',
  'src/components/layout/portal/PortalShell.jsx',
  'src/components/layout/portal/PortalProtected.jsx',
  'src/components/ui/icons/index.jsx',
  'src/lib/supabase.js',
  'src/lib/tenant.js',
  'src/lib/storeConfig.js',
  'src/hooks/useAccount.js',
  'src/utils/constants.js',
  'src/utils/formatGbp.js',
  'src/utils/categories.js',
  'src/utils/category.js',
  'src/styles/base/tokens.css',
  'src/styles/base/global.css',
  'src/styles/layout/portal/portal-shell.module.css'
)

# Every portal page and component, globbed.
#
# Hardcoded lists are why EmptyState, the icon set, SettingsPage and
# FinancePage all had to be asked for one at a time on 20 August. A glob over a
# folder that is still growing costs a few files nobody reads and saves a round
# trip every time one is added.
$tier2Globs = @(
  'src/pages/portal/*.jsx',
  'src/components/ui/portal/*.jsx',
  'src/styles/pages/portal/*.css',
  'src/styles/ui/portal/*.css'
)

# The hooks. Globbed for the same reason, and it is one folder.
$tier3Globs = @(
  'src/hooks/*.js'
)

# The libraries the admin screens call.
#
# csv.js and channelImport.js parse her eBay and TikTok exports, productImages
# resizes a photograph before it is uploaded, and none of them is obvious from
# the component that uses it.
$tier4 = @(
  'src/lib/csv.js',
  'src/lib/channelImport.js',
  'src/lib/productImages.js',
  'src/lib/analytics.js',
  'src/lib/postcode.js'
)

# The edge functions.
#
# Absent from every bundle until now, and the admin cannot be understood without
# them: the portal calls notify, the orders page renders what stripe-webhook
# writes, and checkout is the only thing that decides what a customer pays.
#
# Globbed per folder, because a new function is a new folder and a hardcoded
# list would miss it. Which is exactly how feed shipped with no index.ts.
$tier5Globs = @(
  'supabase/functions/checkout/*.ts',
  'supabase/functions/stripe-webhook/*.ts',
  'supabase/functions/notify/*.ts',
  'supabase/functions/order/*.ts',
  'supabase/functions/feed/*.ts'
)

# Schema, newest first. Append only, so a glob keeps this current without
# anyone remembering to add the next number.
$tier6Glob = 'supabase/migrations/*.sql'
$tier6Take = 16

$staging = Join-Path $repoRoot '_ck-admin-staging'
$srcDir = Join-Path $staging '_src'
$zipPath = Join-Path $repoRoot 'cartandkeep-admin-context.zip'

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

# The planning documents, and today's handoff set.
#
# These carry the decisions. A session without them rediscovers a fortnight of
# corrections, and on 20 August that included re-deriving a rule that was
# already written into a migration comment.
Write-Host "`nTier 0 (read these first)" -ForegroundColor Cyan

$planDocs = @(
  'decisions-*.md',
  'build-plan-*.md',
  'messaging-plan-*.md',
  'portal-gaps-*.md',
  'store-admin-surface-*.md',
  'order-emails-spec-*.md',
  'scaling-to-fifty-clients-*.md'
)

# Both places, because documents have been written to docs/, docs/cart-store/
# and docs/handoff/ on different days and a bundle that only looks in one has
# shipped without a session's decisions before.
$docDirs = @('docs\cart-store', 'docs\handoff', 'docs')

foreach ($pattern in $planDocs) {
  $hits = @()
  foreach ($dir in $docDirs) {
    $hits += Get-ChildItem -Path (Join-Path $repoRoot "$dir\$pattern") -ErrorAction SilentlyContinue
  }
  $newest = $hits | Sort-Object Name -Descending | Select-Object -First 1
  if ($newest) {
    Copy-One (($newest.FullName.Substring($repoRoot.Length + 1)) -replace '\\', '/') 'T0'
  } else {
    Write-Host "  missing $pattern" -ForegroundColor Yellow
    $missing += "T0  $pattern"
  }
}

# Newest of each handoff kind. Dated filenames, so sorting by name descending
# gives the most recent session.
foreach ($kind in @('handoff', 'feedback', 'session-summary')) {
  $hits = @()
  foreach ($dir in $docDirs) {
    $hits += Get-ChildItem -Path (Join-Path $repoRoot "$dir\$kind-ck-*.md") -ErrorAction SilentlyContinue
  }
  $newest = $hits | Sort-Object Name -Descending | Select-Object -First 1
  if (-not $newest) {
    Write-Host "  MISSING $kind-ck-*.md" -ForegroundColor Red
    $missing += "T0  $kind-ck-*.md"
  } else {
    Copy-One (($newest.FullName.Substring($repoRoot.Length + 1)) -replace '\\', '/') 'T0'
  }
}

Write-Host "`nTier 1 (the shell)" -ForegroundColor Cyan
Copy-Tier $tier1 'T1'

Write-Host "`nTier 2 (screens and components)" -ForegroundColor Cyan
foreach ($g in $tier2Globs) { Copy-Glob $g 'T2' }

Write-Host "`nTier 3 (hooks)" -ForegroundColor Cyan
foreach ($g in $tier3Globs) { Copy-Glob $g 'T3' }

Write-Host "`nTier 4 (libraries)" -ForegroundColor Cyan
Copy-Tier $tier4 'T4'

Write-Host "`nTier 5 (edge functions)" -ForegroundColor Cyan
foreach ($g in $tier5Globs) { Copy-Glob $g 'T5' }

Write-Host "`nTier 6 (schema, latest $tier6Take)" -ForegroundColor Cyan
$migrations = Get-ChildItem -Path (Join-Path $repoRoot ($tier6Glob -replace '/', '\')) -ErrorAction SilentlyContinue |
  Sort-Object Name -Descending | Select-Object -First $tier6Take
if (-not $migrations) {
  Write-Host "  missing supabase/migrations/*.sql" -ForegroundColor Yellow
  $missing += "T6  supabase/migrations/*.sql"
} else {
  foreach ($m in $migrations) { Copy-One "supabase/migrations/$($m.Name)" 'T6' }
}

# The whole migration list by name only. Sixteen files is the working set and
# the other forty are still the schema, so the names go in even where the
# contents do not.
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

$versions = @()
$versions += "node    $(try { (node --version) } catch { 'not found' })"
$versions += "npm     $(try { (npm --version) } catch { 'not found' })"
Set-Content -Path (Join-Path $srcDir 'runtime-versions.txt') -Value $versions -Encoding UTF8

$manifest = @()
$manifest += "Cart and Keep, shop admin context bundle"
$manifest += "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$manifest += "Repo: $repoRoot"
$manifest += ""
$manifest += "Read T0 first, and decisions-*.md before anything else in it."
$manifest += ""
$manifest += "This is the admin half of the portal: products, orders, stock,"
$manifest += "settings, interest, being found and finance."
$manifest += ""
$manifest += "The research pipeline is not in here. Use collect-ck-context.ps1."
$manifest += "The storefront is not in here. Use collect-ck-store-context.ps1."
$manifest += "Do not run more than one into a single chat."
$manifest += ""
$manifest += "Only the latest $tier6Take migrations are included in full."
$manifest += "Every migration name is in migration-list.txt, so ask rather than"
$manifest += "concluding a mechanism does not exist. has_tenant is in 0001."
$manifest += ""
$manifest += "FOUND ($($found.Count)):"
$manifest += $found
$manifest += ""
$manifest += "MISSING ($($missing.Count)):"
if ($missing.Count -eq 0) { $manifest += "  none" } else { $manifest += $missing }
Set-Content -Path (Join-Path $srcDir 'MANIFEST.txt') -Value $manifest -Encoding UTF8

if (Test-Path $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
Compress-Archive -Path $srcDir -DestinationPath $zipPath -Force

if ($staging -and $staging -ne $repoRoot -and (Test-Path $staging)) { Remove-Item -LiteralPath $staging -Recurse -Force }

$sizeKb = [math]::Round((Get-Item $zipPath).Length / 1KB, 1)
Write-Host "`nWrote $zipPath ($sizeKb KB). Found $($found.Count), missing $($missing.Count)." -ForegroundColor Cyan
if ($missing.Count -gt 0) { Write-Host "Missing paths are listed in _src/MANIFEST.txt inside the zip." -ForegroundColor Yellow }
