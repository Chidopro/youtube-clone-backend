# Set-password email not arriving

If users don’t receive the “Set your ScreenMerch password” email after entering their address on the Set password page, check the following.

## 1. Fly.io secrets

The backend sends the email via [Resend](https://resend.com). It needs:

- **RESEND_API_KEY** – Your Resend API key (from Resend dashboard → API Keys).
- **RESEND_FROM** – Sender address, e.g. `noreply@screenmerch.com`. Must be from a domain you’ve verified in Resend.

Set them on Fly:

```bash
fly secrets set RESEND_API_KEY=re_xxxxx RESEND_FROM=noreply@screenmerch.com -a <your-fly-app-name>
```

Redeploy or restart the app after changing secrets.

## 2. Resend domain verification

In [Resend Dashboard → Domains](https://resend.com/domains), add and verify the domain used in **RESEND_FROM** (e.g. `screenmerch.com`). Until the domain is verified, Resend may reject sends or they may not deliver.

## 3. Fly logs (why the email didn’t send)

After a “Set password” request, check Fly logs. The backend now logs:

- **`request-set-password: email sent to <email>`** – Email was sent successfully.
- **`request-set-password: RESEND_API_KEY not set ...`** – Secret missing; set it in Fly.io.
- **`request-set-password: Resend failed status=... body=...`** – Resend API error (e.g. domain not verified, invalid from address). Use the status and body to fix the issue in Resend.

View logs:

```bash
fly logs -a <your-fly-app-name>
```

Filter for “request-set-password” to see only these lines.

## 4. Spam / inbox

Ask the user to check spam and “Promotions” (Gmail). If logs show “email sent” but they still don’t see it, it’s likely filtering or delivery delay.

## 5. Temporary workaround (no email)

If email can’t be fixed yet, an admin can set a password for the user in Supabase:

1. In Supabase → Table Editor → `users`, find the row for `filialsons@gmail.com`.
2. Generate a bcrypt hash for the new password (e.g. use an online bcrypt tool or a small script).
3. Set `password_hash` to that hash and save.

The user can then sign in with that password. Prefer fixing Resend so “Set password” emails work for everyone.
