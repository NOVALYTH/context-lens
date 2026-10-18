# check-workspace.ps1 - PowerShell entry point; the logic lives in check-workspace.mjs (Node 22.5+).
# Usage: powershell -File scripts/check-workspace.ps1 [-Root <dir>] [-Budget 8000]   Exit code: 0 = OK, 1 = error(s)
param([string]$Root = '.', [int]$Budget = 8000)
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'node not found (Node 22.5 or later required)' }
& node (Join-Path $PSScriptRoot 'check-workspace.mjs') --root $Root --budget $Budget
exit $LASTEXITCODE
