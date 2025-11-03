$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $ScriptDir
$ServerDir = Join-Path $Root 'server'

if (-not (Test-Path $ServerDir)) { throw "Server directory not found at $ServerDir" }

Push-Location $ServerDir
try {
  if (-not (Test-Path 'node_modules')) {
    Write-Warning "server/node_modules not found. Run 'npm install' in $ServerDir first."
  }
  Write-Host "Seeding demo data..."
  npm run seed
} finally {
  Pop-Location
}
