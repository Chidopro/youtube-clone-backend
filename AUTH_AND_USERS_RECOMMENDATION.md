# Auth & Users: Recommendation for ScreenMerch

## 1. Support both Google OAuth and email for creators and customers

**Recommendation: Yes — support both.**

- **Creators:** Can sign up / log in with **Google** or **email+password**. Same abilities: dashboard, subdomain setup, profile.
- **Customers:** Can sign up / log in with **Google** or **email** (or email+password if you add it). Same ability: make purchases.
- **One account per person:** If the same email is used for Google and for email login, treat it as the same user (one row in `users`, one set of abilities).

Your codebase already has:
- Email signup/login: `auth_signup`, `auth_login` in `backend/routes/auth.py` (writes/reads `users` table).
- Google OAuth: `google_callback` in `backend/routes/auth.py` (looks up by email, creates row if new).
- Email-only signup: `auth_signup_email_only` for customers.

So you can keep and use **both** Google and email for creators and customers; no need to remove one.

---

## 2. Desired abilities (summary)

| Role      | Login methods        | Abilities |
|----------|----------------------|-----------|
| Customer | Email, (optional Google) | Make purchases, view orders |
| Creator  | Email, Google        | Dashboard, set up subdomain, manage store, same as now |

Multiple creators and multiple customers are supported as long as every real user has **exactly one row** in the `users` table and the app uses that row for permissions (role, status, subdomain).

---

## 3. Why you see “No profile found in database” (Supabase row)

The frontend loads the current user’s profile by calling **Supabase** with the user `id` from your backend (e.g. from login response / cookie / localStorage). The warning means one of:

1. **No row for that `id`**  
   The `id` (e.g. `181e8481-9f14-46e3-a821-16d53e1e6f90`) doesn’t exist in the Supabase `users` table. That can happen if:
   - The user was created only in backend session/cookie but the insert into Supabase `users` failed (e.g. RLS, duplicate, missing column).
   - The `id` in the browser is from an old flow (e.g. Google) and doesn’t match the row you create with email signup (different id).
2. **RLS (Row Level Security)**  
   If RLS on `users` only allows `auth.uid() = id` and the frontend uses the **anon** key (no Supabase Auth session), then `auth.uid()` is null and the frontend can’t read any row.  
   Your `database_setup.sql` also has a policy **"Public can view basic user info"** with `USING (true)`, which would allow reads. If that policy is active, then “no row” is due to (1), not RLS.

So to support the desired outcome you need:
- Every login path (Google and email) to **create or update a row** in the Supabase `users` table and return that same `id` to the frontend.
- Frontend to use that `id` for profile fetch; and either RLS allows that read (e.g. public read policy) or you serve profile from the backend instead.

---

## 4. What to do so the system supports the desired outcome

### A. One row per person in Supabase `users` (single source of truth)

- **Email signup**  
  Already creates a row in `users` (e.g. `backend/routes/auth.py` `auth_signup`). Ensure the response includes `user.id` and the frontend stores it (e.g. localStorage / session).
- **Email login**  
  Already looks up by email and returns that row (including `id`). No change needed except to ensure the frontend always uses this `id` for profile fetch.
- **Google OAuth**  
  Already looks up by email; if found, updates and returns that row; if not found, inserts a new row and returns it. So:
  - Same email for Google and email → same row (by email), same `id`, same abilities.
  - Ensure the backend **always** returns the same `user` object (with `id`, `email`, `role`, `status`, `subdomain`, etc.) so the frontend doesn’t keep an old/different `id`.

So: support both Google and email; the only requirement is that **every successful login (Google or email) results in one row in `users` and the frontend uses that row’s `id` for profile**.

### B. Ensure the row exists and frontend can read it

1. **Backend**
   - After **email signup**: you already insert into `users`. If you use Supabase for that insert, ensure RLS allows the backend (e.g. service role or a role that can insert). Same for **Google** first-time sign-in (insert).
   - After **email login**: you only read; the row must already exist (created at signup).
   - If you ever create a user only in backend memory/session without writing to Supabase, add a step that **upserts** into `users` (by email or by a stable id) so the row exists.

2. **Supabase RLS**
   - If the frontend fetches profile with the **anon** key, RLS must allow that read. Options:
     - Keep a policy that allows SELECT on `users` (e.g. “Public can view basic user info” with `USING (true)`), **or**
     - Remove direct frontend read from `users` and have the frontend call a **backend** endpoint (e.g. `GET /api/users/me` or `GET /api/users/<id>`) that uses the backend’s Supabase client (service role) to read the row and return it. Then RLS doesn’t need to allow anon read.

3. **Linking Google and email**
   - Your Google callback already matches by **email**. So if a user first signs up with email (row created with that email and an `id`), then later logs in with Google with the same email, the backend finds the same row and returns the same `id`. No duplicate row. That’s correct for “one account per person” and supports both login methods.

### C. Creators: subdomain and dashboard

- Creator abilities (dashboard, subdomain) are already driven by `role` and `status` (and optionally `subdomain`) on the `users` row.
- As long as creators get a row with `role = 'creator'` and `status = 'active'` (or your chosen flow), and the frontend gets that row (or the same data from the backend), subdomain setup and dashboard will work for multiple creators.

### D. Customers: purchases

- Same idea: customers have a row with `role = 'customer'` (and appropriate `status`). Orders/purchases are tied to `user_id` (the `users.id`). As long as every customer has one row and the app uses that `id` for orders, you support multiple customers.

---

## 5. Practical checklist

- [ ] **Email signup** creates a row in Supabase `users` and returns `user.id`; frontend stores it.
- [ ] **Email login** returns the existing row (with `id`); frontend uses that `id` for profile fetch.
- [ ] **Google OAuth** looks up by email; if found, return that row (same `id`); if not found, insert and return the new row. No duplicate rows for the same email.
- [ ] **Frontend** uses a single source for “current user id” (e.g. from login response / backend session), not an old value from a different login method.
- [ ] **RLS**: Either allow anon SELECT on `users` (e.g. “Public can view basic user info”) or stop reading profile from Supabase in the frontend and use a backend endpoint that returns the profile for the current user.
- [ ] **Backend** uses a Supabase client with sufficient privilege (e.g. service role) so that signup/OAuth can always insert/update `users` regardless of RLS.

Once every login path (Google and email) creates or updates one row in `users` and the frontend uses that row’s `id` (and RLS or backend allows reading it), you’ll have:
- Both Google and email for creators and customers,
- One row per person,
- All necessary abilities (customer purchases, creator subdomain and dashboard),
- Support for multiple creators and customers.

If you want, next step can be: add a small backend endpoint `GET /api/users/me` (or `/api/users/<id>`) that returns the profile from Supabase and point the frontend profile fetch there so you no longer depend on RLS for anon read on `users`.
