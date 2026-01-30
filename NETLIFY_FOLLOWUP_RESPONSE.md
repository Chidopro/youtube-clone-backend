# Follow-up Response to Netlify Support

**Subject:** Re: Domain Alias Becomes Inactive After Deployments - Recurring Issue

---

Hello,

Thank you for the quick response and explanation!

I understand the issue now - there's an inactive Netlify DNS zone for `testcreator.screenmerch.com` that's conflicting with the external DNS configuration in Bluehost.

I've deleted the inactive DNS zone for the subdomain using the link you provided:
https://app.netlify.com/teams/chidopro/dns/testcreator.screenmerch.com#delete-dns-zone

**Current Configuration:**
- ✅ Inactive Netlify DNS zone for `testcreator.screenmerch.com` has been deleted
- ✅ External DNS in Bluehost: CNAME record `testcreator` → `eloquent-crumble-37c09e.netlify.app`
- ✅ Domain alias `testcreator.screenmerch.com` is added in Netlify domain settings

Could you please verify that the configuration is now correct and that the SSL certificate will provision properly?

Also, to prevent this issue in the future when adding more creator subdomains, should I:
1. Add the domain alias in Netlify first, then add the CNAME record in Bluehost?
2. Or add the CNAME record in Bluehost first, then add the domain alias in Netlify?
3. Is there a specific order that prevents the inactive DNS zone from being created?

Thank you for your assistance!

Best regards,
Alan Armstrong
Project: ScreenMerch
