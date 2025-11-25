# Deployment Rollback Guide

This guide explains how to safely deploy and rollback the Favorites feature.

## Pre-Deployment Backup

Before deploying to Netlify, run the backup script:

```powershell
.\backup_before_deploy.ps1
```

This will:
- Create a timestamped backup in `backup-files/`
- Backup all modified frontend files
- Create a git commit for easy rollback
- Generate a manifest file with backup details

## Deployment Steps

1. **Create Backup**
   ```powershell
   .\backup_before_deploy.ps1
   ```

2. **Deploy to Netlify**
   - Push to your repository, or
   - Use Netlify CLI: `netlify deploy --prod`

3. **Test the deployment**
   - Verify Favorites tab appears on Profile pages
   - Test uploading favorites from Dashboard
   - Test "Make Merch" button on favorites

## Rollback Options

### Option 1: Restore from Backup (Recommended)

If you need to rollback, use the restore script:

```powershell
.\restore_from_backup.ps1 -BackupDir "backup-files/pre-deploy-backup-YYYY-MM-DD_HH-mm-ss"
```

Replace `YYYY-MM-DD_HH-mm-ss` with the actual timestamp from your backup folder.

### Option 2: Git Rollback

If you used git commit, you can rollback with:

```powershell
# View recent commits
git log --oneline -5

# Rollback to previous commit (removes the pre-deployment commit)
git reset --hard HEAD~1

# Or rollback to a specific commit
git reset --hard <commit-hash>
```

### Option 3: Manual File Restore

1. Navigate to `backup-files/pre-deploy-backup-[timestamp]/`
2. Copy the files back to their original locations:
   - `frontend/src/Pages/Profile/Profile.jsx`
   - `frontend/src/Pages/Profile/Profile.css`
   - `frontend/src/Pages/Dashboard/Dashboard.jsx`
   - `frontend/src/Pages/ProductPage/ProductPage.jsx`
3. Rebuild frontend: `cd frontend; npm run build`
4. Redeploy to Netlify

## Quick Rollback Checklist

- [ ] Stop any active deployments
- [ ] Run restore script or git rollback
- [ ] Rebuild frontend (`npm run build` in frontend directory)
- [ ] Test locally to verify rollback worked
- [ ] Redeploy to Netlify
- [ ] Verify production site is working

## Database Rollback

If you need to rollback the database changes:

1. Go to Supabase SQL Editor
2. Run this to drop the table (WARNING: This will delete all favorites data):
   ```sql
   DROP TABLE IF EXISTS creator_favorites CASCADE;
   ```

## Emergency Contacts

If you encounter issues:
1. Check Netlify deployment logs
2. Check browser console for errors
3. Verify Supabase database connection
4. Check that all files were deployed correctly

## Backup Locations

All backups are stored in:
- `backup-files/pre-deploy-backup-[timestamp]/`
- Git commits (if using git)

## Notes

- The backup script automatically creates a git commit
- Backups include the built `dist` folder
- Database setup SQL is also backed up
- Each backup has a manifest.json with details

