Param(
  [switch]$NoInstall
)

$ErrorActionPreference = 'Stop'
Write-Host "Spell Wise • First Run" -ForegroundColor Cyan

Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not $NoInstall) {
  Write-Host "Installing server deps..." -ForegroundColor DarkCyan
  Push-Location server
  npm install --silent
  Pop-Location

  Write-Host "Installing client deps..." -ForegroundColor DarkCyan
  Push-Location client
  npm install --silent
  Pop-Location
}

# Ensure server/.env exists
$serverEnv = Join-Path server '.env'
if (-not (Test-Path $serverEnv)) {
  Write-Host "Creating server/.env with placeholders" -ForegroundColor DarkCyan
  @'
PORT=4000
MONGO_URI=mongodb://localhost:27017/spellwise
JWT_ACCESS_SECRET=replace_me
JWT_REFRESH_SECRET=replace_me_2
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
TTS_PROVIDER=openai
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=nova
APP_BASE_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173
'@ | Set-Content -Path $serverEnv -NoNewline
}

Write-Host "All set!" -ForegroundColor Green
Write-Host "Run scripts/dev.ps1 to start both server and client." -ForegroundColor Green

