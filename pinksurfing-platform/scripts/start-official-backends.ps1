# Start OFFICIAL Raihan + Matt backends (not smoke scripts)
# Usage: powershell -File scripts/start-official-backends.ps1
# Set PINKSURFING_ROOT to parent dir containing PS-App-Backend (default: parent of this repo)

$PlatformRoot = Split-Path $PSScriptRoot -Parent
$Root = if ($env:PINKSURFING_ROOT) { $env:PINKSURFING_ROOT } else { Split-Path $PlatformRoot -Parent }

Write-Host "=== PinkSurfing official backends ===" -ForegroundColor Cyan
Write-Host "Root: $Root"

function Start-OfficialService {
  param($Name, $Dir, $Args)
  if (-not (Test-Path $Dir)) {
    Write-Warning "SKIP $Name — missing $Dir"
    return
  }
  Write-Host "Starting $Name..."
  Start-Process -FilePath "node" -ArgumentList $Args -WorkingDirectory $Dir -WindowStyle Normal
  Start-Sleep -Seconds 2
}

Start-OfficialService "chat :6161" "$Root\PS-App-Backend\chat" @("app.js")
Start-OfficialService "mobileapi :6003" "$Root\PS-App-Backend\mobileapi" @("app.js")
Start-OfficialService "Matt wallet :3099" "$Root\ps-wallet-backend-matt-created" @("src/index.js")

Write-Host "`nVerify:" -ForegroundColor Green
Write-Host "  curl http://127.0.0.1:6003/"
Write-Host "  curl http://127.0.0.1:3099/"
Write-Host "`nThen gateway: cd pinksurfing-platform; npm run start:prod -w @pinksurfing/api"
Write-Host "Then web:     npm run start -w @pinksurfing/web"
Write-Host "Production:   https://pinksurfing.com/app"
