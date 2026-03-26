#!/usr/bin/env pwsh
# Quick command to create a teacher account
# Auto-detects if running in Docker or local dev

# Check if Docker container is running
$dockerRunning = docker-compose ps -q app 2>$null
if ($dockerRunning) {
    Write-Host "🐳 Detected Docker environment" -ForegroundColor Cyan
    docker-compose exec app node server/dist/scripts/create-teacher.js
} else {
    Write-Host "💻 Using local environment" -ForegroundColor Cyan
    Push-Location "$PSScriptRoot\server"
    npm run create-teacher
    Pop-Location
}
