# Start Matt wallet backend (Node :3099 + Python KeyVault sidecar :5002)
# Usage: powershell -File scripts/start-wallet-backend.ps1

$ErrorActionPreference = "Stop"
$Root = if ($env:PINKSURFING_ROOT) { $env:PINKSURFING_ROOT } else { "C:\CodeBase" }
$Wallet = Join-Path $Root "ps-wallet-backend-matt-created"
$PythonDir = Join-Path $Wallet "python"
$LogDir = Join-Path $Root "scripts\.stack-logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

Write-Host "=== Matt wallet backend ===" -ForegroundColor Cyan
Write-Host "Wallet repo: $Wallet"

if (-not (Test-Path $Wallet)) {
  Write-Error "Missing $Wallet"
}

# Load .env if present
$envFile = Join-Path $Wallet ".env"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
      $name = $matches[1].Trim()
      $value = $matches[2].Trim()
      [System.Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
  }
}

function Stop-PortListener {
  param([int]$Port)
  Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}

foreach ($p in @(3099, 5002)) { Stop-PortListener $p }
Start-Sleep -Seconds 1

# Node dependencies
if (-not (Test-Path (Join-Path $Wallet "node_modules\better-sqlite3"))) {
  Write-Host "[1/3] npm install (requires Node 20 LTS + C++ build tools on Windows)..." -ForegroundColor Yellow
  Push-Location $Wallet
  npm install
  if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Write-Host "`nInstall failed. Use Node 20 LTS and Visual Studio Build Tools (Desktop C++)." -ForegroundColor Red
    Write-Host "  https://nodejs.org/en/download" -ForegroundColor DarkGray
    exit 1
  }
  Pop-Location
} else {
  Write-Host "[1/3] node_modules OK" -ForegroundColor Green
}

# Python sidecar
Write-Host "[2/3] Starting Python KeyVault sidecar on :5002..." -ForegroundColor Yellow
$pyLog = Join-Path $LogDir "wallet-keyvault-py.log"
Start-Process -FilePath "python" `
  -ArgumentList "-m", "ps_keyvault.api" `
  -WorkingDirectory $PythonDir `
  -RedirectStandardOutput $pyLog `
  -RedirectStandardError $pyLog `
  -WindowStyle Hidden
Start-Sleep -Seconds 4

# Node wallet API
Write-Host "[3/3] Starting Node wallet API on :3099..." -ForegroundColor Yellow
$nodeLog = Join-Path $LogDir "wallet-node.log"
Start-Process -FilePath "node" `
  -ArgumentList "src/index.js" `
  -WorkingDirectory $Wallet `
  -RedirectStandardOutput $nodeLog `
  -RedirectStandardError $nodeLog `
  -WindowStyle Hidden
Start-Sleep -Seconds 4

Write-Host "`nVerify:" -ForegroundColor Green
Write-Host "  curl http://127.0.0.1:3099/"
Write-Host "  curl http://127.0.0.1:3099/keyvault/health"
Write-Host "  Logs: $LogDir"
Write-Host ""

try {
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:3099/keyvault/health" -TimeoutSec 8
  if ($health.python.success) {
    Write-Host "KeyVault sidecar: healthy" -ForegroundColor Green
  } else {
    Write-Host "KeyVault sidecar: Node up, Python unhealthy - check $pyLog" -ForegroundColor Yellow
  }
} catch {
  Write-Host "Wallet not responding yet - check $nodeLog" -ForegroundColor Yellow
}
