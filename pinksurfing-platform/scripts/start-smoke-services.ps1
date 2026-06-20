# Start minimal contract smoke servers (chat contracts + mobileapi proxy)
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
$env:JWT_SECRET = "sso_secret_key_for_jwt_decoding"
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"

$scripts = $PSScriptRoot
if (-not $env:PINKSURFING_ROOT) {
  $platform = Split-Path $scripts -Parent
  $env:PINKSURFING_ROOT = Split-Path $platform -Parent
}

Write-Host "PINKSURFING_ROOT=$env:PINKSURFING_ROOT"

Write-Host "Starting smoke-contract-chat on :6161 ..."
Start-Process -FilePath "node" -ArgumentList "$scripts\smoke-contract-chat.js" -WorkingDirectory $scripts -WindowStyle Hidden -PassThru | Out-Null

Start-Sleep -Seconds 3

Write-Host "Starting smoke-contract-proxy on :6003 ..."
Start-Process -FilePath "node" -ArgumentList "$scripts\smoke-contract-proxy.js" -WorkingDirectory $scripts -WindowStyle Hidden -PassThru | Out-Null

Write-Host "Wait ~15s for MongoDB connection..."
Start-Sleep -Seconds 15

Write-Host "Run: node scripts/run-contract-smoke-test.js"
