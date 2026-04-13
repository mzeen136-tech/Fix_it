# SnapFix Setup & Start Script
# Double-click this file or run it in PowerShell to set up and launch SnapFix

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   SNAPFIX — Setup & Start             " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Make sure we're in the right folder
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir
Write-Host "Working in: $scriptDir" -ForegroundColor Gray

# Step 2: Check Node.js is installed
Write-Host ""
Write-Host "[1/4] Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "      Node.js $nodeVersion found" -ForegroundColor Green
} catch {
    Write-Host "      ERROR: Node.js not found. Install from https://nodejs.org" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Step 3: Clean install node_modules (fixes SWC/native binding errors)
Write-Host ""
Write-Host "[2/4] Installing dependencies (clean install)..." -ForegroundColor Yellow
Write-Host "      This fixes the SWC native binding error on Windows." -ForegroundColor Gray

if (Test-Path "node_modules") {
    Write-Host "      Removing old node_modules..." -ForegroundColor Gray
    Remove-Item -Recurse -Force "node_modules"
}

if (Test-Path "package-lock.json") {
    Remove-Item -Force "package-lock.json"
}

npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "      ERROR: npm install failed" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "      Dependencies installed" -ForegroundColor Green

# Step 4: Check .env.local exists
Write-Host ""
Write-Host "[3/4] Checking environment..." -ForegroundColor Yellow
if (-not (Test-Path ".env.local")) {
    Write-Host "      ERROR: .env.local not found!" -ForegroundColor Red
    Write-Host "      Copy .env.example to .env.local and fill in your values." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "      .env.local found" -ForegroundColor Green

# Step 5: Start dev server
Write-Host ""
Write-Host "[4/4] Starting SnapFix dev server..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  Local:   http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Webhook: http://localhost:3000/api/whatsapp" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Next: Run setup-ngrok.ps1 in a second terminal to get a public URL." -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

npm run dev
