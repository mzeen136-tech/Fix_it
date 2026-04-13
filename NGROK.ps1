# SnapFix — ngrok Tunnel
# Run this in a SECOND terminal while dev server is running

Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "   SNAPFIX — ngrok Tunnel              " -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "Starting ngrok tunnel to localhost:3000..." -ForegroundColor Yellow
Write-Host ""
Write-Host "When ngrok starts, copy the Forwarding URL (https://xxxx.ngrok-free.app)" -ForegroundColor Cyan
Write-Host "and paste it into Meta Developer Console as your Webhook Callback URL:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Callback URL:  https://xxxx.ngrok-free.app/api/whatsapp" -ForegroundColor White
Write-Host "  Verify Token:  Fixit_Zain" -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

npx ngrok http 3000
