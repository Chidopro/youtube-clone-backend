# Subdomain Setup Checklist

You have two parts to subdomain setup. Both are required for a URL like `filialsons.screenmerch.com` to work.

---

## Get a creator their subdomain ASAP (quick runbook)

Subdomain setup is **not** automated. After a creator enters their desired subdomain in the app, you need to configure it at your host. Use this order:

### Step 1: Confirm the subdomain in the app

- Go to **Admin → User Management** (or the Subdomain / User list).
- Find the creator and note their **Subdomain** value (e.g. `filialsons`). If they haven’t set one yet, you can set it there (e.g. add or edit the subdomain field).
- The app only stores this; it does **not** configure the host or DNS.

### Step 2: Submit this information to your host

Give your host (e.g. Netlify support or your DNS/hosting panel) the following. Replace `SUBDOMAIN` with the actual value (e.g. `filialsons`).

**Domain alias to add:**

| Field   | Value |
|--------|--------|
| **Domain** | `SUBDOMAIN.screenmerch.com` |

Example: `filialsons.screenmerch.com`

**If they need a DNS record (e.g. CNAME) instead of or in addition to the alias:**

| Field   | Value |
|--------|--------|
| **Name / host** | `SUBDOMAIN` (subdomain only, no `.screenmerch.com`) |
| **Target**     | Your Netlify site hostname (e.g. `yoursite.netlify.app` or the same target used for `screenmerch.com`) |

Example: Name = `filialsons`, Target = (your Netlify hostname).

### Step 3: After the host confirms

- Wait for the alias/DNS to be active (Netlify often 1–2 minutes; external DNS 5–15 minutes).
- Test: **https://SUBDOMAIN.screenmerch.com** (use HTTPS).
- Optionally in Admin → User Management, use **Validate** next to the subdomain to confirm it’s reachable.

You can reuse this runbook for each new creator; just replace `SUBDOMAIN` with their value.

---

## 1. In the app (you did this correctly)

- **Admin → User Management** → set **Subdomain** to `filialsons` for the creator.
- This only stores the subdomain in the database. It does **not** configure the web server or DNS.

---

## 2. In Netlify + DNS (required for the URL to load)

Until this is done, `filialsons.screenmerch.com` will 404 or “not found”.

### Netlify: add the subdomain as a domain alias

1. Open **Netlify Dashboard** → your site → **Domain management**.
2. Click **“Add domain alias”** (or “Add custom domain” / “Add domain”).
3. Enter: **`filialsons.screenmerch.com`** (the full subdomain, no `*`).
4. Add / Verify. Netlify will verify and provision SSL.
5. Wait 1–2 minutes for the alias to show as active (green check).

### DNS (if Netlify doesn’t manage screenmerch.com)

If DNS for `screenmerch.com` is at your registrar (e.g. Bluehost, Namecheap):

- Add a **CNAME** (or the record type your host recommends):
  - **Name / host:** `filialsons` (only the subdomain).
  - **Target / value:** the Netlify hostname for your site (e.g. `yoursite.netlify.app` or the value Netlify shows for `screenmerch.com`).
- Save and wait for DNS to propagate (often 5–15 minutes).

If **Netlify DNS** is used for `screenmerch.com`, adding the domain alias in Netlify is often enough; check the Domain management page for any extra DNS steps it shows.

---

## 3. Test

- Use **HTTPS:** `https://filialsons.screenmerch.com` (avoid `http://`; SSL is for the HTTPS hostname).
- The app will read the host, see subdomain `filialsons`, and load that creator’s experience.

---

## Summary

| Step                         | Where        | What you do                                      |
|-----------------------------|-------------|---------------------------------------------------|
| Store subdomain for creator | Admin app  | User Management → Subdomain = `filialsons` ✅     |
| Tell Netlify about the URL  | Netlify     | Domain management → Add domain alias → `filialsons.screenmerch.com` |
| Point subdomain to Netlify  | DNS (if needed) | CNAME `filialsons` → your Netlify site           |

**Quick reference:** Use the **“Get a creator their subdomain ASAP”** section at the top for a copy-paste runbook and the exact info to submit to your host.

You created the subdomain correctly in the app; the 404 is from step 2 (and 3 if DNS is external). After adding the alias (and DNS if needed), `filialsons.screenmerch.com` should load.
