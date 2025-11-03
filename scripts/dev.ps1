$ErrorActionPreference = 'Stop'
Write-Host "Spell Wise • Dev" -ForegroundColor Cyan

Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "Starting server (port 4000)..." -ForegroundColor DarkCyan
$server = Start-Process -FilePath npm -ArgumentList 'run','dev' -WorkingDirectory (Join-Path $PWD 'server') -PassThru

Start-Sleep -Seconds 1
Write-Host "Starting client (port 5173)..." -ForegroundColor DarkCyan
$client = Start-Process -FilePath npm -ArgumentList 'run','dev' -WorkingDirectory (Join-Path $PWD 'client') -PassThru

Write-Host "Press Ctrl+C to stop. (Server PID=$($server.Id), Client PID=$($client.Id))" -ForegroundColor Green
Wait-Process -Id @($server.Id, $client.Id) -ErrorAction SilentlyContinue

