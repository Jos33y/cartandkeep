$ErrorActionPreference = 'Stop'

$dir = (Get-Location).Path
for ($i = 0; $i -lt 4 -and -not (Test-Path (Join-Path $dir 'package.json')); $i++) {
  $dir = Split-Path $dir -Parent
}
if (-not (Test-Path (Join-Path $dir 'package.json'))) { throw 'Run this from inside the Cart & Keep repo.' }
Set-Location $dir

# Everything that calls Claude: the API address, the SDK, a model name, or the key's name. Whole repo, not only
# the portal, because the Sonnet 5 caller is not among the portal's functions.
$claudePattern = 'api\.anthropic\.com|@anthropic-ai/|anthropic-version|claude-(sonnet|haiku|opus|fable|mythos)|ANTHROPIC_API_KEY|new Anthropic\('

# How often things run: schedules and job queues, so a call's cost can be multiplied by how often it happens.
$schedulePattern = 'cron\.schedule|keeper_jobs|net\.http_post'

$skipDirs = '[\\/](node_modules|dist|\.git|archive|\.vite|coverage)[\\/]'
$types = @('*.js', '*.jsx', '*.mjs', '*.cjs', '*.ts', '*.tsx', '*.py', '*.json', '*.toml', '*.yml', '*.yaml', '*.md', '*.ps1', '*.sql')

$stamp = Get-Date -Format 'yyyy-MM-dd-HHmm'
$name = "ck-claude-$stamp"
$stage = Join-Path ([IO.Path]::GetTempPath()) $name
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory $stage | Out-Null

$secret = 'sk-ant-[A-Za-z0-9_-]{10,}|sk_(live|test)_|rk_(live|test)_|whsec_|service_role\s*[:=]\s*[''"]ey|-----BEGIN [A-Z ]*PRIVATE KEY-----|v\^1\.1#i\^1#'
$found = @(); $withheld = @(); $models = @(); $schedules = @()

$all = Get-ChildItem . -Recurse -File -Include $types |
  Where-Object { $_.FullName -notmatch $skipDirs -and $_.Name -notmatch '^\.env' -and $_.Name -notmatch '^package-lock\.json$' -and $_.Name -notmatch '^collect-.*\.ps1$' }

$hits = $all | Where-Object { Select-String -Path $_.FullName -Pattern $claudePattern -Quiet }
$sched = $all | Where-Object { $_.Extension -eq '.sql' -and (Select-String -Path $_.FullName -Pattern $schedulePattern -Quiet) }

# A function folder that calls Claude comes whole, so what feeds the call is there too.
$files = @()
foreach ($h in $hits) {
  $rel = (Resolve-Path -Relative $h.FullName) -replace '^\.[\\/]', ''
  $files += $rel
  if ($rel -match '^supabase[\\/]functions[\\/]([^\\/]+)[\\/]') {
    $fn = Join-Path 'supabase' (Join-Path 'functions' $Matches[1])
    if ($Matches[1] -ne '_shared') {
      $files += Get-ChildItem $fn -Recurse -File | Where-Object { $_.Name -notmatch '^\.env' } |
        ForEach-Object { (Resolve-Path -Relative $_.FullName) -replace '^\.[\\/]', '' }
    }
  }
}
$files += $sched | ForEach-Object { (Resolve-Path -Relative $_.FullName) -replace '^\.[\\/]', '' }
if (Test-Path 'package.json') { $files += 'package.json' }
$files = $files | Sort-Object -Unique

foreach ($f in $files) {
  if (Select-String -Path $f -Pattern $secret -Quiet) { $withheld += $f; continue }
  $dest = Join-Path $stage $f
  New-Item -ItemType Directory (Split-Path $dest -Parent) -Force | Out-Null
  Copy-Item $f $dest
  $found += $f
}

# Which model each file names, line by line, so the Sonnet 5 caller shows in the manifest itself.
foreach ($h in $hits) {
  $rel = (Resolve-Path -Relative $h.FullName) -replace '^\.[\\/]', ''
  Select-String -Path $h.FullName -Pattern 'claude-[a-z0-9.-]+' -AllMatches | ForEach-Object {
    $line = $_.LineNumber
    $_.Matches | ForEach-Object { $models += "  $rel`:$line  $($_.Value)" }
  }
}
foreach ($s in $sched) {
  $rel = (Resolve-Path -Relative $s.FullName) -replace '^\.[\\/]', ''
  Select-String -Path $s.FullName -Pattern 'cron\.schedule\([^)]*\)' -AllMatches | ForEach-Object {
    $schedules += "  $rel`:$($_.LineNumber)  $($_.Line.Trim())"
  }
}

$m = @()
$m += "Cart & Keep, Claude usage collector, $stamp"
$m += ''
$m += "Files that call Claude ($(@($hits).Count))"; $m += $hits | ForEach-Object { "  $((Resolve-Path -Relative $_.FullName) -replace '^\.[\\/]', '')" }
$m += ''
$m += "Model names, by file and line ($($models.Count))"; $m += $models
if (-not ($models -match 'claude-sonnet-5')) {
  $m += ''
  $m += '  No claude-sonnet-5 in this repo. The caller is elsewhere: another repo, a script run on this computer, or a'
  $m += '  tool set up with the same API key.'
}
$m += ''
$m += "Schedules ($($schedules.Count))"; $m += $schedules
$m += ''
$m += "Collected ($($found.Count))"; $m += $found | ForEach-Object { "  $_" }
$m += ''
$m += "Withheld, secret pattern ($($withheld.Count))"; $m += $withheld | ForEach-Object { "  $_" }
$m += ''
$m += 'Edge functions present'
if (Test-Path 'supabase/functions') {
  Get-ChildItem 'supabase/functions' -Directory | ForEach-Object { $m += "  $($_.Name)" }
}
$m += ''
$m | Set-Content (Join-Path $stage 'MANIFEST.txt') -Encoding UTF8

$zip = Join-Path $dir "$name.zip"
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -Force
Remove-Item $stage -Recurse -Force
Write-Host "Done: $zip"
Write-Host "Collected $($found.Count), withheld $($withheld.Count), files calling Claude $(@($hits).Count)"
