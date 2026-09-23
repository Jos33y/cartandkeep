$ErrorActionPreference = 'Stop'

$root = (Get-Location).Path
for ($i = 0; $i -lt 4 -and -not (Test-Path (Join-Path $root 'package.json')); $i++) {
  $root = Split-Path $root -Parent
}
if (-not (Test-Path (Join-Path $root 'package.json'))) { throw "package.json not found within four levels of $(Get-Location)" }

$named = @(
  'package.json',
  'vite.config.js',
  'index.html',

  # foundations
  'src/styles/base/tokens.css',
  'src/styles/base/global.css',
  'src/styles/base/reset.css',
  'src/components/ui/portal/primitives.jsx',
  'src/styles/ui/portal/primitives.module.css',
  'src/components/ui/portal/EmptyState.jsx',
  'src/styles/ui/portal/empty-state.module.css',
  'src/components/ui/portal/Skeleton.jsx',
  'src/styles/ui/portal/skeleton.module.css',
  'src/components/ui/icons/index.jsx',
  'src/utils/formatGbp.js',
  'src/utils/constants.js',
  'docs/design-system.md',

  # shell and routing
  'src/app/PortalApp.jsx',
  'src/app/portalRouter.jsx',
  'src/components/layout/portal/PortalShell.jsx',
  'src/styles/layout/portal/portal-shell.module.css',

  # designed reference pages
  'src/pages/portal/OverviewPage.jsx',
  'src/styles/pages/portal/overview-page.module.css',
  'src/pages/portal/ListingsPage.jsx',
  'src/styles/pages/portal/listings-page.module.css',

  # Products
  'src/pages/portal/ProductsPage.jsx',
  'src/styles/pages/portal/products-page.module.css',
  'src/components/ui/portal/ProductRow.jsx',
  'src/styles/ui/portal/product-row.module.css',
  'src/components/ui/portal/PriceField.jsx',
  'src/styles/ui/portal/price-field.module.css',
  'src/components/ui/portal/Breakdown.jsx',
  'src/styles/ui/portal/breakdown.module.css',
  'src/components/ui/portal/NewProduct.jsx',
  'src/styles/ui/portal/new-product.module.css',
  'src/components/ui/portal/product/ChecksPanel.jsx',
  'src/hooks/useStoreProducts.js',

  # Dashboard
  'src/pages/portal/ShopPage.jsx',
  'src/styles/pages/portal/shop-page.module.css',
  'src/hooks/useShopDashboard.js',
  'src/components/ui/portal/OrderRow.jsx',
  'src/styles/ui/portal/order-row.module.css',

  # schema behind the product fields
  'supabase/migrations/0031_dimensions.sql',
  'supabase/migrations/0034_store_products.sql',
  'supabase/migrations/0036_store_product_detail.sql',
  'supabase/migrations/0047_stock.sql',
  'supabase/migrations/0052_product_cost.sql',
  'supabase/migrations/0055_selling_costs.sql',
  'supabase/migrations/0065_archive_and_stock.sql',
  'supabase/migrations/0082_sale_costs.sql'
)

# Names in the brief that the tree does not show, plus the handoff.
$searches = @(
  @{ dir = 'src'; filter = 'DashboardPage*.jsx' },
  @{ dir = 'src'; filter = 'SectionsPage*.jsx' },
  @{ dir = 'src/styles'; filter = 'dashboard-page*.css' },
  @{ dir = 'src/styles'; filter = 'sections-page*.css' },
  @{ dir = 'docs'; filter = 'handoff*.md' },
  @{ dir = '.'; filter = 'handoff-2026-09-23.md' }
)

# Anything after 0086 may be where returns class and hazard live.
$migrationsAfter = '0086'

# tokens.css must not match this, the old pattern withheld it.
$secret = '(^|[\\/])\.env|\.cj-token|secret|\.pem$|\.key$'
$stamp = Get-Date -Format 'yyyyMMdd-HHmm'
$stage = Join-Path $env:TEMP "ck-collect-$stamp"
New-Item -ItemType Directory -Path $stage -Force | Out-Null

$collected = New-Object System.Collections.Generic.List[string]
$missing = New-Object System.Collections.Generic.List[string]
$withheld = New-Object System.Collections.Generic.List[string]

function Add-File([string]$rel) {
  if ($rel -match $secret) { $withheld.Add($rel); return }
  if ($collected | Where-Object { $_.StartsWith("$rel  ") }) { return }
  $src = Join-Path $root $rel
  if (-not (Test-Path $src -PathType Leaf)) { $missing.Add($rel); return }
  $dst = Join-Path $stage $rel
  New-Item -ItemType Directory -Path (Split-Path $dst -Parent) -Force | Out-Null
  Copy-Item $src $dst
  $kb = [math]::Round((Get-Item $src).Length / 1KB, 1)
  $collected.Add("$rel  ($kb KB)")
}

function Rel([string]$full) { $full.Substring($root.Length + 1) -replace '\\', '/' }

foreach ($rel in $named) { Add-File $rel }

foreach ($s in $searches) {
  $base = Join-Path $root $s.dir
  $hits = if (Test-Path $base) { Get-ChildItem -Path $base -Filter $s.filter -File -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch '[\\/](node_modules|dist|backups)[\\/]' } }
  if (-not $hits) { $missing.Add("$($s.dir)/**/$($s.filter)  (no match)"); continue }
  foreach ($h in $hits) { Add-File (Rel $h.FullName) }
}

$migDir = Join-Path $root 'supabase/migrations'
$newer = Get-ChildItem -Path $migDir -Filter '*.sql' -File | Where-Object { $_.Name.Substring(0, 4) -gt $migrationsAfter }
foreach ($m in $newer) { Add-File (Rel $m.FullName) }

$pages = Get-ChildItem -Path (Join-Path $root 'src/pages/portal') -File | ForEach-Object { $_.Name }
$uiPortal = Get-ChildItem -Path (Join-Path $root 'src/components/ui/portal') -File -Recurse | ForEach-Object { Rel $_.FullName }
$migrations = Get-ChildItem -Path $migDir -Filter '*.sql' -File | ForEach-Object { $_.Name }

$manifest = @(
  "Cart & Keep collector, shop pass, $stamp",
  "Root: $root",
  '',
  "COLLECTED ($($collected.Count))"
) + $collected + @('', "MISSING ($($missing.Count))") + $missing +
  @('', "WITHHELD ($($withheld.Count))") + $withheld +
  @('', 'ALL FILES IN src/pages/portal') + $pages +
  @('', 'ALL FILES IN src/components/ui/portal') + $uiPortal +
  @('', 'ALL MIGRATIONS') + $migrations

$manifest | Set-Content -Path (Join-Path $stage 'MANIFEST.txt') -Encoding UTF8

$zip = Join-Path ([Environment]::GetFolderPath('UserProfile')) "Downloads\ck-collect-shop-$stamp.zip"
if (Test-Path $zip) { Remove-Item $zip }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip
Remove-Item $stage -Recurse -Force

Write-Host "Collected $($collected.Count), missing $($missing.Count), withheld $($withheld.Count)"
if ($missing.Count) { $missing | ForEach-Object { Write-Host "  missing: $_" -ForegroundColor Yellow } }
Write-Host "Zip: $zip"
