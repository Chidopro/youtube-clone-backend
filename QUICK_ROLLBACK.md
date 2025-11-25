# Quick Rollback Reference

## Before Deploying
```powershell
.\backup_before_deploy.ps1
```

## If Something Goes Wrong

### Fastest Rollback (Git)
```powershell
git reset --hard HEAD~1
cd frontend
npm run build
# Then redeploy to Netlify
```

### Restore from Backup
```powershell
# List available backups
Get-ChildItem backup-files\pre-deploy-backup-*

# Restore (replace with actual backup folder name)
.\restore_from_backup.ps1 -BackupDir "backup-files\pre-deploy-backup-2025-11-24_12-30-00"
```

### Manual Quick Fix
1. Delete these files/features:
   - Remove Favorites tab from Profile.jsx
   - Remove Favorites tab from Dashboard.jsx
   - Revert Profile.css changes
2. Rebuild: `cd frontend; npm run build`
3. Redeploy

## Current Backup Location
Check: `backup-files\pre-deploy-backup-[timestamp]\`

## Git Commit Hash for Rollback
Current HEAD: `74f227c24`
To rollback to this: `git reset --hard 74f227c24`

