# Deploy ScreenMerch backend (Fly.io) and optionally trigger frontend (Netlify via git push)
# Run from repo root. Ensure flyctl is logged in: flyctl auth login

param(
    [switch]$Backend,
    [switch]$FrontendOnly,
    [switch]$All
)

$ErrorActionPreference = "Stop"
$backendDir = Join-Path $PSScriptRoot "backend"

if ($All -or $Backend -or (-not $FrontendOnly)) {
    Write-Host "Deploying backend to Fly.io (screenmerch.fly.dev)..." -ForegroundColor Cyan
    Push-Location $backendDir
    try {
        flyctl deploy --remote-only
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Remote build failed, trying local build..." -ForegroundColor Yellow
            flyctl deploy
        }
        Write-Host "Backend deploy finished." -ForegroundColor Green
    } finally {
        Pop-Location
    }
}

if ($FrontendOnly) {
    Write-Host "Frontend: push to main to trigger Netlify, or run: cd frontend; netlify deploy --prod" -ForegroundColor Cyan
    exit 0
}

if ($All -or (-not $Backend)) {
    Write-Host "`nFrontend (Netlify):" -ForegroundColor Cyan
    Write-Host "  Option A: git add -A && git commit -m 'Deploy' && git push origin main" -ForegroundColor White
    Write-Host "  Option B: cd frontend && npm run build && netlify deploy --prod" -ForegroundColor White
}
