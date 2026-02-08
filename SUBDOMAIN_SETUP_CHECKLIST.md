# Subdomain Setup Checklist

You have two parts to subdomain setup. Both are required for a URL like `filialsons.screenmerch.com` to work.

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

You created the subdomain correctly in the app; the 404 is from step 2 (and 3 if DNS is external). After adding the alias (and DNS if needed), `filialsons.screenmerch.com` should load.
