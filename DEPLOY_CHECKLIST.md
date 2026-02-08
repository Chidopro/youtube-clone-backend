# Deploy Checklist

**Important:** Manual deploys often pick up old builds or cached artifacts and the app can revert to a broken state. Prefer automated deploys from Git.

---

## Preferred: Deploy from Git (no manual deploy)

- **Backend (Fly):** Push to `main` → GitHub Actions runs "Fly Deploy" and deploys the exact code from that commit. Do not run `fly deploy` locally unless necessary.
- **Frontend (Netlify):** If Netlify is connected to this repo, push to `main` and let Netlify build and deploy from the latest commit. Do not upload an old `dist/` or run a manual deploy from an old folder.

This keeps the live app in sync with the repo and avoids old/cached builds.

---

## If you must deploy manually

1. **Use the latest code only**
   - `git pull origin main` (or ensure your branch is up to date with main).
   - Do not deploy from an old copy of the repo or an old backup.

2. **Frontend**
   - `cd frontend` then `npm run build`.
   - Deploy the **new** `frontend/dist/` that was just built in this repo—never an old backup or a different machine’s dist.

3. **Backend**
   - `cd backend` then `fly deploy`.
   - Ensure `backend/` is the same as the latest `main` (e.g. you just pulled).

4. **If the app breaks after a manual deploy**
   - The live site is likely serving an old frontend or old backend. Push a small commit to `main` (e.g. empty commit or doc change) so CI/CD redeploys from the current repo and overwrites the bad manual deploy.
