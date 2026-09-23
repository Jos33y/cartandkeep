param([string]$Out = "ck-anm-context.zip")
$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
for ($i = 0; $i -lt 4 -and -not (Test-Path (Join-Path $root "package.json")); $i++) {
  $root = Split-Path $root -Parent
}
if (-not (Test-Path (Join-Path $root "package.json"))) { throw "package.json not found within four levels up." }

$paths = @(
  # The three pages
  "src/pages/portal/ActivityPage.jsx",
  "src/pages/portal/NotesPage.jsx",
  "src/pages/portal/MetricsPage.jsx",
  "src/styles/pages/portal/activity-page.module.css",
  "src/styles/pages/portal/notes-page.module.css",
  "src/styles/pages/portal/metrics-page.module.css",
  "src/hooks/useActivity.js",
  "src/hooks/useNotes.js",

  # What they read
  "supabase/migrations/0009_notes.sql",
  "supabase/migrations/0013_decision_history.sql",
  "supabase/migrations/0033_rejection_reasons.sql",

  # Shared, for checking against what exists rather than guessing
  "src/styles/base/tokens.css",
  "src/styles/base/global.css",
  "src/components/ui/portal/primitives.jsx",
  "src/styles/ui/portal/primitives.module.css",
  "src/components/ui/portal/EmptyState.jsx",
  "src/styles/ui/portal/empty-state.module.css",
  "src/components/ui/icons/index.jsx",
  "src/utils/constants.js",
  "src/utils/formatGbp.js"
)

$secret = '(\.env|token|secret|credential|\.pem|\.key)$'
$stage = Join-Path $env:TEMP ("ck-anm-" + [guid]::NewGuid())
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
