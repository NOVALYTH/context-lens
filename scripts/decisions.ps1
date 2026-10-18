# decisions.ps1 - PowerShell entry point; the logic lives in decisions.mjs (Node 22.5+).
#   powershell -File scripts/decisions.ps1 "<question>" [-All] [-Full] [-Limit 5] [-File DECISIONS.md]
#   powershell -File scripts/decisions.ps1 -Verify
param(
  [Parameter(Position = 0, ValueFromRemainingArguments = $true)][string[]]$Query,
  [switch]$Verify, [switch]$All, [switch]$Full, [int]$Limit = 5, [string]$File
)
$ErrorActionPreference = 'Stop'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'node not found (Node 22.5 or later required)' }
$env:NODE_NO_WARNINGS = '1'   # node:sqlite is experimental; its warning on stderr would fail Windows PowerShell 5.1
$ErrorActionPreference = 'Continue'
$tool = Join-Path $PSScriptRoot 'decisions.mjs'
$extra = @()
if ($File) { $extra += @('--file', $File) }
if ($Verify) { & node $tool verify @extra; exit $LASTEXITCODE }
if (-not $Query) { throw 'Usage: decisions.ps1 "<question>" [-All] [-Full] [-Limit n] [-File f]  |  decisions.ps1 -Verify' }
$a = @('search', '--limit', "$Limit") + $extra
if ($All) { $a += '--all' }
if ($Full) { $a += '--full' }
$a += ($Query -join ' ')
& node $tool @a
exit $LASTEXITCODE
