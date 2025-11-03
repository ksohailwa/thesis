$ErrorActionPreference = 'Stop'

# Resolve repo root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $ScriptDir

$envExample = Join-Path $Root ".env.example"
if (-not (Test-Path $envExample)) {
  throw ".env.example not found at $envExample"
}

# 1) Ensure root .env exists (server reads from repo root)
$rootEnv = Join-Path $Root ".env"
if (-not (Test-Path $rootEnv)) {
  Copy-Item -Path $envExample -Destination $rootEnv -Force
  Write-Host "Created $($rootEnv) from .env.example"
} else {
  Write-Host "Root .env already exists (skipping)."
}

# 2) Ensure client/.env contains VITE_* keys
$clientDir = Join-Path $Root "client"
$clientEnv = Join-Path $clientDir ".env"
$viteLines = Get-Content $envExample | Where-Object { $_ -match '^\s*VITE_' }
if (-not $viteLines -or $viteLines.Count -eq 0) {
  $viteLines = @(
    'VITE_API_BASE_URL=http://localhost:4000',
    'VITE_I18N_DEFAULT_LANG=en'
  )
}

if (-not (Test-Path $clientEnv)) {
  if (-not (Test-Path $clientDir)) { throw "Client directory not found at $clientDir" }
  Set-Content -Path $clientEnv -Value ($viteLines -join [Environment]::NewLine)
  Write-Host "Created $($clientEnv) with VITE_* keys"
} else {
  Write-Host "Client .env already exists (skipping)."
}

Write-Host "Environment setup complete."
