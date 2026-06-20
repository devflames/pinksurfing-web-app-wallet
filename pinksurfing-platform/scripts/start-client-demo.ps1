# PinkSurfing — one-command client demo stack
# Starts: Raihan smoke (contracts) + NestJS gateway + Next.js web
#
# Usage (from repo root):
#   npm run demo
#   npm run demo:prod

param(
  [switch]$Production,
  [switch]$SkipSmoke
)

$ErrorActionPreference = "Stop"
$platform = Split-Path $PSScriptRoot -Parent
$scripts = $PSScriptRoot
$backendRoot = if ($env:PINKSURFING_ROOT) { $env:PINKSURFING_ROOT } else { Split-Path $platform -Parent }

Write-Host "`n=== PinkSurfing Client Demo ===" -ForegroundColor Cyan
Write-Host "Platform: $platform"
Write-Host "Backends root: $backendRoot (PS-App-Backend expected here)"

if (-not (Test-Path "$backendRoot\PS-App-Backend")) {
  Write-Warning "PS-App-Backend not found at $backendRoot\PS-App-Backend — smoke stack may fail."
}

if (-not (Test-Path "$platform\.env")) {
  Write-Host "Creating gateway .env from example..."
  Copy-Item "$platform\apps\api\.env.example" "$platform\.env"
}
if (-not (Test-Path "$platform\apps\web\.env.local")) {
  Write-Host "Creating web .env.local from example..."
  Copy-Item "$platform\apps\web\.env.example" "$platform\apps\web\.env.local"
}

$env:PINKSURFING_ROOT = $backendRoot

if (-not $SkipSmoke) {
  Write-Host "`n[1/3] Starting Raihan smoke stack (:6003 / :6161)..."
  & powershell -File "$scripts\start-smoke-services.ps1"
  Start-Sleep -Seconds 12
  Write-Host "Running contract smoke test..."
  node "$scripts\run-contract-smoke-test.js"
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "Smoke test did not pass — contracts may fail. Kill ports 6003/6161 and retry."
  }
} else {
  Write-Host "`n[1/3] Skipped smoke (-SkipSmoke)"
}

Write-Host "`n[2/3] Starting NestJS gateway on :8080..."
Start-Process -FilePath "cmd.exe" `
  -ArgumentList "/c cd /d `"$platform`" && npm run dev:api" `
  -WindowStyle Normal

Start-Sleep -Seconds 5

Write-Host "`n[3/3] Starting Next.js web on :3000..."
if ($Production) {
  Push-Location $platform
  npm run build -w @pinksurfing/web
  if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }
  Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c cd /d `"$platform`" && npm run start -w @pinksurfing/web" `
    -WindowStyle Normal
  Pop-Location
} else {
  Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c cd /d `"$platform`" && npm run dev -w @pinksurfing/web" `
    -WindowStyle Normal
}

Write-Host "`n=== Demo ready ===" -ForegroundColor Green
Write-Host "  Web:     http://localhost:3000"
Write-Host "  Gateway: http://localhost:8080/health"
Write-Host "  Prod URL (when deployed): https://pinksurfing.com/app"
Write-Host "`n  Guide: $platform\..\..\docs\LOCAL_STANDALONE_DEMO.md`n"
