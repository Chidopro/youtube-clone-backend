# Fix: Subdomain OAuth Redirect Issue

## Problem
When signing in via Google OAuth on a subdomain (e.g., `testcreator.screenmerch.com`), users are redirected to `screenmerch.com/dashboard` instead of staying on the subdomain.

## Root Cause
The backend OAuth callback (`/api/auth/google/callback`) hardcodes the frontend URL to `https://screenmerch.com` instead of using the `return_url` parameter.

## Location
`backend/app.py` line ~7876

## Current Code (Problematic):
```python
# Redirect to frontend with user data
frontend_url = "https://screenmerch.com"
redirect_url = f"{frontend_url}?login=success&user={user_data_encoded}"
```

## Solution
The backend needs to:
1. Store the `return_url` parameter when initiating OAuth
2. Use that stored URL in the callback to redirect back to the correct subdomain

## Frontend Workaround (Temporary)
For now, users can manually navigate back to their subdomain after OAuth redirect, or we can add a frontend check that redirects back to the subdomain if they land on the main domain after OAuth.

## Backend Fix Needed
1. In `google_login()` function: Store `return_url` in session
2. In `google_callback()` function: Use stored `return_url` instead of hardcoded URL
