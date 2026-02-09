# Creator sign-up and Pending Approval list

## How sign-up is logged and stored for the Master Admin Pending list

1. **User flow**  
   User goes to subscription-tiers → "Start Free" → "Sign Up Now" → enters email → confirms → browser redirects to Google OAuth with `flow=creator_signup` in the state.

2. **Callback**  
   After Google sign-in, Google redirects to the backend at `GET /api/auth/google/callback` (e.g. `https://screenmerch.fly.dev/api/auth/google/callback`). The callback decodes `flow=creator_signup` from the state.

3. **Lookup**  
   Backend looks up the user by email in the `users` table using **supabase_admin** (service role) so RLS does not hide rows.

4. **New user (email not in DB)**  
   - Backend inserts one row into `users` with:
     - `role='creator'`, `status='pending'`
     - `email`, `display_name`, `profile_image_url` (from Google), `created_at`
   - Insert is done with **supabase_admin** so the row is visible to admin APIs.
   - That record is returned by `GET /api/admin/pending-creators` (same admin client, filters `status=pending` and `role=creator`).

5. **Existing user (email already in DB)**  
   - If `flow=creator_signup` and the user has (or is given) role `creator`:
     - If `status` is null/empty → backend updates to `status='pending'` (and ensures `role='creator'`).
     - If `status` is `'active'` but the user was **created in the last 24 hours** → backend updates to `status='pending'` so they still show in Pending Approval (covers users created by another flow/trigger with default active).
   - Already-approved creators (e.g. `status='active'` and created long ago) are left as active.

6. **Admin list**  
   Master Admin opens Admin → Pending Approval (under Payouts). The frontend calls `GET /api/admin/pending-creators` with header `X-User-Email`. Backend uses **supabase_admin** to select `users` where `status='pending'` and `role='creator'`, ordered by `created_at` desc.

## Requirements

- **Backend (Fly):** `SUPABASE_SERVICE_ROLE_KEY` must be set so new creator inserts and the pending-creators query use the admin client. Without it, new sign-ups are not stored and the pending list stays empty.
- **Google OAuth:** `GOOGLE_REDIRECT_URI` must match the callback URL (e.g. `https://screenmerch.fly.dev/api/auth/google/callback`) in the Google Cloud project.

## If sign-ups still don’t appear

- Check Fly logs for `[GOOGLE OAUTH CALLBACK]` and `[OAUTH CREATOR SIGNUP]` to see whether the callback ran and whether an insert or update happened.
- If you see `SUPABASE_SERVICE_ROLE_KEY not set`, set it in Fly secrets and redeploy.
- If the user already existed with `status='active'` and was created more than 24 hours ago, they will not be moved back to pending (by design).
- Frontend should call `POST /api/auth/register-pending-creator` with email when the user submits the sign-up modal (before redirecting to Google) so a pending record exists even if OAuth fails; the callback will then update that record or create it.
