$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $ScriptDir
$AudioDir = Join-Path $Root 'server\static\audio'

if (-not (Test-Path $AudioDir)) { throw "Audio directory not found at $AudioDir" }

Write-Host "Deleting generated audio under $AudioDir ..."
Get-ChildItem -Path $AudioDir -Recurse -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "Done."
