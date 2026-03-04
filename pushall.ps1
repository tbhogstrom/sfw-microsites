#!/usr/bin/env pwsh
# Push current branch to both origin and upstream
param([string]$Branch = "")

if ($Branch -eq "") {
    $Branch = git rev-parse --abbrev-ref HEAD
}

Write-Host "Pushing $Branch to origin..." -ForegroundColor Cyan
git push origin $Branch

Write-Host "Pushing $Branch to upstream..." -ForegroundColor Cyan
git push upstream $Branch
