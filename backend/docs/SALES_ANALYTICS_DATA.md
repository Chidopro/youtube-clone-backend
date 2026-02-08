# Sales analytics – why data might show zero and how to protect it

## Where the data lives

- **Persistent:** Supabase `sales` table. Rows are keyed by **`user_id`** (creator’s UUID). This is the source of truth for analytics.
- **In-memory:** Backend `order_store` (dict). Used for recent orders before they’re written to `sales`. **Cleared on every Fly.io restart**, so it is not reliable for history.

The dashboard calls `GET /api/analytics?user_id=<creator_id>`. The backend reads from `order_store` and from the `sales` table filtered by that `user_id`.

## How sales are separated per creator (one project, one table)

- **All sales live in one Supabase project** (e.g. Chidopro’s Project) and **one table** (`sales`). You do **not** create a separate project or table per creator.
- **Separation is by the `user_id` column:** each row has `user_id` = the creator’s UUID (from the `users` table). There is also a **`creator_name`** column for display.
- To see “which sales are for which creator” in Supabase:
  1. **Table Editor → `sales`** – make sure the **`user_id`** (and optionally **`creator_name`**) columns are visible. If they’re off-screen, scroll right or use the column picker.
  2. **Filter by creator:** filter `sales` where `user_id` = `<that creator’s UUID>`. Get the UUID from **Table Editor → `users`** (e.g. by subdomain or email).
  3. **Optional:** In SQL Editor you can run a query that joins `sales` to `users` so you see creator email/display_name next to each sale.
- The app already records **`user_id`** and **`creator_name`** on every sale (from subdomain or creator name at checkout), so with multiple creators you always decipher by **`user_id`** (and optionally `creator_name`).

## Why a creator might see “reset” (all zeros)

1. **Sales were deleted**
   - The only code path that deletes sales is **POST /api/admin/reset-sales** (master admin only). It deletes all rows in `sales` for the given `user_id`.
   - If someone with master admin access ran “Reset sales” for that creator (from Admin → User Management or, before the safeguard, from the creator’s Dashboard), the data would be gone.

2. **Wrong creator / wrong user_id**
   - If the logged-in user on that subdomain (e.g. testcreator) doesn’t match the `user_id` that was used when recording sales, the dashboard will show zero. For example:
     - Subdomain or login was changed so the same URL now resolves to a different creator.
     - Sales were recorded with a different `user_id` (e.g. bug or different account).

3. **Sales never written**
   - If `record_sale()` failed or wasn’t called for those orders (e.g. bug, or orders from before sales were persisted), there would be no rows for that creator.

4. **Fly restarts**
   - Only affect `order_store`. If sales were correctly written to the `sales` table, restarts do **not** remove them.

## How to verify in Supabase

1. Open **Supabase** → **Table Editor** → **sales**.
2. Find the creator’s **user_id** (e.g. from **users** table: filter by subdomain `testcreator` or by email for Cheedo V).
3. In **sales**, filter by **user_id** = that UUID.
   - If rows exist: the problem is likely frontend/backend using a different `user_id` (e.g. wrong user logged in or wrong subdomain mapping).
   - If no rows exist: data was either never recorded or was deleted (e.g. via reset-sales).

## Safeguard added

- The **“Reset Sales”** button on the **creator Dashboard** is now shown only when the logged-in user is a **master admin**. Normal creators no longer see it, so they can’t trigger a reset from their own dashboard.
- Resetting sales for a specific creator should be done only from **Admin** → **User Management** → that creator → Reset sales, with full context and care.

## Restoring data

- There is no automatic backup/restore of the `sales` table in this repo. If rows were deleted, they can only be restored from your own backups (e.g. Supabase point-in-time recovery, or any DB backup you have). Consider enabling Supabase PITR or regular backups if creator sales data is critical.
