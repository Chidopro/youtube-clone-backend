# Check Subdomain Status

## Current Issue
`testcreator.screenmerch.com` showing 404 with "Not secure" warning.

## The "Not secure" Warning

The "Not secure" warning appears because:
- SSL certificate hasn't been provisioned for the subdomain
- OR the certificate is invalid/expired
- This is a symptom, not the cause of the 404

## The 404 Error

The 404 is a routing issue - Netlify isn't routing the subdomain to your site. This happens when:
1. Domain alias is inactive or missing
2. Domain alias isn't properly linked to the site
3. Netlify's CDN hasn't updated

## Check These in Netlify

1. **Domain Management:**
   - Is `testcreator.screenmerch.com` listed?
   - What status does it show? (Active, Pending, Failed)
   - Is there a green checkmark?

2. **SSL/HTTPS Section:**
   - Look for HTTPS/SSL section in Domain management
   - Does `testcreator.screenmerch.com` show:
     - "Active" = Good
     - "Pending" = Wait a few minutes
     - "Failed" = Problem

## If Domain Alias Shows "Active" But Still 404

This means Netlify recognizes the domain but isn't routing it. Try:
1. Click Options → "Edit domain" → Save (forces refresh)
2. Wait 2-3 minutes
3. Clear browser cache
4. Try in incognito window

## If SSL Shows "Pending" or "Failed"

The SSL issue might be blocking routing. Contact Netlify support about:
- Why SSL isn't provisioning for the subdomain
- Why domain alias keeps becoming inactive
