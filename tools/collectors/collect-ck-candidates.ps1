param([string]$Out = "ck-candidates-context.zip")
$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
for ($i = 0; $i -lt 4 -and -not (Test-Path (Join-Path $root "package.json")); $i++) {
  $root = Split-Path $root -Parent
}
if (-not (Test-Path (Join-Path $root "package.json"))) { throw "package.json not found within four levels up." }

$paths = @(
  # Candidates
  "src/pages/portal/CandidatesPage.jsx",
  "src/styles/pages/portal/candidates-page.module.css",
  "src/hooks/useCandidates.js",
  "src/components/ui/portal/CandidateRow.jsx",
  "src/styles/ui/portal/candidate-row.module.css",
  "src/components/ui/portal/VerdictBar.jsx",
  "src/components/ui/portal/MarketLine.jsx",
  "src/components/ui/portal/BatchScatter.jsx",
  "src/components/ui/portal/WindowSeries.jsx",
  "src/components/ui/portal/SourceList.jsx",
  "src/components/ui/portal/ImageLightbox.jsx",
  "src/styles/ui/portal/market-line.module.css",
  "src/styles/ui/portal/batch-scatter.module.css",
  "src/hooks/useNotes.js",

  # Coverage
  "src/pages/portal/CoveragePage.jsx",
  "src/styles/pages/portal/coverage-page.module.css",
  "src/hooks/useCoverage.js",
  "src/hooks/useBoundaries.js",
  "src/hooks/useCategoryNames.js",

  # Foundations and the patterns Approved already set
  "src/styles/base/tokens.css",
  "src/components/ui/portal/primitives.jsx",
  "src/styles/ui/portal/primitives.module.css",
  "src/components/ui/portal/Skeleton.jsx",
  "src/styles/ui/portal/skeleton.module.css",
  "src/components/ui/portal/EmptyState.jsx",
  "src/styles/ui/portal/empty-state.module.css",
  "src/components/ui/icons/index.jsx",
  "src/pages/portal/ApprovedPage.jsx",
  "src/styles/pages/portal/approved-page.module.css",
  "src/hooks/useApproved.js",
  "src/components/ui/portal/PriceScale.jsx",
  "src/styles/ui/portal/price-scale.module.css",

  # What the rows actually contain
  "scripts/import-gate.js",
  "scripts/import-coverage.js",
  "scripts/enrich-candidates.js",
  "scripts/gate.js",
  "supabase/migrations/0013_decision_history.sql",
  "supabase/migrations/0017_research_coverage.sql",
  "supabase/migrations/0020_candidate_tier.sql",
  "supabase/migrations/0021_candidate_sources.sql",
  "supabase/migrations/0024_candidate_notes.sql",
  "supabase/migrations/0029_batch_retirement.sql",
  "supabase/migrations/0030_competition.sql",
  "supabase/migrations/0033_rejection_reasons.sql",
  "supabase/migrations/0072_candidate_entry.sql",
  "supabase/migrations/0073_candidate_listing.sql",
  "supabase/migrations/0078_candidate_ebay.sql",
  "supabase/migrations/0079_candidate_draft.sql",

  "docs/approved-page-spec.md"
)

$secret = '(\.env|token|secret|credential|\.pem|\.key)$'
$stage = Join-Path $env:TEMP ("ck-cand-" + [guid]::NewGuid())
New-Item -ItemType Directory $stage | Out-Null
$missing = @(); $copied = 0

foreach ($p in $paths) {
  $src = Join-Path $root $p
  if ((Split-Path $p -Leaf) -match $secret) { $missing += "$p (withheld)"; continue }
  if (-not (Test-Path $src)) { $missing += $p; continue }
  $dst = Join-Path $stage $p
  New-Item -ItemType Directory (Split-Path $dst -Parent) -Force | Out-Null
  Copy-Item $src $dst
  $copied++
}

$manifest = @("Collected $copied of $($paths.Count)", "", "Missing:") + ($missing | ForEach-Object { "  $_" })
$manifest | Set-Content (Join-Path $stage "MANIFEST.txt") -Encoding UTF8

$zip = Join-Path $root $Out
if (Test-Path $zip) { Remove-Item $zip }
Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zip
Remove-Item $stage -Recurse -Force

Write-Host "$copied collected, $($missing.Count) missing -> $zip"
if ($missing.Count) { $missing | ForEach-Object { Write-Host "  missing: $_" } }
