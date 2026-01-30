# Email to Netlify Support

**Subject:** Domain Alias Becomes Inactive After Deployments - Recurring Issue

---

Hello Netlify Support Team,

I'm experiencing a recurring issue with a domain alias that keeps becoming inactive or returning 404 errors after deployments.

**Site Details:**
- Site Name: eloquent-crumble-37c09e
- Primary Domain: screenmerch.com
- Problematic Domain Alias: testcreator.screenmerch.com

**Issue Description:**
The domain alias `testcreator.screenmerch.com` works correctly initially, but after deployments, it starts returning 404 errors. This has happened twice now. The domain shows as "Active" in the Netlify dashboard, but visitors receive 404 errors when accessing the subdomain.

**DNS Configuration:**
- DNS is managed externally in Bluehost (not using Netlify DNS)
- CNAME record exists in Bluehost: `testcreator` → `eloquent-crumble-37c09e.netlify.app`
- DNS resolution is correct (verified with nslookup.io)
- The CNAME record has been verified and is pointing correctly

**What I've Tried:**
1. Verified DNS records are correct in Bluehost
2. Removed and re-added the domain alias multiple times
3. Re-verified DNS configuration
4. Waited for DNS propagation (DNS is already propagated)
5. Cleared browser cache and tested in incognito mode

**Current Status:**
- DNS: ✅ Correct (CNAME resolves to eloquent-crumble-37c09e.netlify.app)
- Domain Alias in Netlify: Shows as "Active" but returns 404
- SSL Certificate: Appears to be provisioned

**Questions:**
1. Why does the domain alias become unlinked or stop working after deployments?
2. Is there a known issue with domain aliases when using external DNS (Bluehost) instead of Netlify DNS?
3. Is there a permanent solution to prevent this from happening after each deployment?
4. Should I be using a different approach for subdomains with external DNS?

**Additional Context:**
This is part of a creator personalization feature where each creator gets their own subdomain (e.g., `creatorname.screenmerch.com`). For this to scale, I need a reliable solution that doesn't require manual intervention after each deployment.

I've already deleted the inactive Netlify DNS zone for screenmerch.com as recommended in a previous support ticket, but the issue persists.

Could you please investigate why the domain alias keeps becoming inactive and provide a permanent solution?

Thank you for your assistance.

Best regards,
Alan Armstrong
Project: ScreenMerch

---

**Attachments/References:**
- Previous support ticket (if you have the ticket number)
- Screenshots of:
  - Domain settings showing "Active" status
  - DNS records in Bluehost
  - 404 error page
  - nslookup results showing correct DNS resolution
