# Fix CORS and 502 for screenmerch.com → screenmerch.fly.dev

## What was changed in code

1. **CORS** – `app.py` now sets CORS for all `/api/*` in one place:
   - `_cors_allow_origin()` returns the allowed origin (no dependency on later app code).
   - `_handle_preflight()`: OPTIONS `/api/*` returns 204 with CORS headers.
   - `add_security_headers()` (after_request): every `/api/*` response gets CORS headers.
   - `@app.errorhandler(500)`: 500 responses for `/api/*` also get CORS.

2. **Videos route** – `routes/videos.py` no longer uses `utils.helpers._allow_origin`. It returns plain `jsonify(data), 200`. CORS is added by `app.py`’s `add_security_headers`.

3. **Flask-CORS** – Still configured for `/api/*` with `ALLOWED_ORIGINS_LIST` as a backup; our `after_request` runs and sets headers so screenmerch.com is always allowed.

---

## If you still see 502 or CORS errors

A **502 Bad Gateway** usually means the app on Fly did not respond (crash on startup or while handling the request). Do the following.

### 1. Check Fly secrets (required for app to start)

In [Fly Dashboard](https://fly.io/dashboard) → your app **screenmerch** → **Secrets**, ensure at least:

- `FLASK_SECRET_KEY` – any long random string (e.g. 32+ chars).
- `VITE_SUPABASE_URL` or `SUPABASE_URL` – your Supabase project URL.
- `VITE_SUPABASE_ANON_KEY` or `SUPABASE_ANON_KEY` – Supabase anon key.

If any of these are missing or wrong, the app can crash on startup and Fly will return 502.

### 2. Check Fly logs

In the Fly dashboard: **Logs** (or **Logs & Errors**). Or in a terminal (with [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/) installed):

```bash
fly logs -a screenmerch
```

Look for:

- Python tracebacks (import errors, missing env, Supabase/Flask errors).
- Messages like `[OK] Videos Blueprint registered` (confirms app started and videos route is registered).

### 3. Test after deploy

1. Deploy: push to the branch that triggers Fly deploy (e.g. `main`).
2. Wait for the new release to be live (Fly dashboard or GitHub Actions).
3. Test **ping** (should always work if the app is up):

   **PowerShell:**

   ```powershell
   Invoke-WebRequest -Uri "https://screenmerch.fly.dev/api/ping" -Method GET -Headers @{ "Origin" = "https://screenmerch.com" } -UseBasicParsing | Select-Object StatusCode, @{ N='AllowOrigin'; E={ $_.Headers['Access-Control-Allow-Origin'] } }
   ```

   You want `StatusCode 200` and `AllowOrigin = https://screenmerch.com`.

4. Test **videos**:

   ```powershell
   Invoke-WebRequest -Uri "https://screenmerch.fly.dev/api/videos" -Method GET -Headers @{ "Origin" = "https://screenmerch.com" } -UseBasicParsing | Select-Object StatusCode, @{ N='AllowOrigin'; E={ $_.Headers['Access-Control-Allow-Origin'] } }
   ```

   You want `StatusCode 200` and `AllowOrigin = https://screenmerch.com`.

5. In the browser: open **https://screenmerch.com**, hard refresh (Ctrl+Shift+R) or use an incognito window. Videos should load and the console should show no CORS or 502 errors.

---

## Summary

- **CORS** is fixed in code for `/api/*` (including OPTIONS, GET, and 500).
- **502** is almost always an environment/startup issue on Fly: check secrets and logs.
- After fixing secrets and redeploying, use the steps above to confirm the app is up and CORS is correct.
