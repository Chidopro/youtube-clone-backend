# Verify Backend Deploy (CORS / Videos)

If the homepage still shows placeholder videos and the console says **"No 'Access-Control-Allow-Origin' header"**, the browser is talking to the backend but the **live Fly.io app is often still running old code** (deploy didn’t run, failed, or used cache).

## 1. Confirm which code is running

In PowerShell, call the API and check response headers:

```powershell
$r = Invoke-WebRequest -Uri "https://screenmerch.fly.dev/api/ping" -Headers @{ Origin = "https://screenmerch.com" } -Method Get -UseBasicParsing
$r.Headers['Access-Control-Allow-Origin']
$r.Headers['X-ScreenMerch-CORS']
$r.Content
```

- If you see **`Access-Control-Allow-Origin`** and **`X-ScreenMerch-CORS: 1`** and **`"cors_fix": "2025-02"`** in the body → this backend has the CORS fix; try a hard refresh (Ctrl+Shift+R) on screenmerch.com.
- If those are **missing** → the app on Fly is still an old build. Force a new deploy (step 2).

## 2. Force a new deploy

**Option A – From your machine (recommended)**

1. Install [flyctl](https://fly.io/docs/hands-on/install-flyctl/) if needed.
2. In a terminal:
   ```bash
   cd backend
   flyctl deploy --remote-only
   ```
   (Use the same Fly app / login you use for screenmerch.)

**Option B – From GitHub**

1. Open the repo (e.g. `Chidopro/youtube-clone-backend`) → **Actions**.
2. Run the **Fly Deploy** workflow on `main` (or push a small commit to `main` to trigger it).
3. Wait until the workflow is green, then wait 1–2 minutes.

## 3. Check Fly

- **Status:** `fly status` (from `backend/`).
- **Logs:** `fly logs` (see if the app starts and handles `/api/videos`).
- In the [Fly dashboard](https://fly.io/dashboard), open the **screenmerch** app and check **Deployments** for the latest deploy time.

## 4. After a new deploy

Run the PowerShell check from step 1 again. Once you see the CORS header and `X-ScreenMerch-CORS`, do a hard refresh on https://screenmerch.com (or test in an incognito window). The video request should then be allowed by CORS.
