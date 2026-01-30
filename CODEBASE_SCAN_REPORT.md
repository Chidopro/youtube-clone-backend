# Codebase Scan Report – Possible Future Issues

Scan focused on: security, redundancy, imperfections, and incomplete areas. **No UI (mobile/desktop) changes suggested.**

---

## 1. Security

### 1.1 Password-related logging (backend)

**Location:** `backend/app.py` (around lines 6390–6401)

**Issue:** Login logs fragments of passwords and password hashes:

- `Stored password (first 5 chars): ...`, `(last 5 chars): ...`
- `Provided password (first 5 chars): ...`, `(last 5 chars): ...`

**Risk:** Logs may be stored or forwarded; even a few characters can help attackers. In production, avoid logging any password material.

**Recommendation:** Remove or guard these logs (e.g. only when `DEBUG` or a dedicated `LOG_AUTH_DEBUG` is true). Keep at most high-level messages like “login attempt for &lt;email&gt;” and “success/failure”.

---

### 1.2 Stripe API key in error logs (backend)

**Location:** `backend/app.py` (around lines 3921–3922)

**Issue:** On Stripe auth error, the code logs a “preview” of the Stripe secret key (first 20 and last 4 characters) and of the env value.

**Risk:** Key fragments in logs can leak into log aggregation/monitoring and weaken key secrecy.

**Recommendation:** Log only that “Stripe authentication failed” (and maybe error type). Do not log any part of `STRIPE_SECRET_KEY` or `stripe.api_key`.

---

### 1.3 GET /api/users/me – no server-side auth (backend)

**Location:** `backend/app.py` – `get_my_profile()` (GET `/api/users/me`)

**Issue:** The endpoint identifies the user only via the `X-User-Id` header (or `user_id` query). There is no check that the *caller* is actually that user (e.g. session, cookie, or token).

**Risk:** Anyone who knows or guesses a user ID could request that user’s profile (within the safe-fields list). Data is limited but still a privacy/information-disclosure concern.

**Recommendation:** In the medium term, validate the caller (e.g. `sm_session` cookie or token mapped to a user id) and only allow returning the profile for that authenticated user. Keep using the safe-fields list.

---

### 1.4 Supabase anon key in frontend source (frontend)

**Location:** `frontend/src/config/apiConfig.js` – `SUPABASE_ANON_KEY` is hardcoded for dev and production.

**Issue:** The key is committed and duplicated. Supabase anon keys are designed to be public and protected by RLS, but hardcoding makes rotation and per-environment config harder and keeps keys in history.

**Recommendation:** Prefer `import.meta.env.VITE_SUPABASE_ANON_KEY` (and optionally `VITE_SUPABASE_URL`) and set them in env files / build config so they are not in source. Keep `.env*` in `.gitignore` (already done).

---

## 2. Redundancy / structure

### 2.1 Duplicate /api/auth/login (backend)

**Locations:**

- `backend/app.py`: `@app.route("/api/auth/login", ...)` and `auth_login()` (around 6328+).
- `backend/routes/auth.py`: `@auth_bp.route("/api/auth/login", ...)` and `auth_login()`.

**Issue:** Two handlers for the same path. Depending on registration order, one can shadow the other. The version in `app.py` contains the verbose password logging; the blueprint version has less.

**Recommendation:** Keep a single implementation of login (preferably in `routes/auth.py` as part of the auth blueprint) and remove the duplicate from `app.py`. Then all auth behavior and logging live in one place and you can clean up password logging once.

---

### 2.2 Backend URL / API base URL (frontend)

**Issue:** `https://screenmerch.fly.dev` (and sometimes other base URLs) appear in many frontend files (e.g. Login, Dashboard, Admin, ProductPage, subscriptionService, userService, etc.), with slightly different env checks (`VITE_BACKEND_URL`, `REACT_APP_BACKEND_URL`, etc.).

**Risk:** Inconsistent env usage and duplication; harder to change backend URL or add staging environments.

**Recommendation:** Centralize in one place (e.g. `config/apiConfig.js` or a small `apiClient.js`) and have the rest of the app import the base URL from there. Prefer a single env name (e.g. `VITE_BACKEND_URL`) for Vite builds.

---

### 2.3 Backup and legacy files in repo (backend)

**Issue:** Multiple backup/legacy files in the backend (e.g. `app_original_before_cors_fix.py.py`, `app_backup_*.py`, `app_temp.py`, `app_working_backup.py`, etc.). Same idea for frontend `data/products.js.*.bak` and similar.

**Risk:** Confusion about which code runs; larger repo and merge surface; possible accidental use of old behavior or secrets in old files.

**Recommendation:** Move backups and one-off scripts to a separate branch or archive repo, or delete them if no longer needed. Keep the main app and routes in a single clear structure (e.g. `app.py` + `routes/`). Ensure `.gitignore` excludes local backups if you still generate them (e.g. `*.bak`, `*_backup_*`).

---

## 3. Other potential issues

### 3.1 Sensitive data in debug/script files (backend)

**Locations:** Scripts such as `generate_hash.py`, `debug_database_update.py`, `fix_admin_database.py`, `check_supabase_admin.py` that print or log password hashes, tokens, or raw user fields.

**Risk:** If run in production or if output is captured, sensitive data can leak. These are good candidates for “dev-only” or “run once then remove”.

**Recommendation:** Do not run these in production. Prefer one-off migrations or admin tools that don’t log sensitive fields, or remove/archive the scripts once their job is done.

---

### 3.2 PRINTFUL_API_KEY fallback (backend)

**Location:** `backend/app.py` – `PRINTFUL_API_KEY = os.getenv("PRINTFUL_API_KEY") or "dummy_key"` (or similar).

**Issue:** Using a literal fallback when the key is missing can hide misconfiguration and cause confusing API errors (e.g. 401 from Printful).

**Recommendation:** Use `os.getenv("PRINTFUL_API_KEY")` and handle “not set” explicitly (e.g. skip Printful features or return a clear “Printful not configured” to the client). Avoid defaulting to a non-empty string like `"dummy_key"`.

---

### 3.3 Rate limiting (backend)

**Issue:** No evidence of rate limiting on auth or other sensitive endpoints (e.g. `/api/auth/login`, `/api/auth/signup`, `/api/users/me`).

**Risk:** Brute-force attempts on login, signup abuse, or scraping of endpoints.

**Recommendation:** Add rate limiting (e.g. Flask-Limiter or a reverse-proxy limit) for auth and other high-value endpoints. Prefer conservative defaults (e.g. a few attempts per minute per IP for login).

---

### 3.4 .env path logging (backend)

**Location:** `backend/app.py` – `print(f"Loaded .env from: {env_path}")` when loading `.env`.

**Issue:** Logs the path of the loaded `.env` file. In some deployments this can reveal directory layout.

**Recommendation:** Optional: remove or restrict to debug mode. Not critical if your logs are internal.

---

## 4. Summary table

| Area              | Issue                              | Severity (potential) | Suggested action                          |
|-------------------|------------------------------------|----------------------|-------------------------------------------|
| Security          | Password chars in logs             | High                 | Remove or gate behind debug flag          |
| Security          | Stripe key preview in logs         | Medium               | Stop logging key fragments                |
| Security          | /api/users/me no caller auth       | Medium               | Validate session/cookie or token           |
| Security          | Supabase anon key hardcoded        | Low                  | Use env vars for Supabase URL/key         |
| Redundancy        | Duplicate auth login (app vs bp)   | Medium               | Single implementation, remove duplicate   |
| Redundancy        | Backend URL scattered in frontend  | Low                  | Centralize API base URL                   |
| Repo hygiene      | Backup/legacy files in tree        | Low                  | Archive or remove, ignore *.bak           |
| Scripts           | Debug scripts print sensitive data | Medium               | Dev-only; avoid in prod; prune when done  |
| Config            | PRINTFUL fallback "dummy_key"      | Low                  | No literal fallback; handle “unset”       |
| Resilience        | No rate limiting on auth           | Medium               | Add rate limiting on auth/sensitive APIs  |

---

## 5. What was not changed

- No UI (mobile or desktop) changes.
- No removal of features or endpoints in this report; only structural and security improvements are suggested.

Implementing the items above in small steps (e.g. logging first, then /api/users/me auth, then deduplication and centralization) will reduce future security and maintenance issues without affecting current UI.
