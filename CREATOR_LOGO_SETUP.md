# Creator Logo Setup (Subdomain Branding)

For custom logos to work on creator subdomains (e.g. `yourname.screenmerch.com`):

## 1. Supabase bucket (creator-logos)

The app uses an existing **creator-logos** bucket in Supabase Storage. Ensure it is **Public** so logo images load on your site. Uploads go through the backend (service role), so no Storage RLS is required for uploads.

## 2. Backend configuration

- The backend uses **SUPABASE_SERVICE_ROLE_KEY** to upload to `creator-logos`.
- If the bucket is missing, the upload API returns a clear error asking you to create it.

## 3. How it works

- **Personalization** → "Upload from Supabase bucket" sends the file to the backend (`POST /api/upload-creator-logo`).
- The backend uploads to `creator-logos/{user_id}/logo-{timestamp}.{ext}` and returns the public URL.
- After saving settings, the subdomain API returns `custom_logo_url` and the navbar shows your logo.
- If the navbar logo does not update, refresh the page (F5) so the subdomain API is called again.

## 4. Pencil icon (edit logo)

- On the **dashboard**, a pencil icon on the navbar logo links to **Dashboard → Personalization**.
- Use it to change your logo or paste a logo URL, then click **Save Settings**.
