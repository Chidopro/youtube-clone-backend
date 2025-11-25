# Backup Script Before Netlify Deployment
# This script creates a backup of the current state before deployment

Write-Host "Creating backup before deployment..." -ForegroundColor Yellow

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$backupDir = "backup-files/pre-deploy-backup-$timestamp"

# Create backup directory
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

Write-Host "Backing up frontend files..." -ForegroundColor Cyan

# Backup frontend source files
$frontendFiles = @(
    "frontend/src/Pages/Profile/Profile.jsx",
    "frontend/src/Pages/Profile/Profile.css",
    "frontend/src/Pages/Dashboard/Dashboard.jsx",
    "frontend/src/Pages/ProductPage/ProductPage.jsx",
    "frontend/dist"
)

foreach ($file in $frontendFiles) {
    if (Test-Path $file) {
        $destPath = Join-Path $backupDir $file
        $destDir = Split-Path $destPath -Parent
        New-Item -ItemType Directory -Force -Path $destDir | Out-Null
        Copy-Item -Path $file -Destination $destPath -Recurse -Force
        Write-Host "  [OK] Backed up: $file" -ForegroundColor Green
    }
}

# Backup database setup file
if (Test-Path "database_favorites_setup.sql") {
    Copy-Item -Path "database_favorites_setup.sql" -Destination "$backupDir/database_favorites_setup.sql" -Force
    Write-Host "  [OK] Backed up: database_favorites_setup.sql" -ForegroundColor Green
}

# Create a manifest file
$manifest = @{
    timestamp = $timestamp
    date = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    description = "Pre-deployment backup for Favorites feature"
    files = $frontendFiles
} | ConvertTo-Json -Depth 10

$manifest | Out-File "$backupDir/manifest.json" -Encoding UTF8

Write-Host "`nBackup completed successfully!" -ForegroundColor Green
Write-Host "Backup location: $backupDir" -ForegroundColor Cyan
Write-Host "`nTo restore this backup, run: .\restore_from_backup.ps1 -BackupDir '$backupDir'" -ForegroundColor Yellow

# Also create a git commit for easy rollback
Write-Host "`nCreating git commit for easy rollback..." -ForegroundColor Cyan
git add frontend/src/Pages/Profile/Profile.jsx frontend/src/Pages/Profile/Profile.css frontend/src/Pages/Dashboard/Dashboard.jsx frontend/src/Pages/ProductPage/ProductPage.jsx database_favorites_setup.sql
git commit -m "Pre-deployment backup: Favorites feature - $timestamp" 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK] Git commit created successfully" -ForegroundColor Green
    Write-Host "  To rollback: git reset --hard HEAD~1" -ForegroundColor Yellow
} else {
    Write-Host "  [WARNING] Git commit failed (this is okay if files are already committed)" -ForegroundColor Yellow
}

Write-Host "`n[SUCCESS] Backup process complete! Safe to deploy." -ForegroundColor Green

