#!/usr/bin/env pwsh
# Script to create a teacher account in SpellWise (Interactive)
# Usage: 
#   Development: .\scripts\create-teacher.ps1
#   Docker:      .\scripts\create-teacher.ps1 -Docker

param(
    [Parameter()]
    [switch]$Docker
)

if ($Docker) {
    Write-Host "🐳 Creating teacher in Docker container..." -ForegroundColor Cyan
    Write-Host ""
    docker-compose exec app node server/dist/scripts/create-teacher.js
} else {
    Write-Host "💻 Creating teacher in local environment..." -ForegroundColor Cyan
    Write-Host ""
    Push-Location "$PSScriptRoot\..\server"
    npm run create-teacher
    Pop-Location
}
