# Admin Roles Setup Guide

## Overview

The admin system now supports three distinct roles:

1. **Master Admin** (`master_admin`)
   - Full access to all operations
   - Can manage other admins
   - Can approve/reject admin signup requests
   - Can change admin roles
   - Can remove admin access

2. **Full Admin** (`admin`)
   - Full access to all operations (except admin management)
   - Can manage users, videos, subscriptions, payouts
   - Can process orders

3. **Order Processing Admin** (`order_processing_admin`)
   - Limited access - can only process orders
   - Cannot manage users, videos, subscriptions, or payouts
   - Cannot access admin management

## Database Setup

### Step 1: Run SQL Migration

Run the SQL migration file in Supabase SQL Editor:

```sql
-- File: database_master_admin_roles.sql
```

This will:
- Add support for `master_admin` role
- Create `admin_signup_requests` table
- Update admin role checking functions
- Set up RLS policies

### Step 2: Set Master Admin

Set yourself as the master admin:

```sql
UPDATE users 
SET admin_role = 'master_admin', is_admin = true 
WHERE email = 'your-email@example.com';
```

### Step 3: Set Regular Admins

Set regular admins (order processing only):

```sql
UPDATE users 
SET admin_role = 'order_processing_admin', is_admin = true 
WHERE email = 'helper-admin@example.com';
```

## Admin Signup Process

### For New Admins:

1. Visit `/admin-signup` on the website
2. Enter their Google email address
3. Submit the signup request
4. Wait for master admin approval

### For Master Admin:

1. Log into the admin portal
2. Navigate to "👥 Admin Management" tab (only visible to master admin)
3. View pending signup requests
4. Approve requests by selecting the role:
   - Master Admin (full access + admin management)
   - Full Admin (full access, no admin management)
   - Order Processing Admin (order processing only)
5. After approving, go to Supabase Dashboard:
   - Authentication → Users → Add User
   - Enter the approved email
   - Set a secure password
   - Provide the password to the new admin

## Admin Management Features

The Admin Management section (master admin only) includes:

1. **Pending Signup Requests**
   - View all pending admin signup requests
   - Approve with role selection
   - Reject with optional notes

2. **All Admins List**
   - View all current admins
   - Change admin roles (except master admin)
   - Remove admin access (except master admin)

3. **Instructions**
   - Step-by-step guide for setting up new admins in Supabase

## Frontend Routes

- `/admin` - Admin portal (requires admin login)
- `/admin-signup` - Admin signup request page (public)

## Security Notes

- Only master admins can manage other admins
- Master admins cannot remove their own master admin status
- Admin signup requests are stored in `admin_signup_requests` table
- All admin actions are logged in `admin_logs` table
- RLS policies ensure only authorized users can access admin data

## API Functions

### AdminService Methods:

- `isMasterAdmin()` - Check if user is master admin
- `isFullAdmin()` - Check if user is full admin (includes master admin)
- `isOrderProcessingAdmin()` - Check if user can process orders
- `submitAdminSignupRequest(email)` - Submit signup request
- `getAdminSignupRequests()` - Get all signup requests (master admin only)
- `approveAdminSignupRequest(requestId, adminRole)` - Approve request
- `rejectAdminSignupRequest(requestId, notes)` - Reject request
- `getAllAdmins()` - Get all admins (master admin only)
- `updateAdminRole(userId, adminRole)` - Update admin role
- `removeAdminAccess(userId)` - Remove admin access

## Testing

1. Test master admin access:
   - Log in as master admin
   - Verify "Admin Management" tab is visible
   - Verify can approve/reject signup requests
   - Verify can change admin roles

2. Test regular admin access:
   - Log in as order processing admin
   - Verify "Admin Management" tab is NOT visible
   - Verify can only access order processing

3. Test signup flow:
   - Visit `/admin-signup`
   - Submit a signup request
   - Verify request appears in master admin's pending requests
   - Approve the request
   - Verify user is created in users table

