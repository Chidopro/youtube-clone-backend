# Deploy Flask backend to screenmerch.fly.dev

Right now `https://screenmerch.fly.dev` is serving the **frontend** (HTML/JS), not the Flask API. That’s why `/api/version` and `/api/auth/login` don’t work as expected.

Deploy the **backend** from this folder so the same host serves the API:

## 1. Install Fly CLI (if needed)

- https://fly.io/docs/harbor/install-flyctl/

## 2. Log in and deploy

From this directory (`backend/`):

```powershell
cd "C:\Users\suppo\Desktop\youtube-clone - Copy (5)\backend"
fly auth login
fly deploy -a screenmerch
```

Use the Fly app name **screenmerch** so the URL stays `https://screenmerch.fly.dev`.

## 3. Check that the API is live

In PowerShell:

```powershell
(Invoke-WebRequest -Uri "https://screenmerch.fly.dev/api/version" -UseBasicParsing).Content
```

You should see JSON like:

```json
{"version":"cors-google-login-v1","message":"If you see cors-google-login-v1, ..."}
```

If you still see HTML, the deploy didn’t update the app or you’re not logged into the right Fly account/org.

## 4. GitHub Actions

The repo’s workflow deploys from `backend/` with `working-directory: backend`. It will only deploy this Flask backend if:

- The remote that receives your push is the one connected to Fly (e.g. `Chidopro/youtube-clone-backend`).
- That repo’s `backend/Dockerfile` is the Flask one (e.g. `CMD ["python", "app.py"]`).

If your “youtube-clone - Copy (5)” project pushes to a different remote, run `fly deploy -a screenmerch` from `backend/` after pushing so the correct backend is live.
