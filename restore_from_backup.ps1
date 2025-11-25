# Restore Script - Rollback from Backup
# Usage: .\restore_from_backup.ps1 -BackupDir "backup-files/pre-deploy-backup-YYYY-MM-DD_HH-mm-ss"

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupDir
)

if (-not (Test-Path $BackupDir)) {
    Write-Host "Error: Backup directory not found: $BackupDir" -ForegroundColor Red
    exit 1
}

Write-Host "Restoring from backup: $BackupDir" -ForegroundColor Yellow

# Read manifest if it exists
$manifestPath = Join-Path $BackupDir "manifest.json"
if (Test-Path $manifestPath) {
    $manifest = Get-Content $manifestPath | ConvertFrom-Json
    Write-Host "Backup date: $($manifest.date)" -ForegroundColor Cyan
    Write-Host "Description: $($manifest.description)" -ForegroundColor Cyan
}

Write-Host "`nRestoring files..." -ForegroundColor Cyan

# Restore frontend files
$filesToRestore = @(
    "frontend/src/Pages/Profile/Profile.jsx",
    "frontend/src/Pages/Profile/Profile.css",
    "frontend/src/Pages/Dashboard/Dashboard.jsx",
    "frontend/src/Pages/ProductPage/ProductPage.jsx",
    "frontend/dist"
)

foreach ($file in $filesToRestore) {
    $backupPath = Join-Path $BackupDir $file
    if (Test-Path $backupPath) {
        Copy-Item -Path $backupPath -Destination $file -Recurse -Force
        Write-Host "  [OK] Restored: $file" -ForegroundColor Green
    } else {
        Write-Host "  [WARNING] Not found in backup: $file" -ForegroundColor Yellow
    }
}

# Restore database setup file
$dbBackupPath = Join-Path $BackupDir "database_favorites_setup.sql"
if (Test-Path $dbBackupPath) {
    Copy-Item -Path $dbBackupPath -Destination "database_favorites_setup.sql" -Force
    Write-Host "  [OK] Restored: database_favorites_setup.sql" -ForegroundColor Green
}

Write-Host "`n[SUCCESS] Restore completed!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Rebuild frontend: cd frontend; npm run build" -ForegroundColor Cyan
Write-Host "2. Redeploy to Netlify" -ForegroundColor Cyan

