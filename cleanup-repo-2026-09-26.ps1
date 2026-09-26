# Repo cleanup. Dry run by default: it prints what it would remove. Run again with -Apply to do it.
# Run from the repo root:  powershell -ExecutionPolicy Bypass -File cleanup-repo-2026-09-26.ps1 [-Apply]
# Everything removed that git tracks stays in git history; `git checkout <commit>~1 -- <path>` brings any of it back.
param([switch]$Apply)

if (-not (Test-Path 'package.json')) { Write-Host 'Run this from the repo root.'; exit 1 }

# Tier 1: one-off or superseded, nothing reads them, all regenerable or in git history.
$remove = @(
  # Collector zips, the tree dump and finished cleanup scripts at the root
  'ck-daily-pull-2026-09-26.zip', 'ck-department-2026-09-26.zip', 'ck-foundation-2026-09-26.zip',
  'ck-product-seo-2026-09-26.zip', 'ck-quickview-2026-09-26.zip', 'cartandkeep.txt',
  'cleanup-session-2026-09-26.ps1', 'cleanup-phase3-2026-09-26.ps1',
  # Per-session collectors: each was written for one conversation and is regenerated when needed
  'tools/collectors', 'docs/ps',
  # Tree dumps
  'scripts/ck_scripts_tree.txt', 'supabase/ck_supabase_tree',
  # CJ is dead: its token (a secret at the repo root) and its notes
  '.cj-token.json', 'docs/cj-api-notes.md',
  # The zip of a folder that sits unzipped beside it
  'docs/cld_designs/Design-review-process.zip',
  # One-off checks from July and test tidy-ups already run
  'supabase/queries',
  # Old query sets, replaced by the current ones
  'research/queries/old',
  # The older of two copies of the same audit, and the earlier legal pack
  'docs/catalogueaudit.md', 'docs/Cart and Keep legal pages review pack 2026-09-24.docx',
  # Superseded plans and prompts
  'docs/week-plan-2026-08-17.md', 'docs/cart-store/next-session-prompt.md'
)

# Local runtime data: never belongs in git. Added to .gitignore; the files stay on this machine.
$ignore = @('.browser/', '.gate/', 'backups/', 'research/archive/backups/', '.cj-token.json', '*.zip', 'dist/')

$gone = 0
foreach ($p in $remove) {
  if (-not (Test-Path -LiteralPath $p)) { Write-Host "  already gone  $p"; continue }
  if (-not $Apply) { Write-Host "  would remove  $p"; continue }
  # Tracked files go through git so the removal is staged; anything untracked is plain deleted.
  git rm -r -q --ignore-unmatch -- "$p" 2>$null | Out-Null
  if (Test-Path -LiteralPath $p) { Remove-Item -LiteralPath $p -Recurse -Force }
  Write-Host "  removed       $p"; $gone++
}

$gi = if (Test-Path '.gitignore') { Get-Content '.gitignore' } else { @() }
$add = $ignore | Where-Object { $gi -notcontains $_ }
if ($add) {
  if ($Apply) { Add-Content '.gitignore' ("`n# Local runtime data`n" + ($add -join "`n")); Write-Host "  .gitignore += $($add -join ', ')" }
  else { Write-Host "  would add to .gitignore: $($add -join ', ')" }
}

# Anything now ignored but still tracked leaves the index only; the files stay on disk.
if ($Apply) {
  foreach ($d in @('.browser', '.gate', 'backups', 'research/archive/backups')) {
    if (git ls-files -- $d) { git rm -r -q --cached -- $d | Out-Null; Write-Host "  untracked     $d (kept on disk)" }
  }
}

Write-Host ''
if ($Apply) { Write-Host "Done. Removed $gone. Now: npm run build, then commit." } else { Write-Host 'Dry run only. Nothing changed. Re-run with -Apply.' }
