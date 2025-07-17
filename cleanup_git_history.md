# GitHub Repository Cleanup Guide

## Remove .env file from Git History

Your `.env` file containing Mailgun credentials is exposed in your public GitHub repository. Here's how to completely remove it:

### Option 1: Use BFG Repo-Cleaner (Recommended)

1. **Install BFG** (if not already installed):
   ```bash
   # On Windows with Chocolatey
   choco install bfg
   
   # Or download from: https://rtyley.github.io/bfg-repo-cleaner/
   ```

2. **Clone a fresh copy of your repository**:
   ```bash
   git clone --mirror https://github.com/Chidopro/screenmerch.git
   cd screenmerch.git
   ```

3. **Remove the .env file from history**:
   ```bash
   bfg --delete-files .env
   ```

4. **Clean up and push**:
   ```bash
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive
   git push
   ```

### Option 2: Use Git Filter-Branch (Alternative)

```bash
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all
```

### Option 3: Make Repository Private (Quick Fix)

1. Go to your GitHub repository
2. Click "Settings" tab
3. Scroll down to "Danger Zone"
4. Click "Change repository visibility"
5. Select "Make private"
6. Confirm

### Option 4: Create New Repository (Nuclear Option)

1. Create a new private repository
2. Copy all files EXCEPT `.env` and `.git` folder
3. Push to new repository
4. Delete the old public repository

## After Cleanup

1. **Create a new `.env` file locally** (never commit this):
   ```bash
   # Create .env file with new Mailgun credentials
   touch .env
   ```

2. **Add `.env` to `.gitignore`**:
   ```bash
   echo ".env" >> .gitignore
   echo ".env.local" >> .gitignore
   echo ".env.*" >> .gitignore
   ```

3. **Create `.env.example`** (safe to commit):
   ```bash
   # Copy .env to .env.example and remove actual values
   cp .env .env.example
   # Edit .env.example and replace actual values with placeholders
   ```

## Security Best Practices

- **Never commit `.env` files**
- **Use environment variables in production**
- **Regularly rotate API keys**
- **Use secrets management for production**
- **Enable 2FA on all accounts**

## Next Steps

After cleaning up GitHub:
1. Follow Mailgun's security steps
2. Update your application with new credentials
3. Test email functionality
4. Contact Mailgun support to reactivate account 